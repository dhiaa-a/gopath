//go:build !fixed

// notify renders lock-screen notifications for the pickup app. The lock
// screen fits 12 characters of a title; anything longer is cut and given
// an ellipsis so the reader can tell there is more. Each send is logged
// twice: the title as the screen shows it, and quoted for the payload
// log, so whitespace and control characters stay visible.
package main

import "fmt"

// maxTitle is the display budget: the lock screen fits 12 characters.
const maxTitle = 12

// shorten fits a title to the display budget, marking any cut with an
// ellipsis.
func shorten(title string) string {
	if len(title) <= maxTitle {
		return title
	}
	return title[:maxTitle] + "…"
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
