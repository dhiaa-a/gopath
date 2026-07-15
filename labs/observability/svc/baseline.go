package svc

// Baseline renders one line per entry by string concatenation. Strings in Go
// are immutable: every += allocates a new string and copies the entire report
// accumulated so far into it, so rendering n entries copies O(n^2) bytes. At
// n=1000 that is roughly 30 MB of copying to produce a 70 KB report, plus one
// heap allocation per iteration for the garbage collector to chase.
//
// Do not edit this function. It is the comparison anchor: the correctness
// suite pins Optimized's output to this output, and the gate measures
// Optimized's cost against this cost in the same process. A golden test pins
// the exact output, so an accidental edit here fails loudly instead of
// silently moving the goalposts.
func Baseline(entries []Entry) string {
	report := ""
	for _, e := range entries {
		report += e.Stamp + " [" + e.Level + "] " + e.Source + ": " + e.Msg + "\n"
	}
	return report
}
