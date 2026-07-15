//go:build !solution

// This file is yours. Optimized starts as an exact copy of Baseline: same
// output, same quadratic cost. The service, the benchmarks, and the gate all
// call Optimized, so this is the function your CPU profile points at and the
// only file you change. Keep the output identical; the correctness suite
// compares it to Baseline byte for byte.
package svc

// Optimized is the hot path you fix. Right now it is Baseline under another
// name, which is why go test ./... is already green and the gate is not: a
// copy of correct code is correct, it just is not faster.
func Optimized(entries []Entry) string {
	report := ""
	for _, e := range entries {
		report += e.Stamp + " [" + e.Level + "] " + e.Source + ": " + e.Msg + "\n"
	}
	return report
}
