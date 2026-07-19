// The file renamer from GoPath Tier 1, Project 1.
//
// Three layers, three TODOs, in step order:
//
//	parseFlags     step 01: read and validate input at the boundary
//	transformName  step 02: the pure transformation, no I/O anywhere
//	run            step 03: walk the directory and apply the plan
//
// main is already wired: parse, run, exit 1 on any error. Check your work
// from the lab root with: go run ./check
package main

import (
	"fmt"
	"os"
)

// Config carries everything the program needs past the boundary. Once a
// *Config exists the input is trusted; nothing after parseFlags re-validates.
type Config struct {
	Dir     string // directory to scan
	Pattern string // prefix for every renamed file
	DryRun  bool   // print the plan instead of executing it
}

// parseFlags registers --dir (default "."), --pattern (required), and
// --dry-run, then validates everything before any work begins.
//
// TODO step 01:
//   - register the three flags and call flag.Parse()
//   - --pattern must be non-empty
//   - --dir must exist and be a directory (os.Stat, then IsDir)
//   - collect every problem into one descriptive error
func parseFlags() (*Config, error) {
	return nil, fmt.Errorf("parseFlags: not implemented (step 01)")
}

// transformName is pure: string in, string out, the filesystem is never
// touched in here.
//
// TODO step 02:
//   - keep the extension exactly as it is (filepath.Ext, strings.TrimSuffix)
//   - in the base name: replace spaces with underscores, then lowercase
//   - prepend pattern + "_" when pattern is non-empty
//
// "My File.TXT" with pattern "backup" becomes "backup_my_file.TXT".
func transformName(name, pattern string) string {
	return name
}

// run reads the directory once and applies the plan entry by entry.
//
// TODO step 03:
//   - os.ReadDir(cfg.Dir); it returns entries already sorted by name
//   - skip directories, and skip files transformName leaves unchanged
//   - dry-run: print "[DRY RUN] old → new" and touch nothing
//   - otherwise os.Rename; wrap the first error with the filename and return it
func run(cfg *Config) error {
	return nil
}

func main() {
	cfg, err := parseFlags()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := run(cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
