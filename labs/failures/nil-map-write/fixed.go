//go:build fixed

// The fix: Stats gets a birthplace. NewReport makes the map in the same
// moment the struct comes to exist, so no code path can reach a write
// before the make. The zero-value Report was half-usable, reads fine and
// writes fatal, and a constructor is how you retire a half-usable zero
// value (see the nil concept for which zero values are designed to work).
package main

import (
	"fmt"
	"strings"
)

// Stats accumulates word counts across every batch fed to it.
type Stats struct {
	counts map[string]int
	total  int
}

// Count records one occurrence of a word.
func (s *Stats) Count(word string) {
	s.counts[strings.ToLower(word)]++
	s.total++
}

// Distinct reports how many different words have been seen.
func (s *Stats) Distinct() int {
	return len(s.counts)
}

// CountOf reports how many times one word has been seen.
func (s *Stats) CountOf(word string) int {
	return s.counts[strings.ToLower(word)]
}

// Report is one digest run: a title plus the stats behind it.
type Report struct {
	Title string
	Stats Stats
}

// NewReport starts an empty report whose stats are ready to write.
func NewReport(title string) *Report {
	return &Report{
		Title: title,
		Stats: Stats{counts: make(map[string]int)},
	}
}

func main() {
	batches := []struct{ name, text string }{
		{"release-notes", "config watcher now reloads the config on change without a restart"},
		{"incident-review", "the reload raced the watcher and the deploy stalled"},
	}

	r := NewReport("weekly word digest")
	fmt.Println("report:", r.Title)
	fmt.Printf("tracking %q: seen %d times so far\n", "config", r.Stats.CountOf("config"))

	for _, b := range batches {
		words := strings.Fields(b.text)
		fmt.Printf("%s: %d words, %d distinct so far\n", b.name, len(words), r.Stats.Distinct())
		for _, w := range words {
			r.Stats.Count(w)
		}
	}

	fmt.Printf("tracking %q: seen %d times total\n", "config", r.Stats.CountOf("config"))
	fmt.Printf("words counted: %d (%d distinct)\n", r.Stats.total, r.Stats.Distinct())
}
