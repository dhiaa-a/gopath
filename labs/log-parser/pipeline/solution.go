//go:build solution

package pipeline

import (
	"bufio"
	"fmt"
	"os"
	"sync"

	"gopath.dev/labs/log-parser/parser"
)

// This is the reference implementation. Do not read it until your own run
// of the suite is green. It exists so the repo can prove the suite passes
// against a real implementation: go test -tags solution ./... swaps this
// file in for pipeline.go.

// ProcessFile is the reference ProcessFile.
func ProcessFile(path string, out chan<- parser.LogEntry) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	skipped := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		entry, ok := parser.ParseLine(scanner.Text())
		if !ok {
			skipped++
			continue
		}
		out <- entry
	}
	// Scan() returns false for a clean EOF and for a failure, and the loop
	// above cannot tell them apart. Err() is the only thing that can. Skip
	// this check and a file that blew the token limit halfway through reads
	// as a file that ended, with a summary built from the part you saw.
	if err := scanner.Err(); err != nil {
		return skipped, fmt.Errorf("scan %s: %w", path, err)
	}
	return skipped, nil
}

// fileReport is what a worker says about one file once it is done with it.
// Entries stream out one at a time on their own channel; this is the
// per-file postscript that only exists once the file is finished.
type fileReport struct {
	path    string
	skipped int
	err     error
}

// Run is the reference Run.
func Run(paths []string, workers int) (Summary, error) {
	if workers < 1 {
		workers = 1
	}

	// tasks holds every path, so the sends below never block and no
	// dispatcher goroutine is needed. This works because the file list is
	// known and bounded; a stream of unknown length would need the send
	// loop moved into its own goroutine.
	tasks := make(chan string, len(paths))
	for _, p := range paths {
		tasks <- p
	}
	// Closed here, by the only sender, before any receiving starts. The
	// workers' range loops end when the buffer is drained.
	close(tasks)

	// results is a stream: it is meant to be drained as it fills, so the
	// buffer is a throughput knob, not a correctness requirement.
	results := make(chan parser.LogEntry, 128)
	// reports is not a stream. It is buffered to exactly the number of
	// reports that can ever be sent, which means a worker can post its
	// report and exit without anyone receiving. That is what lets the
	// collector below drain results to completion first and read reports
	// afterwards, in sequence, instead of selecting over both.
	reports := make(chan fileReport, len(paths))

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for path := range tasks {
				skipped, err := ProcessFile(path, results)
				reports <- fileReport{path: path, skipped: skipped, err: err}
			}
		}()
	}

	// One closer, not one per worker. Every worker sends on results, so no
	// single worker knows when the last send has happened; the WaitGroup
	// does. Closing from inside a worker is a "close of closed channel"
	// panic waiting for the second worker to finish.
	go func() {
		wg.Wait()
		close(results)
		close(reports)
	}()

	summary := Summary{ByLevel: make(map[string]int)}
	for entry := range results {
		summary.Total++
		summary.ByLevel[entry.Level]++
		if summary.Earliest.IsZero() || entry.Timestamp.Before(summary.Earliest) {
			summary.Earliest = entry.Timestamp
		}
		if summary.Latest.IsZero() || entry.Timestamp.After(summary.Latest) {
			summary.Latest = entry.Timestamp
		}
	}

	// results is closed, so every worker has finished, so every report is
	// already sitting in the buffer.
	var firstErr error
	for r := range reports {
		summary.Skipped += r.skipped
		if r.err != nil && firstErr == nil {
			firstErr = r.err
		}
	}
	return summary, firstErr
}
