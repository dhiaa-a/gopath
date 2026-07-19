import { Tier0Lesson } from "../../content"

export const functions: Tier0Lesson = {
	slug: "functions",
	order: 4,
	title: "Functions and multiple returns",
	tagline: "Types after names, and more than one way out.",
	estimatedMinutes: 14,
	intro: [
		{
			type: "text",
			value: {
				en: "Go function syntax reads left to right: <code>func name(param type) returnType</code>. The type comes after the name, which feels backwards from Java or C# for about a day and then reads more naturally than the alternative (the declaration order matches how you'd say it out loud: \"a takes an int and returns a string\").",
			},
		},
		{
			type: "text",
			value: {
				en: "The feature that actually changes how you write code: functions can return multiple values, directly, without wrapper objects or tuples. Python fakes this with tuple packing; Java makes you define a class or use a pair library; C# needed <code>out</code> parameters for years. In Go it's first-class syntax, and it exists for one dominant reason you'll meet properly in the errors lesson: results and failures travel together, as two return values.",
			},
		},
	],
	program: `package main

import "fmt"

// Two params of the same type can share the type name.
func divmod(a, b int) (int, int) {
	return a / b, a % b
}

func describe(seconds int) (mins int, rest int) {
	mins = seconds / 60
	rest = seconds % 60
	return // "naked" return: uses the named results
}

func main() {
	q, r := divmod(17, 5)
	fmt.Println(q, r)

	m, s := describe(200)
	fmt.Printf("%dm%ds\\n", m, s)

	// Take only what you need; discard the rest explicitly.
	onlyQuotient, _ := divmod(17, 5)
	fmt.Println(onlyQuotient)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Three things to notice. First, <code>divmod</code> returns two values and the caller receives both in one statement: <code>q, r := divmod(17, 5)</code>. Second, <code>describe</code> uses named results: <code>(mins int, rest int)</code> declares the return variables up front, and a bare <code>return</code> ships whatever they hold. Use that sparingly; in long functions a naked return forces the reader to scroll up to learn what's being returned. Third, the blank identifier <code>_</code> discards a value you don't want. It's not a convention, it's syntax: the compiler requires you to either use a returned value's variable or explicitly throw it away.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Break it: change <code>q, r := divmod(17, 5)</code> to <code>q := divmod(17, 5)</code>. Compile error: <em>assignment mismatch: 1 variable but divmod returns 2 values</em>. Multiple returns are part of the function's type. You can't quietly drop one the way you'd ignore a Python tuple element; every value is accounted for, used or discarded by name.",
			},
		},
	],
	retrievalPrompts: [
		"Write a function that returns both the integer quotient and remainder of two ints. How does the caller receive them? || func divmod(a, b int) (int, int) { return a / b, a % b }. Caller: q, r := divmod(17, 5). Both values arrive in one assignment; the compiler errors if the variable count doesn't match the return count.",
		"What is the blank identifier for, and why does Go make you write it? || _ explicitly discards a value: onlyQ, _ := divmod(a, b). Go requires every returned value to be either used or deliberately thrown away, so ignoring something is a visible decision in the source, not an accident.",
		"What are named return values, and what's the argument against naked returns? || func f() (n int, err error) declares result variables that a bare return ships automatically. In anything longer than a few lines, the naked return hides what's actually returned, so idiomatic Go reserves it for very short functions.",
	],
}
