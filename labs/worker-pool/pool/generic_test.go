// Black-box suite for the generic pool (step 08). Same contract as
// pool_test.go, checked at three different type instantiations.
//
// Read what is NOT in here. There is no second copy of TestSubmitStopRace, no
// second Stop-is-idempotent test, no second backpressure test. The concurrency
// in GenericPool is the concurrency in Pool: if you changed it while making the
// pool generic, you changed the wrong thing. What these tests check is the part
// that is actually new, which is that the contract survives instantiation at
// types that are not int.
//
// Note the shape every test here follows, which is pool_test.go's shape and is
// not optional: start draining Results BEFORE submitting. The workers send
// every result onto a buffered channel, so a test that submits 1000 jobs before
// it starts reading deadlocks the moment that buffer fills. That is not a bug
// in the pool, it is the caller obligation the README spells out.
package pool_test

import (
	"errors"
	"testing"
	"time"

	"gopath.dev/labs/worker-pool/pool"
)

// collectGeneric starts draining ch into a slice and returns a channel that
// delivers the slice once ch closes. Call it before you submit anything.
func collectGeneric[Out any](t *testing.T, ch <-chan pool.GenericResult[Out]) <-chan []pool.GenericResult[Out] {
	t.Helper()
	if ch == nil {
		t.Fatal("Results() returned a nil channel; implement Results first")
	}
	out := make(chan []pool.GenericResult[Out], 1)
	go func() {
		var rs []pool.GenericResult[Out]
		for r := range ch {
			rs = append(rs, r)
		}
		out <- rs
	}()
	return out
}

// waitGenericResults waits for the collector to see the results channel close.
func waitGenericResults[Out any](t *testing.T, out <-chan []pool.GenericResult[Out]) []pool.GenericResult[Out] {
	t.Helper()
	select {
	case rs := <-out:
		return rs
	case <-time.After(waitTimeout):
		t.Fatalf("results channel still open %v after Stop; the pool must close it once every worker has exited", waitTimeout)
		return nil
	}
}

// stopGenericOrFatal calls p.Stop and fails the test if it does not return in
// time. Call it from the test goroutine: t.Fatalf may only be called there.
func stopGenericOrFatal[In, Out any](t *testing.T, p *pool.GenericPool[In, Out]) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		p.Stop()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(waitTimeout):
		t.Fatalf("Stop did not return within %v; Stop or a worker is blocked forever", waitTimeout)
	}
}

// TestGenericIntToInt is the instantiation the gate benchmarks: the same
// exactly-once delivery check as TestAllJobsProcessedExactlyOnce, with the
// type assertion gone from the worker fn.
func TestGenericIntToInt(t *testing.T) {
	const jobs = 1000
	p := pool.NewGeneric[int, int](8, 16, func(j pool.GenericJob[int]) pool.GenericResult[int] {
		// No j.Payload.(int) here. That is the whole point: Payload is
		// already an int, checked when this file compiled.
		return pool.GenericResult[int]{JobID: j.ID, Output: j.Payload * 2}
	})
	out := collectGeneric(t, p.Results())
	for i := 0; i < jobs; i++ {
		if err := p.Submit(pool.GenericJob[int]{ID: i, Payload: i}); err != nil {
			t.Fatalf("Submit(%d) before Stop: unexpected error: %v", i, err)
		}
	}
	stopGenericOrFatal(t, p)
	rs := waitGenericResults(t, out)
	if len(rs) != jobs {
		t.Fatalf("delivered %d results for %d submitted jobs; accepted jobs must never be dropped", len(rs), jobs)
	}
	seen := make(map[int]bool, jobs)
	for _, r := range rs {
		if seen[r.JobID] {
			t.Fatalf("job %d delivered more than once", r.JobID)
		}
		seen[r.JobID] = true
		if r.Output != r.JobID*2 {
			t.Fatalf("job %d: Output = %d, want %d; the Result the worker fn returns must be delivered unaltered", r.JobID, r.Output, r.JobID*2)
		}
	}
}

// TestGenericStringToInt instantiates In and Out at different types, which is
// why the pool takes two type parameters instead of one. A single-parameter
// Pool[T] would force every worker fn to return what it was given.
func TestGenericStringToInt(t *testing.T) {
	words := []string{"a", "bb", "ccc", "dddd", "eeeee"}
	p := pool.NewGeneric[string, int](4, 8, func(j pool.GenericJob[string]) pool.GenericResult[int] {
		return pool.GenericResult[int]{JobID: j.ID, Output: len(j.Payload)}
	})
	out := collectGeneric(t, p.Results())
	for i, w := range words {
		if err := p.Submit(pool.GenericJob[string]{ID: i, Payload: w}); err != nil {
			t.Fatalf("Submit(%d): %v", i, err)
		}
	}
	stopGenericOrFatal(t, p)
	rs := waitGenericResults(t, out)
	if len(rs) != len(words) {
		t.Fatalf("delivered %d results for %d jobs", len(rs), len(words))
	}
	for _, r := range rs {
		if want := len(words[r.JobID]); r.Output != want {
			t.Fatalf("job %d (%q): Output = %d, want %d", r.JobID, words[r.JobID], r.Output, want)
		}
	}
}

// TestGenericStructPayload instantiates In at a struct type, the case that
// matters most in real code and the one boxing punishes hardest: a struct
// payload behind `any` costs a heap allocation the size of the struct.
func TestGenericStructPayload(t *testing.T) {
	type req struct {
		URL   string
		Retry int
	}
	const jobs = 50
	p := pool.NewGeneric[req, string](4, 8, func(j pool.GenericJob[req]) pool.GenericResult[string] {
		if j.Payload.Retry > 2 {
			return pool.GenericResult[string]{JobID: j.ID, Err: errors.New("too many retries")}
		}
		return pool.GenericResult[string]{JobID: j.ID, Output: j.Payload.URL}
	})
	out := collectGeneric(t, p.Results())
	for i := 0; i < jobs; i++ {
		j := pool.GenericJob[req]{ID: i, Payload: req{URL: "https://example.test", Retry: i % 5}}
		if err := p.Submit(j); err != nil {
			t.Fatalf("Submit(%d): %v", i, err)
		}
	}
	stopGenericOrFatal(t, p)
	rs := waitGenericResults(t, out)
	if len(rs) != jobs {
		t.Fatalf("delivered %d results for %d jobs", len(rs), jobs)
	}
	var failed int
	for _, r := range rs {
		if r.JobID%5 > 2 {
			failed++
			if r.Err == nil {
				t.Fatalf("job %d: want an error result, got Output %q; error results are results, they do not vanish", r.JobID, r.Output)
			}
			continue
		}
		if r.Err != nil {
			t.Fatalf("job %d: unexpected Err: %v", r.JobID, r.Err)
		}
		if r.Output != "https://example.test" {
			t.Fatalf("job %d: Output = %q", r.JobID, r.Output)
		}
	}
	if want := jobs * 2 / 5; failed != want {
		t.Fatalf("got %d error results, want %d", failed, want)
	}
}

// TestGenericSubmitAfterStopReturnsError pins the one piece of the shutdown
// contract worth rechecking generically: Submit's error path still exists after
// the types changed. Everything else about Stop is Pool's suite's job.
func TestGenericSubmitAfterStopReturnsError(t *testing.T) {
	p := pool.NewGeneric[int, int](2, 4, func(j pool.GenericJob[int]) pool.GenericResult[int] {
		return pool.GenericResult[int]{JobID: j.ID, Output: j.Payload}
	})
	stopGenericOrFatal(t, p)
	if err := p.Submit(pool.GenericJob[int]{ID: 1, Payload: 1}); err == nil {
		t.Fatal("Submit after Stop returned nil; it must return an error, and it must not panic")
	}
}
