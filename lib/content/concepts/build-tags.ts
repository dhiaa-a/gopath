import { Concept } from "../../content"

export const buildTags: Concept = {
	slug: "build-tags",
	name: "Build tags",
	tagline:
		"A build tag is read before the code it guards, and a file that fails it is invisible, as if it were not on disk.",
	summary:
		"A build tag, written <code>//go:build</code>, is a per-file switch the compiler reads before it reads the code, deciding whether the file is part of the package for this build at all. It is how one module carries code for several operating systems, optional integrations, and, in these labs, the reference solution and the performance gates, with no runtime <code>if</code> anywhere. The expression is evaluated at compile time against the target <code>GOOS</code> and <code>GOARCH</code>, the toolchain version, and any tags you pass with <code>-tags</code>, and a file whose expression is false is excluded as though it did not exist. The syntax replaced an older <code>// +build</code> form in Go 1.17, and the two do not follow the same rules, which is its own source of bugs.",
	mentalModel:
		"Think of every <code>.go</code> file as carrying an admission test the compiler runs before parsing a single declaration. The test is the <code>//go:build</code> line, evaluated against a set of facts about this build: the target OS and architecture (<code>GOOS</code>, <code>GOARCH</code>), the toolchain version (<code>go1.22</code> and friends), and the explicit tags from <code>-tags</code>. If the test fails the file is not skipped-but-present, it is absent: its imports are not required, its symbols are not declared, its <code>init</code> does not run, exactly as if you had deleted it. The filename is part of the test too: <code>server_windows.go</code> carries an implicit <code>//go:build windows</code>, and <code>_test.go</code> carries an implicit constraint only <code>go test</code> satisfies. This is why the labs keep your code and the reference in one package under <code>debounce.go</code> and <code>debounce_solution.go</code>: <code>//go:build !solution</code> and <code>//go:build solution</code> can never both pass, so exactly one file is admitted and the other may as well not be on disk.",
	retrievalPrompts: [
		"You run go test -tags 'solution gate'. Is that satisfying an OR, an AND, or something else, and which files compile? || Something else: a -tags list is a SET of tags you are declaring true, not a boolean expression. 'solution gate' (identical to 'solution,gate' for this flag) makes BOTH solution and gate satisfied, and then each file's own //go:build expression is evaluated against that truth assignment. So //go:build solution files are admitted, //go:build gate files are admitted, and //go:build !solution files are now excluded because !solution is false. The AND and OR live inside a file's line: //go:build solution && gate would require both on ONE file, a different statement from making both true globally.",
		"Someone hand-writes // +build ignore with the package clause on the very next line, no blank line between them. Is the file excluded? What if they had written //go:build ignore instead? || The // +build file is NOT excluded: without the required blank line the old-syntax constraint attaches to the package clause as a doc comment and is silently ignored, so the file compiles in as if unconstrained. The //go:build form IS excluded either way: it is a compiler directive recognized structurally, so go1.22 honors it with or without the trailing blank line, and gofmt inserts the blank line for you. That difference is exactly why mixing the two forms is dangerous, and why gofmt keeps them in sync when both are present.",
		"A function you defined compiles on your Mac and vanishes with 'undefined' in CI on Linux, though the file is right there in the tree. What is the most likely cause? || The file's build constraint excludes it on Linux, so on that target the file is absent and the symbol it declares is undeclared. The usual culprit is an implicit constraint you did not think of as one: a filename like helpers_darwin.go carries an implicit //go:build darwin, so it exists only on macOS builds; an explicit //go:build darwin line does the same. The compiler is not wrong, the symbol genuinely does not exist for GOOS=linux. Provide a linux counterpart file, or move the shared symbol into an unconstrained file.",
	],
	codeExample: `package main

import (
	"fmt"
	"runtime"
)

// A build tag (//go:build) is a line the COMPILER reads before it reads the
// code, to decide whether this file belongs to the package for this build at
// all. A file whose expression is false is invisible: its symbols are not
// declared, its init does not run, as if it were not on disk. The switch is at
// compile time. There is no runtime if involved.
//
// One file cannot stage that selection: a tag that excluded THIS file would
// exclude main and leave nothing to run. So this file carries no constraint,
// and prints the two implicit tags every build already has. GOOS and GOARCH
// are set for the TARGET of the build, so under cross-compilation they are not
// the machine you are on. The filename is a tag too: server_windows.go carries
// an implicit //go:build windows, and a //go:build go1.21 line is tested
// against the toolchain version.
//
// The real mechanism, exactly as these labs use it. Two files can declare the
// SAME symbols in the SAME package, split by opposite tags:
//
//	debounce.go           //go:build !solution   your code, built by default
//	debounce_solution.go  //go:build solution     the reference
//	gate_test.go          //go:build gate         a performance gate
//
// Exactly one of the first two is admitted, because !solution and solution can
// never both hold. "go test ./..." builds your code; "go test -tags solution"
// swaps in the reference; "go test -tags 'solution gate'" makes BOTH tags true
// (a -tags list is a SET of satisfied tags, not a boolean expression), so the
// reference AND the gate tests compile in together. gate_test.go is also a
// _test.go file, an implicit constraint no plain build satisfies, so it is
// gated twice: by the suffix and by the tag.
func main() {
	fmt.Printf("GOOS=%s GOARCH=%s\\n", runtime.GOOS, runtime.GOARCH)
	fmt.Println("no //go:build line here, so every build includes this file")
}`,
	codeExplanation:
		"On the Go Playground the Run link prints <code>GOOS=linux GOARCH=amd64</code>, the Playground's target; built with this Windows toolchain the identical program printed <code>GOOS=windows GOARCH=amd64</code>. Those two identifiers are the point: they are implicit build tags, the same values a <code>//go:build amd64</code> line or a <code>_windows.go</code> filename is tested against, and they describe the build's TARGET, so a cross-compile sets them to the target's values, not the host's. What one file cannot show is the selection itself, because the Playground compiles a single file and a constraint that excluded this file would take <code>main</code> with it. So the mechanism was verified separately, in a module with two files declaring the same symbol: <code>starter.go</code> tagged <code>//go:build !solution</code> and <code>reference.go</code> tagged <code>//go:build solution</code>. <code>go run .</code> compiled the starter and printed its line; <code>go run -tags solution .</code> compiled the reference and printed the other; exactly one was ever admitted, because <code>!solution</code> and <code>solution</code> cannot both be true. A <code>gate_test.go</code> tagged <code>//go:build gate</code> confirmed the rest: plain <code>go test</code> ran only the untagged tests, <code>go test -tags gate</code> added the gate test, and <code>go build ./...</code> never compiled the <code>_test.go</code> file at all, so a gate symbol can never reach a normal build. That is the labs' whole scheme: <code>go test -tags 'solution gate'</code> makes both tags true at once, so the reference and the gates compile in together.",
	designRationale:
		"A build constraint is compile-time on purpose, and the modern syntax is a deliberate cleanup of an older one. Before Go 1.17 the constraint was <code>// +build</code>, an ordinary comment with an idiosyncratic grammar, space meant OR, comma meant AND, multiple lines meant AND, that had to be separated from the package clause by a blank line or it was silently treated as documentation. Go 1.17 introduced <code>//go:build</code>, a real compiler directive with ordinary boolean operators, <code>&amp;&amp;</code>, <code>||</code>, <code>!</code>, and parentheses, so the expression reads like an expression and a bare space between two tags is a syntax error rather than a hidden OR. The two forms coexist for compatibility, and <code>gofmt</code> keeps them in sync and inserts the blank line, which is why you rarely hand-edit <code>// +build</code> anymore. Evaluating constraints before parsing is what lets one module hold platform-specific files that would not even compile on the wrong OS: a file calling a Windows-only syscall is simply absent on Linux, so its <code>import</code> is never required there, which a runtime <code>if</code> could never achieve because the import would still have to resolve. The <code>-tags</code> flag is the user-supplied half of the fact set: it declares a set of tags satisfied for this build, and each file's expression is evaluated against the union of those, the target <code>GOOS</code> and <code>GOARCH</code>, and the toolchain version. That set model, rather than one global expression, is why a single <code>-tags 'solution gate'</code> switches on both the reference files and the gate tests at once, and simultaneously switches OFF the <code>//go:build !solution</code> starter files, which asked to be present only while <code>solution</code> is absent.",
	commonMistakes: [
		{
			title: "Assuming the blank line after the constraint is what makes it work",
			body: "The rule you half-remember is real but belongs to the OLD syntax. <code>// +build ignore</code> with the package clause on the very next line, no blank between them, is silently ignored: the constraint attaches to the package as a doc comment and the file compiles in unconstrained (verified, it printed rather than being excluded). The modern <code>//go:build</code> is a compiler directive recognized structurally, so on go1.22 it is honored with or without the trailing blank line, and <code>gofmt</code> inserts the blank line for you. The real modern trap is placement: a <code>//go:build</code> after the package clause is not ignored, it is a hard <code>misplaced compiler directive</code> error.",
		},
		{
			title: "Letting // +build and //go:build disagree",
			body: "When both forms are present, a file predating Go 1.17 or a bad merge, they must express the same condition, and <code>gofmt</code> normally keeps them synchronized. Edit one by hand and leave the other and you have two constraints that can contradict: the build honors them as written and <code>go vet</code>'s <code>buildtag</code> analyzer flags the mismatch. Delete the legacy <code>// +build</code> line and keep only <code>//go:build</code>, or run <code>gofmt</code>, which rewrites the pair to agree. New code should carry only the <code>//go:build</code> form.",
		},
		{
			title: "A symbol that vanishes under a normal build or the wrong GOOS",
			body: "A function defined only in a constrained file does not exist when the constraint is false, and the compiler reports <code>undefined</code> at the call site, not at the file. The usual surprise is an IMPLICIT constraint: a filename like <code>cache_linux.go</code> carries an implicit <code>//go:build linux</code>, so the symbol is real on Linux and gone on <code>GOOS=windows</code>; a <code>_test.go</code> file exists only under <code>go test</code>. When code compiles for you and is <code>undefined</code> in CI or on a teammate's OS, suspect a build tag, explicit or from the filename, and add a counterpart file for the other targets or move the shared symbol into an unconstrained file.",
		},
		{
			title: "Reading -tags as a boolean, or putting a bare space in //go:build",
			body: "<code>-tags 'solution gate'</code> is not an OR or an AND, it is a SET: it declares both <code>solution</code> and <code>gate</code> satisfied, and each file's own expression is evaluated against that (<code>-tags 'a b'</code> and <code>-tags a,b</code> are identical). The boolean lives inside the file: <code>//go:build a &amp;&amp; b</code> needs both, <code>//go:build a || b</code> needs either. In the new syntax the operators are mandatory: <code>//go:build a b</code> with a bare space is a compile error (<code>unexpected token</code>), where the OLD <code>// +build a b</code> quietly meant OR. Mixing those two mental models is how a constraint ends up meaning the opposite of what you intended.",
		},
		{
			title: "Forgetting a gate or integration test is gated twice",
			body: "A file named <code>gate_test.go</code> with <code>//go:build gate</code> has two constraints, not one: the <code>_test.go</code> suffix already excludes it from every <code>go build</code>, and the <code>gate</code> tag excludes it from every <code>go test</code> that does not pass <code>-tags gate</code>. So plain <code>go test ./...</code> runs your normal tests and silently skips the gate, the intended default, but it also means a green <code>go test</code> is no evidence the gate passed or even compiled. Run it explicitly, as the labs do, <code>go test -tags 'solution gate' -run '^TestGate' ./...</code>, and put that in CI so the gate cannot rot unnoticed.",
		},
	],
	relatedSlugs: ["tooling", "modules", "testing", "packages"],
}
