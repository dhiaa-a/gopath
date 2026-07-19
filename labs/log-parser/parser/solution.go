//go:build solution

package parser

import (
	"strings"
	"time"
)

// ParseLine is the reference implementation. Do not read this file until
// your own run of the suite is green. It exists so the repo can prove the
// suite passes against a real implementation: go test -tags solution ./...
// swaps this file in for parser.go.
func ParseLine(line string) (LogEntry, bool) {
	// SplitN, not Split: only the first two spaces separate fields, and
	// everything after them, spaces included, is the message.
	parts := strings.SplitN(line, " ", 3)
	if len(parts) < 3 {
		return LogEntry{}, false
	}
	ts, err := time.Parse(time.RFC3339, parts[0])
	if err != nil {
		return LogEntry{}, false
	}
	return LogEntry{Timestamp: ts, Level: parts[1], Message: parts[2]}, true
}
