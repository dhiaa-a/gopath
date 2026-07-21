//go:build fixed

// The fix: redact builds its own slice before touching anything. A slice
// value is a three-word header (pointer, length, capacity), so passing one
// shares the backing array with the caller. A function whose contract is
// "returns a copy" has to start by actually copying the elements:
// make+copy here, or slices.Clone for the same thing in one call.
package main

import (
	"fmt"
	"strings"
)

// redact returns a support-safe copy of the entries: identifying fields
// (user, ip) are masked, everything else passes through unchanged.
func redact(entries []string) []string {
	out := make([]string, len(entries))
	copy(out, entries)
	for i, e := range out {
		out[i] = mask(e)
	}
	return out
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
