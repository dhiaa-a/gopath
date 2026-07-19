// Black-box correctness suite. It compares Optimized against Baseline byte
// for byte, so it passes before you change anything: Optimized starts as an
// exact copy, and a copy of correct code is correct. Green here is necessary,
// never sufficient. The exam is the gate in gate_test.go.
package svc_test

import (
	"fmt"
	"testing"

	"gopath.dev/labs/observability/svc"
)

// TestBaselineGolden pins the anchor itself. Baseline is the fixed point
// every comparison in this lab is relative to; if its output drifts, the
// whole lab is measuring against a moved goalpost, so this test fails loudly
// on any edit to svc/baseline.go.
func TestBaselineGolden(t *testing.T) {
	got := svc.Baseline([]svc.Entry{
		{Stamp: "2026-01-02T15:04:05Z", Level: "INFO", Source: "api", Msg: "listening on :8080"},
		{Stamp: "2026-01-02T15:04:06Z", Level: "ERROR", Source: "billing", Msg: "charge failed: card declined"},
	})
	want := "2026-01-02T15:04:05Z [INFO] api: listening on :8080\n" +
		"2026-01-02T15:04:06Z [ERROR] billing: charge failed: card declined\n"
	if got != want {
		t.Fatalf("Baseline output drifted; svc/baseline.go is the comparison anchor and must not be edited\ngot:  %q\nwant: %q", got, want)
	}
}

func TestOptimizedMatchesBaseline(t *testing.T) {
	tests := []struct {
		name    string
		entries []svc.Entry
	}{
		{"nil slice", nil},
		{"empty slice", []svc.Entry{}},
		{"single entry", []svc.Entry{
			{Stamp: "2026-01-02T15:04:05Z", Level: "INFO", Source: "api", Msg: "request completed"},
		}},
		{"zero-value entry", []svc.Entry{{}}},
		{"unicode message", []svc.Entry{
			{Stamp: "2026-01-02T15:04:07Z", Level: "WARN", Source: "auth", Msg: `user "björn" retried MFA 3 times`},
		}},
		{"message with embedded newline", []svc.Entry{
			{Stamp: "2026-01-02T15:04:08Z", Level: "ERROR", Source: "ingest", Msg: "panic: oh no\ngoroutine 1 [running]"},
		}},
		{"25 entries", svc.GenEntries(25)},
		{"1000 entries, production shape", svc.GenEntries(1000)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := svc.Baseline(tt.entries)
			got := svc.Optimized(tt.entries)
			if got != want {
				i := firstDiff(want, got)
				t.Fatalf("Optimized diverged from Baseline: lengths %d vs %d, first difference at byte %d\nbaseline:  %s\noptimized: %s\nA faster function with different output is a bug, not an optimisation.",
					len(want), len(got), i, window(want, i), window(got, i))
			}
		})
	}
}

// firstDiff returns the index of the first byte where a and b differ, or the
// shorter length if one is a prefix of the other.
func firstDiff(a, b string) int {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		if a[i] != b[i] {
			return i
		}
	}
	return n
}

// window quotes the 40 bytes around position at, so a failure shows where the
// outputs split without dumping a 70 KB report.
func window(s string, at int) string {
	start := at - 20
	if start < 0 {
		start = 0
	}
	end := at + 20
	if end > len(s) {
		end = len(s)
	}
	return fmt.Sprintf("...%q...", s[start:end])
}
