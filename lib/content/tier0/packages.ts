import { Tier0Lesson } from "../../content"

export const packages: Tier0Lesson = {
	slug: "packages",
	order: 14,
	title: "Packages, imports, and the capital letter",
	tagline: "Visibility without keywords, plus the two commands that build everything.",
	estimatedMinutes: 12,
	intro: [
		{
			type: "text",
			value: {
				en: "Every Go file starts with a <code>package</code> clause, and every project is a tree of packages. You've been writing <code>package main</code>, the one that compiles to an executable; everything else is a library package named after its directory. Importing gives you the package name as a prefix: <code>fmt.Println</code>, <code>strconv.Atoi</code>, <code>strings.ToUpper</code>. A dot-import form that dumps names into your namespace technically exists in the spec, but real codebases ban it; in practice every foreign identifier in a Go file tells you where it came from.",
			},
		},
		{
			type: "text",
			value: {
				en: "Here's the design move with no equivalent in Java, C#, or Python: visibility is spelled with a capital letter. An identifier that starts uppercase is exported (public, usable by importers); lowercase is unexported (private to its package). No <code>public</code>, no <code>private</code>, no <code>__underscore</code> conventions. <code>strings.ToUpper</code> works because <code>ToUpper</code> is capitalized; the helper functions inside the strings package are lowercase and unreachable from outside. You can read a type's entire API surface by scanning for capital letters.",
			},
		},
	],
	program: `package main

import (
	"fmt"
	"strings"
)

// Exported: in a library package, importers could call this.
// (package main itself can't be imported; the rule shows its
// power once your code grows beyond one package in Tier 1.)
func Shout(s string) string {
	return strings.ToUpper(s) + "!"
}

// unexported: private to this package. Capital letter is the
// entire visibility system; there is no "private" keyword.
func quietly(s string) string {
	return strings.ToLower(s)
}

func main() {
	fmt.Println(Shout("ship it"))
	fmt.Println(quietly("BE COOL"))
	fmt.Println(strings.Repeat("=", 20))
}`,
	after: [
		{
			type: "text",
			value: {
				en: "The import block pulls in two standard-library packages, and every use is prefixed: <code>strings.ToUpper</code>, <code>fmt.Println</code>. Notice that everything you can reach in those packages is capitalized; that's not a style choice by their authors, it's the visibility rule doing its work. When your programs grow beyond one file in Tier 1, the same rule governs your own code: <code>Shout</code> would be callable from another package, <code>quietly</code> would not exist outside this one.",
			},
		},
		{
			type: "text",
			value: {
				en: "The toolchain you already know closes the loop. <code>go run main.go</code> for the dev loop, <code>go build</code> for a shippable binary, and one more worth adopting today: <code>gofmt -w .</code> (or your editor's format-on-save) rewrites your files into the one canonical Go style. There are no formatting debates in Go; the tool is the style guide. Real projects also start with <code>go mod init</code>, which you did once on the setup page and will repeat for every Tier 1 project.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "That's Tier 0. You can read declarations, control flow, pointers, structs, methods, slices, maps, strings, closures, and error handling: every syntax pattern the Tier 1 projects assume. Head to the <a href=\"/orientation/ready-check\" class=\"text-go-cyan underline decoration-go-cyan/40 hover:no-underline\">ready check</a> to prove it to yourself, then start building.",
			},
		},
	],
	retrievalPrompts: [
		"How does Go decide whether an identifier is public or private? || By its first letter. Uppercase = exported, importable by other packages (strings.ToUpper); lowercase = unexported, private to its own package. There are no visibility keywords; the name itself is the access control.",
		"What does importing a package give you, and why don't Go files have bare foreign names? || The package name as a prefix: import \"strings\" gives strings.ToUpper. Every foreign identifier states its origin, so readers never guess where a name came from. (A dot-import that drops the prefix exists in the spec; real codebases ban it.) Unused imports are compile errors.",
		"Which three commands cover run, ship, and format? || go run main.go (compile and execute in one step, for development), go build (produce a self-contained binary), gofmt -w . (rewrite files into the single canonical style; usually wired to format-on-save).",
	],
}
