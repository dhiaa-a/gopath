import { Concept } from "../../content"

export const structs: Concept = {
	slug: "structs",
	name: "Structs",
	tagline:
		"Named collections of fields: Go's primary way to model data.",
	summary:
		"A struct is a composite type that groups together fields with names and types. Unlike classes in OOP languages, Go structs have no inheritance; behaviour is added through methods and composition. Structs are value types by default: assigning or passing a struct copies it.",
	mentalModel:
		"A struct is a form with labelled fields. When you assign a struct to another variable, you're filling out a new identical form, and changes to one don't affect the other. To share a struct across functions and have mutations visible, pass a pointer to it.",
	retrievalPrompts: [
		"You pass a struct to a function that mutates a field. Back in the caller, did the field change? When would your answer be different? || No. Structs are value types, so the function received a copy. The caller's struct is unchanged. It would be different if you passed a pointer (*MyStruct); then both point to the same memory and the mutation persists.",
		"What is the zero value of a struct with Count int, Label string, Active bool? Is it safe to use without initialisation? || Count: 0, Label: \"\", Active: false. Whether it is safe depends on the type's contract. For these fields, yes; all zero values are meaningful. Go's design encourages zero-value structs to be usable without a constructor.",
		"Explain embedding with type Employee struct { Person }. What does it give you, and how is it different from inheritance? || Embedding promotes Person's fields and methods onto Employee, so you write e.Name instead of e.Person.Name. It is composition, not inheritance: Employee does not is-a Person. You cannot substitute an Employee where a Person is expected. The types remain distinct.",
	],
	codeExample: `package main

import "fmt"

type Address struct {
	Street string
	City   string
}

type User struct {
	Name    string
	Age     int
	Address // embedded — fields promoted
}

func (u *User) Greet() string {
	return fmt.Sprintf("Hi, I'm %s from %s", u.Name, u.City)
}

func main() {
	u := User{
		Name: "Alice",
		Age:  30,
		Address: Address{
			Street: "123 Main St",
			City:   "Baghdad",
		},
	}

	fmt.Println(u.Greet())
	fmt.Println(u.City) // promoted from Address
}`,
	codeExplanation:
		"Embedding <code>Address</code> inside <code>User</code> promotes its fields, so you can write <code>u.City</code> instead of <code>u.Address.City</code>. Methods are defined separately on <code>*User</code> (pointer receiver) so mutations persist.",
	designRationale:
		"Go chose composition over inheritance because class hierarchies create tight coupling that becomes expensive to refactor as requirements change. Structs have methods but no parent class; shared behaviour comes from embedding and interfaces, which can be changed independently. Structs are value types by default so passing them to functions is explicit about copying; you opt into reference semantics with a pointer. Zero values are a first-class design choice: every struct is usable immediately without a constructor, eliminating a whole category of uninitialized-state bugs.",
	commonMistakes: [
		{
			title: "Copying large structs unintentionally",
			body: "Passing a large struct to a function copies the entire thing. For structs with many fields or mutable state, pass a pointer (<code>*MyStruct</code>) instead.",
		},
		{
			title: "Zero value confusion",
			body: 'Every field in a struct starts as its zero value: 0, "", false, nil. This is intentional and useful, but always consider whether a zero-value struct makes sense for your type.',
		},
	],
	relatedSlugs: ["interfaces", "json-decode", "pointers"],
}
