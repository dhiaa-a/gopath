//go:build gate

// The gate: the machine check this project is graded on, and the only place
// the numbers live.
//
//	go test -tags gate -run TestGate ./...
//
// Every number here is measured against the server's own configured budget,
// never against a guess about how fast your machine is. The drop rate is a
// count. The drain window is compared to the drain delay this same Config
// asked for. The shutdown deadline is compared to the shutdown timeout this
// same Config asked for. All three hold on a laptop, in CI, and on a loaded
// machine, because both sides of every comparison move together.
//
// -race adds nothing here. The race this project can produce, an unguarded
// readiness flag, is caught by `go test -race ./...` on the suite, where Run
// writes the flag while a /readyz handler goroutine reads it.
package ship_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"strings"
	"sync"
	"testing"
	"time"

	"gopath.dev/labs/ship-it/ship"
)

const (
	// gateInFlight is how many requests are running when the drain starts.
	// This is not a stress test: it is just enough concurrency that a
	// shutdown path which drops "only some" requests cannot get lucky.
	gateInFlight = 64

	// gateWorkMillis has to outlast gateDrainDelay, or every request would
	// finish before Shutdown was ever called and the harness would prove
	// nothing about Shutdown.
	gateWorkMillis = 1500

	// gateDrainDelay is short for the same reason testConfig's is: the
	// ordering it produces at 200ms is the ordering it produces at 5s.
	gateDrainDelay = 200 * time.Millisecond

	// gateWindowDrainDelay is deliberately long. TestGateReadinessLeadsTheListener
	// measures the window between "readiness says no" and "the listener says
	// no", and a window worth measuring has to be bigger than the poll doing
	// the measuring.
	gateWindowDrainDelay = 2 * time.Second

	// gateDropBudget, in percent. There is no acceptable number of requests
	// to drop on a deploy you chose the timing of.
	gateDropBudget = 0.0
)

func gateConfig(drainDelay, shutdownTimeout time.Duration) ship.Config {
	return ship.Config{
		Addr:              "127.0.0.1:0",
		DrainDelay:        drainDelay,
		ShutdownTimeout:   shutdownTimeout,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

// runResult is Run's answer and the moment it gave it. The moment matters:
// Run returning is the promise that main may now return, and main returning
// is the process exiting.
type runResult struct {
	err error
	at  time.Time
}

// launch starts srv on a fresh loopback listener and waits until it reports
// ready.
func launch(t *testing.T, srv *ship.Server) (base string, stop context.CancelFunc, done <-chan runResult) {
	t.Helper()
	ln := mustListen(t)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	results := make(chan runResult, 1)
	go func() {
		err := srv.Run(ctx, ln)
		results <- runResult{err: err, at: time.Now()}
	}()

	base = "http://" + ln.Addr().String()
	waitFor(t, "the server to report ready on /readyz", func() bool {
		return status(base+"/readyz") == http.StatusOK
	})
	return base, cancel, results
}

// ─── the headline metric ────────────────────────────────────────────────────

// outcome is what happened to one of the in-flight requests.
type outcome struct {
	problem string        // non-empty means it never got a whole answer
	took    time.Duration // how long the request took end to end
	replied time.Time     // when the client had the whole body
}

// TestGateZeroDroppedOnDrain is the exam. It puts gateInFlight requests in
// flight, asks the process to stop while every one of them is still running,
// and counts how many never got a whole response.
//
// The answer has to be zero. A deploy is a shutdown you chose the timing of,
// and there is no rate of dropped requests that is acceptable for something
// you scheduled.
func TestGateZeroDroppedOnDrain(t *testing.T) {
	// The shutdown timeout has to outlast the work in flight, or this would
	// be measuring the deadline instead of the drain. The deadline gets its
	// own test below.
	cfg := gateConfig(gateDrainDelay, 30*time.Second)
	base, stop, done := launch(t, ship.New(cfg, warmOK))

	// One connection per in-flight request. With keep-alives the transport
	// would happily push 64 requests down a handful of reused connections,
	// one after another, and only a few would be running when the drain
	// started.
	client := &http.Client{
		Timeout:   60 * time.Second,
		Transport: &http.Transport{DisableKeepAlives: true},
	}
	url := fmt.Sprintf("%s/work?ms=%d", base, gateWorkMillis)

	var onTheWire, finished sync.WaitGroup
	onTheWire.Add(gateInFlight)
	finished.Add(gateInFlight)
	results := make(chan outcome, gateInFlight)

	for i := 0; i < gateInFlight; i++ {
		go func(i int) {
			defer finished.Done()

			// httptrace's WroteRequest fires once the request bytes have left
			// the client, so when all 64 have fired the server has all 64
			// requests. That is a fact about this run, not a sleep long enough
			// to probably be true on this machine.
			var once sync.Once
			release := func() { once.Do(onTheWire.Done) }
			defer release()

			trace := &httptrace.ClientTrace{
				WroteRequest: func(httptrace.WroteRequestInfo) { release() },
			}
			req, err := http.NewRequestWithContext(
				httptrace.WithClientTrace(context.Background(), trace),
				http.MethodGet, url, nil)
			if err != nil {
				results <- outcome{problem: fmt.Sprintf("request %d: %v", i, err)}
				return
			}

			began := time.Now()
			resp, err := client.Do(req)
			if err != nil {
				results <- outcome{problem: fmt.Sprintf("request %d: %v", i, err)}
				return
			}
			defer resp.Body.Close()

			body, err := io.ReadAll(resp.Body)
			switch {
			case err != nil:
				results <- outcome{problem: fmt.Sprintf("request %d: response cut off after %d bytes: %v", i, len(body), err)}
			case resp.StatusCode != http.StatusOK:
				results <- outcome{problem: fmt.Sprintf("request %d: status %d, want 200", i, resp.StatusCode)}
			default:
				results <- outcome{took: time.Since(began), replied: time.Now()}
			}
		}(i)
	}

	// Every request is on the wire. This is the SIGTERM.
	onTheWire.Wait()
	stoppedAt := time.Now()
	stop()

	finished.Wait()
	close(results)

	var (
		problems  []string
		fastest   = time.Duration(-1)
		lastReply time.Time
	)
	for o := range results {
		if o.problem != "" {
			problems = append(problems, o.problem)
			continue
		}
		if fastest < 0 || o.took < fastest {
			fastest = o.took
		}
		if o.replied.After(lastReply) {
			lastReply = o.replied
		}
	}

	var run runResult
	select {
	case run = <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("Run never returned after the drain, 30s after the stop was asked for. Shutdown blocks until every connection is idle or its context is done: give it a context with a deadline.")
	}

	dropped := len(problems)
	dropRate := float64(dropped) / float64(gateInFlight) * 100
	t.Logf("drain harness: %d in flight at the stop, %d completed, %d dropped, drop rate %.2f%% (budget %.2f%%)",
		gateInFlight, gateInFlight-dropped, dropped, dropRate, gateDropBudget)
	t.Logf("               drain delay %s, work %dms, Run returned %s after the stop",
		cfg.DrainDelay, gateWorkMillis, run.at.Sub(stoppedAt).Round(time.Millisecond))

	if dropRate > gateDropBudget {
		shown := problems
		if len(shown) > 3 {
			shown = shown[:3]
		}
		t.Errorf(`gate failed: %d of %d in-flight requests never got a whole response (drop rate %.2f%%, budget %.2f%%).
  %s
Three ways to produce this, in the order they are worth checking:
  1. Close instead of Shutdown. Close hangs up on live connections; Shutdown waits for them.
  2. Shutdown handed the context that asked you to stop. That context is already cancelled, so Shutdown closes the listener, returns ctx.Err() without waiting for anything, and the process exits on top of the requests it accepted. Shutdown needs its own context, with its own deadline.
  3. The listener closed before the drain delay elapsed. A connection that has arrived but has not been accepted yet dies with the listener, and the client never even gets a refusal it could retry.`,
			dropped, gateInFlight, dropRate, gateDropBudget, strings.Join(shown, "\n  "))
	}

	// Guard against a vacuous pass. Nothing above means anything unless the
	// requests were genuinely still running when Shutdown was called.
	if fastest >= 0 && fastest < gateWorkMillis*8/10*time.Millisecond {
		t.Fatalf("gate failed: the quickest /work?ms=%d request came back in %s, so nothing was in flight and this harness proved nothing. /work has to sleep for the time it is given.",
			gateWorkMillis, fastest.Round(time.Millisecond))
	}

	// Run returning is the promise that it is safe for main to return, and
	// main returning is the process exiting. If Run returns while a request it
	// accepted is still running, the real binary drops that request, even
	// though nothing in this test process died to show it.
	//
	// The 100ms is the client's read scheduling, not slack: the response bytes
	// sit in the client's socket buffer before Shutdown can observe the
	// connection go idle, so a few milliseconds of overlap is normal. The bug
	// this catches is off by more than a second.
	if !lastReply.IsZero() {
		if early := lastReply.Sub(run.at); early > 100*time.Millisecond {
			t.Errorf("gate failed: Run returned %s before the last in-flight request got its response. In the binary, main would have returned there and the process would have exited on top of it. Run must not return until Shutdown says the work is done.",
				early.Round(time.Millisecond))
		}
	}

	if run.err != nil {
		t.Errorf("gate failed: Run returned %v. Every request finished well inside the %s shutdown timeout, so this drain was clean, and a clean drain returns nil.", run.err, cfg.ShutdownTimeout)
	}
}

// ─── the ordering that makes the metric possible ────────────────────────────

// TestGateReadinessLeadsTheListener measures the window between the two
// events that a naive shutdown collapses into one: readiness starting to say
// no, and the listener stopping accepting.
//
// The window has to exist, because SIGTERM and your removal from the load
// balancer's pool are concurrent events with no ordering between them. The
// signal does not mean traffic has stopped. It means traffic is about to stop,
// eventually, once something else notices, and until then requests keep
// arriving at a process that has been told to die.
func TestGateReadinessLeadsTheListener(t *testing.T) {
	cfg := gateConfig(gateWindowDrainDelay, 10*time.Second)
	base, stop, done := launch(t, ship.New(cfg, warmOK))

	t0 := time.Now()
	stop()

	// Poll both facts until the listener goes away. `probe` never reuses a
	// connection, so every one of these requests is a real accept: that is
	// what makes "the listener is still open" an observation rather than an
	// assumption.
	var (
		readyzAt  time.Duration
		sawReadyz bool
		refusedAt time.Duration
	)
	budget := cfg.DrainDelay + cfg.ShutdownTimeout + 5*time.Second
	for {
		if !sawReadyz && status(base+"/readyz") == http.StatusServiceUnavailable {
			readyzAt, sawReadyz = time.Since(t0), true
		}
		if status(base+"/healthz") == -1 {
			refusedAt = time.Since(t0)
			break
		}
		if time.Since(t0) > budget {
			t.Fatalf("gate failed: the listener was still accepting %s after the stop was asked for. The drain delay is %s and the shutdown timeout is %s, so it should have been gone long before now.",
				time.Since(t0).Round(time.Millisecond), cfg.DrainDelay, cfg.ShutdownTimeout)
		}
		time.Sleep(5 * time.Millisecond)
	}

	if !sawReadyz {
		t.Fatalf("gate failed: the listener stopped accepting %s after the stop was asked for, and /readyz never returned 503 at any point before that. Nothing routing traffic to this process was ever told to stop. Flip readiness first, then wait, then shut down.",
			refusedAt.Round(time.Millisecond))
	}

	window := refusedAt - readyzAt
	t.Logf("drain window: /readyz went 503 at +%s, the listener stopped accepting at +%s, window %s (configured drain delay %s, floor %s)",
		readyzAt.Round(time.Millisecond), refusedAt.Round(time.Millisecond),
		window.Round(time.Millisecond), cfg.DrainDelay, cfg.DrainDelay/2)

	if window < cfg.DrainDelay/2 {
		t.Errorf("gate failed: readiness led the listener by %s, and the floor is %s (half the %s this Config asked for). The delay is the only window the load balancer has to notice you are going away; without it, every request it sends between the signal and its next probe hits a closed port.",
			window.Round(time.Millisecond), (cfg.DrainDelay / 2).Round(time.Millisecond), cfg.DrainDelay)
	}

	if err := (<-done).err; err != nil {
		t.Errorf("Run with nothing in flight returned %v, want nil", err)
	}
}

// ─── the escape hatch ───────────────────────────────────────────────────────

// TestGateShutdownDeadlineIsReal puts one request in flight that cannot
// possibly finish inside the shutdown budget, and holds the process to that
// budget anyway.
//
// Waiting for in-flight work is the right default and an unbounded wait is
// not a wait, it is a hang. The orchestrator has its own timer
// (terminationGracePeriodSeconds), and when it expires the process is killed
// by the kernel with no drain at all. Blowing your own deadline and hanging up
// is bad. Blowing the orchestrator's is worse and takes everything still in
// flight with it.
func TestGateShutdownDeadlineIsReal(t *testing.T) {
	cfg := gateConfig(50*time.Millisecond, 300*time.Millisecond)
	base, stop, done := launch(t, ship.New(cfg, warmOK))

	// 5000ms of work against a 300ms budget. This one is not going to make it,
	// and that is the point: the question is whether the process knows.
	onTheWire := make(chan struct{})
	go func() {
		var once sync.Once
		release := func() { once.Do(func() { close(onTheWire) }) }
		defer release()

		trace := &httptrace.ClientTrace{
			WroteRequest: func(httptrace.WroteRequestInfo) { release() },
		}
		req, err := http.NewRequestWithContext(
			httptrace.WithClientTrace(context.Background(), trace),
			http.MethodGet, base+"/work?ms=5000", nil)
		if err != nil {
			return
		}
		client := &http.Client{Timeout: 30 * time.Second, Transport: &http.Transport{DisableKeepAlives: true}}
		resp, err := client.Do(req)
		if err != nil {
			// Expected: this is the request the deadline hangs up on.
			return
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()
	<-onTheWire

	t0 := time.Now()
	stop()

	budget := cfg.DrainDelay + cfg.ShutdownTimeout + 2*time.Second
	select {
	case run := <-done:
		took := time.Since(t0)
		t.Logf("shutdown deadline: Run returned after %s carrying %v (drain delay %s + shutdown timeout %s = %s, plus %s of slack)",
			took.Round(time.Millisecond), run.err, cfg.DrainDelay, cfg.ShutdownTimeout,
			cfg.DrainDelay+cfg.ShutdownTimeout, 2*time.Second)

		if run.err == nil {
			t.Error("gate failed: Run returned nil after hanging up on a request that was still running. A drain that blew its deadline is not a clean drain, and it has to reach the exit code: otherwise a deploy that dropped traffic looks exactly like one that did not.")
		}
		if took > budget {
			t.Errorf("gate failed: Run took %s to return against a configured budget of %s + %s.", took.Round(time.Millisecond), cfg.DrainDelay, cfg.ShutdownTimeout)
		}
	case <-time.After(budget):
		t.Fatalf("gate failed: Run had not returned %s after the stop, with a drain delay of %s and a shutdown timeout of %s. Shutdown blocks until every connection is idle or its context is done, so Shutdown(context.Background()) waits exactly as long as the slowest handler feels like taking, and the orchestrator's grace period runs out instead of yours.",
			budget, cfg.DrainDelay, cfg.ShutdownTimeout)
	}
}
