package svc_test

import (
	"testing"

	"gopath.dev/labs/observability/svc"
)

// The two benchmarks the README workflow is built around. Identical input,
// identical loop, the only difference is the function under test, so the gap
// between them is exactly the cost of the concatenation strategy.
// BenchmarkBaseline never changes; it anchors every comparison, including the
// gate's. Run from this directory:
//
//	go test -run '^$' -bench . -benchmem -count=5

// sink defeats dead-code elimination: the compiler cannot discard a call
// whose result lands in a package-level variable.
var sink string

func BenchmarkBaseline(b *testing.B) {
	entries := svc.GenEntries(1000)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sink = svc.Baseline(entries)
	}
}

func BenchmarkOptimized(b *testing.B) {
	entries := svc.GenEntries(1000)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sink = svc.Optimized(entries)
	}
}
