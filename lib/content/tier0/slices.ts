import { Tier0Lesson } from "../../content"

export const slices: Tier0Lesson = {
	slug: "slices",
	order: 9,
	title: "Slices, first contact",
	tagline: "Go's growable list, and the append rule you must not skip.",
	estimatedMinutes: 16,
	intro: [
		{
			type: "text",
			value: {
				en: "The slice is Go's everyday collection: an ordered, growable sequence, the role Python's list and JavaScript's array play. The syntax below covers 90% of daily use. What a slice actually is under the hood (a small header pointing into a shared backing array) has its own <a href=\"/concepts/slices\" class=\"text-go-cyan underline decoration-go-cyan/40 hover:no-underline\">concept page</a> that you'll want mid-Tier-1; today is about using them fluently.",
			},
		},
		{
			type: "text",
			value: {
				en: "One rule to burn in immediately: <code>append</code> returns a new slice value, and you must keep it. The idiom is always <code>s = append(s, x)</code>. Calling append and dropping the result is a bug the compiler only sometimes catches, and understanding exactly why waits for the internals page. For now: always reassign.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	// Literal, like a typed list.
	langs := []string{"python", "js", "java"}

	// Always s = append(s, ...). Append grows as needed.
	langs = append(langs, "go")
	langs = append(langs, "rust", "zig")

	fmt.Println(langs, "len =", len(langs))
	fmt.Println("first:", langs[0], "last:", langs[len(langs)-1])

	// range gives index and value.
	for i, lang := range langs {
		fmt.Println(i, lang)
	}

	// Slicing: half-open [from:to), like Python but no negatives.
	mid := langs[1:3]
	fmt.Println("mid:", mid)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "The pieces: <code>[]string{...}</code> declares and fills in one literal (the empty brackets before the type mean slice; <code>[3]string</code> with a number would be a fixed-size array, a different and much rarer type). <code>len(s)</code> is a builtin function, not a method. Indexing is bounds-checked: <code>langs[99]</code> compiles fine and panics at runtime, no silent <code>undefined</code> like JavaScript.",
			},
		},
		{
			type: "text",
			value: {
				en: "<code>for i, lang := range langs</code> is the third and final shape of <code>for</code>: it yields index and element. Only need the element? <code>for _, lang := range langs</code>, with the blank identifier from the functions lesson. Slicing syntax <code>langs[1:3]</code> takes elements 1 and 2, half-open exactly like Python's <code>langs[1:3]</code>, but there are no negative indices; the last element is <code>langs[len(langs)-1]</code>, written out.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Break it: change an append line to just <code>append(langs, \"go\")</code> without the assignment. The compiler rejects it: <em>append(langs, \"go\") (value of type []string) is not used</em>. Good, but don't lean on that net: <code>grown := append(langs, \"go\")</code> compiles happily and leaves <code>langs</code> without the new element. The compiler only catches a fully discarded result, which is why <code>s = append(s, ...)</code> needs to be muscle memory.",
			},
		},
	],
	retrievalPrompts: [
		"Declare a slice of strings with three elements, add a fourth, and get the last element. || s := []string{\"a\", \"b\", \"c\"}; s = append(s, \"d\"); last := s[len(s)-1]. Append must be reassigned (s = append(s, ...)), len is a builtin, and there's no negative indexing.",
		"What does for i, v := range s give you, and how do you iterate when you only need values? || i is the index, v is a copy of the element at that index. Values only: for _, v := range s, discarding the index with the blank identifier. (Index only: for i := range s.)",
		"What happens when you index past the end of a slice, and how is that different from JavaScript? || Runtime panic: index out of range, crashing the program with a stack trace. JavaScript returns undefined and lets the bad value flow onward; Go stops at the exact line where the assumption broke.",
	],
}
