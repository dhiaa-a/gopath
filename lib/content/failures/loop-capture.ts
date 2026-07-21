import { Failure } from "../../content"

export const loopCapture: Failure = {
	slug: "loop-capture",
	name: "Loop capture: three closures, one variable",
	category: "Language semantics",
	tagline:
		"Every handler reports the last menu entry, because before go.mod says 1.22 a for loop declares one variable and every closure captured it.",
	symptom:
		"Every registered menu handler claims to be the same entry: <code>2: quit</code>, three times, deterministically, on one machine and in CI. On a teammate's scratch module the byte-identical file prints the three distinct entries it obviously should. The same toolchain is installed everywhere, <code>go vet</code> is silent in both places, and the source diffs empty. The only file that differs between the working and broken checkouts is go.mod. Nothing is concurrent, nothing errors, exit code 0: three closures were registered in a loop, and all three somehow print the loop's final values.",
	labPath: "labs/failures/loop-capture",
	runCommand: "go run .",
	tools: [
		"the output's shape: N identical results, all equal to the final element",
		"go.mod's go directive: the language version is per-module, not per-machine",
		"go mod edit -go=1.22, the experiment that flips loop semantics without touching the source",
		"go vet, to learn its limits: loopclosure does not look at stored closures",
	],
	diagnosis: [
		{
			title: "Read the shape of the wrongness",
			body: "Three closures, three identical outputs, and the value they agree on is the <em>final</em> element, index 2 of a 3-entry menu. That shape is a fingerprint. The menu slice was not corrupted: nothing in the program writes to it, and <code>quit</code> really is entry 2. The registration count is right: three lines printed. What collapsed is which iteration each closure remembers, and they all remember the last one. Identical outputs equal to the final iteration means every closure is reading the <em>same storage</em>, after the loop finished writing it. Compare the shapes this rules out: an off-by-one would print shifted-but-distinct values, a data race would vary between runs, and this varies never.",
			command: "go run .",
			output: `2: quit
2: quit
2: quit`,
		},
		{
			title: "Closures capture variables, not values",
			body: "A closure holds pointers to the variables it uses, not snapshots of their values; the closures concept builds this model in full. So <code>fmt.Printf(\"%d: %s\\n\", i, name)</code> inside the closure means \"read whatever <code>i</code> and <code>name</code> hold at call time\", and the calls happen after the loop has ended. All of the diagnostic weight now lands on one question: how many <code>i</code>s exist? If the loop declared one <code>i</code> and one <code>name</code> for the entire loop, all three closures point at that single pair, the loop left it at <code>2</code> and <code>quit</code>, and every call prints the same line. If the loop declared a fresh pair per iteration, each closure owns its own. The uncomfortable part: the source text cannot answer the question. The same <code>for i, name := range menu</code> line means either, depending on something outside the file.",
		},
		{
			title: "When machines disagree, open go.mod first",
			body: "This module's go.mod pins <code>go 1.21</code>, and the comment in it says the pin is deliberate. Through Go 1.21, a for loop declared one variable per loop; Go 1.22 changed the statement to declare fresh variables each iteration. The change is gated on the <code>go</code> directive in go.mod, not on the installed toolchain, so a 1.21 module keeps 1.21 loop semantics under every compiler forever. That is the whole machine-to-machine mystery: the scratch module was created with a modern directive. The proving experiment touches no source at all. Run <code>go mod edit -go=1.22</code> and the same main.go under the same go1.23.12 toolchain prints all three entries; put the pin back with <code>go mod edit -go=1.21</code>, because reproducing the failure is this lab's job. One directive line, two different programs. Note also which tool stayed quiet: vet's loopclosure check looks for loop variables escaping through <code>go</code> and <code>defer</code> statements at the end of a loop body, and closures stored in a slice and called later, this exact code, are outside its view. Verified here: <code>go vet ./...</code> is clean on the broken variant.",
			command: "go mod edit -go=1.22 && go run .",
			output: `0: start
1: save
2: quit`,
		},
		{
			title: "Why the language changed, and why your module did not follow",
			body: "The shared loop variable was the most famous bug in Go: a decade of postmortems, lint rules, and interview questions. Go 1.22 fixed it by narrowing what <code>for</code> declares rather than changing how closures capture, because the closures were behaving correctly all along. Gating the change on go.mod is Go's compatibility contract at work: upgrading a toolchain must never silently change what a working program means, so each module opts in by raising its language version. The same gate decides whether <code>time.After</code> is collectable under Go 1.23 (the time concept), and it cuts both ways: safety for old code, and old semantics silently preserved in any module whose directive nobody has bumped since 2021. One boundary survives even on 1.22+, and the closures concept spells it out: only the loop's own variables became per-iteration. A variable declared outside the loop and mutated inside it is still one variable, shared by every closure, on every version of Go.",
		},
	],
	fix: "Two fixes at different layers, and this lab ships the one its own go.mod permits. <code>fixed.go</code> uses the pre-1.22 idiom: <code>i, name := i, name</code> at the top of the loop body, shadowing the loop pair with per-iteration copies so each closure captures its own; it is correct on every version of Go ever released. Prove it: <code>go run -tags fixed .</code> prints <code>0: start</code>, <code>1: save</code>, <code>2: quit</code>, exit 0. The real-world fix is the one the diagnosis already performed: raise the directive with <code>go mod edit -go=1.22</code> (or higher), after which the compiler declares fresh variables per iteration and the shadowing line becomes redundant; do that in any module you actually maintain, and delete the idiom where you find it. The tempting non-fix is upgrading the toolchain: install the newest Go, rebuild, ship, change nothing. The semantics follow the directive, not the compiler, so a machine-level upgrade cannot fix a module-level setting, and believing it can is exactly how this bug survives a \"we are on modern Go\" review.",
	production:
		"Before 1.22 this bug class had a signature sentence in postmortems: \"we processed 500 jobs, and all 500 were job 500\". Worker pools all handling the final task, HTTP handlers registered in a loop all serving the last route, cleanup callbacks all closing the last file. After 1.22 it did not die, it went demographic: it lives in modules whose <code>go</code> directive predates 1.22, which in practice means the oldest, least-touched, most load-bearing repos in the company, the ones where the toolchain got upgraded by the platform team but the directive never moved. The production tell is the one from this lab scaled up: two environments disagree about the behavior of identical source, and the directive is the diff. Check go.mod before you check your sanity. And keep the post-1.22 residue on your list: closures over a variable declared <em>outside</em> the loop, or over an accumulator mutated inside it, still share storage on every version, which is why \"all N outputs equal the final value\" remains a shape worth recognizing on sight.",
	scar: "A closure captures the variable itself, and until go.mod says 1.22 a for loop only ever declared one.",
	relatedSlugs: ["closures", "modules", "value-semantics"],
	unlockTier: 1,
}
