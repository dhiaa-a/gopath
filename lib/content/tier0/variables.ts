import { Tier0Lesson } from "../../content"

export const variables: Tier0Lesson = {
	slug: "variables",
	order: 2,
	title: "Variables and zero values",
	tagline: "Two ways to declare, one rule: memory is never garbage.",
	estimatedMinutes: 12,
	intro: [
		{
			type: "text",
			value: {
				en: "In C, an uninitialized local variable holds whatever bytes were left in that stack slot: garbage. In JavaScript, an unassigned <code>let</code> is <code>undefined</code>, a value that exists specifically to represent \"nothing yet.\" Go picked a third design: every variable is usable the instant it is declared, because the runtime zeroes the memory. An <code>int</code> starts at <code>0</code>, a <code>string</code> at <code>\"\"</code>, a <code>bool</code> at <code>false</code>. These are called zero values, and Go code leans on them constantly.",
			},
		},
		{
			type: "text",
			value: {
				en: "There are two declaration forms. <code>var name type</code> is the full form and works everywhere. <code>name := value</code> is the short form: it declares and assigns in one step, infers the type from the right-hand side, and only works inside functions. In practice, <code>:=</code> is what you'll type for nearly every local variable.",
			},
		},
	],
	program: `package main

import "fmt"

var greeting = "declared at package scope"

func main() {
	var count int
	var enabled bool
	var label string

	name := "gopher"
	ratio := 2.5

	fmt.Println(count, enabled, label)
	fmt.Println(name, ratio)
	fmt.Println(greeting)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Run it. The first line prints <code>0 false</code> and an empty string: the zero values. Nothing was assigned to <code>count</code>, <code>enabled</code>, or <code>label</code>, and yet reading them is safe and deterministic. This is a language guarantee, not a convention. It's why Go structs, counters, and buffers so often work correctly with no constructor: the zero state is a valid state.",
			},
		},
		{
			type: "text",
			value: {
				en: "Note the package-level <code>greeting</code>: outside a function you must use <code>var</code>, because <code>:=</code> is statement syntax and only statements inside functions can use it. Also note that <code>ratio := 2.5</code> gave you a <code>float64</code> without writing the type; inference reads the literal.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Break it: declare <code>unused := 1</code> inside main and run. Compile error: <em>declared and not used</em>. Same policy as unused imports. If you genuinely need to discard a value, that's what the blank identifier <code>_</code> is for; you'll meet it in the functions lesson.",
			},
		},
	],
	retrievalPrompts: [
		"What does := do, and where is it not allowed? || := declares a new variable and infers its type from the right-hand side in one statement. It only works inside functions; at package scope you must use var, because := is statement syntax.",
		"What are the zero values for int, string, bool, and float64, and why does Go guarantee them? || 0, \"\" (empty string), false, and 0.0. The runtime zeroes a variable's memory at declaration, so every variable is usable immediately: no garbage reads like C, no undefined like JavaScript. Well-designed Go types treat the zero state as a valid state.",
		"You declare a local variable and never use it. What happens? || Compile error: declared and not used. Go enforces this at the compiler level, exactly like unused imports. Discarding a value on purpose requires the blank identifier _.",
	],
}
