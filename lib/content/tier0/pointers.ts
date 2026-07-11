import { Tier0Lesson } from "../../content"

export const pointers: Tier0Lesson = {
	slug: "pointers",
	order: 6,
	title: "What * and & actually do",
	tagline: "A pointer is an address. Everything else follows from that.",
	estimatedMinutes: 18,
	intro: [
		{
			type: "text",
			value: {
				en: "This is the lesson that unblocks Tier 1, so take the full time. A pointer is a memory address: a number that says where a value lives. <code>&x</code> asks \"where does x live?\" and gives you that address. <code>*p</code> asks \"what lives at this address?\" and gives you the value back. That's the entire mechanism. The two symbols are questions and answers about location, nothing more mystical.",
			},
		},
		{
			type: "text",
			value: {
				en: "Why does Go need them when Python and JavaScript don't? Because Go is honest about copying. Every argument you pass to a Go function is copied; the callee gets its own copy, always. Python hands functions a reference to the same object; Java does the same for everything except primitives; you never chose. In Go, the type says which one you get: <code>int</code> means \"a copy of the number,\" <code>*int</code> means \"the address of the caller's number.\" Watch what that means in practice:",
			},
		},
	],
	program: `package main

import "fmt"

func doubleCopy(n int) {
	n = n * 2 // mutates the copy; the caller never sees this
}

func double(n *int) {
	*n = *n * 2 // follows the address, mutates the caller's variable
}

func main() {
	x := 10

	doubleCopy(x)
	fmt.Println("after doubleCopy:", x)

	double(&x)
	fmt.Println("after double:    ", x)

	p := &x
	fmt.Println("x lives at", p, "and holds", *p)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Run it. <code>doubleCopy</code> changes nothing: it doubled its private copy and the copy vanished when the function returned. <code>double</code> works because it received <code>&x</code>, the address of the caller's variable, and <code>*n = *n * 2</code> writes through that address into the original memory. The last line makes it concrete: <code>p</code> prints as something like <code>0xc000012345</code>. It really is just an address.",
			},
		},
		{
			type: "text",
			value: {
				en: "Read <code>*</code> in two positions. In a type, <code>*int</code> means \"pointer to int.\" In an expression, <code>*p</code> means \"the value at p.\" The zero value of any pointer is <code>nil</code>: an address that points nowhere. Dereferencing nil crashes the program with a panic, which you will do at least once this year; the fix is always the same, check or initialize before following.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "This resolves a Tier 1 speed bump now: the standard flag package returns pointers. <code>dir := flag.String(\"dir\", \".\", \"target\")</code> gives you a <code>*string</code>, because the package needs to write the parsed value into memory you can read afterwards. So you'll see <code>*dir</code> everywhere in the first project. That's not noise; it's \"the value at the address flag gave me.\"",
			},
		},
	],
	retrievalPrompts: [
		"What do &x and *p literally evaluate to? || &x evaluates to the memory address where x lives (a pointer). *p evaluates to the value stored at address p (a dereference). In a type, the asterisk means pointer-to: *int is \"pointer to int.\"",
		"A function takes n int and assigns n = n * 2. The caller's variable is unchanged. Why, and what's the fix? || Go copies every argument; the function doubled its own copy, which died at return. Fix: take n *int, call it with double(&x), and write through the pointer with *n = *n * 2 so the write lands in the caller's memory.",
		"What is the zero value of a pointer, and what happens if you dereference it? || nil, an address pointing nowhere. Dereferencing nil panics and crashes the program at runtime (not compile time). Check for nil or initialize the pointer before following it.",
	],
}
