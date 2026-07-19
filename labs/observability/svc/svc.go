// Package svc is the hot path of a small report service: it renders parsed
// access-log entries into the plain-text report served at /process.
//
// Baseline is the shipped implementation and never changes. Optimized starts
// as an exact copy of it and is yours to fix. The correctness suite pins
// Optimized's output to Baseline's byte for byte, and the gate pins its cost
// against Baseline's, measured in the same process.
package svc

import (
	"strconv"
	"time"
)

// Entry is one parsed access-log record, the shape this service processes on
// every request. Upstream parsing already happened; rendering is the only job
// left, which is why rendering dominates the profile.
type Entry struct {
	Stamp  string // RFC3339, formatted upstream
	Level  string // INFO, WARN, ERROR
	Source string // component that emitted the line
	Msg    string
}

var (
	genLevels  = [...]string{"INFO", "INFO", "INFO", "WARN", "ERROR"}
	genSources = [...]string{"api", "auth", "billing", "cache", "ingest"}
	genMsgs    = [...]string{
		"request completed",
		"cache miss, fell through to origin",
		"retrying upstream call",
		"slow query took 1.2s",
		"connection reset by peer",
		"token refreshed",
		"payload accepted",
	}
)

// GenEntries returns n deterministic entries in the production shape. The
// tests, the benchmarks, and the running service all render this same input,
// so every number you measure is measured on the same work.
func GenEntries(n int) []Entry {
	base := time.Date(2026, 1, 2, 15, 4, 5, 0, time.UTC)
	entries := make([]Entry, n)
	for i := range entries {
		entries[i] = Entry{
			Stamp:  base.Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			Level:  genLevels[i%len(genLevels)],
			Source: genSources[i%len(genSources)],
			Msg:    genMsgs[i%len(genMsgs)] + " (req " + strconv.Itoa(i) + ")",
		}
	}
	return entries
}
