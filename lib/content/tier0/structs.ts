import { Tier0Lesson } from "../../content"

export const structs: Tier0Lesson = {
	slug: "structs",
	order: 7,
	title: "Structs: your own types",
	tagline: "Named fields, contiguous memory, no class ceremony.",
	estimatedMinutes: 14,
	intro: [
		{
			type: "text",
			value: {
				en: "A struct is a group of named fields stored side by side in memory. That's the whole definition. There is no class keyword, no constructor, no inheritance hierarchy to place it in. A Java object carries a header and lives behind a reference; a Python object is a dictionary of attributes resolved at runtime. A Go struct is just its fields, laid out contiguously, with every offset known at compile time. Field access compiles to \"read memory at base plus offset,\" which is as fast as it gets.",
			},
		},
		{
			type: "text",
			value: {
				en: "The corollary that trips up people coming from reference languages: structs are values. Assigning one copies all of it, the same way assigning an <code>int</code> copies the number. Two variables never secretly share a struct unless you involve a pointer, and after the last lesson you know exactly what that means.",
			},
		},
	],
	program: `package main

import "fmt"

type User struct {
	Name  string
	Email string
	Age   int
}

func main() {
	// Field-name literal: order-independent, survives adding fields.
	alice := User{Name: "Alice", Email: "alice@example.com", Age: 34}

	// Zero-value struct: every field is its own zero value.
	var nobody User
	fmt.Println(nobody)

	// Assignment copies the whole struct.
	backup := alice
	backup.Email = "new@example.com"

	fmt.Println(alice.Email)
	fmt.Println(backup.Email)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Two outputs matter. <code>nobody</code> prints as <code>{  0}</code> (two empty strings and a zero): a struct declared without assignment is fully usable, every field at its zero value, because struct memory is zeroed like all Go memory. No constructor ran because none exists; if a type needs setup, Go code provides a plain function conventionally named <code>NewUser(...)</code>, and you can read it like any other function.",
			},
		},
		{
			type: "text",
			value: {
				en: "And <code>alice.Email</code> still prints the original address after <code>backup.Email</code> changed. <code>backup := alice</code> copied all three fields into new memory; the two structs are independent from that moment. In Python this same sequence would alias one object and \"corrupt\" alice. If you want sharing, you say so with a pointer: <code>ref := &alice</code>, then <code>ref.Email = ...</code> writes through to the original.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Use field-name literals (<code>User{Name: \"Alice\"}</code>), not positional ones (<code>User{\"Alice\", \"alice@example.com\", 34}</code>). Positional literals break the moment someone inserts a field, and they read as a puzzle. Any field you omit in a named literal is its zero value, which composes perfectly with zero-value design.",
			},
		},
	],
	retrievalPrompts: [
		"Define a struct type Point with X and Y ints, create one with a literal, and explain what var p Point gives you. || type Point struct { X, Y int }. Literal: p := Point{X: 1, Y: 2}. var p Point is a fully usable struct with X and Y at 0: struct memory is zeroed, so the zero-value struct is valid without any constructor.",
		"b := a where both are structs, then b.Field = \"x\". What does a.Field hold and why? || The original value. Struct assignment copies every field into new memory; a and b are independent values, like copying an int. Sharing requires a pointer: ref := &a makes writes through ref visible in a.",
		"Go has no constructors. What's the convention when a type needs setup logic? || A plain function named NewTypeName that returns the type (or a pointer to it): func NewUser(name string) *User. It's not special syntax, just a naming convention, so there's no hidden initialization to reason about.",
	],
}
