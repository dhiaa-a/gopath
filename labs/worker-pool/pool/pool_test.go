// Black-box suite for the worker pool. It lives in package pool_test and
// exercises only the exported API: how you structure the inside is your
// call, the contract is not.
//
// Run it with the race detector on:
//
//	go test -race ./...
//
// Every wait in here has a deadline, so a pool that leaks a blocked
// goroutine fails fast with a named guarantee instead of hanging the run.
package pool_test

import (
	"errors"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gopath.dev/labs/worker-pool/pool"
)

// waitTimeout is how long any single delivery or shutdown step may take.
// The reference finishes each test in milliseconds; the margin is for
// loaded CI machines, not for the pool.
const waitTimeout = 5 * time.Second

// collect starts draining p.Results into a slice and returns a channel that
// delivers the slice once the results channel closes.
func collect(t *testing.T, p *pool.Pool) <-chan []pool.Result {
	t.Helper()
	ch := p.Results()
	if ch == nil {
		t.Fatal("Results() returned a nil channel; implement Results first")
	}
	out := make(chan []pool.Result, 1)
	go func() {
		var rs []pool.Result
		for r := range ch {
			rs = append(rs, r)
		}
		out <- rs
	}()
	return out
}

// stopOrFatal calls p.Stop and fails the test if it does not return in time.
func stopOrFatal(t *testing.T, p *pool.Pool) {
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

// waitResults waits for the collector started by collect to see the results
// channel close.
func waitResults(t *testing.T, out <-chan []pool.Result) []pool.Result {
	t.Helper()
	select {
	case rs := <-out:
		return rs
	case <-time.After(waitTimeout):
		t.Fatalf("results channel still open %v after Stop; the pool must close it once every worker has exited", waitTimeout)
		return nil
	}
}

// waitWG fails the test if the group is still blocked after the deadline.
func waitWG(t *testing.T, wg *sync.WaitGroup, what string) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(waitTimeout):
		t.Fatalf("%s still blocked after %v; Submit must not block forever while the workers are alive", what, waitTimeout)
	}
}

// TestAllJobsProcessedExactlyOnce pushes more jobs than workers plus buffer
// can hold, so Submit has to exercise backpressure, then checks that every
// job came back exactly once with the worker fn's Result unaltered.
func TestAllJobsProcessedExactlyOnce(t *testing.T) {
	const jobs = 1000
	p := pool.New(8, 16, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID, Output: j.Payload.(int) * 2}
	})
	out := collect(t, p)
	for i := 0; i < jobs; i++ {
		if err := p.Submit(pool.Job{ID: i, Payload: i}); err != nil {
			t.Fatalf("Submit(%d) before Stop: unexpected error: %v", i, err)
		}
	}
	stopOrFatal(t, p)
	rs := waitResults(t, out)
	if len(rs) != jobs {
		t.Fatalf("delivered %d results for %d submitted jobs; accepted jobs must never be dropped", len(rs), jobs)
	}
	seen := make(map[int]bool, jobs)
	for _, r := range rs {
		if seen[r.JobID] {
			t.Fatalf("job %d delivered more than once", r.JobID)
		}
		seen[r.JobID] = true
		if r.Err != nil {
			t.Fatalf("job %d: unexpected Err: %v", r.JobID, r.Err)
		}
		got, ok := r.Output.(int)
		if !ok || got != r.JobID*2 {
			t.Fatalf("job %d: Output = %v, want %d; the Result the worker fn returns must be delivered unaltered", r.JobID, r.Output, r.JobID*2)
		}
	}
}

// TestErrorResultsAreDelivered checks step 03's contract: a failing job
// produces a Result carrying Err on the same channel, it does not vanish.
func TestErrorResultsAreDelivered(t *testing.T) {
	errBoom := errors.New("boom")
	const jobs = 100
	p := pool.New(4, 8, func(j pool.Job) pool.Result {
		if j.ID%2 == 1 {
			return pool.Result{JobID: j.ID, Err: errBoom}
		}
		return pool.Result{JobID: j.ID, Output: "ok"}
	})
	out := collect(t, p)
	for i := 0; i < jobs; i++ {
		if err := p.Submit(pool.Job{ID: i}); err != nil {
			t.Fatalf("Submit(%d): %v", i, err)
		}
	}
	stopOrFatal(t, p)
	rs := waitResults(t, out)
	if len(rs) != jobs {
		t.Fatalf("delivered %d results for %d jobs; failing jobs must produce a Result too, not vanish", len(rs), jobs)
	}
	var failed int
	for _, r := range rs {
		if r.JobID%2 == 1 {
			failed++
			if !errors.Is(r.Err, errBoom) {
				t.Fatalf("job %d: Err = %v, want the exact error the worker fn returned", r.JobID, r.Err)
			}
		} else if r.Err != nil {
			t.Fatalf("job %d: Err = %v, want nil", r.JobID, r.Err)
		}
	}
	if failed != jobs/2 {
		t.Fatalf("got %d error results, want %d", failed, jobs/2)
	}
}

// TestStopWaitsForAcceptedJobs pins the blocking half of Stop: when Stop
// returns, every accepted job has already been processed by the worker fn.
func TestStopWaitsForAcceptedJobs(t *testing.T) {
	const jobs = 32
	var processed atomic.Int64
	p := pool.New(4, jobs, func(j pool.Job) pool.Result {
		time.Sleep(time.Millisecond)
		processed.Add(1)
		return pool.Result{JobID: j.ID}
	})
	out := collect(t, p)
	for i := 0; i < jobs; i++ {
		if err := p.Submit(pool.Job{ID: i}); err != nil {
			t.Fatalf("Submit(%d): %v", i, err)
		}
	}
	stopOrFatal(t, p)
	if got := processed.Load(); got != jobs {
		t.Fatalf("Stop returned with %d of %d accepted jobs processed; Stop must wait for the queue to drain and the workers to exit", got, jobs)
	}
	if rs := waitResults(t, out); len(rs) != jobs {
		t.Fatalf("delivered %d results for %d jobs", len(rs), jobs)
	}
}

// TestResultsClosesAfterStop checks the sender-closes rule from the results
// side: once Stop returns on an idle pool, Results is a closed channel.
func TestResultsClosesAfterStop(t *testing.T) {
	p := pool.New(2, 4, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID}
	})
	if p.Results() == nil {
		t.Fatal("Results() returned a nil channel; implement Results first")
	}
	stopOrFatal(t, p)
	select {
	case _, ok := <-p.Results():
		if ok {
			t.Fatal("received a result from a pool that was never given a job")
		}
	case <-time.After(waitTimeout):
		t.Fatalf("results channel still open %v after Stop returned; the pool must close it once the workers exit", waitTimeout)
	}
}

// TestSubmitAfterStopReturnsError pins the intake side of shutdown.
func TestSubmitAfterStopReturnsError(t *testing.T) {
	p := pool.New(2, 4, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID}
	})
	stopOrFatal(t, p)
	if err := p.Submit(pool.Job{ID: 1}); err == nil {
		t.Fatal("Submit after Stop returned nil; it must return an error, and it must not panic")
	}
}

// TestStopIsIdempotentAndConcurrent calls Stop from four goroutines at once
// and then once more for good measure. Every call must return, none may
// panic, and no result may be lost in the crossfire.
func TestStopIsIdempotentAndConcurrent(t *testing.T) {
	const jobs = 64
	p := pool.New(4, 8, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID}
	})
	out := collect(t, p)
	for i := 0; i < jobs; i++ {
		if err := p.Submit(pool.Job{ID: i}); err != nil {
			t.Fatalf("Submit(%d): %v", i, err)
		}
	}
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p.Stop()
		}()
	}
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(waitTimeout):
		t.Fatalf("four concurrent Stop calls did not all return within %v; every caller must block until shutdown finishes, then return", waitTimeout)
	}
	stopOrFatal(t, p) // sequential repeat must also be safe
	if rs := waitResults(t, out); len(rs) != jobs {
		t.Fatalf("delivered %d results for %d jobs across concurrent Stops", len(rs), jobs)
	}
}

// TestConcurrentSubmitters drives Submit from 16 goroutines against a small
// buffer. Under -race this is where an unsynchronized pool gets caught.
func TestConcurrentSubmitters(t *testing.T) {
	const (
		submitters = 16
		perG       = 200
	)
	p := pool.New(8, 10, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID}
	})
	out := collect(t, p)
	var wg sync.WaitGroup
	for g := 0; g < submitters; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < perG; i++ {
				if err := p.Submit(pool.Job{ID: g*perG + i}); err != nil {
					t.Errorf("Submit before Stop: unexpected error: %v", err)
					return
				}
			}
		}()
	}
	waitWG(t, &wg, "concurrent submitters")
	stopOrFatal(t, p)
	rs := waitResults(t, out)
	if len(rs) != submitters*perG {
		t.Fatalf("delivered %d results for %d jobs", len(rs), submitters*perG)
	}
	seen := make(map[int]bool, len(rs))
	for _, r := range rs {
		if seen[r.JobID] {
			t.Fatalf("job %d delivered more than once", r.JobID)
		}
		seen[r.JobID] = true
	}
}

// TestSubmitStopRace lands Stop in the middle of live Submit traffic and pins
// the nastiest edge of the contract: Submit must never panic, not even when
// Stop closes the intake while a Submit is parked on the send.
//
// One pool is a single coin toss. The naive "read a bool, then send on the
// channel" pool only blows up when Stop's close lands in the sliver of time
// between that read and that send; a single pass catches it barely half the
// time and silently passes the rest. Run this under -race and the detector
// flags the unsynchronized bool directly, which is why -race stays the
// primary check. This loop is the belt-and-braces for machines without cgo:
// it reruns the race many rounds over, each round a fresh small-buffer pool
// saturated to backpressure so several submitters are blocked on the send at
// the instant Stop closes. A pool that serializes close against the send
// (send under a read lock, close under the write lock) survives every round.
// One that closes with senders in flight sends on a closed channel and
// panics on ~every run, no detector required.
func TestSubmitStopRace(t *testing.T) {
	const (
		rounds     = 100
		submitters = 8
		maxPerG    = 5000 // safety ceiling so a never-stopping impl cannot run away
	)
	for round := 0; round < rounds; round++ {
		// One buffer slot and two workers against eight submitters: the intake
		// saturates and most submitters end up blocked on the send. A no-op
		// worker fn keeps each round fast; the backpressure comes from the
		// submitter-to-capacity ratio, not from slowing the workers down.
		p := pool.New(2, 1, func(j pool.Job) pool.Result {
			return pool.Result{JobID: j.ID}
		})
		out := collect(t, p)
		accepted := make([][]int, submitters)
		var wg sync.WaitGroup
		for g := 0; g < submitters; g++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for i := 0; i < maxPerG; i++ {
					id := g*maxPerG + i
					if err := p.Submit(pool.Job{ID: id}); err != nil {
						return // Stop landed underneath us: allowed
					}
					accepted[g] = append(accepted[g], id)
				}
			}()
		}
		// Let the submitters saturate the intake before Stop. time.Sleep is
		// useless here: on Windows its clock rounds up to ~15ms and this loop
		// runs a hundred rounds. Spin on the monotonic clock and yield to the
		// submitters instead, which is microsecond-precise on every platform.
		for spin := time.Now().Add(500 * time.Microsecond); time.Now().Before(spin); {
			runtime.Gosched()
		}
		stopOrFatal(t, p)
		waitWG(t, &wg, "submitters racing Stop")
		rs := waitResults(t, out)

		want := make(map[int]bool)
		for _, ids := range accepted {
			for _, id := range ids {
				want[id] = true
			}
		}
		if len(rs) != len(want) {
			t.Fatalf("round %d: Submit accepted %d jobs but %d results were delivered; a job Submit accepted must never be dropped by Stop", round, len(want), len(rs))
		}
		for _, r := range rs {
			if !want[r.JobID] {
				t.Fatalf("round %d: job %d was delivered but Submit never reported accepting it", round, r.JobID)
			}
			delete(want, r.JobID)
		}
	}
}
