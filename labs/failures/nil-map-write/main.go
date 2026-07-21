//go:build !fixed

// wordstats builds the weekly word digest for the team channel: it counts
// word frequencies across the week's write-ups and prints the numbers the
// digest template needs.
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

func main() {
	batches := []struct{ name, text string }{
		{"release-notes", "config watcher now reloads the config on change without a restart"},
		{"incident-review", "the reload raced the watcher and the deploy stalled"},
	}

	r := Report{Title: "weekly word digest"}
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
