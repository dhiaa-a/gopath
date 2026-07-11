import { Tier0Lesson } from "../../content"

export const maps: Tier0Lesson = {
	slug: "maps",
	order: 10,
	title: "Maps, first contact",
	tagline: "Key-value lookup where a missing key is not an error.",
	estimatedMinutes: 14,
	intro: [
		{
			type: "text",
			value: {
				en: "A map is Go's hash table: <code>map[string]int</code> reads as \"map from string to int.\" Python raises <code>KeyError</code> on a missing key; JavaScript hands you <code>undefined</code>. Go does neither: reading a missing key returns the value type's zero value. <code>m[\"nope\"]</code> on a <code>map[string]int</code> is <code>0</code>, silently. That sounds dangerous until you see what it enables, and Go gives you a precise tool for the times you genuinely need to know whether the key was there.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	words := []string{"go", "is", "small", "go", "is", "fast", "go"}

	// The zero-value-on-miss rule makes this three-liner work:
	// counts["go"] is 0 the first time, so ++ just works.
	counts := map[string]int{}
	for _, w := range words {
		counts[w]++
	}
	fmt.Println(counts)

	// The comma-ok idiom: was the key actually present?
	n, ok := counts["rust"]
	fmt.Println("rust:", n, "present:", ok)

	delete(counts, "is")

	for word, c := range counts {
		fmt.Println(word, c)
	}
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Look at the word counter. In Python you'd reach for <code>defaultdict(int)</code> or <code>.get(w, 0)</code>; in Go the missing-key-returns-zero rule means <code>counts[w]++</code> is already correct: first sight of a word reads 0, increments, stores 1. Zero values composing with zero values. This exact three-line shape appears in the Tier 1 log parser.",
			},
		},
		{
			type: "text",
			value: {
				en: "When zero is ambiguous (is <code>\"rust\": 0</code> counted zero times, or absent?), use the comma-ok form: <code>n, ok := counts[\"rust\"]</code>. The second return value is a bool that answers \"was the key present.\" You'll see comma-ok again across Go; it's the language's standard shape for \"the lookup itself can fail.\" Also run the program twice and compare the final loop's output: map iteration order is deliberately randomized by the runtime, precisely so nobody can accidentally depend on it.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "One real trap: the zero value of a map is nil, and writing to a nil map panics. <code>var m map[string]int</code> then <code>m[\"k\"] = 1</code> crashes. Initialize with a literal <code>map[string]int{}</code> or <code>make(map[string]int)</code> before writing. (Reading from a nil map is fine and returns zero values, consistent with the miss rule.)",
			},
		},
	],
	retrievalPrompts: [
		"What does reading a missing key from a map[string]int return, and how do you distinguish \"absent\" from \"stored zero\"? || The zero value, 0, with no error or panic. To distinguish, use comma-ok: n, ok := m[key]; ok is false when the key is absent. Reach for comma-ok whenever zero is a legitimate stored value.",
		"Write the idiomatic Go word-frequency counter over a slice of strings. || counts := map[string]int{}; for _, w := range words { counts[w]++ }. It works because a missing key reads as 0, so the first increment stores 1 with no existence check or default needed.",
		"var m map[string]int, then m[\"a\"] = 1. What happens and what's the fix? || Panic: assignment to entry in nil map. A map's zero value is nil, readable but not writable. Initialize before writing: m := map[string]int{} or m := make(map[string]int).",
	],
}
