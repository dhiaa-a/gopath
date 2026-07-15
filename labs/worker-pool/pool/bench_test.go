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

// BenchmarkPool is the step 04 experiment: 8 workers, jobs buffer swept from
// unbuffered to 1000. Unbuffered means every Submit is a synchronous
// handshake with a worker, two scheduler wakeups per job; a buffer lets
// Submit run ahead and amortizes that cost. Watch jobs/s move.
func BenchmarkPool(b *testing.B) {
	for _, buffer := range []int{0, 10, 100, 1000} {
		b.Run(fmt.Sprintf("workers=8/buffer=%d", buffer), func(b *testing.B) {
			benchPool(b, 8, buffer)
		})
	}
}
