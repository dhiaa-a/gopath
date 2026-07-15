//go:build gate

package config

import "testing"

// TestGateAtomicFasterThanMutex is the project's benchmark gate. It reruns
// both Load benchmarks in this process via testing.Benchmark and requires
// the atomic store to be strictly faster per operation than the mutex store.
// The comparison is relative, never an absolute ns threshold: both numbers
// move with the machine, but the ordering holds anywhere, because RLock and
// RUnlock each perform an atomic read-modify-write on the mutex word while
// atomic.Value.Load is a plain atomic pointer read.
//
// Run: go test -tags gate -run TestGate ./...
func TestGateAtomicFasterThanMutex(t *testing.T) {
	if NewStore(&Config{Port: 1, LogLevel: "info"}).Load() == nil ||
		NewMutexStore(&Config{Port: 1, LogLevel: "info"}).Load() == nil {
		t.Fatal("Load is still a stub; make go test ./... green before running the gate")
	}

	atomicRes := testing.Benchmark(BenchmarkAtomicLoad)
	mutexRes := testing.Benchmark(BenchmarkMutexLoad)

	atomicNs := nsPerOp(atomicRes)
	mutexNs := nsPerOp(mutexRes)
	t.Logf("BenchmarkAtomicLoad: %8.2f ns/op, %d allocs/op over %d iterations", atomicNs, atomicRes.AllocsPerOp(), atomicRes.N)
	t.Logf("BenchmarkMutexLoad:  %8.2f ns/op, %d allocs/op over %d iterations", mutexNs, mutexRes.AllocsPerOp(), mutexRes.N)

	// The assessment claims both Loads are allocation-free, and the whole
	// design rests on it: the hot path reads the stored pointer, it never
	// builds a new Config. AllocsPerOp is total allocations divided by
	// iteration count, an integer that does not move with the machine: 0 for a
	// clean pointer read, 1 for a Load that boxes a fresh *Config every call.
	// The handful of allocations RunParallel makes to start goroutines vanish
	// against the billions of iterations, so a correct Load reports exactly 0.
	if a := atomicRes.AllocsPerOp(); a != 0 {
		t.Errorf("gate failed: atomic Load must be allocation-free, got %d allocs/op; Load must return the stored *Config, not allocate a new one on the read path", a)
	}
	if m := mutexRes.AllocsPerOp(); m != 0 {
		t.Errorf("gate failed: mutex Load must be allocation-free, got %d allocs/op; Load must return the stored *Config, not allocate a new one on the read path", m)
	}

	if atomicNs >= mutexNs {
		t.Fatalf("gate failed: atomic Load (%.2f ns/op) is not faster than mutex Load (%.2f ns/op)", atomicNs, mutexNs)
	}
}

func nsPerOp(r testing.BenchmarkResult) float64 {
	if r.N <= 0 {
		return 0
	}
	return float64(r.T.Nanoseconds()) / float64(r.N)
}
