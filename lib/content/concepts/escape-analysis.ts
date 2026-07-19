import { Concept } from "../../content"

export const escapeAnalysis: Concept = {
	slug: "escape-analysis",
	name: "Escape analysis",
	tagline:
		"Whether a value lands on the heap is the compiler's decision about lifetime, not your decision about syntax.",
	summary:
		"Go has no <code>stack</code> or <code>heap</code> keyword, and <code>new</code>, <code>make</code> and <code>&amp;</code> do not mean \"allocate\". The compiler proves, per call site and after inlining, whether a value's lifetime ends with the function. If it does, the value lives in the frame and costs nothing to reclaim. If the proof fails, the value escapes to the heap and becomes the collector's problem. <code>go build -gcflags='-m'</code> prints those decisions, and it is the right answer to \"does this allocate\" and the wrong answer to \"how much does this allocate\", because it is a static, per-line statement with no notion of how many times a line runs.",
	mentalModel:
		"The compiler is not asking \"did the programmer write an ampersand\". It is asking one question about lifetime: can I prove nothing outside this frame will still be referring to this value after the frame pops? If it can prove that, the value stays in the frame, and the frame pops for free with no allocator and no collector involved. If the proof fails, for any reason, including reasons that have nothing to do with your intent, the value goes to the heap. Note the asymmetry: escape analysis is a proof, so failure is the default. It does not need to show a value escapes, it needs to show it does not, and anything that defeats the proof (storing through an interface, passing to a function it cannot see into, a pointer that outlives the call) sends the value to the heap conservatively. So the question is never \"did I use new\". It is \"can the compiler see the whole lifetime from here\".",
	retrievalPrompts: [
		"You benchmark a method that returns a defensive copy of a struct, and it reports 0 allocs/op. Does it allocate? || You have not asked yet. If the benchmark discards the result, the method inlines into the loop, nothing observes the copy, and escape analysis keeps it in the frame: 0 allocs/op. Assign the same call's result to a package-level variable and the identical line reports 1 allocs/op. The measurement is of the call site, not the function, so a benchmark that throws the result away is measuring a version of the code that your callers never run.",
		"Adding strings.Builder.Grow to a hot loop cut allocations from 19 per call to 1. What does go build -gcflags='-m' say about it? || Nothing at all. Diffed on the same file with the Grow line commented out and back, the -m output is byte for byte identical, 22 lines each way. Nothing escaped that was not escaping before; the same line just allocated 19 times while the buffer doubled its way up instead of once. -m reports which values reach the heap, never how many times. Count is a measurement, and -m is a static analysis that runs before your program does.",
		"Your function has no &, no new, and no make. Can it still allocate? || Easily. Putting any non-pointer value into an interface (fmt.Println's parameters, an error, an any) needs a pointer to point at, so the value gets boxed on the heap: -m calls this \"escapes to heap\" on a line with no address operator in it. Closures captured by reference, a slice that outgrows its append, and a map that grows all allocate too. Syntax is not the signal in either direction: & does not mean heap, and no & does not mean stack.",
	],
	codeExample: `package main

import (
	"fmt"
	"testing"
)

type Config struct {
	Port  int
	Level string
}

var stored = &Config{Port: 8080, Level: "info"}

// Load returns a defensive copy of the stored config. One &, one return.
// Whether that & allocates is not decided here.
func Load() *Config {
	c := *stored
	return &c
}

var sink *Config

func main() {
	discarded := testing.AllocsPerRun(1000, func() {
		_ = Load()
	})
	kept := testing.AllocsPerRun(1000, func() {
		sink = Load()
	})
	fmt.Printf("result discarded: %.0f allocs/op\\n", discarded)
	fmt.Printf("result kept:      %.0f allocs/op\\n", kept)
}`,
	codeExplanation:
		"This prints <code>result discarded: 0 allocs/op</code> and <code>result kept: 1 allocs/op</code>, stably, run after run. One function, one <code>&amp;c</code>, two different answers, and <code>Load</code>'s body is not what decided it: the caller did. Run <code>go build -gcflags='-m'</code> on it and the mechanism is on the page. The compiler reports <code>can inline Load</code>, then inlines it at both call sites, and then runs escape analysis on each site separately. It prints <code>moved to heap: c</code> twice: once for line 18, which is <code>Load</code>'s own out-of-line copy, and once for the <code>sink = Load()</code> site, where the copy is stored in a package-level variable and outlives the frame. For the <code>_ = Load()</code> site it prints no such line, because nothing observes the copy and the frame can keep it. So the same source line gets two different escape decisions in one build, which is the thing to carry away: escape analysis runs after inlining, per call site, and <code>-m</code>'s per-line output is not a per-line truth. It is also exactly why this trap is quiet. A benchmark that discards the result measures the inlined, stack-allocated version, reports the reassuring zero, and tells you nothing about the version your callers compile.",
	designRationale:
		"In C the distinction is yours to manage and getting it wrong is a security bug: return the address of a local and you have handed your caller a pointer into a dead frame. Go's answer is not a warning or a rule, it is to make the question the compiler's, so that <code>return &amp;c</code> is always safe and the compiler is obliged to arrange for it to be true. Everything else follows from that promise. The analysis has to be conservative, because the cost of wrongly proving a value non-escaping is a dangling pointer and the cost of wrongly sending it to the heap is some garbage, so every ambiguity resolves toward the heap. It has to run after inlining, because inlining is what reveals whether the caller keeps the value, which is why the decision belongs to the call site and not the function. And it is deliberately not in the language spec: no Go program's meaning depends on where a value lives, only its speed, which leaves the compiler team free to improve the analysis in any release without breaking anyone. That freedom is the reason <code>-gcflags='-m'</code> is a diagnostic and not an API, and the reason it is a poor thing to build habits on. It answers \"can this value stay in the frame\", asked of source, before execution, with no idea what a loop is. The question you almost always actually have is \"where are my allocations going\", which is a count, and counts come from <code>-benchmem</code> and the allocation profile. Reach for <code>-m</code> to explain a cost you have already measured. Reach for it to find one and you will read a wall of true statements and learn nothing.",
	commonMistakes: [
		{
			title: "Reading -m as an allocation counter",
			body: "It is a per-line, static statement of whether a value can reach the heap, with no notion of execution. A line inside a hot loop that escapes a million times per call and a line in <code>main</code> that escapes once produce identical output. Sizing a <code>strings.Builder</code> with <code>Grow</code> cut a loop from 19 allocs/op to 1 and changed the <code>-m</code> output by zero bytes. Whether is <code>-m</code>. How many is <code>-benchmem</code> and <code>go tool pprof -sample_index=alloc_objects</code>.",
		},
		{
			title: "Benchmarking a function whose result you throw away",
			body: "Discarding the result changes the answer, because it changes the escape decision at that call site. The example above goes 1 allocs/op to 0 on that basis alone, so a benchmark written the lazy way certifies as allocation-free a function that allocates on every real call. Assign to a package-level sink, or accept that you measured a version of the code nobody runs.",
		},
		{
			title: "Believing new goes to the heap and a plain var does not",
			body: "<code>new(T)</code> is defined as \"allocate a zeroed T and return its address\", and where that memory comes from is unspecified. <code>x := new(int)</code> used only locally stays in the frame; <code>var x int; return &amp;x</code> escapes. The syntax has no correlation with the outcome, in either direction. The compiler is answering a lifetime question and <code>new</code> is not evidence about lifetime.",
		},
		{
			title: "Switching to pointer receivers or pointer fields to \"avoid copying\"",
			body: "A pointer is the thing that defeats the escape proof. Passing a small struct by value copies a few words into a frame that pops for free; passing it by pointer can force the value to the heap and buy you an allocation, a collector obligation, and an indirection on every field access. Below roughly a cache line, by value is frequently both simpler and faster. Measure the pair rather than reasoning from \"pointers avoid copies\".",
		},
		{
			title: "Chasing every escape the compiler reports",
			body: "Most of them are correct and necessary. A string you return escapes because it is returned, and no rewrite changes that: in the observability lab both the slow concatenation and the fast <code>strings.Builder</code> escape, and <code>-m</code> says so about both. The bug was never that something escaped, it was that something escaped 1000 times where once would do. <code>-m</code> output also includes inlining notes and dead paths, such as the Builder's copy-check panic string escaping on every method call. Read it for the lines you asked about, not top to bottom.",
		},
	],
	relatedSlugs: ["pointers", "benchmarks", "pprof", "structs", "tooling"],
}
