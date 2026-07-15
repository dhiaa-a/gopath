// Reference implementation of the file renamer (GoPath Tier 1, Project 1).
//
// Stay out of this file until your check run is green. Then read it and
// compare decisions, not just output: where validation happens, what owns
// I/O, how errors pick up context on the way out.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Config carries everything the program needs past the boundary. Once a
// *Config exists the input is trusted; nothing after parseFlags re-validates.
type Config struct {
	Dir     string // directory to scan
	Pattern string // prefix for every renamed file
	DryRun  bool   // print the plan instead of executing it
}

// parseFlags is the input boundary: register, parse, validate, and only then
// hand back a Config. Every problem is collected into one message so the
// user fixes the whole command line in one round trip.
func parseFlags() (*Config, error) {
	dir := flag.String("dir", ".", "directory to scan")
	pattern := flag.String("pattern", "", "prefix to prepend to every renamed file (required)")
	dryRun := flag.Bool("dry-run", false, "print each rename without executing it")
	flag.Parse()

	var problems []string
	if *pattern == "" {
		problems = append(problems, "--pattern is required")
	}
	info, err := os.Stat(*dir)
	if err != nil {
		problems = append(problems, fmt.Sprintf("invalid --dir: %v", err))
	} else if !info.IsDir() {
		problems = append(problems, fmt.Sprintf("%s is not a directory", *dir))
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("%s", strings.Join(problems, "; "))
	}
	return &Config{Dir: *dir, Pattern: *pattern, DryRun: *dryRun}, nil
}

// transformName is pure: same input, same output, no filesystem. The
// extension survives byte for byte; only the base name is rewritten.
func transformName(name, pattern string) string {
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	base = strings.ReplaceAll(base, " ", "_")
	base = strings.ToLower(base)
	if pattern != "" {
		base = pattern + "_" + base
	}
	return base + ext
}

// run reads the directory once and applies the plan entry by entry.
// Directories are skipped, unchanged names are skipped, and the first rename
// error returns immediately, wrapped with the filename that caused it.
func run(cfg *Config) error {
	entries, err := os.ReadDir(cfg.Dir)
	if err != nil {
		return fmt.Errorf("read %s: %w", cfg.Dir, err)
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		newName := transformName(e.Name(), cfg.Pattern)
		if newName == e.Name() {
			continue
		}
		if cfg.DryRun {
			fmt.Printf("[DRY RUN] %s → %s\n", e.Name(), newName)
			continue
		}
		oldPath := filepath.Join(cfg.Dir, e.Name())
		newPath := filepath.Join(cfg.Dir, newName)
		if err := os.Rename(oldPath, newPath); err != nil {
			return fmt.Errorf("rename %s: %w", e.Name(), err)
		}
	}
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
