//go:build solution

package svc

import "strings"

// Optimized renders the same report through a strings.Builder. The Builder
// appends into one growing buffer instead of allocating and copying the whole
// report on every +=, so the bytes copied drop from O(n^2) to O(n), and its
// String() hands back the buffer without a final copy. Grow up front removes
// even the doubling reallocations: one allocation for the whole report.
func Optimized(entries []Entry) string {
	var b strings.Builder
	b.Grow(len(entries) * 80)
	for _, e := range entries {
		b.WriteString(e.Stamp)
		b.WriteString(" [")
		b.WriteString(e.Level)
		b.WriteString("] ")
		b.WriteString(e.Source)
		b.WriteString(": ")
		b.WriteString(e.Msg)
		b.WriteByte('\n')
	}
	return b.String()
}
