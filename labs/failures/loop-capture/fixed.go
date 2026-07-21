//go:build fixed

// The fix, in the idiom this module's go directive demands: shadow the
// loop variables inside the body, so each closure captures its own pair
// instead of the loop's single shared one. From go 1.22 in go.mod onward
// the compiler declares fresh variables per iteration and this line
// becomes redundant; on 1.21 and below it is the difference between one
// variable and three.
package main

import "fmt"

func main() {
	menu := []string{"start", "save", "quit"}

	var handlers []func()
	for i, name := range menu {
		i, name := i, name
		handlers = append(handlers, func() {
			fmt.Printf("%d: %s\n", i, name)
		})
	}

	for _, h := range handlers {
		h()
	}
}
