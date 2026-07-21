import { Failure } from "../../content"

export const sliceAliasing: Failure = {
	slug: "slice-aliasing",
	name: "Aliasing: the function that edited its caller's data",
	category: "Memory and aliasing",
	tagline:
		"A helper that promises a sanitized copy mutates in place, because passing a slice copies the header and shares every element.",
	symptom:
		"The compliance archive is corrupted: entries that must be stored verbatim went in masked, <code>user=***</code> where names should be. The renderer does everything in a sensible order: it calls <code>redact(entries)</code>, keeps the result in its own variable for the support dashboard, and only afterwards archives the original <code>entries</code>, which is never reassigned anywhere in the file. <code>redact</code> is even written to return a slice, the way a copying function would. No concurrency, no error, exit code 0, and the archive comes out masked identically on every run and every machine.",
	labPath: "labs/failures/slice-aliasing",
	runCommand: "go run .",
	tools: [
		"the program's own output: two views that must differ and do not",
		"fmt.Printf(\"%p\", s): a slice's identity is the address of its element 0",
		"the callee, reread with the header model: []T in, []T out promises no copy",
	],
	diagnosis: [
		{
			title: "Let the two views convict each other",
			body: "The program makes one structural claim: <code>view</code> and <code>entries</code> are independent, one masked, one verbatim. The output disproves it, and the print order tells you where. The archive line prints <em>after</em> <code>redact</code> returns, and between building <code>entries</code> and archiving it exactly one statement touches anything: the <code>redact</code> call itself. So the corruption happened inside a function that, by its own comment, returns a copy. Note what is absent: no panic, no error, no race. A program that is wrong about who owns memory is not wrong in any way the runtime can detect, so the only witness is the data.",
			command: "go run .",
			output: `support dashboard (redacted):
  user=*** action=login ip=***
  user=*** action=export ip=***
  user=*** action=delete ip=***
archived original: [user=*** action=login ip=*** user=*** action=export ip=*** user=*** action=delete ip=***]`,
		},
		{
			title: "Ask the data-pointer question",
			body: "A slice value is a three-word header: a pointer to a backing array, a length, and a capacity (the slice-internals concept). Passing a slice to a function copies those three words and none of the elements. That turns \"did redact edit my data\" into a question you can print: do the caller's slice and the returned slice carry the same pointer? <code>%p</code> on a slice prints the address of its first element, so add one line after the call, <code>fmt.Printf(\"entries %p  view %p\\n\", entries, view)</code>, and run again. Same address: one backing array, two headers describing it. <code>view</code> is not a view of a copy; it is a second name for the same memory, and so is every \"copy\" this function has ever returned.",
			command: "go run .",
			output: "entries 0xc000022180  view 0xc000022180",
		},
		{
			title: "Reread redact with the header model",
			body: "Now the function reads differently. <code>entries[i] = mask(e)</code> is an element write through the copied header, and element writes land in the one shared backing array, where the caller sees them immediately. <code>return entries</code> returns another copy of the same header, same pointer. Nothing in the function ever allocates element storage, so it cannot possibly return an independent copy, no matter what its comment says. This is the asymmetry the slice-internals concept documents: element writes cross the call boundary, <code>append</code> and reslicing do not. The signature <code>func([]string) []string</code> looks copy-like to anyone fluent in a language that deep-copies on assignment, which is exactly why this survives review. In Go the shape of the type tells you sharing is possible; only the body tells you whether it happens.",
		},
		{
			title: "Name the misconception, then the design",
			body: "The misconception: treating <code>[]string</code> as a value that copies when passed. Go does copy it by value, but the value is the header, three words, not the elements. That is a deliberate trade, not an accident: slices exist so that passing a million elements costs three words and zero allocations, and so the runtime always has a length to bounds-check against. Deep copy on every call would destroy that cost model; hidden copy-on-write would make it unpredictable. Go's position is that sharing is the default and copying is a visible, written-out act: <code>make</code> plus <code>copy</code>, or <code>slices.Clone</code>. Any function that takes a slice and produces a \"modified version\" therefore stands at a fork: document that it mutates in place, or copy first and return the copy. <code>redact</code> does the first while claiming the second, and the compiler has no opinion about comments.",
		},
	],
	fix: "Make <code>redact</code> honest about the copy. In <code>fixed.go</code> it allocates before it masks: <code>out := make([]string, len(entries))</code>, <code>copy(out, entries)</code>, then mask <code>out</code> in place and return it. <code>slices.Clone(entries)</code> from the standard library (since go 1.21) says the same thing in one call. Prove it: <code>go run -tags fixed .</code> prints the masked dashboard and an intact <code>archived original: [user=alice ...]</code>, exit 0. The tempting non-fix is to reorder the caller: archive first, redact after, and the archive really does come out clean (verified on this lab with the two blocks swapped). But <code>redact</code> still edits every caller's data, the next call site that keeps its slice alive inherits the bug, and correctness now hangs on a call-ordering convention that is invisible in the function's signature. Fix the function that lies, not the caller that believed it.",
	production:
		"In production this is a data-corruption incident with no crash and no log line, discovered weeks later by an auditor, a backfill job, or a customer export, long after the process that did it has exited. The write path all reviews clean, because the offender is a read path: a sanitizer, a normalizer, a formatter, something that \"only renders\" the data. The standard library makes aliasing idiomatic, which is why the habit matters: <code>bytes.TrimSpace</code> returns a subslice of its input, <code>bufio.Scanner</code>'s <code>Bytes</code> is overwritten by the next <code>Scan</code>, and every <code>io.Reader</code> hands you a buffer it may reuse. The diagnostic move is the same one this page used, aimed at a bigger program: log <code>%p</code> and <code>len</code>/<code>cap</code> of the slice at the site that wrote the data and the site that found it corrupted, and see whether two \"different\" slices share an element-0 address. And when the corrupted store is an audit or compliance record, the postmortem question is no longer \"what was the bug\", it is \"which records can we legally reconstruct\", which is a much worse meeting.",
	scar: "A slice is a shared view, not a private copy: pass one and every element write is everyone's write.",
	relatedSlugs: ["slice-internals", "slices", "value-semantics", "pointers"],
	unlockTier: 1,
}
