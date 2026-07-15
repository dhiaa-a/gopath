// Command logparse summarises a directory of .log files.
//
// This file ships finished. It is not graded and there is nothing to fill
// in: flags and directory reading were the first project on GoPath, and
// repeating them here would cost you an evening and teach you nothing. It
// is here so that the pool you write in pipeline/ has something to be run
// by, and so you can watch the summary change as you implement it:
//
//	go run ./cmd/logparse -workers 8 testdata
//
// Against the stub it prints an empty summary. That is the "before".
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"gopath.dev/labs/log-parser/pipeline"
)

func main() {
	workers := flag.Int("workers", 4, "number of parsing workers")
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "usage: logparse [-workers N] <dir>\n\n")
		fmt.Fprintf(flag.CommandLine.Output(), "Summarises every .log file in <dir>.\n\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() != 1 {
		flag.Usage()
		os.Exit(2)
	}

	paths, err := logFiles(flag.Arg(0))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if len(paths) == 0 {
		fmt.Fprintf(os.Stderr, "no .log files in %s\n", flag.Arg(0))
		os.Exit(1)
	}

	start := time.Now()
	summary, runErr := pipeline.Run(paths, *workers)
	elapsed := time.Since(start)

	// The error is printed but does not replace the summary: Run reports
	// what it could not read and still returns what it could.
	if runErr != nil {
		fmt.Fprintf(os.Stderr, "warning: %v\n", runErr)
	}
	printSummary(summary, len(paths), *workers, elapsed)
	if runErr != nil {
		os.Exit(1)
	}
}

func logFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	var paths []string
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".log" {
			continue
		}
		paths = append(paths, filepath.Join(dir, e.Name()))
	}
	return paths, nil
}

func printSummary(s pipeline.Summary, files, workers int, elapsed time.Duration) {
	fmt.Printf("%d file(s), %d worker(s), %s\n", files, workers, elapsed.Round(time.Microsecond))
	fmt.Printf("parsed:  %d\n", s.Total)
	fmt.Printf("skipped: %d\n", s.Skipped)

	// Sorted, because ranging a map is randomised by the runtime and this
	// output is meant to be diffable between runs.
	levels := make([]string, 0, len(s.ByLevel))
	for level := range s.ByLevel {
		levels = append(levels, level)
	}
	sort.Strings(levels)
	for _, level := range levels {
		fmt.Printf("  %-6s %d\n", level, s.ByLevel[level])
	}

	if s.Total > 0 {
		// UTC, so that two entries written in different zones can be read
		// against each other. Earliest here is a +05:30 line.
		fmt.Printf("earliest: %s\n", s.Earliest.UTC().Format(time.RFC3339))
		fmt.Printf("latest:   %s\n", s.Latest.UTC().Format(time.RFC3339))
	}
}
