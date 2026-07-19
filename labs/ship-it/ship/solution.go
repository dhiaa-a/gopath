//go:build solution

// Reference implementation. Compiled only with -tags solution; go test
// without the tag never sees this file, so the suite always grades yours. It
// exists so the repo's CI can prove the suite and the gate are passable. Do
// not read it until your own run is green.
package ship

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"
)

// The documented defaults. They live here rather than in Config so that an
// unset variable and a zero value stay distinguishable in LoadConfig.
const (
	defaultAddr              = "127.0.0.1:8080"
	defaultShutdownTimeout   = 15 * time.Second
	defaultDrainDelay        = 5 * time.Second
	defaultReadHeaderTimeout = 5 * time.Second

	// maxWorkMillis caps /work so a stray client cannot pin a goroutine for
	// an hour, and so the sleep can never outlive the gate's patience.
	maxWorkMillis = 5000
)

// LoadConfig reads the configuration from getenv.
func LoadConfig(getenv func(string) string) (Config, error) {
	var problems []error

	// dur parses one duration variable, or records why it could not. The
	// closure exists because the three duration variables differ in exactly
	// one bit (whether zero is meaningful) and writing the same eight lines
	// three times is how the third one ends up subtly different.
	dur := func(name string, def time.Duration, allowZero bool) time.Duration {
		raw := getenv(name)
		if raw == "" {
			return def
		}
		d, err := time.ParseDuration(raw)
		if err != nil {
			// The value, not just the variable: "15" is a very common way to
			// write "15 seconds" and time.ParseDuration rejects it, so the
			// message has to show the operator what it read.
			problems = append(problems, fmt.Errorf("%s=%q: %w (durations need a unit: 15s, 500ms, 2m)", name, raw, err))
			return def
		}
		switch {
		case d < 0:
			problems = append(problems, fmt.Errorf("%s=%q: must not be negative", name, raw))
		case d == 0 && !allowZero:
			problems = append(problems, fmt.Errorf("%s=%q: must be greater than zero", name, raw))
		default:
			return d
		}
		return def
	}

	// Start from the defaults, then let the environment override them. An
	// unset variable is not an error and not a zero: it is "the default was
	// right", which is what makes a container spec that sets one variable a
	// legal container spec.
	cfg := Config{
		Addr:              defaultAddr,
		ShutdownTimeout:   defaultShutdownTimeout,
		DrainDelay:        defaultDrainDelay,
		ReadHeaderTimeout: defaultReadHeaderTimeout,
	}
	if v := getenv("SHIP_ADDR"); v != "" {
		cfg.Addr = v
	}
	cfg.ShutdownTimeout = dur("SHIP_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout, false)
	cfg.DrainDelay = dur("SHIP_DRAIN_DELAY", cfg.DrainDelay, true)
	cfg.ReadHeaderTimeout = dur("SHIP_READ_HEADER_TIMEOUT", cfg.ReadHeaderTimeout, false)

	// One error carrying every problem. The operator fixes the whole
	// environment in one round trip instead of learning about the second bad
	// variable after the redeploy that fixed the first.
	if len(problems) > 0 {
		return Config{}, errors.Join(problems...)
	}
	return cfg, nil
}

// Server is the running service: the config it was built with, the dependency
// check it has to pass before it is worth traffic, and one flag saying
// whether it is worth traffic right now.
type Server struct {
	cfg  Config
	warm func(context.Context) error

	// ready is written by Run and read by every /readyz request on its own
	// goroutine. atomic.Bool rather than bool is not caution, it is the
	// difference between defined and undefined behaviour.
	ready atomic.Bool
}

// New builds a Server from cfg.
func New(cfg Config, warm func(context.Context) error) *Server {
	return &Server{cfg: cfg, warm: warm}
}

// Handler returns the mux this server serves.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Liveness. It knows nothing, and that is the feature. The question it
	// answers is "is this process wedged, should you restart it", and the
	// only honest way to answer it is to depend on nothing that could be
	// broken somewhere else.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})

	// Readiness. The question it answers is "should traffic come here right
	// now", and there are two ways for the answer to be no: not warm yet, and
	// on the way out.
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if !s.ready.Load() {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		fmt.Fprintln(w, "ready")
	})

	mux.HandleFunc("/work", s.handleWork)
	return mux
}

// handleWork stands in for the database query or upstream call a real handler
// makes: the only property this project needs from it is that it takes time,
// because a request that is not still running when the drain starts cannot
// prove anything about the drain.
func (s *Server) handleWork(w http.ResponseWriter, r *http.Request) {
	ms := 0
	if raw := r.URL.Query().Get("ms"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 || n > maxWorkMillis {
			http.Error(w, fmt.Sprintf("ms must be an integer from 0 to %d", maxWorkMillis), http.StatusBadRequest)
			return
		}
		ms = n
	}

	// Selecting on the request context as well as the timer means a client
	// that hangs up does not leave this goroutine sleeping for the rest of the
	// duration. Note what does not cancel this context: Shutdown. It waits for
	// handlers, it does not interrupt them, which is exactly why the in-flight
	// requests in the gate complete.
	select {
	case <-time.After(time.Duration(ms) * time.Millisecond):
	case <-r.Context().Done():
		return
	}
	fmt.Fprintf(w, "worked %dms\n", ms)
}

// Run serves on ln until ctx is cancelled, then drains and shuts down.
func (s *Server) Run(ctx context.Context, ln net.Listener) error {
	srv := &http.Server{
		Handler: s.Handler(),
		// The zero value of http.Server has no timeouts. This one is free:
		// nothing legitimate takes five seconds to send its request headers.
		// WriteTimeout is the one to think about rather than copy, because it
		// is measured from the end of the request headers and would cap /work.
		ReadHeaderTimeout: s.cfg.ReadHeaderTimeout,
	}

	// The listener goes live before warm runs, not after. Exec to listening is
	// milliseconds; exec to useful is however long the slowest dependency
	// takes. Serving through that gap is what lets the probes answer 503
	// instead of refusing the connection, and those two mean different things
	// to whatever is watching.
	serveErr := make(chan error, 1)
	go func() {
		err := srv.Serve(ln)
		if errors.Is(err, http.ErrServerClosed) {
			// The success case: Shutdown or Close asked Serve to stop.
			err = nil
		}
		serveErr <- err
	}()

	warmErr := make(chan error, 1)
	go func() { warmErr <- s.warm(ctx) }()

	select {
	case err := <-serveErr:
		// The listener died before we were ever ready: the port went away, or
		// it was never ours.
		return err
	case err := <-warmErr:
		if err != nil {
			_ = srv.Close()
			return fmt.Errorf("warm dependencies: %w", err)
		}
		s.ready.Store(true)
	case <-ctx.Done():
		// Told to stop while still warming up. Drain anyway: the listener has
		// been accepting this whole time, so there may be requests in there.
		return s.drain(srv)
	}

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}
	return s.drain(srv)
}

// drain is the shutdown ordering, and it is the reason this project exists.
func (s *Server) drain(srv *http.Server) error {
	// 1. Lie first. From here on this process is not worth traffic, and the
	//    only way to say so is to start failing the readiness probe.
	s.ready.Store(false)

	// 2. Keep serving anyway. Nothing routing traffic here has noticed step 1
	//    yet: SIGTERM and endpoint removal are concurrent, and the load
	//    balancer finds out on its own schedule. Sleep is exactly right here,
	//    and it is deliberately not interruptible. A second SIGTERM is not a
	//    reason to drop the requests already on the wire.
	time.Sleep(s.cfg.DrainDelay)

	// 3. Stop accepting, and wait for what is already running.
	//
	//    Shutdown gets a fresh context with its own deadline. Handing it the
	//    ctx that asked us to stop is the classic version of this bug: that
	//    context is already cancelled, so Shutdown closes the listener,
	//    notices ctx.Err() is non-nil, and returns immediately. Run returns,
	//    main returns, the process exits, and every request still in a handler
	//    dies without a response. The bug is invisible in any test that does
	//    not have a request in flight at that exact moment.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		// 4. The deadline expired with requests still running. Close is the
		//    escape hatch: it hangs up on them. That is a bad outcome, so it
		//    is an error, so it becomes a non-zero exit code, so it is
		//    countable in whatever collects exit codes. Silently returning nil
		//    here would make a dropped-request event look like a clean deploy.
		_ = srv.Close()
		return fmt.Errorf("shutdown exceeded %s with requests still in flight: %w", s.cfg.ShutdownTimeout, err)
	}
	return nil
}
