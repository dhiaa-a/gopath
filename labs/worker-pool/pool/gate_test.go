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

// TestGateGenericAllocs is the step 09 gate, and it is a different kind of
// check from the one above. Throughput is a property of the machine, so that
// gate needs an absolute floor and generous headroom to survive a slow laptop.
// Allocations per job are a property of the code: the same source allocates the
// same number of times on a Raspberry Pi and on a 64-core server. So this gate
// needs no headroom, no threshold, and no tuning. It asserts zero.
//
// It also runs both pools in the same process and requires the boxed one to
// allocate, which is not decoration. If Go ever stopped boxing an int into an
// interface, "generic allocates nothing" would still pass while having stopped
// meaning anything. A comparison that cannot fail on the control is not a
// comparison.
func TestGateGenericAllocs(t *testing.T) {
	boxed := testing.Benchmark(func(b *testing.B) { benchBoxedInts(b, 8, 100) })
	generic := testing.Benchmark(func(b *testing.B) { benchGenericInts(b, 8, 100) })

	if generic.AllocsPerOp() != 0 {
		t.Fatalf("allocation gate: the generic pool allocated %d times and %d bytes per job, want 0; a chan GenericJob[In] stores In values inline, so nothing on the per-job path should reach the heap. Look for an `any` you left behind, a payload you took the address of, or a closure allocated per job",
			generic.AllocsPerOp(), generic.AllocedBytesPerOp())
	}
	if boxed.AllocsPerOp() == 0 {
		t.Fatalf("allocation gate: the boxed pool allocated 0 times per job, so there is nothing to compare against. It should allocate once per job to box the int payload behind `any`. Did benchBoxedInts stop submitting payloads above 255?")
	}
	t.Logf("allocation gate: boxed %d allocs/op (%d B/op), generic %d allocs/op (%d B/op)",
		boxed.AllocsPerOp(), boxed.AllocedBytesPerOp(),
		generic.AllocsPerOp(), generic.AllocedBytesPerOp())
	t.Logf("throughput, same run, machine-relative: boxed %.0f jobs/s, generic %.0f jobs/s",
		boxed.Extra["jobs/s"], generic.Extra["jobs/s"])
}
