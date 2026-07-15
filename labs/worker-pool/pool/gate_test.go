//go:build gate

// The throughput gate. Run it without -race: the detector instruments every
// channel operation and the number stops meaning anything.
//
//	go test -tags gate -run TestGate ./...
package pool_test

import "testing"

// gateMinJobsPerSec matches the project assessment: 8 workers, buffer 100,
// no-op worker fn, more than 500,000 jobs per second.
const gateMinJobsPerSec = 500_000

func TestGateThroughput(t *testing.T) {
	res := testing.Benchmark(func(b *testing.B) {
		benchPool(b, 8, 100)
	})
	got := res.Extra["jobs/s"]
	if got == 0 {
		t.Fatal("benchmark reported no jobs/s metric; benchPool must call b.ReportMetric")
	}
	if got <= gateMinJobsPerSec {
		t.Fatalf("throughput gate: measured %.0f jobs/s with 8 workers and buffer 100, need more than %d jobs/s; look for a lock held across the send, per-job allocations, or an unbuffered results channel", got, gateMinJobsPerSec)
	}
	t.Logf("throughput gate: %.0f jobs/s with 8 workers and buffer 100 (floor %d)", got, gateMinJobsPerSec)
}
