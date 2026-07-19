// Package pipeline reads log files and reduces them to one Summary.
//
// It is the concurrent half of the lab. Package parser turns one line into
// one entry; this package turns a list of files into a single answer, using
// a worker pool to read them at the same time.
//
// This file is untagged, so it is shared by your build and the reference
// build: the types here are the contract the test suite checks against, and
// the functions that produce them are yours.
package pipeline

import "time"

// Summary is the aggregate over every entry parsed from every file.
//
// Every field is an order-independent reduction: a count, a running
// minimum, a running maximum. That is not a stylistic choice, it is what
// makes the summary safe to compute from a worker pool at all. Entries
// arrive in whatever order the workers finish, which changes run to run,
// so a summary that depended on arrival order would give a different answer
// every time. None of these fields can.
type Summary struct {
	// Total is the number of lines that parsed.
	Total int
	// Skipped is the number of lines that did not, across all files.
	Skipped int
	// ByLevel counts entries per level: "INFO", "WARN", "ERROR", "DEBUG".
	ByLevel map[string]int
	// Earliest and Latest are the instants of the oldest and newest
	// entries. Instants, not strings: an entry written at 09:00:00+05:30
	// happened before one written at 08:59:12Z, and testdata/auth.log
	// contains exactly that line to keep you honest.
	Earliest time.Time
	Latest   time.Time
}
