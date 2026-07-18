import { Concept } from "../../content"

export const testing: Concept = {
	slug: "testing",
	name: "Testing",
	tagline:
		"go test is a compiler, not a framework, and t.Fatal stops the goroutine it runs on, which is not always the test.",
	summary:
		"There is no test runner to install and no assertion library to choose. <code>go test</code> compiles your package together with every <code>_test.go</code> file into one throwaway binary, runs every <code>func TestXxx(t *testing.T)</code> in it, and reports what failed. The whole API is the methods on <code>*testing.T</code>, and the two that end a test, <code>t.Fatal</code> and <code>t.FailNow</code>, do it by calling <code>runtime.Goexit</code> on the goroutine they are called from. Call one from a goroutine you started inside the test and it ends that goroutine, records a failure, and lets the test run on regardless, which is the single most surprising thing about the package.",
	mentalModel:
		"A test binary is a real program compiled from your package plus its <code>_test.go</code> files, and <code>t</code> is a handle to the one test currently running. Its methods split cleanly in two. <code>t.Error</code> and <code>t.Log</code> record something and return, so the code after them still runs. <code>t.Fatal</code> and <code>t.FailNow</code> record and then unwind, and they unwind by ending the current goroutine, not by throwing something the test catches. That is why the rule the docs state so flatly matters: call <code>FailNow</code> and friends only from the goroutine running the test. From any other goroutine, <code>t.Fatal</code> does not stop the test, and if the test has already returned, touching <code>t</code> at all panics the whole binary.",
	retrievalPrompts: [
		"A background goroutine in your test calls t.Fatal the moment it sees bad data, yet the test sometimes reports PASS. How? || t.Fatal is Log plus FailNow, and FailNow calls runtime.Goexit, which ends only the goroutine it runs on. From a goroutine you started, it kills that goroutine and marks the test failed, but it does not stop the test's own goroutine, which keeps running and can return before anyone reads the failure. Worse: if the test returns first and the goroutine touches t afterward, the runtime panics with \"Fail in goroutine after <name> has completed\". Record from goroutines with t.Error, and synchronise (a WaitGroup, a channel) so the test cannot return before they finish.",
		"go test -run 'TestAuth/valid_token', and you expect the one valid-token subtest. Which subtests actually run? || Every subtest whose name contains valid_token, which includes invalid_token, because the text after each slash is an unanchored regular expression and valid_token is a substring of invalid_token. -run splits on slashes and matches each segment against the matching level of the subtest name. Anchor it: go test -run 'TestAuth/^valid_token$'. The same slicing is why a name with a space is matched as its rewritten form, spaces turned to underscores.",
		"Two identical go test runs; the second prints ok (cached) and finishes instantly. Did your tests execute the second time? || No. go test caches a passing package result keyed by the test binary and a restricted set of cacheable flags, and replays the stored output instead of running anything. That is usually what you want, but when a test depends on state the tool cannot hash, the wall clock, a network service, a file outside the module, the green is stale. A failing result is never cached. -count=1 is the documented way to force a real run.",
	],
	codeExample: `package main

import (
	"sync"
	"testing"
)

// The assertion is correct. Its placement is the bug.
func TestFatalFromGoroutine(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		if got := 2 + 2; got != 5 {
			// t.Fatal calls runtime.Goexit, which unwinds THIS goroutine,
			// not the test's. The test is marked failed but is never told
			// to stop, so nothing here halts the code after wg.Wait below.
			t.Fatalf("got %d, want 5", got)
		}
	}()

	wg.Wait()
	// This line runs. Written on the test's own goroutine, a preceding
	// t.Fatal would have skipped it. The failure fired on another stack.
	t.Log("test body continued past the goroutine's t.Fatal")
}`,
	codeExplanation:
		"This is a test file, not a Playground program: it has no <code>func main</code>, it is a <code>_test.go</code> file you run with <code>go test</code>. The Run link compiles it as a test and runs it, which is exactly the point. It prints <code>x_test.go:19: got 4, want 5</code> from the goroutine's <code>t.Fatalf</code>, then <code>x_test.go:26: test body continued past the goroutine's t.Fatal</code>, then <code>--- FAIL</code>. Read that order. The <code>t.Fatalf</code> did mark the test failed, which is why the run ends in FAIL, but it ended only the goroutine it was called on, so <code>wg.Wait</code> returned and line 26 executed anyway. Any logic you wrote after the wait on the assumption that a failure would already have stopped you is running on a test you believe is dead. Change one thing to see the sharper form: drop the <code>wg.Wait</code> so the test returns before the goroutine fires, keep the binary alive with a second test, and the goroutine's call to <code>t</code> now hits a completed test and panics the whole binary with <code>Fail in goroutine after TestFatalFromGoroutine has completed</code>. The fix in both cases is the same: from a goroutine use <code>t.Error</code>, which records and returns, and make the test wait for the goroutine before it returns.",
	designRationale:
		"The package has almost no surface on purpose. Go shipped <code>testing</code> and <code>go test</code> together in the first release with a hard convention instead of configuration: files end in <code>_test.go</code>, functions are <code>TestXxx(t *testing.T)</code>, and there are no asserts because the language already has <code>if got != want</code>. That convention is what lets <code>go test ./...</code> mean the same thing in every Go repository ever written, with nothing to install. The features grew slowly and each one is a small, composable method rather than a DSL: subtests with <code>t.Run</code> arrived in Go 1.7, <code>t.Helper</code> (which reattributes a failure's line number to the caller) in 1.9, <code>t.Cleanup</code> in 1.14, <code>t.TempDir</code> in 1.15. The <code>t.Fatal</code> goroutine rule is not an API wart, it falls out of a real decision: stopping a test means unwinding it, and the only mechanism Go has to unwind a goroutine from the outside is <code>runtime.Goexit</code>, which by definition acts on the goroutine that calls it. A framework in another language throws an exception that propagates across your call stack; <code>Goexit</code> cannot cross goroutines, so neither can <code>Fatal</code>. The honest cost of that simplicity is the one sharp edge this page is built around.",
	commonMistakes: [
		{
			title: "Calling t.Fatal from a goroutine the test started",
			body: "<code>t.Fatal</code> and <code>t.FailNow</code> call <code>runtime.Goexit</code>, which ends only the calling goroutine. From a spawned goroutine the test is marked failed but keeps running, and if it has already returned, the runtime panics with <code>Fail in goroutine after ... has completed</code>. Use <code>t.Error</code> off the test goroutine and synchronise before returning.",
		},
		{
			title: "Unanchored -run patterns matching more than you meant",
			body: "<code>-run 'TestAuth/valid_token'</code> is a regexp, not a literal, so it also runs <code>invalid_token</code> and anything else containing the substring. Anchor each segment: <code>-run 'TestAuth/^valid_token$'</code>. And remember <code>go test</code> rewrites spaces in subtest names to underscores, so a row named <code>\"valid token\"</code> is selected as <code>valid_token</code>.",
		},
		{
			title: "Trusting a (cached) result after changing untracked state",
			body: "A passing package result is cached on the test binary plus a small set of cacheable flags. Change something the tool cannot see, an environment variable, a service, a file outside the module, and the next run replays the old green without executing anything. <code>-count=1</code> forces a real run. Failing results are never cached.",
		},
		{
			title: "Writing the assertion helper without t.Helper",
			body: "An <code>assertEqual(t, got, want)</code> that omits <code>t.Helper()</code> reports every failure at the line inside the helper where <code>t.Errorf</code> lives, so ten different failing call sites all blame the same useless line. One <code>t.Helper()</code> call at the top of the helper moves the reported line back to the caller, which is the line you actually need.",
		},
		{
			title: "Putting the test in the package instead of package_test",
			body: "A test in <code>package parser</code> can reach unexported identifiers, so it quietly tests internals and locks in your implementation. A test in <code>package parser_test</code> must import the package like any caller and sees only the exported API, which keeps the suite a black-box contract and leaves you free to refactor the inside. GoPath's log-parser suite is <code>parser_test</code> for exactly this reason. Reach inside only when a specific invariant genuinely cannot be checked through the exported surface.",
		},
	],
	relatedSlugs: ["table-driven-tests", "fuzzing", "benchmarks", "tooling", "race-detector"],
}
