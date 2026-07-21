//go:build fixed

// The fix: cap base at its own length with a full slice expression, so an
// append that would grow past it finds no spare capacity and is forced to
// allocate a fresh array instead of writing into the shared one.
// slices.Clip(base) spells the same operation by name.
package main

import "fmt"

func main() {
	// Base flags shared by every profile. Sized up front so the appends
	// below never have to reallocate mid-build.
	base := make([]string, 0, 8)
	base = append(base,
		"--log-level=info",
		"--region=eu-west-1",
		"--retries=3",
		"--timeout=30s",
	)

	// len 4, cap 4: any append past this point must copy first, so the
	// profiles below cannot share (or overwrite) each other's memory.
	base = base[:len(base):len(base)]

	devFlags := append(base, "--verbose")
	prodFlags := append(base, "--quiet")

	fmt.Printf("dev flags:  %v\n", devFlags)
	fmt.Printf("prod flags: %v\n", prodFlags)
}
