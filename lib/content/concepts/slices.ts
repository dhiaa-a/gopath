import { Concept } from "../../content"

export const slices: Concept = {
	slug: "slices",
	name: "Slices",
	tagline:
		"Dynamic arrays with a hidden header: length, capacity, and a pointer to an array.",
	summary:
		"A slice is a view into an underlying array. It has three parts: a pointer to the array, a length, and a capacity. This makes slices cheap to pass (no copying of elements) but creates subtle aliasing bugs if you're not aware of how they share memory.",
	mentalModel:
		"A slice is a window into a row of seats. The window has a start position, a width (length), and a maximum width it could expand to (capacity). Two slices can look at overlapping seats, so mutating one changes what the other sees. <code>append</code> either expands the window or, if at capacity, moves everyone to a bigger row.",
	retrievalPrompts: [
		"After b := a[1:4], you set b[0] = 99. Does a change? Then you append beyond b's capacity. Does a change now? || Yes: b shares the underlying array, so a[1] becomes 99. After appending beyond capacity, Go allocates a new array for b. From that point b is independent; further mutations to b do not affect a.",
		"A slice has length 3 and capacity 6. You append one element. What are the new length and capacity? You append four more, what happens? || After one append: length 4, capacity 6, which fits within existing capacity, no allocation. After four more (length 8): exceeds capacity 6, so Go allocates a new array (typically doubles), copies data, and capacity becomes at least 8.",
		"What is the practical difference between var s []int and s := []int{}? Give one situation where the difference matters. || var s []int is nil (s == nil is true). s := []int{} is non-nil with length 0. Both work with append and range. The difference matters with JSON: a nil slice marshals to null, an empty slice marshals to []. If your API must return an empty array, use []int{}.",
	],
	codeExample: `package main

import "fmt"

func main() {
	// Create a slice
	s := []int{1, 2, 3, 4, 5}
	fmt.Println(len(s), cap(s)) // 5 5

	// Slicing creates a view — shared memory!
	a := s[1:3] // [2 3]
	a[0] = 99
	fmt.Println(s) // [1 99 3 4 5] — s is affected!

	// append beyond capacity creates a new array
	b := append(s, 6, 7, 8)
	b[0] = 0
	fmt.Println(s[0]) // still 1 — b is now independent
	fmt.Println(b)    // [0 99 3 4 5 6 7 8]

	// Safe copy pattern
	c := make([]int, len(s))
	copy(c, s)
	c[0] = 999
	fmt.Println(s[0]) // 1 — unaffected
}`,
	codeExplanation:
		"Slicing with <code>s[1:3]</code> shares the underlying array, so mutations in <code>a</code> appear in <code>s</code>. <code>append</code> returns a new slice; if it needed to grow, it allocated a new array and <code>s</code> and <code>b</code> no longer share memory. <code>copy</code> always produces a fully independent slice.",
	designRationale:
		"Go separated the concept of a view into data from ownership of data because copying large arrays on every function call would make Go unsuitable for systems programming. A slice (a three-field header of pointer, length, and capacity) is cheap to pass while leaving the underlying array in place. The aliasing behaviour is an explicit design trade-off: slices are deliberately lightweight descriptors, and understanding that two slices can share memory is part of the expected mental model.",
	commonMistakes: [
		{
			title: "Mutating a slice you think is independent",
			body: "After <code>b := a[1:3]</code>, modifying <code>b</code> modifies <code>a</code>. Use <code>copy</code> if you need an independent copy.",
		},
		{
			title: "nil slice vs empty slice",
			body: "A nil slice (<code>var s []int</code>) and an empty slice (<code>s := []int{}</code>) both have length 0, but only the nil slice is nil. Both work with <code>append</code> and <code>range</code>, but JSON encodes nil as <code>null</code> and empty as <code>[]</code>.",
		},
	],
	relatedSlugs: ["structs", "json-decode"],
}
