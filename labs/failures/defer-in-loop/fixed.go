//go:build fixed

// The fix: give each report its own function, because defer is scoped to
// the function, not the loop. writeReport owns one file's whole lifetime:
// open, write, flush, close. Its deferred call runs when IT returns, once
// per iteration, so the bytes are on disk and the handle is closed before
// the next report starts, and long before verification reads anything
// back. Flush is called explicitly so its error is checked, and the
// deferred Close feeds its error into the named return instead of
// discarding it.
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

	// Second count, kept from the REP-411 investigation: it now agrees
	// with the verify step, because every report is flushed and closed
	// before exportAll ever counts.
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
// batch back. The per-report work lives in writeReport so that each file
// is flushed and closed before the loop moves on.
func exportAll(dir string, users []user) (int, int, error) {
	for _, u := range users {
		if err := writeReport(filepath.Join(dir, u.name+".txt"), u); err != nil {
			return 0, 0, err
		}
	}

	complete, empty, err := countComplete(dir)
	if err != nil {
		return 0, 0, err
	}
	fmt.Printf("verified: %d of %d reports complete (%d empty)\n", complete, len(users), empty)
	return complete, empty, nil
}

// writeReport is the unit of resource lifetime: one call, one file, opened
// and fully released by the time it returns.
func writeReport(path string, u user) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}()

	w := bufio.NewWriter(f)
	fmt.Fprintf(w, "activity report: %s\n", u.name)
	fmt.Fprintf(w, "events this week: %d\n", u.events)
	fmt.Fprintln(w, footer)
	return w.Flush()
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
