//go:build !fixed

// auditview renders the day's audit entries twice: once redacted for the
// support dashboard, and once untouched for the permanent compliance
// archive. Support must never see identities; the archive must hold the
// entries exactly as they were recorded.
package main

import (
	"fmt"
	"strings"
)

// redact returns a support-safe copy of the entries: identifying fields
// (user, ip) are masked, everything else passes through unchanged.
func redact(entries []string) []string {
	for i, e := range entries {
		entries[i] = mask(e)
	}
	return entries
}

// mask hides the values of sensitive key=value fields in one entry.
func mask(entry string) string {
	fields := strings.Fields(entry)
	for i, f := range fields {
		key, _, ok := strings.Cut(f, "=")
		if ok && (key == "user" || key == "ip") {
			fields[i] = key + "=***"
		}
	}
	return strings.Join(fields, " ")
}

func main() {
	entries := []string{
		"user=alice action=login ip=10.0.0.7",
		"user=alice action=export ip=10.0.0.7",
		"user=bob action=delete ip=10.0.0.9",
	}

	view := redact(entries)
	fmt.Println("support dashboard (redacted):")
	for _, e := range view {
		fmt.Println("  " + e)
	}

	// Compliance gets the entries as recorded, straight from the source.
	fmt.Printf("archived original: %v\n", entries)
}
