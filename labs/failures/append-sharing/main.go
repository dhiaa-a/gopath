//go:build !fixed

// launchcfg resolves the flag sets for the two deploy profiles. Every
// profile starts from the same base flags and adds its own extras; the
// resolved sets are printed the way `launchcfg --dry-run` would show them.
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

	devFlags := append(base, "--verbose")
	prodFlags := append(base, "--quiet")

	fmt.Printf("dev flags:  %v\n", devFlags)
	fmt.Printf("prod flags: %v\n", prodFlags)
}
