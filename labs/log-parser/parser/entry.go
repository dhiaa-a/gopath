// Package parser turns raw log lines into typed entries.
//
// The format is one entry per line:
//
//	2024-01-15T10:30:00Z INFO message here
//
// an RFC3339 timestamp, a level, and a message, separated by single
// spaces. The message may itself contain spaces; the first two spaces on
// the line are the only separators.
package parser

import "time"

// LogEntry is one successfully parsed log line.
//
// This file is untagged, so it is shared by your build and the reference
// build: the type is the contract the test suite checks against, and the
// function that fills it is yours.
type LogEntry struct {
	Timestamp time.Time
	Level     string
	Message   string
}
