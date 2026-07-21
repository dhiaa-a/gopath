//go:build !fixed

// menureg wires up a small command menu: each entry registers a handler
// that announces which entry it serves, and the dispatch loop below runs
// them all, the way a TUI would render its hotkey bar on startup.
package main

import "fmt"

func main() {
	menu := []string{"start", "save", "quit"}

	var handlers []func()
	for i, name := range menu {
		handlers = append(handlers, func() {
			fmt.Printf("%d: %s\n", i, name)
		})
	}

	for _, h := range handlers {
		h()
	}
}
