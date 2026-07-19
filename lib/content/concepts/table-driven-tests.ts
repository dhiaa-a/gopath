import { Concept } from "../../content"

export const tableDrivenTests: Concept = {
	slug: "table-driven-tests",
	name: "Table-driven tests",
	tagline:
		"Write the checking logic once, list the cases as data, and let t.Run give every row its own name.",
	summary:
		"A table-driven test is the default shape of a Go test, not an advanced move: the standard library is written this way. You declare a slice of anonymous structs, one row per scenario with a name, an input, and the expected output, then a single loop calls <code>t.Run(tc.name, ...)</code> so each row becomes a separately named, separately reported subtest. Adding coverage costs one struct literal instead of one copy-pasted function, and <code>go test -v</code> prints every case by name so a failure tells you which scenario broke. Two details bite people: the subtest name is rewritten (spaces become underscores) before it reaches <code>-run</code>, and the loop variable's meaning under <code>t.Parallel</code> changed in Go 1.22.",
	mentalModel:
		"Separate the two things a test does. One is the logic that checks a result, and you want exactly one copy of it, debugged once. The other is the list of situations you want checked, and you want that to be cheap to extend, because the day a bug shows up you should be able to reproduce it by adding a row and nothing else. The table is that separation made literal: the rows are pure data, the loop is the one copy of the logic, and <code>t.Run</code> turns each row into a real subtest with its own name, its own pass/fail line, and its own selectable ID. Once the shape is a list of data, the obvious next step is to stop writing the data by hand, which is exactly what fuzzing does.",
	retrievalPrompts: [
		"A table row is named \"only two fields\". Your teammate runs go test -run 'TestParse/only two fields' and gets \"no tests to run\". Why, and what runs it? || go test rewrites subtest names before matching: any space becomes an underscore, so the subtest is registered as only_two_fields and the pattern with a literal space matches nothing. Run it with go test -run 'TestParse/only_two_fields'. The rewrite is also why two rows that differ only in spacing can collide into the same subtest ID and get a #01 suffix.",
		"Pre-1.22 habit: your parallel subtests all assert against the last row's expected value and pass anyway. What broke, and what changed in Go 1.22? || Before Go 1.22 the loop variable tc was one variable reused every iteration, so a closure that ran later (which is what t.Parallel arranges) saw whatever tc held last: the final row. Every subtest tested the last case under a different name, and if the code was correct for that case they all passed. The fix was tc := tc inside the loop. Since Go 1.22 the loop variable is a fresh variable per iteration, so the copy is unnecessary and the bug is gone, but only if the module's go directive is 1.22 or higher, since that line is what enables the new semantics.",
		"Inside a subtest, ok came back wrong. Do you use t.Errorf or t.Fatalf on the next line? || t.Fatalf. When the ok result is already wrong, the fields underneath are noise, and checking them buries the real failure under follow-on errors about a value that was never valid. t.Fatalf stops this one subtest and lets the other rows keep running, because it ends only the current subtest's goroutine. Reserve t.Errorf for independent checks within a row, where a wrong Level should not hide a wrong Message.",
	],
	codeExample: `package main

import (
	"strings"
	"testing"
)

// levelOf pulls the LEVEL out of "TIMESTAMP LEVEL message". A tiny pure
// function is exactly what a table tests exhaustively and cheaply.
func levelOf(line string) (string, bool) {
	parts := strings.SplitN(line, " ", 3)
	if len(parts) < 3 {
		return "", false
	}
	return parts[1], true
}

func TestLevelOf(t *testing.T) {
	// The table. Its element type is an anonymous struct declared inline,
	// because it exists for this test alone. One row is one scenario.
	cases := []struct {
		name string // becomes the subtest ID; spaces turn into underscores
		line string
		want string
		ok   bool
	}{
		{"info line", "2024-01-15T10:30:00Z INFO up", "INFO", true},
		{"warn line", "2024-01-15T10:31:00Z WARN slow", "WARN", true},
		{"two fields", "2024-01-15T10:30:00Z INFO", "", false},
		{"empty", "", "", false},
	}

	for _, tc := range cases {
		// Since Go 1.22 tc is a fresh variable each iteration, so this
		// closure captures the row safely even though it runs later, in
		// parallel. Before 1.22 this needed a tc := tc line right here.
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := levelOf(tc.line)
			// got first, want second: the convention every reader assumes.
			if ok != tc.ok {
				t.Fatalf("levelOf(%q) ok = %v, want %v", tc.line, ok, tc.ok)
			}
			if got != tc.want {
				t.Errorf("levelOf(%q) = %q, want %q", tc.line, got, tc.want)
			}
		})
	}
}`,
	codeExplanation:
		"This is a <code>_test.go</code> file, run with <code>go test</code>, not a <code>func main</code> program; the Run link compiles and runs it as a test. Under <code>-v</code> it prints a <code>PAUSE</code> and later a <code>CONT</code> for each subtest (that is <code>t.Parallel</code> at work) and passes all four: <code>TestLevelOf/info_line</code>, <code>/warn_line</code>, <code>/two_fields</code>, <code>/empty</code>. Notice the name rewriting in that output: the row named <code>\"two fields\"</code> is reported and selected as <code>two_fields</code>, which is the trap in <code>-run</code>. The <code>t.Parallel</code> line is the reason the Go 1.22 loop-variable change matters here and not just in theory. Set the module's <code>go.mod</code> to <code>go 1.21</code> and run it: all four subtests capture the same <code>tc</code>, every one tests the <code>empty</code> row under its own name, and because <code>levelOf</code> handles that row correctly they all still pass, a green suite that tests one case four times. Set it to <code>go 1.22</code> and each subtest captures its own row again. Same toolchain, same source, different semantics, chosen entirely by the <code>go</code> directive. One more thing the parallelism exposes: the parent <code>TestLevelOf</code> returns before any paused child runs, so a cleanup written as <code>defer</code> in the parent fires while the subtests are still pending, which is why setup shared across parallel rows belongs in <code>t.Cleanup</code>, not <code>defer</code>.",
	designRationale:
		"The table shape is a direct consequence of Go not having assertion libraries or parameterised-test annotations. In a language with those, you might write a decorator that feeds arguments to a test method; in Go the cheapest way to feed many inputs to one check is a slice and a <code>for</code> loop, so that is what everyone converged on, and <code>t.Run</code> (added in Go 1.7) made it first-class by giving each iteration a real subtest. The anonymous struct is a deliberate choice too: the row type exists for one test, so naming it at package level would advertise a reuse that never comes and force the next reader to check whether anything depends on it. The Go 1.22 loop-variable change is the interesting bit of history. For a decade the language reused one variable across loop iterations, which was fine until closures outlived the iteration, and parallel subtests are the canonical case where they do. The community papered over it with the <code>tc := tc</code> shadow line for years. Go 1.22 changed the semantics so each iteration gets its own variable, and made it opt-in per module through the <code>go</code> directive so old code could not silently change meaning. That is why the version in your <code>go.mod</code>, not the version of the toolchain you run, decides which behaviour you get.",
	commonMistakes: [
		{
			title: "Selecting a subtest with its human name, spaces and all",
			body: "Subtest names are rewritten before matching, so <code>go test -run 'TestParse/only two fields'</code> matches nothing. Use the rewritten form <code>only_two_fields</code>. Two rows whose names differ only in punctuation that gets normalised can also collide and gain a <code>#01</code> suffix, so keep row names distinct after rewriting.",
		},
		{
			title: "Carrying the tc := tc line as a ritual, or dropping it on old Go",
			body: "Since Go 1.22 the per-iteration copy is unnecessary. But the fix is keyed to the module's <code>go</code> directive, not the toolchain, so a module still declaring <code>go 1.21</code> gets the old shared-variable behaviour even under a new compiler, and parallel subtests that captured <code>tc</code> will all see the last row. Know which side of 1.22 your <code>go.mod</code> is on.",
		},
		{
			title: "Using t.Errorf where t.Fatalf belongs, and the reverse",
			body: "If a wrong <code>ok</code> or a <code>nil</code>/non-nil mismatch makes the rest of the row meaningless, use <code>t.Fatalf</code> so you do not bury the real failure under noise from a value that was never valid. If the checks are independent, use <code>t.Errorf</code> so one wrong field does not hide another. Reaching for <code>Fatalf</code> everywhere throws away information.",
		},
		{
			title: "Reversing got and want in the failure message",
			body: "Go's universal convention is <code>got %v, want %v</code>, got first. Reversing it produces messages that read backwards at 2am and mislead every reader who trusts the convention. The compiler will not catch it because both are the same type; only discipline will.",
		},
		{
			title: "Comparing structs with == when a field needs a method",
			body: "A whole-struct <code>got != want</code> is tempting for one line of comparison, but <code>==</code> on a struct compares every field including ones like <code>time.Time</code> that carry an unexported <code>*Location</code> pointer, so two values naming the same instant can compare unequal. Compare those fields with their own method (<code>Timestamp.Equal</code>) and let the plain string fields take <code>==</code>. GoPath's log-parser suite has a row that exists only to force this.",
		},
	],
	relatedSlugs: ["testing", "fuzzing", "benchmarks", "race-detector", "time"],
}
