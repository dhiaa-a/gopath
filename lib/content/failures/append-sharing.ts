import { Failure } from "../../content"

export const appendSharing: Failure = {
	slug: "append-sharing",
	name: "Append: two slices, one backing array",
	category: "Memory and aliasing",
	tagline:
		"Two appends from the same base both find the same spare slot, and the second write lands inside the first result.",
	symptom:
		"The dev profile is running with prod's flag. <code>launchcfg --dry-run</code> prints both flag sets, and dev ends in <code>--quiet</code>, the flag only prod adds; <code>--verbose</code> is nowhere in the output. <code>devFlags</code> is built once and never assigned again. The detail nobody on the thread believed: delete the <code>prodFlags</code> line, which runs <em>after</em> <code>devFlags</code> already exists, and dev comes out correct. A later line is editing an earlier variable, deterministically, every run, exit code 0. Nothing here mutates anything in place; the only operations in sight are two innocent-looking appends.",
	labPath: "labs/failures/append-sharing",
	runCommand: "go run .",
	tools: [
		"len and cap, printed before you theorize: those two numbers decide append's branch",
		"fmt.Printf(\"%p\", s) on the base and both results: one address means one array",
		"the full slice expression s[low:high:max], the tool that caps what append may touch",
	],
	diagnosis: [
		{
			title: "State the impossible thing precisely",
			body: "Dev ends in <code>--quiet</code>. <code>devFlags</code> is assigned exactly once, and between its <code>append</code> and its print exactly one statement runs: <code>prodFlags := append(base, \"--quiet\")</code>. So the precise claim is: an append assigned to <code>prodFlags</code> changed <code>devFlags</code>. Said out loud, it stops being impossible and becomes a lead, because <code>append</code> never promised anyone a new array. It promises a slice with the element added; where that element physically goes depends on numbers this code never looked at. The symptom's other clue points the same way: deleting the prod line \"fixes\" dev, so the two results are coupled through something they share, and the only thing they share is <code>base</code>.",
			command: "go run .",
			output: `dev flags:  [--log-level=info --region=eu-west-1 --retries=3 --timeout=30s --quiet]
prod flags: [--log-level=info --region=eu-west-1 --retries=3 --timeout=30s --quiet]`,
		},
		{
			title: "Print the numbers append reads",
			body: "<code>append</code>'s decision procedure is short: if the slice's <code>len</code> is below its <code>cap</code>, write the new element into the existing backing array at index <code>len</code> and return a header with the length bumped; otherwise allocate a bigger array, copy, and write there. Which branch you get is decided by two integers, so the diagnosis is to print them, plus the identity question from the slice-internals concept: <code>%p</code> on a slice is the address of its element 0. Five added print lines settle everything. <code>base</code> is len 4, cap 8: four spare slots. Both appends asked \"is there room at index 4\" and both heard yes, in the same array: all three slices share one element-0 address, and <code>&devFlags[4] == &prodFlags[4]</code> is <code>true</code>. Dev's fifth element and prod's fifth element are the same memory cell, and the last writer was prod.",
			command: "go run .",
			output: `base len 4 cap 8
dev  len 5 cap 8
prod len 5 cap 8
base 0xc0000aa000  dev 0xc0000aa000  prod 0xc0000aa000
dev[4] and prod[4] same address: true`,
		},
		{
			title: "Append's actual contract",
			body: "The contract is exactly this: if the capacity is large enough, the result reslices the existing array in place; if not, a new array is allocated. \"May share, cap decides\" is not an implementation leak, it is the design, and it is what makes appending amortised O(1): most calls are one write, not an allocation plus a copy of everything so far. The slice-internals concept states the sharp edge from one side: <code>cap</code> can describe memory your view does not cover, so append can write where you did not expect. This lab is the two-writer mirror image: two appends from the <em>same</em> base both find the same room, and neither result carries any record of the other. Also note what made this lab deterministic: cap 8 is comfortably above len 4, so both calls take the in-place branch on every run of every toolchain. Build <code>base</code> with cap equal to len and both appends take the allocate branch, and the bug vanishes, which is exactly why this class of failure appears and disappears when someone adds or removes a flag.",
		},
		{
			title: "The review smell that finds it before the pager does",
			body: "The grep-able shape: an append result assigned to a <em>new</em> variable while the argument stays live. <code>s = append(s, x)</code> rebinds the only header and is safe. <code>dev := append(base, x)</code> with <code>base</code> used again below is the smell, because it reads as \"derive a child from the parent\", and append is not a derivation operator: whether the child is welded to the parent's array is decided by a capacity nobody printed. The lab's two lines read perfectly naturally, which is why this survives review; the discipline is to treat any <code>append(shared, ...)</code> whose result gets its own name as a question that needs an answer: who else can reach that array's tail?",
		},
	],
	fix: "Say what you mean about <code>base</code>: it is a fixed prefix nobody may grow into. The full slice expression states exactly that: <code>base = base[:len(base):len(base)]</code> sets capacity equal to length (the third index caps capacity), so every later <code>append(base, ...)</code> finds no spare room, allocates its own array, and the profiles disconnect. That is the one-line fix in <code>fixed.go</code>; <code>slices.Clip(base)</code> is the same operation by name. Prove it: <code>go run -tags fixed .</code> prints dev ending <code>--verbose</code> and prod ending <code>--quiet</code>, exit 0. The blunt alternative is <code>slices.Clone(base)</code> at each derivation site: always copies, needs no capacity reasoning, and at config-loading scale the extra allocation is beneath measurement. The tempting non-fix is deleting the <code>make(..., 0, 8)</code> \"optimization\", because a plain literal has cap equal to len and the symptom vanishes. It vanishes by coincidence: growth over-allocates, so the derived slices come back with spare capacity of their own (measured here: appending to the len-4 literal returns cap 8), and the first time somebody derives twice from a <em>derived</em> slice, the same collision reappears one level down. Cap the slice you hand out; do not depend on how much room append happened to leave.",
	production:
		"The production shape is a request-scoped derivation from a long-lived base: a middleware chain built per route with <code>chain := append(baseMiddleware, routeSpecific...)</code>, argv for <code>exec.Command</code> assembled per host from shared defaults, metric tag sets appended per request onto a package-level prefix. Router path-parameter slices in early Go web frameworks shipped exactly this bug, one request reading another request's parameter. In the wild it is intermittent in the cruellest way: the collision needs spare capacity, so the code works for months while the base's length happens to equal its capacity, then someone removes one default entry and two tenants start sharing an element. The values themselves are valid, no checksum fails, no decode errors; only set membership is wrong, so data-integrity tooling stays green while users see someone else's flag, tag, or parameter. When you suspect it, resist reading code first: log <code>len</code>, <code>cap</code>, and <code>%p</code> of the suspects at each derivation site, and the shared address convicts in one deploy what code-reading argues about for a day.",
	scar: "If it fits in cap, append writes in place: derive two slices from one base and the second write lands in the first.",
	relatedSlugs: [
		"slice-internals",
		"arrays-vs-slices",
		"slices",
		"value-semantics",
	],
	unlockTier: 1,
}
