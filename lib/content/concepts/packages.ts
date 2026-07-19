import { Concept } from "../../content"

export const packages: Concept = {
	slug: "packages",
	name: "Packages & modules",
	tagline: "Go's unit of code organisation: one directory, one package.",
	summary:
		"Every Go file belongs to a package, declared on the first line. A module is a collection of packages with a single version, defined by <code>go.mod</code>. Exported identifiers start with an uppercase letter; lowercase is package-private. Circular imports are forbidden.",
	mentalModel:
		"A package is a room in a building. Everything in the room can see everything else. Uppercase names are windows: visible from outside. Lowercase names are internal furniture: invisible from other rooms. The building's address is the module path in <code>go.mod</code>.",
	retrievalPrompts: [
		"Package A imports B, B imports C, C imports A. What does the compiler do, and what is the fix? || The compiler rejects it with \"import cycle not allowed\". Fix: identify the type or function that both A and B need, extract it into a new package that both import, breaking the cycle. Cycles indicate that two packages are logically one, or that a shared abstraction needs its own home.",
		"What makes an identifier visible to other packages in Go? Is there a keyword? || An identifier is exported if and only if it starts with an uppercase letter. There is no keyword: no public, export, or extern. The compiler enforces this rule purely from the first letter of the name.",
		"What does placing code under internal/ enforce, and which tool enforces it: programmer, linter, or compiler? || Code in internal/ can only be imported by code in the parent directory and its descendants. The compiler enforces it; importing an internal package from outside its module is a compile error, not just a lint warning.",
	],
	codeExample: `// go.mod
module github.com/you/myapp

go 1.22

// internal/user/user.go
package user

type User struct {
	ID   int
	Name string
}

// exported — uppercase
func New(id int, name string) *User {
	return &User{ID: id, Name: name}
}

// unexported — lowercase, package-private
func validate(u *User) bool {
	return u.Name != ""
}

// main.go
package main

import (
	"fmt"
	"github.com/you/myapp/internal/user"
)

func main() {
	u := user.New(1, "Alice")
	fmt.Println(u.Name)
	// user.validate(u) — compile error: unexported
}`,
	codeExplanation:
		"The module path in <code>go.mod</code> is the root of all import paths. <code>internal/</code> packages can only be imported by code within the same module. Uppercase = exported, lowercase = package-private: that's the entire visibility system.",
	designRationale:
		"Go's visibility rule (uppercase exported, lowercase package-private) was chosen because it makes access control obvious from the identifier name without any modifier keyword, and it is enforced by the compiler rather than convention. Circular imports are forbidden at compile time to keep build graphs acyclic: a cycle means two packages are logically one package, and the fix is to extract the shared type into a third. The <code>internal/</code> directory convention enforces package boundaries within a module without additional tooling; the compiler rejects imports that violate it.",
	commonMistakes: [
		{
			title: "Circular imports",
			body: "Package A importing B which imports A is a compile error. The fix is usually to extract the shared type into a third package that both A and B import.",
		},
		{
			title: "Putting everything in main",
			body: "As projects grow, keeping all code in <code>package main</code> makes testing nearly impossible. Extract logic into sub-packages early; they're easier to test in isolation.",
		},
	],
	relatedSlugs: ["structs", "interfaces", "error-handling"],
}
