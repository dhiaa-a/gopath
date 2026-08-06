// Command starter is the empty target. Copy this directory, or make your own
// next to it, and build linkd there.
//
// There is deliberately nothing here. No scaffolding, no TODOs, no function
// signatures waiting to be filled in. SPEC.md is the whole brief, and how the
// code is arranged is one of the things being assessed.
//
//	go run ./suite -target ./starter    fails, as it should
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "linkd: nothing here yet. read SPEC.md, then build it.")
	os.Exit(1)
}
