// This suite grades the concurrent half of the lab. It is table-driven,
// like parser_test.go: that file is where the pattern is taught, this one
// is the pattern being used, which is the normal state of affairs from here
// on.
//
// Black-box again: package pipeline_test can only call what pipeline
// exports, so the shape of the pool inside Run is entirely your call. The
// suite checks what Run answers, not how it got there.
package pipeline_test

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gopath.dev/labs/log-parser/parser"
	"gopath.dev/labs/log-parser/pipeline"
)

// The fixtures live at the module root, one directory up, so that the
// tests and the command in cmd/logparse read the same files. Open them and
// read them: every number in this suite is countable by hand.
const testdata = "../testdata"

func path(name string) string { return filepath.Join(testdata, name) }

func ts(t *testing.T, s string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatalf("test fixture is not RFC3339: %s", s)
	}
	return parsed
}

// collect runs fn with an unbuffered channel and a receiver draining it,
// which is how ProcessFile is meant to be called: it streams entries out as
// it scans, and never needs to hold the file in memory.
func collect(t *testing.T, fn func(out chan<- parser.LogEntry) (int, error)) ([]parser.LogEntry, int, error) {
	t.Helper()
	out := make(chan parser.LogEntry)
	done := make(chan []parser.LogEntry, 1)
	go func() {
		var got []parser.LogEntry
		for e := range out {
			got = append(got, e)
		}
		done <- got
	}()
	skipped, err := fn(out)
	close(out)
	return <-done, skipped, err
}

func TestProcessFile(t *testing.T) {
	cases := []struct {
		name    string
		file    string
		entries int // lines that parse
		skipped int // lines that do not
	}{
		{"api log has one undated line", "api.log", 7, 1},
		{"worker log has one blank line", "worker.log", 6, 1},
		{"auth log has one two-field line", "auth.log", 5, 1},
		{"db log is clean", "db.log", 5, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, skipped, err := collect(t, func(out chan<- parser.LogEntry) (int, error) {
				return pipeline.ProcessFile(path(tc.file), out)
			})
			if err != nil {
				t.Fatalf("ProcessFile(%s): got %v, want nil", tc.file, err)
			}
			if len(got) != tc.entries {
				t.Errorf("entries: got %d, want %d", len(got), tc.entries)
			}
			if skipped != tc.skipped {
				t.Errorf("skipped: got %d, want %d", skipped, tc.skipped)
			}
		})
	}
}

// Entries must arrive in file order. One file is read by one worker, top to
// bottom, so there is nothing concurrent about this and no excuse for the
// order to drift.
func TestProcessFileKeepsFileOrder(t *testing.T) {
	got, _, err := collect(t, func(out chan<- parser.LogEntry) (int, error) {
		return pipeline.ProcessFile(path("db.log"), out)
	})
	if err != nil {
		t.Fatalf("ProcessFile: got %v, want nil", err)
	}
	want := []string{"INFO", "DEBUG", "ERROR", "INFO", "WARN"}
	if len(got) != len(want) {
		t.Fatalf("entries: got %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i].Level != want[i] {
			t.Errorf("entry %d level: got %q, want %q", i, got[i].Level, want[i])
		}
	}
}

func TestProcessFileMissingFile(t *testing.T) {
	_, _, err := collect(t, func(out chan<- parser.LogEntry) (int, error) {
		return pipeline.ProcessFile(path("does-not-exist.log"), out)
	})
	// errors.Is, not err != nil: the caller has to be able to tell "no such
	// file" from "permission denied", and that only survives if you wrap
	// with %w instead of flattening with %v.
	if !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("got %v, want an error matching fs.ErrNotExist", err)
	}
}

// The scanner's default buffer tops out at bufio.MaxScanTokenSize, 64KB.
// One line over that and Scan() stops early and reports it through Err().
// A ProcessFile that ignores Err() returns nil here and claims a file it
// read three lines of was a file that ended.
func TestProcessFileStopsOnLongLine(t *testing.T) {
	file := filepath.Join(t.TempDir(), "huge.log")
	var b strings.Builder
	b.WriteString("2024-01-15T10:30:00Z INFO first line\n")
	b.WriteString("2024-01-15T10:30:01Z ERROR " + strings.Repeat("x", 70*1024) + "\n")
	b.WriteString("2024-01-15T10:30:02Z INFO last line\n")
	if err := os.WriteFile(file, []byte(b.String()), 0o644); err != nil {
		t.Fatal(err)
	}

	got, _, err := collect(t, func(out chan<- parser.LogEntry) (int, error) {
		return pipeline.ProcessFile(file, out)
	})
	if !errors.Is(err, bufio.ErrTooLong) {
		t.Fatalf("got %v, want an error matching bufio.ErrTooLong", err)
	}
	// The point of the row above, made concrete: the scan stopped after one
	// line, so a caller who trusted a nil error would have summarised a
	// third of the file and called it a day.
	if len(got) != 1 {
		t.Errorf("entries before the long line: got %d, want 1", len(got))
	}
}

// checkSummary compares two summaries field by field.
//
// Summary cannot be compared with ==: it has a map field, so the compiler
// rejects it outright. Even without the map, Earliest and Latest are
// time.Time, and == on time.Time compares the location pointer as well as
// the instant. Comparing instants takes Equal. See parser_test.go, which
// has a row that fails struct equality against a perfectly correct parser.
func checkSummary(t *testing.T, got, want pipeline.Summary) {
	t.Helper()
	if got.Total != want.Total {
		t.Errorf("Total: got %d, want %d", got.Total, want.Total)
	}
	if got.Skipped != want.Skipped {
		t.Errorf("Skipped: got %d, want %d", got.Skipped, want.Skipped)
	}
	if !maps.Equal(got.ByLevel, want.ByLevel) {
		t.Errorf("ByLevel: got %v, want %v", got.ByLevel, want.ByLevel)
	}
	if !got.Earliest.Equal(want.Earliest) {
		t.Errorf("Earliest: got %v, want %v", got.Earliest, want.Earliest)
	}
	if !got.Latest.Equal(want.Latest) {
		t.Errorf("Latest: got %v, want %v", got.Latest, want.Latest)
	}
}

func allFiles() []string {
	return []string{path("api.log"), path("worker.log"), path("auth.log"), path("db.log")}
}

func wantSummary(t *testing.T) pipeline.Summary {
	t.Helper()
	return pipeline.Summary{
		Total:   23,
		Skipped: 3,
		ByLevel: map[string]int{"INFO": 12, "DEBUG": 3, "WARN": 4, "ERROR": 4},
		// Not 08:59:12Z. testdata/auth.log logs 09:00:00+05:30, which is
		// 03:30:00Z, half an hour before the sun came up on any other line
		// in the fixtures. Compare instants and you find it; compare the
		// timestamp strings and you sort "08:59" before "09:00" and get
		// the wrong answer with total confidence.
		Earliest: ts(t, "2024-01-15T09:00:00+05:30"),
		Latest:   ts(t, "2024-01-15T09:59:59Z"),
	}
}

func TestRun(t *testing.T) {
	got, err := pipeline.Run(allFiles(), 4)
	if err != nil {
		t.Fatalf("Run: got %v, want nil", err)
	}
	checkSummary(t, got, wantSummary(t))
}

// The one property that matters. A pool that returns a different answer
// with eight workers than with one is not faster, it is broken, and the
// bug is usually in who owns the aggregate rather than in the parsing.
func TestRunSameAnswerRegardlessOfWorkers(t *testing.T) {
	want := wantSummary(t)
	for _, workers := range []int{1, 2, 3, 8, 64} {
		t.Run(fmt.Sprintf("workers=%d", workers), func(t *testing.T) {
			got, err := pipeline.Run(allFiles(), workers)
			if err != nil {
				t.Fatalf("Run: got %v, want nil", err)
			}
			checkSummary(t, got, want)
		})
	}
}

// More workers than files, run repeatedly: most workers find the tasks
// channel already empty and exit immediately, which is the interleaving
// that catches a channel closed by its workers instead of by their owner.
func TestRunWithMoreWorkersThanFiles(t *testing.T) {
	want := wantSummary(t)
	for i := 0; i < 50; i++ {
		got, err := pipeline.Run(allFiles(), 32)
		if err != nil {
			t.Fatalf("Run: got %v, want nil", err)
		}
		checkSummary(t, got, want)
	}
}

func TestRunReportsUnreadableFile(t *testing.T) {
	paths := append(allFiles(), path("does-not-exist.log"))
	got, err := pipeline.Run(paths, 4)
	if !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("got %v, want an error matching fs.ErrNotExist", err)
	}
	// The error is a report, not an abort: the four readable files were
	// still read. Bailing out the moment one worker fails means leaving the
	// others mid-send on a channel nobody is draining any more.
	checkSummary(t, got, wantSummary(t))
}

func TestRunWithNoFiles(t *testing.T) {
	got, err := pipeline.Run(nil, 4)
	if err != nil {
		t.Fatalf("Run: got %v, want nil", err)
	}
	if got.Total != 0 || got.Skipped != 0 {
		t.Errorf("got %+v, want an empty summary", got)
	}
}
