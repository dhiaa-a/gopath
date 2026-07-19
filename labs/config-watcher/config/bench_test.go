package config

import "testing"

// These are the two benchmarks the step 04 assessment names. They are
// written the way the step teaches: setup outside the measurement,
// b.ResetTimer to exclude it, b.RunParallel to run the loop body from
// GOMAXPROCS goroutines. A serial b.N loop would show both stores near
// identical, because contention only exists when cores actually compete.
//
// Run: go test -bench . -benchmem -count=5 ./...

func BenchmarkAtomicLoad(b *testing.B) {
	s := NewStore(&Config{Port: 8080, LogLevel: "info"})
	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = s.Load()
		}
	})
}

func BenchmarkMutexLoad(b *testing.B) {
	s := NewMutexStore(&Config{Port: 8080, LogLevel: "info"})
	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = s.Load()
		}
	})
}
