import { Concept } from "../../content"

export const closures: Concept = {
	slug: "closures",
	name: "Closures and captured variables",
	tagline:
		"A closure captures the variable itself, not a snapshot of its value, and Go 1.22 changed which variable a loop hands it.",
	summary:
		"A closure is a function value that carries references to the variables it uses from the enclosing scope. It closes over the <em>variable</em>, not a copy of whatever the variable held when the closure was built, so if that variable is assigned to afterward the closure observes the new value. That single mechanism is behind both the notorious loop-variable bug and its fix. Through Go 1.21 a <code>for</code> loop had one iteration variable shared across every pass, so all the closures captured it and all read its final value; Go 1.22 gives each iteration its own variable, so each closure captures a distinct one. The bug did not disappear because people learned to write better loops: the language changed what the loop declares.",
	mentalModel:
		"Do not picture a closure copying values inward. Picture it holding the addresses of the actual variables it reached out and grabbed, which is close to what the compiler really emits. A closure is a pair: the function's code, plus pointers to every captured variable. Reading a captured variable follows its pointer to wherever that variable now lives, so the value you get is always the current one. The right question is never what was <code>i</code> when I made this closure, it is which variable does this closure point at, and how many closures point at the same one. Go 1.22's loop change is entirely a change to that second question: the closures are unchanged, but each now points at a fresh per-iteration variable instead of all sharing one.",
	retrievalPrompts: [
		"On Go 1.22 a loop that appends func(){ print(i) } and later runs them prints 0 1 2; the identical code on Go 1.21 prints 3 3 3. What changed? || What each closure captured. A closure captures the variable, not its value, so on Go 1.21, where the for loop kept one i shared across iterations, all three closures captured that single i and read its final value 3. Go 1.22 declares the loop variable afresh each iteration, so each closure captured a different i holding 0, 1, and 2. The closures are identical; the loop now hands each one its own variable.",
		"You upgraded to the Go 1.22 toolchain but the loop still prints 3 3 3. Why is the fix not active? || Because the per-iteration semantics are gated on the language version in go.mod, not on the toolchain you built with. A module whose go.mod says go 1.21 keeps the old single-variable loop even under a 1.22 compiler; only go 1.22 or higher in go.mod switches it on. Raise the go line in go.mod to change the behavior. It is a per-module language setting, which is how one compiler binary can produce either result.",
		"You capture a variable declared before the loop and mutate it inside the loop; Go 1.22 does not save you. Why not? || Because Go 1.22 only makes the loop's own iteration variable per-iteration. A variable you declared outside the loop is still one variable, and every closure captures that same one, so reading them all afterward reports its final value. Capture-by-variable is the rule everywhere; the 1.22 change is narrowly about what for declares, not about closures suddenly taking snapshots. To snapshot, assign to a new variable inside the loop body and capture that instead.",
	],
	codeExample: `package main

import "fmt"

func main() {
	// Each for-loop iteration in Go 1.22+ gets its OWN copy of i, so each
	// closure captures a different variable. Before Go 1.22 there was one
	// shared i and all three would print 3.
	var funcs []func()
	for i := 0; i < 3; i++ {
		funcs = append(funcs, func() { fmt.Printf("%d ", i) })
	}
	for _, f := range funcs {
		f()
	}
	fmt.Println() // 0 1 2  (was 3 3 3 before Go 1.22)

	// A closure closes over the VARIABLE, not its value at capture time.
	// There is one n; the closure sees whatever n currently holds.
	n := 1
	get := func() int { return n }
	fmt.Println(get()) // 1
	n = 42
	fmt.Println(get()) // 42: same closure, new value

	// The still-live gotcha: a variable declared OUTSIDE the loop and mutated
	// inside it. The per-iteration fix does not apply, because sum is not the
	// loop variable. All three closures share the one sum.
	sum := 0
	var reads []func() int
	for i := 0; i < 3; i++ {
		sum += i
		reads = append(reads, func() int { return sum })
	}
	for _, r := range reads {
		fmt.Printf("%d ", r())
	}
	fmt.Println() // 3 3 3: all read the final sum
}`,
	codeExplanation:
		"On this go1.22.1 toolchain the program prints four lines: <code>0 1 2</code>, then <code>1</code>, then <code>42</code>, then <code>3 3 3</code>. The first line is Go 1.22's per-iteration loop variable at work: each closure captured a different <code>i</code>, holding 0, 1, and 2. Lower the language version to <code>go 1.21</code> in go.mod, change nothing else, and the same source prints <code>3 3 3</code> on that line, because now a single shared <code>i</code> has already reached 3 by the time any closure runs (verified by editing only the go.mod directive). Lines two and three show capture-by-variable head on: <code>get</code> closes over <code>n</code> and returns <code>1</code>, then after <code>n = 42</code> the very same <code>get</code> returns <code>42</code>, because it holds the variable rather than a copy of the old value. The last line is the gotcha that outlives the 1.22 fix: <code>sum</code> is declared outside the loop, so it is one variable shared by all three closures, and after the loop they all read its final value <code>3</code>, which is <code>0+1+2</code>. The fix touched only what the <code>for</code> statement declares, and <code>sum</code> is not it.",
	designRationale:
		"Two decisions meet here. The first is that closures capture by reference, which is what makes them worth having: a closure that could only read a frozen copy could not accumulate into a counter its caller also watches, and Go relies on that for callbacks, deferred cleanup, and goroutine bodies. To keep it sound, the compiler runs escape analysis. A captured variable can outlive the function that declared it, so it cannot stay in that function's stack frame, which is reclaimed on return; the compiler notices the capture and moves the variable to the heap, and the closure holds a pointer to it. That is why closing over a variable in a hot loop can quietly allocate. The second decision was to change what <code>for</code> declares. For over a decade the shared loop variable was the single most common Go mistake, because capture-by-reference plus one shared variable is a trap that reads as though it should snapshot. Rather than change closures, which are behaving correctly, Go 1.22 changed the loop to declare a fresh variable each iteration, and gated the change on the go.mod language version so no existing program shifts behavior without an explicit opt-in. It is a rare case of a language fixing a footgun by narrowing what a statement means, with a per-module version flag as the price.",
	commonMistakes: [
		{
			title: "Assuming a closure snapshots the value",
			body: "Writing <code>f := func() int { return x }</code> and believing it froze <code>x</code> at that instant. It did not: <code>f</code> holds the variable, so a later <code>x = 99</code> makes <code>f()</code> return 99. For a genuine snapshot, copy into a fresh variable first, <code>x2 := x; f := func() int { return x2 }</code>, and that only works because <code>x2</code> is never assigned again.",
		},
		{
			title: "Assuming the loop-variable fix follows the toolchain",
			body: "Per-iteration loop variables are gated on the language version in go.mod, not on the compiler you run. Build a <code>go 1.21</code> module with a 1.22 toolchain and the old shared-variable loop is still in force, so the classic <code>3 3 3</code> bug is live. The fix only activates at <code>go 1.22</code> or higher in go.mod. This is deliberate, so that upgrading a toolchain cannot silently alter a working program, but it makes the version line load-bearing.",
		},
		{
			title: "Goroutines in a loop sharing a mutated accumulator",
			body: "Even on Go 1.22, a loop that runs <code>total += n</code> and launches <code>go func(){ use(total) }()</code> has every goroutine capture the one <code>total</code>. Because the goroutines run later and concurrently, they read whatever <code>total</code> has reached, not the per-iteration value, and they race with the loop still writing it. The per-iteration fix covers the loop variable, not variables you mutate in the body. Pass the value as an argument, <code>go func(t int){ use(t) }(total)</code>, which both snapshots it and removes the race.",
		},
		{
			title: "Deferring a closure that reads a loop variable",
			body: "<code>for _, f := range files { defer func(){ f.Close() }() }</code> hides two problems. Every deferred call runs at function return, not at the end of its iteration, so nothing closes until the whole function exits. On Go 1.21 they would also all close the last <code>f</code>. Go 1.22 fixes the variable half so each defer closes its own <code>f</code>, but the timing half stays: for per-iteration cleanup, move the work into a function called each iteration, or write <code>defer f.Close()</code>, which evaluates the receiver now yet still runs at return.",
		},
		{
			title: "Capturing a range value and expecting the live element",
			body: "In <code>for i, v := range xs { funcs = append(funcs, func(){ use(v) }) }</code>, <code>v</code> is a per-iteration copy of the element on Go 1.22, so each closure sees its own value, but it is still a copy: mutate <code>xs[i]</code> afterward and the closure never sees it, because <code>v</code> was copied out of the slice at range time. To read the live element, capture the index and index in, <code>func(){ use(xs[i]) }</code>, so the closure reads the slice rather than a stale copy.",
		},
	],
	relatedSlugs: ["goroutines", "escape-analysis", "defer", "value-semantics"],
}
