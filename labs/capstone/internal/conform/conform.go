// Package conform holds the capstone conformance checks and the small runner
// that executes them.
//
// It is a package rather than a main so that the seeded-bug prover can run the
// same checks and read the results as values. A prover that scraped the
// suite's printed output would pass the day somebody reworded a message, and a
// harness that can drift out of agreement with itself is not a harness.
package conform

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"gopath.dev/labs/capstone/internal/harness"
)

// Check is one requirement from SPEC.md, made executable.
type Check struct {
	// Name is stable and is what the seeded-bug table refers to. Renaming one
	// is a breaking change to seeds.go.
	Name string
	// Section points at the part of SPEC.md this comes from.
	Section string
	Run     func(e *Env, t *T)
}

// T collects what went wrong inside one check. Deliberately shaped like
// testing.T: the reader has met this API by now, and the capstone is not the
// place to make them learn a new one.
type T struct {
	errs    []string
	notes   []string
	skipped string
}

type fatal struct{}

// Errorf records a failure and keeps going, so one run can report everything
// that is wrong rather than the first thing.
func (t *T) Errorf(format string, args ...any) {
	t.errs = append(t.errs, fmt.Sprintf(format, args...))
}

// Fatalf records a failure and abandons the check, for when continuing would
// only produce noise (no server to talk to, no link to look at).
func (t *T) Fatalf(format string, args ...any) {
	t.Errorf(format, args...)
	panic(fatal{})
}

// Skipf abandons the check without failing it, and says why. Used only where
// the platform genuinely cannot run it.
func (t *T) Skipf(format string, args ...any) {
	t.skipped = fmt.Sprintf(format, args...)
	panic(fatal{})
}

// Logf attaches context that is printed when the check fails.
func (t *T) Logf(format string, args ...any) {
	t.notes = append(t.notes, fmt.Sprintf(format, args...))
}

// Env is one check's private world: its own temp directory, its own store
// file, and whatever processes it starts.
type Env struct {
	Target *harness.Target
	Dir    string
	Tokens string

	t     *T
	procs []*harness.Proc
}

// Data is the store path for this check.
func (e *Env) Data() string { return filepath.Join(e.Dir, "store.json") }

// Start runs the target with the default rate limit.
func (e *Env) Start() *harness.Proc { return e.StartRate(100) }

// StartRate runs the target with a specific per-token rate.
func (e *Env) StartRate(rate float64) *harness.Proc {
	return e.StartWith(harness.Options{Data: e.Data(), Tokens: e.Tokens, Rate: rate})
}

// StartWith runs the target with explicit options and fails the check if it
// will not come up.
func (e *Env) StartWith(opts harness.Options) *harness.Proc {
	p, err := e.Target.Start(opts)
	if err != nil {
		e.t.Fatalf("starting the server: %v", err)
	}
	e.procs = append(e.procs, p)
	return p
}

func (e *Env) stopAll() {
	for _, p := range e.procs {
		p.Kill()
	}
	e.procs = nil
}

// Result is what one check did.
type Result struct {
	Check   Check
	Errors  []string
	Notes   []string
	Skipped string
}

func (r Result) Failed() bool     { return len(r.Errors) > 0 }
func (r Result) WasSkipped() bool { return r.Skipped != "" && len(r.Errors) == 0 }

// Summary is what a whole run did.
type Summary struct {
	Results []Result
	Passed  int
	Failed  int
	Skipped int
}

// Run executes every check whose name contains filter, writing progress to w.
// Pass an empty filter for all of them, and a nil writer to run quietly.
func Run(target *harness.Target, filter string, w io.Writer) Summary {
	return run(target, func(c Check) bool {
		return filter == "" || strings.Contains(c.Name, filter)
	}, w)
}

// RunNames executes exactly the named checks. The seeded-bug prover uses this:
// it needs the specific checks a seed is supposed to trip, not everything that
// happens to share a prefix with them.
func RunNames(target *harness.Target, names []string, w io.Writer) Summary {
	want := make(map[string]bool, len(names))
	for _, n := range names {
		want[n] = true
	}
	return run(target, func(c Check) bool { return want[c.Name] }, w)
}

// Names lists every check name, so a caller can verify the names it refers to
// still exist.
func Names() []string {
	out := make([]string, 0, len(All()))
	for _, c := range All() {
		out = append(out, c.Name)
	}
	return out
}

func run(target *harness.Target, keep func(Check) bool, w io.Writer) Summary {
	if w == nil {
		w = io.Discard
	}
	var sum Summary

	for _, c := range All() {
		if !keep(c) {
			continue
		}
		res := runOne(target, c)
		sum.Results = append(sum.Results, res)

		switch {
		case res.Failed():
			sum.Failed++
			fmt.Fprintf(w, "  FAIL  %s\n", c.Name)
			for _, note := range res.Notes {
				fmt.Fprintf(w, "          %s\n", note)
			}
			for _, e := range res.Errors {
				fmt.Fprintf(w, "        %s\n", indent(e))
			}
			fmt.Fprintf(w, "        SPEC.md %s\n", c.Section)
		case res.WasSkipped():
			sum.Skipped++
			fmt.Fprintf(w, "  skip  %s (%s)\n", c.Name, res.Skipped)
		default:
			sum.Passed++
			fmt.Fprintf(w, "  ok    %s\n", c.Name)
		}
	}
	return sum
}

func runOne(target *harness.Target, c Check) (res Result) {
	t := &T{}
	dir, err := os.MkdirTemp("", "linkd-check-*")
	if err != nil {
		return Result{Check: c, Errors: []string{"creating temp dir: " + err.Error()}}
	}
	defer os.RemoveAll(dir)

	tokens, err := harness.WriteTokens(dir, map[string]string{"tok_alice": "alice", "tok_bob": "bob"})
	if err != nil {
		return Result{Check: c, Errors: []string{"writing tokens: " + err.Error()}}
	}

	e := &Env{Target: target, Dir: dir, Tokens: tokens, t: t}
	defer e.stopAll()

	func() {
		defer func() {
			switch r := recover(); r.(type) {
			case nil, fatal:
			default:
				t.Errorf("the check itself panicked: %v", r)
			}
		}()
		c.Run(e, t)
	}()

	return Result{Check: c, Errors: t.errs, Notes: t.notes, Skipped: t.skipped}
}

func indent(s string) string {
	return strings.ReplaceAll(s, "\n", "\n        ")
}
