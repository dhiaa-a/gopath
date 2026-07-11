import { Tier0Lesson } from "../../content"

export const controlFlow: Tier0Lesson = {
	slug: "control-flow",
	order: 5,
	title: "for is the only loop",
	tagline: "One loop keyword, if with setup, and a switch that doesn't fall through.",
	estimatedMinutes: 15,
	intro: [
		{
			type: "text",
			value: {
				en: "Go has exactly one loop keyword: <code>for</code>. There is no <code>while</code>, no <code>do/while</code>, no <code>foreach</code>. That's not minimalism for its own sake; every looping construct a language adds is another form readers must recognize and another pair of semantics to misremember (quick: does a do/while run once on a false condition?). Go collapses them into one keyword with three shapes.",
			},
		},
		{
			type: "text",
			value: {
				en: "Two more departures worth knowing before you read real Go. <code>if</code> can run a setup statement before its condition, scoping a variable to just that branch. And <code>switch</code> breaks automatically after each case: C's fall-through, source of decades of missing-<code>break</code> bugs, is opt-in via an explicit <code>fallthrough</code> keyword you will almost never type.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	// Shape 1: the three-clause for you already know.
	for i := 0; i < 3; i++ {
		fmt.Println("count", i)
	}

	// Shape 2: condition only. This is Go's "while".
	n := 40
	for n > 1 {
		n = n / 2
	}
	fmt.Println("halved down to", n)

	// if with a setup statement: rem exists only inside this if/else.
	if rem := 17 % 5; rem != 0 {
		fmt.Println("17 is not divisible by 5, remainder", rem)
	}

	switch hour := 14; {
	case hour < 12:
		fmt.Println("morning")
	case hour < 18:
		fmt.Println("afternoon") // no break needed; none falls through
	default:
		fmt.Println("evening")
	}
}`,
	after: [
		{
			type: "text",
			value: {
				en: "The second loop is the shape people miss: <code>for n > 1</code> is a while loop, keyword and all. Drop the condition too (<code>for { ... }</code>) and you have an infinite loop, exited with <code>break</code> or <code>return</code>; that shape runs every server you'll write in Tier 2. The third shape, <code>for range</code>, walks collections, and you'll meet it in the slices lesson.",
			},
		},
		{
			type: "text",
			value: {
				en: "Look at the switch: no expression after <code>switch hour := 14;</code> means each <code>case</code> is a boolean condition, evaluated top to bottom. It reads like an if/else-if chain with the noise removed. And because cases break automatically, a missing <code>break</code> can't silently run the next case's code. The bug class doesn't exist here.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Break it: delete the braces from the first loop and write <code>for i := 0; i < 3; i++ fmt.Println(i)</code>. It won't parse. Braces are mandatory on every if, for, and switch body, even one-liners. C allows braceless bodies, which is how Apple's \"goto fail\" TLS bug shipped: a duplicated line silently escaped its if. Go removes the possibility at the grammar level.",
			},
		},
	],
	retrievalPrompts: [
		"Write Go's version of a while loop that halves n until it's 1 or less. || for n > 1 { n = n / 2 }. The keyword is still for; a single condition is the while shape. No condition at all (for { ... }) is an infinite loop exited by break or return.",
		"What does if rem := x % 5; rem != 0 do that a plain if can't? || It runs a setup statement first and scopes rem to the if/else only. The variable can't leak into the surrounding function, which keeps single-use values (remainders, lookups, errors) from cluttering the outer scope.",
		"Why doesn't Go's switch need break after each case? || Cases break automatically; fall-through is opt-in via the explicit fallthrough keyword. C inherited implicit fall-through and with it decades of missing-break bugs; Go inverted the default so the mistake can't be made silently.",
	],
}
