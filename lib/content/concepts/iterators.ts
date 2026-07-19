import { Concept } from "../../content"

export const iterators: Concept = {
	slug: "iterators",
	name: "Iterators (range-over-func)",
	tagline:
		"Go 1.23 lets a function be a range target: the sequence pushes values to a yield callback, and yield's bool return is how your break reaches back into it.",
	summary:
		"Since Go 1.23 you can write <code>for v := range seq</code> where <code>seq</code> is a function, not a slice, map, or channel. The function has the shape <code>func(yield func(V) bool)</code>, aliased <code>iter.Seq[V]</code> (and <code>iter.Seq2[K, V]</code> for pairs): it calls <code>yield</code> once per value, and <code>yield</code> returns <code>false</code> when the consumer's loop has stopped early, which is the mechanism that makes <code>break</code>, <code>return</code>, and <code>continue</code> work across the function boundary. It is how a custom collection finally becomes a first-class <code>range</code> target instead of a <code>Next()</code> cursor or a <code>ForEach</code> callback, and, like the loop-variable change, it is gated on your <code>go.mod</code>.",
	mentalModel:
		"A range-over-func iterator is a producer you hand a single instruction to: \"here is <code>yield</code>, call it with each value until it tells you to stop.\" The consumer's loop body IS that <code>yield</code> function. The compiler rewrites <code>for v := range seq { body }</code> into roughly <code>seq(func(v V) bool { body; return true })</code>, where a <code>break</code> in the body compiles to <code>return false</code> and a <code>return</code> in the body compiles to a real return out of the enclosing function. So the sequence is in control of iteration (it decides what comes next and when), but the consumer stays in control of stopping (its <code>break</code> becomes <code>yield</code> returning <code>false</code>). That split is the whole design: the producer must check what <code>yield</code> returned and stop when it is <code>false</code>, or the two sides disagree about whether the loop is still running.",
	retrievalPrompts: [
		"You write a custom iter.Seq that calls yield in a loop but never looks at what yield returns. A consumer ranges it and breaks on the third value. What goes wrong? || The break turns into yield returning false, but your producer ignores that and keeps calling yield for the rest of the sequence. In Go 1.23 calling yield again after it has returned false panics, so a consumer that breaks crashes your iterator. The contract is not optional: every yield call site must be if !yield(v) { return }, because yield's bool return is the only signal the consumer has stopped. A producer that ignores it is a for loop whose break does not work.",
		"Ranging over a slice with for i := range s and ranging over a one-line iter.Seq that yields the same elements. Which is cheaper per element, and why would you still reach for the iterator? || The slice range is cheaper: it is a pointer bump and a bounds check the compiler knows cold. Every element of a range-over-func goes through an indirect call to the yield closure and back, which the compiler cannot always inline, so it is not free. You reach for the iterator anyway when you are abstracting over a source that is not a slice (a tree walk, a paged API, a filtered or infinite sequence), because it composes and stays lazy: the point is expressing the sequence, not out-running a slice loop.",
		"Your range-over-func code compiles for a teammate and fails for you with a syntax error on the range line, same toolchain. What differs? || The go directive in the main module's go.mod. Range-over-func is a Go 1.23 language feature gated the same way the loop-variable change was: it is enabled only when the go line says 1.23.0 or later, regardless of how new the toolchain is. Your module still says go 1.22, so the compiler rejects ranging over a function. Bump the go directive to 1.23, not just the toolchain, and it compiles. The toolchain decides what CAN be enabled; go.mod decides what IS.",
	],
	codeExample: `package main

import (
	"fmt"
	"iter"
	"slices"
)

// Count returns a push iterator over 0..n-1. An iter.Seq[int] is just
// func(yield func(int) bool): the sequence calls yield once per value, and
// yield's bool return is how a break in the consumer's loop reaches back here.
func Count(n int) iter.Seq[int] {
	return func(yield func(int) bool) {
		for i := 0; i < n; i++ {
			if !yield(i) { // consumer broke: stop producing
				return
			}
		}
	}
}

// filter wraps one Seq in another. Push iterators compose without allocating
// the intermediate sequence: nothing is built until something ranges it.
func filter(seq iter.Seq[int], keep func(int) bool) iter.Seq[int] {
	return func(yield func(int) bool) {
		for v := range seq {
			if keep(v) && !yield(v) {
				return
			}
		}
	}
}

func main() {
	// A custom sequence is a first-class range target: break, continue, and the
	// loop variable all work, because the compiler rewrites this loop into a
	// call to Count(...) that passes the body in as the yield function.
	sum := 0
	for v := range Count(1_000_000) {
		if v == 5 {
			break // this is what makes yield(5) return false inside Count
		}
		sum += v
	}
	fmt.Println("sum of 0..4:", sum, "(ranged a million-long sequence, stopped at 5)")

	// The stdlib hands back iterators now. slices.All yields index,value pairs.
	for i, s := range slices.All([]string{"a", "b", "c"}) {
		fmt.Printf("%d=%s ", i, s)
	}
	fmt.Println()

	// Compose, then collect back into a slice. Nothing between Count and
	// Collect ever holds the whole sequence in memory.
	evens := slices.Collect(filter(Count(10), func(v int) bool { return v%2 == 0 }))
	fmt.Println("evens under 10:", evens)
}`,
	codeExplanation:
		"On go1.23.12 this prints <code>sum of 0..4: 10 (ranged a million-long sequence, stopped at 5)</code>, then <code>0=a 1=b 2=c</code>, then <code>evens under 10: [0 2 4 6 8]</code>. The first line is the argument for the whole feature. <code>Count(1_000_000)</code> looks like it should build or walk a million values, but the <code>break</code> at <code>v == 5</code> compiles to <code>yield</code> returning <code>false</code>, <code>Count</code> sees <code>!yield(i)</code> and returns, and the other 999,994 iterations never happen: the sequence is lazy, driven one value at a time by the consumer's demand, not materialised up front. <code>slices.All</code> shows the stdlib now speaks this protocol: it returns an <code>iter.Seq2[int, string]</code>, so a plain <code>range</code> gets index and value with no slice copy. The last line composes: <code>filter</code> wraps <code>Count(10)</code> in another <code>iter.Seq[int]</code>, and <code>slices.Collect</code> runs the composed sequence and gathers it, and at no point does an intermediate <code>[]int</code> of the unfiltered values exist. That is the payoff over returning slices from each stage, where every stage allocates the full result before the next one starts.",
	designRationale:
		"Before Go 1.23 there were three ways to expose iteration over a type you owned, and each gave something up. Returning a slice is simple and composes with <code>range</code>, but it allocates the whole result and cannot be infinite or lazy. A stateful cursor (<code>Next() bool</code> plus <code>Value()</code>) is lazy but verbose, easy to misuse, and every collection invents its own shape. A callback (<code>ForEach(func(v))</code>) is lazy and uniform but breaks the language: you cannot <code>break</code>, <code>continue</code>, <code>return</code> from the caller, or <code>defer</code> naturally inside it, because the body is a different function. Range-over-func is the design that keeps all three properties, lazy, uniform, and composable, without breaking control flow, and the <code>bool</code> return on <code>yield</code> is the entire trick. When the compiler rewrites the loop body into the <code>yield</code> function, a <code>break</code> becomes <code>return false</code> and the producer's <code>if !yield(v) { return }</code> honours it, so <code>break</code> reaches across a function boundary that a callback could never cross. Go chose the push shape (the producer calls <code>yield</code>) as the primary form because it composes and needs no goroutine, and provided <code>iter.Pull</code> for the cases push cannot express, chiefly merging two sequences step by step, at the cost of a goroutine and an explicit <code>stop</code>. The feature is gated on the <code>go.mod</code> go directive for the same reason loop-variable semantics were: it changes what a program means, so a module opts in by declaring its language version, and a new toolchain never silently changes an old module's behaviour.",
	commonMistakes: [
		{
			title: "Writing a producer that ignores yield's return value",
			body: "<code>func(yield func(int) bool) { for _, v := range data { yield(v) } }</code> looks right and is broken: it never checks what <code>yield</code> returned, so a consumer that <code>break</code>s cannot stop it, and calling <code>yield</code> again after it returned <code>false</code> panics in Go 1.23. Every call must be <code>if !yield(v) { return }</code>. The bool is not advisory, it is the consumer's <code>break</code> arriving, and a producer that drops it is a loop whose <code>break</code> does not work.",
		},
		{
			title: "Calling yield again after it returned false",
			body: "Once <code>yield</code> returns <code>false</code>, the iteration is over and the sequence must not call it again; doing so panics with <code>runtime error: range function continued iteration after loop body returned false</code>. This usually happens through a missing <code>return</code> after the check, or a <code>defer</code>/cleanup path in the producer that yields one last value. Return immediately when <code>yield</code> is <code>false</code>, and put teardown after that return, not another yield.",
		},
		{
			title: "Reaching for an iterator to speed up a slice loop",
			body: "Range-over-func is not free: each element crosses an indirect call into the <code>yield</code> closure and back, which the compiler often cannot inline, so a plain <code>for i := range s</code> over a slice is measurably cheaper per element. Iterators earn their place by abstracting sources that are not slices (a tree, a paged API, an infinite or filtered stream) and by staying lazy, not by beating a slice range. If your data is already a slice and you just want to loop it, loop it.",
		},
		{
			title: "Forgetting range-over-func is gated on go.mod",
			body: "The feature is a Go 1.23 language change, enabled only when the main module's <code>go</code> directive is <code>1.23.0</code> or later, exactly like the loop-variable fix. A module whose <code>go.mod</code> still says <code>go 1.22</code> will not compile <code>for v := range someFunc</code> no matter how new the installed toolchain is, and the error points at the range line, not the version. Bump the <code>go</code> directive, not just the toolchain.",
		},
		{
			title: "Using iter.Pull without stopping it",
			body: "<code>iter.Pull</code> converts a push iterator into a <code>next, stop := iter.Pull(seq)</code> pull pair, which is what you need to consume two sequences in lockstep. It runs the producer on a goroutine, so if you stop reading early and never call <code>stop</code>, that goroutine is blocked in <code>yield</code> forever: a leak. Always <code>defer stop()</code> the moment you create the pair, the same discipline as <code>defer t.Stop()</code> on a ticker.",
		},
	],
	relatedSlugs: ["closures", "generics", "slices", "channels"],
}
