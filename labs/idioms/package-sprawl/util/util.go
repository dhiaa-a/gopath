//go:build !solution

package util

import (
	"strings"
	"unicode/utf8"
)

// UtilFirstLine returns everything in s before the first newline.
func UtilFirstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}

// UtilTruncate shortens s to at most width runes, marking a cut with a
// trailing ellipsis so the reader can see the text continues.
func UtilTruncate(s string, width int) string {
	if utf8.RuneCountInString(s) <= width {
		return s
	}
	return string([]rune(s)[:width-1]) + "…"
}

// UtilWordCount reports how many whitespace-separated words s holds.
func UtilWordCount(s string) int {
	return len(strings.Fields(s))
}
