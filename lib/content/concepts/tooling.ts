import { Concept } from "../../content"

export const tooling: Concept = {
	slug: "tooling",
	name: "Tooling (gofmt, vet, and beyond)",
	tagline:
		"One format, no argument. A vetter that runs inside go test, but only a high-confidence subset of it.",
	summary:
		"Go ships its own formatter and its own static checker, and the point of both is to remove decisions. <code>gofmt</code> defines exactly one canonical layout for every program, so formatting is never reviewed, discussed, or configured. <code>go vet</code> catches a specific list of correctness bugs the compiler allows, misformatted <code>Printf</code> verbs, malformed struct tags, locks copied by value, results ignored where that is always a mistake, and it runs automatically as part of <code>go test</code>. But <code>go test</code> runs only a high-confidence subset of vet's checks, so a bug vet can find is not necessarily a bug your tests will surface. Past vet sit the next rungs, <code>staticcheck</code> and <code>golangci-lint</code>, and each rung is honestly a different kind of tool: vet is not a linter, and a linter is not a type checker.",
	mentalModel:
		"Think of the tools as a ladder of increasing scope and decreasing certainty. <code>gofmt</code> is not a linter at all: it rewrites layout and has no opinion about correctness. <code>go vet</code> is a correctness checker tuned for near-zero false positives, which is exactly why <code>go test</code> is willing to run a slice of it on every build without ever annoying you, and also why that slice is small. <code>staticcheck</code> and <code>golangci-lint</code> accept more false positives in exchange for catching more, so they are opt-in and configurable. Above all of them, the compiler's type checker is the only thing that is actually sound. Each tool answers a narrower question with more confidence than the one above it, and using one to do another's job, expecting vet to be a full linter, expecting a linter to prove your program correct, is where people get disappointed.",
	retrievalPrompts: [
		"go test passes clean. You then run go vet on the same package and it reports a bug. How can the vet that go test runs have missed it? || go test runs vet automatically, but only a high-confidence subset of its checks, the ones with essentially no false positives (printf, bool, atomic, buildtags, errorsas, ifaceassert, nilfunc, stringintconv, directive). A check outside that subset, copylocks for a mutex passed by value for instance, is skipped during go test and only reported by a full go vet. Passing tests is not the same as passing vet. Run go vet ./... in CI in its own right.",
		"A teammate's editor keeps reformatting your carefully aligned code and the diff is all whitespace. Whose settings win, and how do you argue for your alignment? || Nobody's settings, and you don't. gofmt defines a single canonical format with no options, so every correct editor produces byte-identical output and there is nothing to configure or argue about. Your alignment is not a preference gofmt overrode, it is simply not gofmt's format. Run gofmt -l to list files that differ and gofmt -w to rewrite them; the whitespace debate is over by construction.",
		"You want go vet to stop flagging a line, so you reach for a // nolint comment. Does that work? || No: that directive is for third-party linters like golangci-lint, not for go vet, which has no suppression comment. If go vet is right, fix the code; if you believe it is wrong, the check is narrow enough that you can usually restructure past it, and genuine false positives are rare by design. Suppression pragmas live one rung up, at staticcheck and golangci-lint, which is part of why those are separate tools.",
	],
	codeExample: `package main

import (
	"fmt"
	"testing"
)

// This test compiles. It never runs. go test vets it first, and vet's
// printf analyzer sees that %s was handed an int.
func TestReport(t *testing.T) {
	count := 3
	msg := fmt.Sprintf("%s items processed", count)
	if msg == "" {
		t.Fatal("empty message")
	}
	t.Log(msg)
}`,
	codeExplanation:
		"This is a <code>_test.go</code> file, and the Run link compiles it as a test. It never executes: <code>go test</code> runs <code>go vet</code> first, vet's printf analyzer sees <code>%s</code> handed an <code>int</code>, and the run stops with <code>fmt.Sprintf format %s has arg count of wrong type int</code> followed by <code>FAIL [build failed]</code>. That is the vet-runs-inside-go-test fact demonstrated rather than asserted: the failure comes from vet, not from any assertion in the test. Now the boundary that the same mechanism hides. Only a high-confidence subset of vet runs during <code>go test</code>, and <code>printf</code> is in it, which is why this one is caught. Write a different bug that is not in the subset, a function taking a <code>struct</code> that contains a <code>sync.Mutex</code> by value, which copies the lock, and <code>go test</code> passes clean while a full <code>go vet</code> reports <code>passes lock by value</code>. Both are real bugs; only one stops your test. That gap is the entire reason to run <code>go vet ./...</code> as its own CI step and not assume a green test suite has vetted your code. <code>gofmt</code> sits underneath all of this: it would rewrite this file's layout to the one canonical form, and <code>gofmt -l</code> printing the filename is how CI fails a PR that was not formatted.",
	designRationale:
		"Both tools exist to delete arguments, and the history shows the language leaning into that harder over time. <code>gofmt</code> shipped with Go 1 and deliberately has no options, because the moment a formatter is configurable, teams spend real time configuring it and reviewing the results; one canonical format means <code>gofmt</code>'d code is never a review comment, and tools like <code>goimports</code> and every editor integration can rewrite freely knowing there is exactly one right answer. <code>go vet</code> is the compiler's pragmatic counterweight: the spec makes certain real mistakes legal Go (a <code>Printf</code> with the wrong verb is a valid call, a struct with a mutex is copyable), so vet catches the ones that are almost always bugs. It is tuned for near-zero false positives on purpose, which is what earned it a place inside <code>go test</code> in Go 1.10: a checker that cried wolf could never run on every build without being disabled, so the team runs only the subset that essentially never does. That same design ceiling is why <code>staticcheck</code> and <code>golangci-lint</code> exist as separate, opt-in tools: they trade false positives for coverage, a trade the core toolchain will not make for you. And it is why the honest framing is a ladder, <code>gofmt</code> for layout, <code>vet</code> for high-confidence correctness, linters for the broader net, the type checker for soundness, rather than one tool pretending to be all four.",
	commonMistakes: [
		{
			title: "Assuming a green go test means vet is satisfied",
			body: "<code>go test</code> runs only a high-confidence subset of vet (printf, atomic, bool, buildtags, errorsas, ifaceassert, nilfunc, stringintconv, directive). Checks like <code>copylocks</code>, <code>unreachable</code>, and <code>shift</code> are skipped, so a full <code>go vet ./...</code> can fail on code whose tests pass. Run vet as its own step.",
		},
		{
			title: "Trying to configure gofmt, or arguing with its output",
			body: "<code>gofmt</code> has no options and one canonical format. Time spent trying to make it align things your way is time wasted; the format is the point. Use <code>gofmt -l</code> to find unformatted files in CI and <code>gofmt -w</code> to fix them, and let the argument be over.",
		},
		{
			title: "Expecting go vet to be a full linter",
			body: "vet checks a fixed list of high-confidence correctness problems; it does not enforce naming, complexity, unused code, or style. Wanting those and being disappointed vet is silent means reaching for the wrong rung. <code>staticcheck</code> and <code>golangci-lint</code> are the linters; vet is not one.",
		},
		{
			title: "Expecting a linter to prove the program correct",
			body: "<code>staticcheck</code> and <code>golangci-lint</code> catch more than vet by accepting false positives, but they are heuristics, not a proof. The only sound check is the compiler's type system. Treating a clean lint as a correctness guarantee, or suppressing a real finding to get the green, misreads what the tool is.",
		},
		{
			title: "Reading -gcflags output as an error instead of information",
			body: "<code>go build -gcflags=-m</code> prints escape-analysis and inlining decisions (<code>moved to heap</code>, <code>can inline</code>); it is diagnostics, not warnings, and the build still succeeds. <code>-gcflags='-N -l'</code> disables optimisation and inlining so a debugger can step cleanly. Neither changes correctness, and mistaking the <code>-m</code> notes for problems to fix sends you chasing allocations that may not matter.",
		},
	],
	relatedSlugs: ["testing", "escape-analysis", "struct-tags", "race-detector", "modules"],
}
