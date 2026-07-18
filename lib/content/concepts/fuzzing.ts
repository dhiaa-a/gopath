import { Concept } from "../../content"

export const fuzzing: Concept = {
	slug: "fuzzing",
	name: "Fuzzing",
	tagline:
		"A table checks the inputs you thought of. A fuzzer finds the one you didn't, then writes it down forever.",
	summary:
		"Native fuzzing has been in the toolchain since Go 1.18. A fuzz target looks like a table-driven test with the table taken away: you write <code>func FuzzXxx(f *testing.F)</code>, register a few seed inputs with <code>f.Add</code>, and hand <code>f.Fuzz</code> a function that takes <code>*testing.T</code> plus your fuzzed arguments and asserts a property that must hold for every input. Run it as an ordinary test and only the seeds execute. Run it with <code>go test -fuzz</code> and the engine mutates inputs, guided by code coverage, looking for one that breaks the property. When it finds one it minimises it and writes it to <code>testdata/fuzz/</code>, where plain <code>go test</code> replays it forever as a regression case. It runs until it finds a failure or you stop it, which is why CI bounds it with <code>-fuzztime</code>.",
	mentalModel:
		"A table encodes a claim about specific inputs: for these ten lines, the output is these ten things. A fuzz target encodes a claim about all inputs: for any string at all, this property holds, round-trips are lossless, the output is always valid, the function never panics. That shift from examples to properties is the whole idea. You are no longer responsible for imagining the pathological input, because the engine generates millions of them and keeps the ones that reach new code, so it walks into the branches your seeds never touched. When it finds a counterexample it shrinks it to something you can read and commits it to disk, so the bug it discovered becomes a permanent, named test the moment you fix it.",
	retrievalPrompts: [
		"You run go test on a package with a FuzzXxx target and it passes in milliseconds. Did it fuzz anything? || No. Without the -fuzz flag a fuzz target runs only its seed corpus: the f.Add inputs plus anything already in testdata/fuzz. It behaves exactly like a small table-driven test, which is what keeps it in your normal CI. Actual fuzzing happens only under go test -fuzz=FuzzXxx, which mutates inputs and runs until it fails or hits -fuzztime. The fast green is the seeds passing, not the space being explored.",
		"Your fuzz target asserts got == want against a hand-written expected value. Why will it not even compile as a fuzz target, and what should it assert instead? || Because there is no want: the input is generated, so you cannot precompute the answer to compare against. A fuzz target asserts a property that holds for every input without knowing the specific case: a round-trip (Decode(Encode(x)) equals x), an invariant (the output is always valid UTF-8), or simply that the function does not panic. If you find yourself wanting a per-input expected value, you want a table, not a fuzzer.",
		"CI runs go test -fuzz=Fuzz and the job never finishes. What did you forget, and where did the failing input go if it had found one? || -fuzz runs until it finds a failure or you stop it; its default is to run forever. In CI you bound it with -fuzztime (a duration like 30s, or Nx for a fixed count). Had it found a crash, it would have minimised the input and written it under testdata/fuzz/FuzzName/, a plain-text file you commit; from then on ordinary go test replays it as a named regression subtest, no -fuzz flag needed.",
	],
	codeExample: `package main

import (
	"testing"
	"unicode/utf8"
)

// Truncate shortens s to at most maxBytes. This exact function ships in a
// lot of real codebases, and it has a bug no reasonable table would catch.
func Truncate(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	return s[:maxBytes]
}

func FuzzTruncate(f *testing.F) {
	// Seeds double as a table: the cases a careful reviewer writes by hand.
	f.Add("hello", 3)
	f.Add("", 0)
	f.Add("go", 10)

	f.Fuzz(func(t *testing.T, s string, maxBytes int) {
		if maxBytes < 0 {
			t.Skip()
		}
		got := Truncate(s, maxBytes)
		// Property 1: the result never exceeds the limit.
		if len(s) > maxBytes && len(got) > maxBytes {
			t.Fatalf("Truncate(%q, %d) = %q: over the limit", s, maxBytes, got)
		}
		// Property 2 (the invariant): valid UTF-8 in, valid UTF-8 out.
		if utf8.ValidString(s) && !utf8.ValidString(got) {
			t.Fatalf("Truncate(%q, %d) = %q: valid in, INVALID UTF-8 out", s, maxBytes, got)
		}
	})
}`,
	codeExplanation:
		"This is a <code>_test.go</code> file, run with <code>go test</code>, not a <code>func main</code> program. The Run link executes only the three seeds, and all three pass, because none of them straddles a rune boundary. That green is itself the lesson: the seeds are the table a careful reviewer would write, and the table is blind to this bug. Run it as a fuzzer instead, <code>go test -fuzz=FuzzTruncate -fuzztime=20s</code>, and within a couple of seconds it fails. A representative failure from one run: <code>Truncate(\"00݈\", 3) = \"00\\xdd\": valid in, INVALID UTF-8 out</code>. The character before the cut is a two-byte rune; slicing at byte 3 keeps its lead byte <code>\\xdd</code> and drops the continuation byte, leaving a string that is no longer valid UTF-8. A table would only have caught this if someone had already thought to write a multi-byte input sitting on exactly the wrong byte, which is precisely the input nobody thinks of. The engine writes the minimised case to <code>testdata/fuzz/FuzzTruncate/</code> as a small text file (<code>go test fuzz v1</code> then the two arguments), and from then on plain <code>go test</code> runs it as a named subtest and fails until you fix <code>Truncate</code> to back the cut up to a rune boundary with <code>utf8.RuneStart</code>. Fuzzing here is not a Playground demo, it is a local command that turns a discovered crash into a committed regression test.",
	designRationale:
		"Fuzzing was bolted onto the language's existing test machinery rather than shipped as a separate tool, and that choice explains its shape. A <code>FuzzXxx</code> function lives in a <code>_test.go</code> file next to your <code>TestXxx</code> functions, its seeds run in normal <code>go test</code>, and its found inputs are ordinary files in <code>testdata</code>, so a fuzz target costs nothing until you point the engine at it and integrates with everything you already do. The two-corpus design is the part worth understanding: the seed corpus is code you write and commit, while the generated corpus, the millions of coverage-expanding inputs the engine keeps, lives in the build cache and is never committed, so your repository stays small while the engine's memory persists locally. Coverage guidance is what makes it more than random input: the engine favours mutations that reach new lines, so it effectively searches for the branches your tests miss. And it runs forever by default because fuzzing is open-ended: there is no point at which every input has been tried, so the tool bounds itself only when you tell it to with <code>-fuzztime</code>. The one real constraint is that the property must be something you can state without knowing the input, which is why fuzzing pushes you toward round-trips and invariants, the claims that are true of all inputs at once.",
	commonMistakes: [
		{
			title: "Expecting go test to fuzz without the -fuzz flag",
			body: "Plain <code>go test</code> runs a fuzz target's seed corpus only and returns in milliseconds. Real fuzzing requires <code>go test -fuzz=FuzzName</code>. Seeing the seeds pass and concluding the input space is covered is the most common misunderstanding; the seeds are just a small table.",
		},
		{
			title: "Writing a fuzz target that needs a precomputed expected value",
			body: "The input is generated, so there is no <code>want</code> to compare against. Assert a property instead: a round-trip, an invariant like valid-UTF-8-out, or no-panic. A target that reaches for a hand-written expected answer is a table-driven test wearing the wrong signature.",
		},
		{
			title: "Running an unbounded -fuzz in CI",
			body: "<code>-fuzz</code> runs until it finds a failure or is stopped; its default is to run forever, so a CI job with no <code>-fuzztime</code> hangs until it times out. Bound it (<code>-fuzztime=30s</code> or <code>-fuzztime=100000x</code>) in CI, and run long open-ended sessions separately.",
		},
		{
			title: "Not committing the testdata/fuzz corpus",
			body: "When the engine finds a crash it writes the minimised input to <code>testdata/fuzz/FuzzName/</code>. That file is the regression test: commit it, and plain <code>go test</code> replays it forever. Gitignore <code>testdata</code> or delete the file and you have thrown away the one input that proves the bug, and the fix, are real.",
		},
		{
			title: "A property that panics or is slow on legitimate input",
			body: "The fuzzer treats any panic as a finding, so if your property function itself panics on inputs the target legitimately produces (a nil deref in the check, an unhandled negative), you get false crashes that bury real ones. Guard or <code>t.Skip</code> the inputs that are genuinely out of contract, as the example does for a negative limit, and keep the property cheap, since it runs millions of times.",
		},
	],
	relatedSlugs: ["testing", "table-driven-tests", "strings-bytes-runes", "benchmarks", "tooling"],
}
