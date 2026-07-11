import { Tier0Lesson } from "../../content"

export const closures: Tier0Lesson = {
	slug: "closures",
	order: 12,
	title: "Functions are values",
	tagline: "Assign them, pass them, and let them capture variables.",
	estimatedMinutes: 13,
	intro: [
		{
			type: "text",
			value: {
				en: "Functions in Go are ordinary values. They have types (<code>func(int) int</code> is a type like any other), they can be assigned to variables, passed as arguments, and returned from other functions. If you write JavaScript this is your home turf; if you come from Java, this is what lambdas and functional interfaces were retrofitted to fake.",
			},
		},
		{
			type: "text",
			value: {
				en: "The part that matters for real Go: an anonymous function captures the variables around it, and it captures the variables themselves, not snapshots of their values. A function that outlives its enclosing scope keeps that scope's variables alive with it. That pair (function + captured variables) is a closure, and it's Go's standard mechanism for attaching state to behavior without defining a type.",
			},
		},
	],
	program: `package main

import "fmt"

// Returns a function; each returned function owns a private n.
func makeCounter() func() int {
	n := 0
	return func() int {
		n++ // captures n itself, not a copy of its value
		return n
	}
}

func apply(nums []int, f func(int) int) []int {
	out := []int{}
	for _, v := range nums {
		out = append(out, f(v))
	}
	return out
}

func main() {
	tick := makeCounter()
	tock := makeCounter()
	fmt.Println(tick(), tick(), tick())
	fmt.Println(tock())

	double := func(x int) int { return x * 2 }
	fmt.Println(apply([]int{1, 2, 3}, double))
}`,
	after: [
		{
			type: "text",
			value: {
				en: "The output proves both claims. <code>tick()</code> prints 1, 2, 3: the closure kept <code>n</code> alive after <code>makeCounter</code> returned, and each call mutates the same captured variable. <code>tock()</code> prints 1: a second call to <code>makeCounter</code> created a fresh <code>n</code>, so the two counters are fully independent. Local variables aren't tied to a stack frame's lifetime in Go; the compiler notices <code>n</code> escapes and places it where it can outlive the call.",
			},
		},
		{
			type: "text",
			value: {
				en: "<code>apply</code> shows the other direction: functions as parameters. Its second parameter has type <code>func(int) int</code>, satisfied by any function of that shape, named or anonymous. This pattern is everywhere in real Go: HTTP handlers, sort comparators, worker tasks, and test helpers are all \"pass behavior as a value.\"",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Capture cuts both ways: two closures capturing the same variable see each other's writes, which becomes genuinely dangerous once goroutines enter in Tier 2. And if you're reading pre-2024 Go threads about loop variables and closures: Go 1.22 changed loop semantics so each iteration gets a fresh variable, retiring the single most famous closure bug in the language.",
			},
		},
	],
	retrievalPrompts: [
		"Write makeCounter() so each returned function has an independent count. Why does n survive after makeCounter returns? || func makeCounter() func() int { n := 0; return func() int { n++; return n } }. The closure captures n itself; the compiler sees n escaping and allocates it to outlive the call. Each makeCounter() call creates a fresh n, so counters are independent.",
		"Does a Go closure capture a variable's value at creation time, or the variable itself? || The variable itself. Later changes to the variable are visible inside the closure, and the closure's writes are visible outside. Two closures over the same variable share it: state, not snapshot.",
		"What is the type of func(x int) int { return x * 2 }, and where do function types show up in practice? || func(int) int: function types are ordinary types. They appear as parameters (sort comparators, HTTP handlers, worker tasks) and returns (makeCounter). Passing behavior as a value is standard Go, not a functional-programming add-on.",
	],
}
