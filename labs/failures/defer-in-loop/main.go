//go:build !fixed

// reportgen writes one activity report per user into a staging directory,
// then verifies the batch by reading every file back: the job may only
// succeed if each report ends with the footer line the downstream importer
// looks for. Ops runs it nightly.
package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const footer = "-- end of report --"

type user struct {
	name   string
	events int
}

// roster is a fixed fixture: production reads the user table, the lab
// ships a deterministic copy so every run writes the same 40 reports.
func roster() []user {
	users := make([]user, 40)
	for i := range users {
		users[i] = user{name: fmt.Sprintf("user%02d", i+1), events: (i*7)%13 + 1}
	}
	return users
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "reportgen:", err)
		os.Exit(1)
	}
}

func run() error {
	users := roster()

	dir, err := os.MkdirTemp("", "reportgen-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)

	complete, empty, err := exportAll(dir, users)
	if err != nil {
		return err
	}

	// Second count, added while debugging REP-411: the verify step inside
	// exportAll keeps reporting empty files, yet the staging directory
	// always looks fine when inspected by hand after the job dies.
	again, _, err := countComplete(dir)
	if err != nil {
		return err
	}
	fmt.Printf("re-check from main: %d of %d reports complete\n", again, len(users))

	if complete != len(users) {
		return fmt.Errorf("verification failed: %d of %d reports complete (%d empty)", complete, len(users), empty)
	}
	return nil
}

// exportAll writes every report, then verifies its own work by reading the
// batch back. Each report uses the usual shape: open the file, register
// the cleanup, write through a buffered writer.
func exportAll(dir string, users []user) (int, int, error) {
	for _, u := range users {
		f, err := os.Create(filepath.Join(dir, u.name+".txt"))
		if err != nil {
			return 0, 0, err
		}
		defer f.Close()
		w := bufio.NewWriter(f)
		defer w.Flush()

		fmt.Fprintf(w, "activity report: %s\n", u.name)
		fmt.Fprintf(w, "events this week: %d\n", u.events)
		fmt.Fprintln(w, footer)
	}

	complete, empty, err := countComplete(dir)
	if err != nil {
		return 0, 0, err
	}
	fmt.Printf("verified: %d of %d reports complete (%d empty)\n", complete, len(users), empty)
	return complete, empty, nil
}

// countComplete reads every file in dir and counts the ones that end with
// the importer's footer. Empty files are counted separately so the failure
// message can say which kind of bad batch this is.
func countComplete(dir string) (int, int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, 0, err
	}
	complete, empty := 0, 0
	for _, e := range entries {
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return 0, 0, err
		}
		switch {
		case len(data) == 0:
			empty++
		case strings.HasSuffix(strings.TrimRight(string(data), "\n"), footer):
			complete++
		}
	}
	return complete, empty, nil
}
