// Command seed proves the conformance suite can fail.
//
// For each seed in seeds.go it copies the reference implementation, applies a
// named bug, compiles it, and runs the checks that bug is supposed to trip.
// Every one of them must go red. A seed that applies cleanly, builds, and
// leaves the suite green is a hole in the suite, and this command exits 1 for
// it just as loudly as for a broken seed.
//
// The failure modes are kept apart on purpose, because they mean different
// things:
//
//	stale    the code it patches has moved, so the bug was never introduced
//	broken   the patched code does not compile, so nothing was proven
//	missed   the bug went in, it built, and the suite passed anyway
//
// Only the last one is a bug in the suite. The first two are bugs in here, and
// silently treating either as a pass is how a harness rots into decoration.
//
//	go run ./seed                    every seed
//	go run ./seed -seed data-race    one of them
//	go run ./seed -list              what the seeds are, and what they catch
package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopath.dev/labs/capstone/internal/conform"
	"gopath.dev/labs/capstone/internal/harness"
)

func main() {
	source := flag.String("source", "./reference", "implementation to seed bugs into")
	only := flag.String("seed", "", "run only the seed with this name")
	list := flag.Bool("list", false, "list the seeds and exit")
	flag.Parse()

	if *list {
		listSeeds()
		return
	}

	if err := checkNamesExist(); err != nil {
		fmt.Fprintf(os.Stderr, "seed: %v\n", err)
		os.Exit(1)
	}

	all := seeds()
	if *only != "" {
		var picked []seed
		for _, s := range all {
			if s.Name == *only {
				picked = append(picked, s)
			}
		}
		if len(picked) == 0 {
			fmt.Fprintf(os.Stderr, "seed: no seed named %q\n", *only)
			os.Exit(1)
		}
		all = picked
	}

	fmt.Printf("── seeded bugs: %d seed(s) against %s\n", len(all), *source)

	failures := 0
	for _, s := range all {
		if err := prove(*source, s); err != nil {
			failures++
			fmt.Printf("  FAIL  %-20s %s\n", s.Name, err)
			continue
		}
		fmt.Printf("  ok    %-20s caught by %s\n", s.Name, strings.Join(s.Catches, ", "))
	}

	fmt.Println()
	if failures > 0 {
		fmt.Printf("seed: %d of %d seed(s) not caught\n", failures, len(all))
		os.Exit(1)
	}
	fmt.Printf("seed: ok — %d of %d seed(s) caught\n", len(all), len(all))
}

// prove applies one seed and requires the suite to notice.
func prove(source string, s seed) error {
	dir, err := os.MkdirTemp("", "linkd-seed-*")
	if err != nil {
		return fmt.Errorf("temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	if err := copyPackage(source, dir); err != nil {
		return err
	}
	for _, e := range s.Edits {
		if err := apply(dir, e); err != nil {
			return fmt.Errorf("stale: %w", err)
		}
	}

	target, err := harness.Build(dir)
	if err != nil {
		return fmt.Errorf("broken: the seeded code does not compile, so nothing was proven\n%s", indent(err.Error()))
	}

	var log bytes.Buffer
	sum := conform.RunNames(target, s.Catches, &log)
	if len(sum.Results) != len(s.Catches) {
		return fmt.Errorf("stale: names %v, but only %d check(s) by those names exist", s.Catches, len(sum.Results))
	}

	var missed []string
	for _, r := range sum.Results {
		if !r.Failed() {
			missed = append(missed, r.Check.Name)
		}
	}
	if len(missed) > 0 {
		return fmt.Errorf("missed: the bug went in and built, but %s still passed", strings.Join(missed, ", "))
	}
	return nil
}

// copyPackage copies the .go files of a package into dir and gives them a
// module of their own, so a seeded build never touches the real tree.
func copyPackage(source, dir string) error {
	entries, err := os.ReadDir(source)
	if err != nil {
		return fmt.Errorf("reading %s: %w", source, err)
	}
	copied := 0
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".go") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(source, e.Name()))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dir, e.Name()), raw, 0o600); err != nil {
			return err
		}
		copied++
	}
	if copied == 0 {
		return fmt.Errorf("no .go files in %s", source)
	}
	return os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module linkdseed\n\ngo 1.23\n"), 0o600)
}

// apply makes one edit, insisting the text it is looking for appears exactly
// once. Zero matches means the reference moved and the bug was never
// introduced; more than one means the edit is not the edit it claims to be.
// Both are errors, and neither is a pass.
func apply(dir string, e edit) error {
	path := filepath.Join(dir, e.File)
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading %s: %w", e.File, err)
	}
	text := string(raw)

	switch n := strings.Count(text, e.Find); n {
	case 1:
	case 0:
		return fmt.Errorf("%s no longer contains the code this seed patches:\n%s", e.File, indent(e.Find))
	default:
		return fmt.Errorf("%s contains the code this seed patches %d times; it must be unique", e.File, n)
	}

	return os.WriteFile(path, []byte(strings.Replace(text, e.Find, e.Replace, 1)), 0o600)
}

// checkNamesExist catches a rename in the suite before it turns into a seed
// that silently proves nothing.
func checkNamesExist() error {
	known := map[string]bool{}
	for _, n := range conform.Names() {
		known[n] = true
	}
	var unknown []string
	for _, s := range seeds() {
		if len(s.Catches) == 0 {
			return fmt.Errorf("seed %q names no checks to catch it", s.Name)
		}
		for _, c := range s.Catches {
			if !known[c] {
				unknown = append(unknown, fmt.Sprintf("%s -> %s", s.Name, c))
			}
		}
	}
	if len(unknown) > 0 {
		sort.Strings(unknown)
		return fmt.Errorf("these seeds name checks that do not exist:\n%s", indent(strings.Join(unknown, "\n")))
	}
	return nil
}

func listSeeds() {
	all := seeds()
	fmt.Printf("%d seeded bug(s). Each must be caught by every check it names.\n", len(all))

	for _, s := range all {
		where := "labs/failures/" + s.Class
		if s.Class == "" {
			where = "specific to this spec, not a failure lab"
		}
		fmt.Printf("\n%s\n", s.Name)
		fmt.Printf("  breaks     %s\n", s.Why)
		fmt.Printf("  read more  %s\n", where)
		fmt.Printf("  caught by  %s\n", strings.Join(s.Catches, ", "))
	}
}

func indent(s string) string {
	return "        " + strings.ReplaceAll(strings.TrimRight(s, "\n"), "\n", "\n        ")
}
