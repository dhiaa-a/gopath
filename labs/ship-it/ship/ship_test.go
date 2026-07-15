// The suite for the ship package. It is black-box (package ship_test): it
// imports the package the way main.go does and only touches the exported API,
// so the shape of your internals is your business.
//
//	go test ./...
//
// This suite is correctness. It says nothing about the drain, which is the
// part with the numbers on it: that is the gate, in gate_test.go, behind the
// `gate` build tag.
package ship_test

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gopath.dev/labs/ship-it/ship"
)

// ─── helpers ────────────────────────────────────────────────────────────────

// env turns a map into the getenv function LoadConfig takes, and is the whole
// payoff of that parameter: no t.Setenv, no process-global state to put back,
// no ordering between tests.
func env(m map[string]string) func(string) string {
	return func(key string) string { return m[key] }
}

// probe never reuses a connection, so every request it makes is a fresh
// accept. That is the difference between "the server answered" and "the
// listener is still open", and the drain gate cares about the second one.
var probe = &http.Client{
	Timeout:   5 * time.Second,
	Transport: &http.Transport{DisableKeepAlives: true},
}

// status returns the response status, or -1 when there was no response at all.
func status(url string) int {
	resp, err := probe.Get(url)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode
}

// testConfig has production's shape and none of its patience. The drain
// ordering is identical at 20ms and at 5s; the tests are not here to wait.
func testConfig() ship.Config {
	return ship.Config{
		Addr:              "127.0.0.1:0",
		ShutdownTimeout:   5 * time.Second,
		DrainDelay:        20 * time.Millisecond,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

// warmOK is the dependency check of a service that has no dependencies.
func warmOK(context.Context) error { return nil }

func mustListen(t *testing.T) net.Listener {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on 127.0.0.1:0: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	return ln
}

// start runs srv on a fresh loopback listener and hands back its base URL, the
// cancel that asks it to drain, and the channel Run's error will arrive on.
func start(t *testing.T, srv *ship.Server) (string, context.CancelFunc, <-chan error) {
	t.Helper()
	ln := mustListen(t)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	errc := make(chan error, 1)
	go func() { errc <- srv.Run(ctx, ln) }()
	return "http://" + ln.Addr().String(), cancel, errc
}

// waitFor polls cond until it holds. Every wait in this suite has a deadline
// and a sentence naming what never happened: a stub that returns nil from Run
// should fail with a message you can act on, not by hanging until the test
// binary panics ten minutes later.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("timed out after 5s waiting for %s", what)
}

// waitRun waits for Run to return and gives back whatever it returned.
func waitRun(t *testing.T, runErr <-chan error, budget time.Duration) error {
	t.Helper()
	select {
	case err := <-runErr:
		return err
	case <-time.After(budget):
		t.Fatalf("Run had not returned %s after it was asked to stop", budget)
		return nil
	}
}

// ─── LoadConfig ─────────────────────────────────────────────────────────────

func TestLoadConfigDefaults(t *testing.T) {
	cfg, err := ship.LoadConfig(env(nil))
	if err != nil {
		t.Fatalf("LoadConfig with an empty environment returned %v; every variable has a default, so an empty environment is a valid one", err)
	}
	want := ship.Config{
		Addr:              "127.0.0.1:8080",
		ShutdownTimeout:   15 * time.Second,
		DrainDelay:        5 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}
	if cfg != want {
		t.Errorf("defaults:\n got %+v\nwant %+v", cfg, want)
	}
}

func TestLoadConfigReadsTheEnvironment(t *testing.T) {
	cfg, err := ship.LoadConfig(env(map[string]string{
		"SHIP_ADDR":                ":8080",
		"SHIP_SHUTDOWN_TIMEOUT":    "25s",
		"SHIP_DRAIN_DELAY":         "1500ms",
		"SHIP_READ_HEADER_TIMEOUT": "2s",
	}))
	if err != nil {
		t.Fatalf("LoadConfig with a valid environment: %v", err)
	}
	want := ship.Config{
		Addr:              ":8080",
		ShutdownTimeout:   25 * time.Second,
		DrainDelay:        1500 * time.Millisecond,
		ReadHeaderTimeout: 2 * time.Second,
	}
	if cfg != want {
		t.Errorf("from the environment:\n got %+v\nwant %+v", cfg, want)
	}
}

// A zero drain delay is legal: it is what you set when nothing is load
// balancing you and there is no one to tell.
func TestLoadConfigAllowsAZeroDrainDelay(t *testing.T) {
	cfg, err := ship.LoadConfig(env(map[string]string{"SHIP_DRAIN_DELAY": "0s"}))
	if err != nil {
		t.Fatalf("SHIP_DRAIN_DELAY=0s: %v; zero is a meaningful drain delay, unlike a zero shutdown timeout", err)
	}
	if cfg.DrainDelay != 0 {
		t.Errorf("SHIP_DRAIN_DELAY=0s gave DrainDelay %s, want 0s", cfg.DrainDelay)
	}
}

func TestLoadConfigRejectsBadValues(t *testing.T) {
	tests := []struct {
		name string
		env  map[string]string
		// The error has to name the variable and show the value. "invalid
		// duration" alone is useless in a crash loop log at 3am.
		wantIn []string
	}{
		{
			name:   "duration with no unit",
			env:    map[string]string{"SHIP_SHUTDOWN_TIMEOUT": "15"},
			wantIn: []string{"SHIP_SHUTDOWN_TIMEOUT", "15"},
		},
		{
			name:   "not a duration at all",
			env:    map[string]string{"SHIP_READ_HEADER_TIMEOUT": "soon"},
			wantIn: []string{"SHIP_READ_HEADER_TIMEOUT", "soon"},
		},
		{
			name:   "negative drain delay",
			env:    map[string]string{"SHIP_DRAIN_DELAY": "-1s"},
			wantIn: []string{"SHIP_DRAIN_DELAY", "-1s"},
		},
		{
			name:   "zero shutdown timeout",
			env:    map[string]string{"SHIP_SHUTDOWN_TIMEOUT": "0s"},
			wantIn: []string{"SHIP_SHUTDOWN_TIMEOUT", "0s"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ship.LoadConfig(env(tc.env))
			if err == nil {
				t.Fatalf("LoadConfig(%v) returned no error; a value the process cannot use must stop it at startup, not surprise it later", tc.env)
			}
			for _, want := range tc.wantIn {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not mention %q", err, want)
				}
			}
		})
	}
}

// Two bad variables should cost the operator one redeploy, not two.
func TestLoadConfigReportsEveryProblemAtOnce(t *testing.T) {
	_, err := ship.LoadConfig(env(map[string]string{
		"SHIP_SHUTDOWN_TIMEOUT": "15",
		"SHIP_DRAIN_DELAY":      "-1s",
	}))
	if err == nil {
		t.Fatal("LoadConfig with two bad variables returned no error")
	}
	for _, want := range []string{"SHIP_SHUTDOWN_TIMEOUT", "SHIP_DRAIN_DELAY"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q; collect the problems and errors.Join them rather than returning at the first one", err, want)
		}
	}
}

// ─── the routes ─────────────────────────────────────────────────────────────

// This Server has never been Run, so warm has not even been called: it is as
// un-ready as a process gets. Liveness must still answer, because liveness is
// not about readiness. A /healthz that goes red when a dependency goes red
// converts one sick dependency into an orchestrator restarting every replica
// you have.
func TestHealthzAnswersRegardlessOfReadiness(t *testing.T) {
	ts := httptest.NewServer(ship.New(testConfig(), warmOK).Handler())
	defer ts.Close()

	if got := status(ts.URL + "/healthz"); got != http.StatusOK {
		t.Errorf("/healthz on a server that is not ready = %d, want 200: liveness must not depend on anything", got)
	}
}

func TestReadyzIsUnavailableBeforeWarm(t *testing.T) {
	ts := httptest.NewServer(ship.New(testConfig(), warmOK).Handler())
	defer ts.Close()

	if got := status(ts.URL + "/readyz"); got != http.StatusServiceUnavailable {
		t.Errorf("/readyz before warm has run = %d, want 503: the process exists but is not worth traffic yet", got)
	}
}

func TestWorkTakesTheTimeItWasAsked(t *testing.T) {
	ts := httptest.NewServer(ship.New(testConfig(), warmOK).Handler())
	defer ts.Close()

	start := time.Now()
	got := status(ts.URL + "/work?ms=150")
	elapsed := time.Since(start)

	if got != http.StatusOK {
		t.Fatalf("/work?ms=150 = %d, want 200", got)
	}
	if elapsed < 150*time.Millisecond {
		t.Errorf("/work?ms=150 came back in %s; it has to sleep for the time it was given. The drain gate needs requests that are genuinely still running when Shutdown is called, and a handler that returns instantly makes that gate prove nothing", elapsed)
	}
}

func TestWorkRejectsADurationItCannotUse(t *testing.T) {
	ts := httptest.NewServer(ship.New(testConfig(), warmOK).Handler())
	defer ts.Close()

	for _, ms := range []string{"abc", "-1", "5001"} {
		if got := status(ts.URL + "/work?ms=" + ms); got != http.StatusBadRequest {
			t.Errorf("/work?ms=%s = %d, want 400", ms, got)
		}
	}
}

// ─── the lifecycle ──────────────────────────────────────────────────────────

// The shape of a real start-up: the port is open in milliseconds, the
// dependencies are not, and the gap between the two is what readiness exists
// to describe.
func TestReadyzWaitsForWarm(t *testing.T) {
	release := make(chan struct{})
	srv := ship.New(testConfig(), func(ctx context.Context) error {
		select {
		case <-release:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
	base, cancel, runErr := start(t, srv)

	// The listener has to be live while warm is still blocked. An orchestrator
	// needs an answer from the probes during start-up; a refused connection is
	// not an answer.
	waitFor(t, "the listener to come up while warm is still running", func() bool {
		return status(base+"/healthz") == http.StatusOK
	})
	if got := status(base + "/readyz"); got != http.StatusServiceUnavailable {
		t.Fatalf("/readyz while warm is still running = %d, want 503", got)
	}

	close(release)
	waitFor(t, "/readyz to turn 200 once warm returned nil", func() bool {
		return status(base+"/readyz") == http.StatusOK
	})

	// /healthz never moved through any of that.
	if got := status(base + "/healthz"); got != http.StatusOK {
		t.Errorf("/healthz after warm = %d, want 200", got)
	}

	cancel()
	if err := waitRun(t, runErr, 5*time.Second); err != nil {
		t.Errorf("Run after a clean cancel = %v, want nil", err)
	}
}

// A dependency that is never coming is a startup failure, not a service that
// sits at 503 forever pretending it might recover. Exit non-zero and let the
// supervisor decide whether to try again.
func TestRunReportsAWarmFailure(t *testing.T) {
	boom := errors.New("database is not there")
	srv := ship.New(testConfig(), func(context.Context) error { return boom })
	base, _, runErr := start(t, srv)

	err := waitRun(t, runErr, 5*time.Second)
	if !errors.Is(err, boom) {
		t.Fatalf("Run when warm fails = %v, want an error wrapping %q. Wrap it with %%w: the caller needs the cause, not a sentence about it", err, boom)
	}
	if got := status(base + "/healthz"); got != -1 {
		t.Errorf("/healthz after warm failed = %d, want no answer at all: Run must stop the server before it returns, or main exits and leaves the listener to the garbage collector", got)
	}
}

// Nothing legitimate takes five seconds to send its request headers. A client
// that opens a connection and sends nothing is holding a goroutine and a file
// descriptor, and it costs the client nothing to hold ten thousand more: that
// is the entire Slowloris technique. http.Server's zero value lets it.
func TestReadHeaderTimeoutHangsUpOnASilentClient(t *testing.T) {
	cfg := testConfig()
	cfg.ReadHeaderTimeout = 200 * time.Millisecond
	srv := ship.New(cfg, warmOK)

	ln := mustListen(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runErr := make(chan error, 1)
	go func() { runErr <- srv.Run(ctx, ln) }()
	base := "http://" + ln.Addr().String()
	waitFor(t, "the server to come up", func() bool { return status(base+"/healthz") == http.StatusOK })

	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Say nothing at all, and see who blinks first.
	if err := conn.SetReadDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	_, err = conn.Read(make([]byte, 1))

	var netErr net.Error
	switch {
	case err == nil:
		t.Fatal("the server sent bytes to a client that had not sent a request")
	case errors.As(err, &netErr) && netErr.Timeout():
		t.Fatalf("the connection was still open 3s after a client opened it and sent nothing. Set ReadHeaderTimeout on your http.Server from cfg.ReadHeaderTimeout (%s here) and the server hangs up on its own", cfg.ReadHeaderTimeout)
	}
	// Anything else is the server closing the connection, which is the point.
}
