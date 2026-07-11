import { Concept } from "../../content"

export const pointers: Concept = {
	slug: "pointers",
	name: "Pointers",
	tagline:
		"A pointer holds the memory address of a value, enabling mutation and sharing.",
	summary:
		"Go uses pointers to avoid copying data and to allow functions to mutate their arguments. A pointer <code>*T</code> holds the memory address of a <code>T</code>. You dereference it with <code>*ptr</code> to read or write the value. The address-of operator <code>&amp;</code> gives you a pointer to an existing value.",
	mentalModel:
		"A value is a house. A pointer is the street address written on a piece of paper. If you hand someone a copy of your house (value), they can redecorate it without affecting yours. If you hand them the address (pointer), any changes they make are to your actual house.",
	retrievalPrompts: [
		"You write one method on Counter with a value receiver and one with a pointer receiver, both incrementing. Which mutation persists after the call? || The pointer receiver mutation persists. The value receiver gets a copy; its change does not escape. The pointer receiver operates on the original. From main, Go auto-addresses a variable for pointer receiver calls, so both can be called on the same Counter.",
		"A function returns *User. When should it return nil, and what must the caller do before using it? || Return nil when there is no result, for example user not found. The caller must check if result != nil before dereferencing. Dereferencing nil panics. Better pattern: return (*User, error); nil pointer for no result, non-nil error for failure.",
		"All methods on FileWriter use pointer receivers. You accidentally add one with a value receiver. What breaks? || If FileWriter implements an interface, the value receiver method is in the method set of both FileWriter and *FileWriter, but pointer receiver methods are only in *FileWriter. A mismatch may cause an interface satisfaction compile error. go vet also warns about inconsistent receiver types.",
	],
	codeExample: `package main

import "fmt"

type Counter struct {
	count int
}

// Value receiver — works on a copy
func (c Counter) ValueIncrement() {
	c.count++ // affects the copy only
}

// Pointer receiver — works on the original
func (c *Counter) Increment() {
	c.count++
}

func main() {
	c := Counter{}
	c.ValueIncrement()
	fmt.Println(c.count) // 0 — unchanged

	c.Increment()
	fmt.Println(c.count) // 1 — mutated
}`,
	codeExplanation:
		"<code>ValueIncrement</code> receives a copy of <code>Counter</code>, so its change doesn't escape. <code>Increment</code> receives a pointer, so the mutation affects the original. This is the most common pointer vs value confusion in Go.",
	designRationale:
		"Go makes pointer semantics explicit because implicit reference passing hides whether a function can mutate its arguments: callers have no way to know without reading the implementation. Explicit pointers make mutation visible at the call site: <code>&x</code> signals 'this function may change x'. Go deliberately omits pointer arithmetic because a pointer's only legitimate uses are sharing a value across function boundaries and enabling mutation, not manual memory navigation.",
	commonMistakes: [
		{
			title: "Nil pointer dereference",
			body: "Dereferencing a nil pointer panics. Before dereferencing, always check <code>if ptr != nil</code>. Return pointers from functions only when the zero value is meaningfully different from 'no result'; otherwise return a value and an error.",
		},
		{
			title: "Mixed pointer and value receivers on the same type",
			body: "If any method on a type uses a pointer receiver, all methods should use pointer receivers. Mixing causes subtle bugs with interface satisfaction and is a style violation.",
		},
	],
	relatedSlugs: ["structs", "interfaces"],
}
