//go:build gate

// The speedup gate, the machine check for this project. Run it without
// -race: the detector instruments every allocation and memory access, so the
// numbers would measure the instrumentation, not your fix.
//
//	go test -tags gate -run TestGate ./...
package svc_test

import (
	"testing"

	"gopath.dev/labs/observability/svc"
)

// Thresholds from the project assessment. Both are relative to Baseline
// measured in this same process, never absolute nanoseconds: both sides move
// with the machine, the ratio does not. The reference fix clears both with a
// wide margin, so an honest fix does not fail on a slow or loaded machine.
const (
	gateMinNsCut    = 40.0 // percent reduction in ns/op
	gateMinAllocCut = 50.0 // percent reduction in allocs/op
)

func TestGateSpeedup(t *testing.T) {
	// Correctness gates speed. The command that runs this gate,
	// go test -tags gate -run TestGate ./..., filters by test name, so the
	// correctness suite in correctness_test.go never executes in this run. A
	// fast but wrong Optimized (a strings.Builder that forgets the trailing
	// "\n", say) would otherwise clear the gate on numbers alone. Pin Optimized
	// to Baseline byte for byte before measuring anything: n=0 is the empty
	// report, n=1 is the single line where a dropped newline first shows, n=1000
	// is the production shape.
	for _, n := range []int{0, 1, 1000} {
		in := svc.GenEntries(n)
		if got, want := svc.Optimized(in), svc.Baseline(in); got != want {
			t.Fatalf("Optimized output is wrong at n=%d entries (got %d bytes, want %d); fix correctness before the speedup gate can pass. Run go test ./... to see the exact byte where it diverges.", n, len(got), len(want))
		}
	}

	base := testing.Benchmark(BenchmarkBaseline)
	opt := testing.Benchmark(BenchmarkOptimized)

	baseNs := float64(base.NsPerOp())
	baseAllocs := float64(base.AllocsPerOp())
	if baseNs <= 0 || baseAllocs <= 0 {
		t.Fatal("baseline benchmark reported zero cost; svc/baseline.go is the anchor and must not be edited")
	}
	nsCut := (1 - float64(opt.NsPerOp())/baseNs) * 100
	allocCut := (1 - float64(opt.AllocsPerOp())/baseAllocs) * 100

	t.Logf("Baseline:  %10d ns/op  %7d allocs/op  (%d iterations)", base.NsPerOp(), base.AllocsPerOp(), base.N)
	t.Logf("Optimized: %10d ns/op  %7d allocs/op  (%d iterations)", opt.NsPerOp(), opt.AllocsPerOp(), opt.N)

	if nsCut < gateMinNsCut || allocCut < gateMinAllocCut {
		t.Fatalf("gate failed: ns/op cut %.1f%% (need >= %.0f%%), allocs/op cut %.1f%% (need >= %.0f%%); profile BenchmarkOptimized and look at where the bytes get copied",
			nsCut, gateMinNsCut, allocCut, gateMinAllocCut)
	}
	t.Logf("gate passed: ns/op cut %.1f%%, allocs/op cut %.1f%%", nsCut, allocCut)
}
