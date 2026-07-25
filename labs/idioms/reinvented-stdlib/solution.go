//go:build solution

// Package logline normalizes raw log lines from a fleet of agents before
// they reach the status screen: shipper prefixes come off, secrets get
// masked, repeated lines collapse, and columns get sized.
package logline

import (
	"slices"
	"strconv"
	"strings"
)

// agentPrefix is stamped on every line by the fleet's log shipper.
const agentPrefix = "gopath-agent: "

// severities lists the levels the fleet's loggers emit.
var severities = []string{"TRACE", "DEBUG", "INFO", "WARN", "ERROR"}

// TrimAgent removes one leading shipper prefix from a line, if present.
func TrimAgent(line string) string {
	return strings.TrimPrefix(line, agentPrefix)
}

// KnownSeverity reports whether sev is a level the fleet's loggers emit.
// Matching is exact: severities are upper-case on the wire.
func KnownSeverity(sev string) bool {
	return slices.Contains(severities, sev)
}

// HasMarker reports whether a deploy marker occurs anywhere in the line.
// Every line contains the empty marker.
func HasMarker(line, marker string) bool {
	return strings.Contains(line, marker)
}

// Redact replaces every occurrence of each secret with a mask of the same
// length, so line widths survive redaction. Empty secrets are ignored.
func Redact(line string, secrets []string) string {
	for _, secret := range secrets {
		if secret == "" {
			continue
		}
		line = strings.ReplaceAll(line, secret, strings.Repeat("*", len(secret)))
	}
	return line
}

// Dedupe collapses each run of identical lines into one entry, syslog
// style: a run of n > 1 identical lines becomes the line followed by
// " (xN)".
func Dedupe(lines []string) []string {
	if len(lines) == 0 {
		return nil
	}
	var out []string
	current := lines[0]
	count := 1
	for _, line := range lines[1:] {
		if line == current {
			count++
			continue
		}
		out = append(out, entry(current, count))
		current = line
		count = 1
	}
	return append(out, entry(current, count))
}

// entry renders one deduplicated line with its repeat count.
func entry(line string, count int) string {
	if count == 1 {
		return line
	}
	return line + " (x" + strconv.Itoa(count) + ")"
}

// Widest reports the length of the longest line, for column layout.
func Widest(lines []string) int {
	widest := 0
	for _, line := range lines {
		widest = max(widest, len(line))
	}
	return widest
}

// Fit truncates line to at most width bytes, for column layout. The
// fleet logs ASCII, so bytes are columns. A width of zero or less leaves
// nothing.
func Fit(line string, width int) string {
	if width <= 0 {
		return ""
	}
	return line[:min(len(line), width)]
}

// Tail returns the last keep lines as an independent slice: the result
// shares no memory with lines, so holding it does not pin the caller's
// buffer. A keep of zero or less returns nil; a keep past the start
// returns a copy of everything.
func Tail(lines []string, keep int) []string {
	if keep <= 0 {
		return nil
	}
	tail := lines
	if keep < len(lines) {
		tail = lines[len(lines)-keep:]
	}
	out := make([]string, len(tail))
	copy(out, tail)
	return out
}
