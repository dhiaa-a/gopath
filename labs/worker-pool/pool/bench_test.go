// Throughput benchmarks for the pool with a no-op worker fn. The number
// that matters is the jobs/s column, reported with b.ReportMetric; ns/op is
// the same information upside down.
//
//	go test -bench . -benchmem ./...
package pool_test

import (
	"fmt"
	"testing"
	"time"

	"gopath.dev/labs/worker-pool/pool"
)

// benchPool pushes b.N no-op jobs through a fresh pool and reports jobs/s.
// The timed section deliberately includes Stop and the final drain:
// throughput that only looks good by ignoring shutdown cost is not
// throughput.
func benchPool(b *testing.B, workers, buffer int) {
	p := pool.New(workers, buffer, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID}
	})
	drained := make(chan int, 1)
	go func() {
		n := 0
		for range p.Results() {
			n++
		}
		drained <- n
	}()
	b.ReportAllocs()
	b.ResetTimer()
	start := time.Now()
	for i := 0; i < b.N; i++ {
		if err := p.Submit(pool.Job{ID: i}); err != nil {
			b.Fatalf("Submit: %v", err)
		}
	}
	p.Stop()
	n := <-drained
	elapsed := time.Since(start)
	b.StopTimer()
	if n != b.N {
		b.Fatalf("delivered %d results for %d jobs", n, b.N)
	}
	// At -benchtime 1x a single job can finish inside the clock's
	// resolution; skip the metric rather than report +Inf.
	if elapsed > 0 {
		b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s")
	}
}

// BenchmarkPool is the step 07 experiment: 8 workers, jobs buffer swept from
// unbuffered to 1000. Unbuffered means every Submit is a synchronous
// handshake with a worker, two scheduler wakeups per job; a buffer lets
// Submit run ahead and amortizes that cost. Watch jobs/s move.
//
// Note the payload: BenchmarkPool submits Job{ID: i} and leaves Payload nil,
// because it is measuring channel and scheduler cost and nothing else. A nil
// `any` is just a zero interface header, so nothing is boxed and nothing is
// allocated. That is deliberate, and it is also why this benchmark is useless
// for the question step 09 asks. BenchmarkPayload below is the one that
// carries a real payload.
func BenchmarkPool(b *testing.B) {
	for _, buffer := range []int{0, 10, 100, 1000} {
		b.Run(fmt.Sprintf("workers=8/buffer=%d", buffer), func(b *testing.B) {
			benchPool(b, 8, buffer)
		})
	}
}

// ─── Step 09: what the type parameters cost ────────────────────────────────
//
// The two functions below are the same pool doing the same work, differing
// only in whether the payload travels as an `any` or as a type parameter. Both
// carry a real int payload and both double it, so the only variable is the
// type discipline. Read the allocs/op column, not the ns/op column: the time
// is machine noise, the allocations are the mechanism.

// benchBoxedInts pushes b.N int-payload jobs through the `any` pool. The
// worker fn has to assert its way back to an int, because the channel gave it
// an interface.
//
// Payload is i, deliberately: i climbs past 255 within the first microsecond
// of the run and stays there. Step 09's break-it is about why that matters.
func benchBoxedInts(b *testing.B, workers, buffer int) {
	p := pool.New(workers, buffer, func(j pool.Job) pool.Result {
		return pool.Result{JobID: j.ID, Output: j.Payload.(int) * 2}
	})
	drained := make(chan int, 1)
	go func() {
		n := 0
		for range p.Results() {
			n++
		}
		drained <- n
	}()
	b.ReportAllocs()
	b.ResetTimer()
	start := time.Now()
	for i := 0; i < b.N; i++ {
		if err := p.Submit(pool.Job{ID: i, Payload: i}); err != nil {
			b.Fatalf("Submit: %v", err)
		}
	}
	p.Stop()
	n := <-drained
	elapsed := time.Since(start)
	b.StopTimer()
	if n != b.N {
		b.Fatalf("delivered %d results for %d jobs", n, b.N)
	}
	if elapsed > 0 {
		b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s")
	}
}

// benchGenericInts is benchBoxedInts with the type parameters filled in. Note
// what is missing from the worker fn: the type assertion. There is nothing to
// assert, because chan GenericJob[int] holds ints.
func benchGenericInts(b *testing.B, workers, buffer int) {
	p := pool.NewGeneric[int, int](workers, buffer, func(j pool.GenericJob[int]) pool.GenericResult[int] {
		return pool.GenericResult[int]{JobID: j.ID, Output: j.Payload * 2}
	})
	drained := make(chan int, 1)
	go func() {
		n := 0
		for range p.Results() {
			n++
		}
		drained <- n
	}()
	b.ReportAllocs()
	b.ResetTimer()
	start := time.Now()
	for i := 0; i < b.N; i++ {
		if err := p.Submit(pool.GenericJob[int]{ID: i, Payload: i}); err != nil {
			b.Fatalf("Submit: %v", err)
		}
	}
	p.Stop()
	n := <-drained
	elapsed := time.Since(start)
	b.StopTimer()
	if n != b.N {
		b.Fatalf("delivered %d results for %d jobs", n, b.N)
	}
	if elapsed > 0 {
		b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s")
	}
}

// BenchmarkPayload is the step 09 comparison: identical work, 8 workers,
// buffer 100, one int payload per job, boxed against generic.
//
//	go test -tags solution -run '^$' -bench Payload -benchmem ./...
func BenchmarkPayload(b *testing.B) {
	b.Run("boxed", func(b *testing.B) { benchBoxedInts(b, 8, 100) })
	b.Run("generic", func(b *testing.B) { benchGenericInts(b, 8, 100) })
}
