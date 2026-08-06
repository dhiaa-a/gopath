// Command suite is the capstone conformance suite.
//
// It builds the package at -target, runs the binary, and holds it to SPEC.md
// over HTTP. It never reads your source, so any layout that meets the spec
// passes and no layout that misses it does.
//
//	go run ./suite                      checks ./reference
//	go run ./suite -target ./mine       checks your implementation
//	go run ./suite -target ./mine -run durability
package main

import (
	"flag"
	"fmt"
	"os"

	"gopath.dev/labs/capstone/internal/conform"
	"gopath.dev/labs/capstone/internal/harness"
)

func main() {
	target := flag.String("target", "./reference", "package directory to build and check")
	run := flag.String("run", "", "only run checks whose name contains this substring")
	flag.Parse()

	fmt.Printf("── conformance suite: %s\n", *target)

	built, err := harness.Build(*target)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		fmt.Println("\nsuite: the target does not build, so nothing was checked")
		os.Exit(1)
	}

	sum := conform.Run(built, *run, os.Stdout)

	fmt.Println()
	if len(sum.Results) == 0 {
		fmt.Printf("suite: no checks matched -run %q\n", *run)
		os.Exit(1)
	}
	if sum.Failed > 0 {
		fmt.Printf("suite: %d ok, %d failed%s\n", sum.Passed, sum.Failed, skipNote(sum.Skipped))
		os.Exit(1)
	}
	fmt.Printf("suite: ok — %d check(s) passed%s\n", sum.Passed, skipNote(sum.Skipped))
}

func skipNote(n int) string {
	if n == 0 {
		return ""
	}
	return fmt.Sprintf(", %d skipped", n)
}
