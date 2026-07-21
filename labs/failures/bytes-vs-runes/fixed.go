//go:build fixed

// The fix: cut in the unit the screen counts. []rune decodes the UTF-8,
// so the slice lands between characters, never inside one. Code points
// are still not everything a reader calls a character (combining accents,
// emoji sequences); budgets like those need grapheme clusters, which the
// standard library does not provide. The strings-bytes-runes concept
// draws that boundary.
package main

import "fmt"

// maxTitle is the display budget: the lock screen fits 12 characters.
const maxTitle = 12

// shorten fits a title to the display budget, marking any cut with an
// ellipsis.
func shorten(title string) string {
	r := []rune(title)
	if len(r) <= maxTitle {
		return title
	}
	return string(r[:maxTitle]) + "…"
}

func main() {
	titles := []string{
		"Order ready",
		"Your table is ready",
		"Commande prête à retirer",
	}

	for _, t := range titles {
		s := shorten(t)
		fmt.Printf("display: %s\n", s)
		fmt.Printf("payload: %q\n", s)
	}
	fmt.Println("sent", len(titles), "notifications")
}
