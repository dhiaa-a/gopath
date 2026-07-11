import { Tier0Lesson } from "../../content"

export const types: Tier0Lesson = {
	slug: "types",
	order: 3,
	title: "Basic types and conversions",
	tagline: "No coercion, ever. Every conversion is written by you.",
	estimatedMinutes: 12,
	intro: [
		{
			type: "text",
			value: {
				en: "JavaScript will happily compute <code>\"2\" + 2</code> and hand you <code>\"22\"</code>. C silently promotes an <code>int</code> to a <code>double</code> mid-expression. Decades of bugs live in those silent conversions, so Go bans all of them: there is no implicit conversion between types, not even between <code>int</code> and <code>int64</code>, which are different types despite usually being the same size. If you want a value as another type, you write the conversion yourself: <code>T(v)</code>.",
			},
		},
		{
			type: "text",
			value: {
				en: "The types you'll touch daily: <code>int</code> (machine-word signed integer, 64-bit on modern hardware), <code>float64</code> (the default for decimals), <code>string</code>, <code>bool</code>, and <code>byte</code> (an alias for <code>uint8</code>). Sized variants like <code>int32</code> and <code>uint64</code> exist for when layout matters: file formats, network protocols, database columns.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	users := 7
	capacity := 2.0

	// load := users / capacity        // compile error: mismatched types
	load := float64(users) / capacity // the conversion is visible
	fmt.Println("load:", load)

	// Integer division truncates. Both operands are ints, so the
	// result is an int; nothing promotes to float behind your back.
	fmt.Println("7 / 2 =", 7/2)
	fmt.Println("7 / 2.0 =", 7/2.0)

	n := 65
	fmt.Println(string(rune(n)), byte(n))
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Break the working line: delete the conversion so it reads <code>load := users / capacity</code>, matching the commented line above it, and run. The compiler rejects it with <em>invalid operation: mismatched types int and float64</em>. That error is the design: the cost of mixing representations (a float division is a different CPU instruction than an integer division, with different results) must appear in the source. <code>float64(users)</code> is that cost, written down.",
			},
		},
		{
			type: "text",
			value: {
				en: "Notice <code>7/2</code> prints <code>3</code>, not <code>3.5</code>. Two integer operands mean integer division, truncated toward zero. Write <code>7/2.0</code> and the untyped constant <code>7</code> adapts, giving <code>3.5</code>. Constants are the one place Go is flexible: a literal has no fixed type until the context demands one, which is why <code>capacity := 2.0</code> became a <code>float64</code>.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "<code>string(rune(n))</code> prints <code>A</code>, because converting a number to string interprets it as a Unicode code point, not as digits. To get <code>\"65\"</code> you need <code>strconv.Itoa(65)</code>. This surprises everyone once; the strings lesson explains what runes actually are.",
			},
		},
	],
	retrievalPrompts: [
		"What does Go do when you add an int to a float64, and why? || Compile error: mismatched types. Go has zero implicit conversions, because silent promotion hides a real change in representation and behavior. You must write float64(myInt) explicitly, making the conversion visible in the source.",
		"What does 9 / 4 evaluate to in Go, and what about 9 / 4.0? || 9/4 is 2: both operands are integers, so it's integer division, truncated. 9/4.0 is 2.25: the untyped constant 9 adapts to float64 because the other operand demands it. Untyped constants are the only place Go bends on types.",
		"Why does string(65) not produce \"65\", and what should you use instead? || Converting an integer to string treats it as a Unicode code point, so you get \"A\". For digit strings use strconv.Itoa(65). string(65) still compiles, but go vet flags it; write string(rune(65)) so the code-point intent is explicit.",
	],
}
