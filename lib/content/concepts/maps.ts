import { Concept } from "../../content"

export const maps: Concept = {
	slug: "maps",
	name: "Maps",
	tagline:
		"Hash maps with simple syntax, but nil maps and concurrent access will panic.",
	summary:
		"Maps are Go's built-in hash map. They map keys to values, both of any comparable type. Two things will panic: writing to a nil map, and concurrent reads + writes without synchronisation. Maps are reference types; passing a map to a function passes a reference, not a copy.",
	mentalModel:
		"A map is a lookup table. The zero value of a map is nil, a table that doesn't exist yet. You must initialise it with <code>make</code> or a literal before writing to it. Reading a missing key never panics (it returns the zero value) but that can silently mask bugs.",
	retrievalPrompts: [
		"You declare var m map[string]int and read m[\"key\"]. What do you get? Then you write m[\"key\"] = 1. What happens? || Reading from a nil map returns the zero value (0), no panic. Writing to a nil map panics with \"assignment to entry in nil map\". Always initialise: m := make(map[string]int) or m := map[string]int{}.",
		"How do you distinguish between a key that is missing and a key whose value is 0? Write the idiom. || val, ok := m[\"key\"], the comma-ok form. If ok is false, the key is absent (val will be 0). If ok is true, the key exists and val is its actual value, which may legitimately be 0.",
		"Two goroutines read from the same map simultaneously. Is this safe? What if one reads while the other writes? || Concurrent reads are safe. Concurrent read and write (or write and write) is not safe. Go's runtime detects this and panics with \"concurrent map read and map write\". Protect with sync.RWMutex or use sync.Map.",
	],
	codeExample: `package main

import "fmt"

func main() {
	// Always initialise before writing
	scores := make(map[string]int)
	scores["Alice"] = 95
	scores["Bob"] = 87

	// Comma-ok idiom to distinguish missing vs zero
	val, ok := scores["Charlie"]
	if !ok {
		fmt.Println("Charlie not found, val is:", val) // 0
	}

	// Iterate — order is randomised every run
	for name, score := range scores {
		fmt.Printf("%s: %d\n", name, score)
	}

	// Delete a key
	delete(scores, "Bob")
	fmt.Println(len(scores)) // 1
}`,
	codeExplanation:
		"The comma-ok pattern <code>val, ok := m[key]</code> tells you whether the key exists. Without it, a missing key and a key set to <code>0</code> look identical. Map iteration order is intentionally randomised; never rely on it.",
	designRationale:
		"Maps are reference types in Go because the designers observed that maps are almost always shared rather than copied; making them value types would silently copy large data structures on every function call. The zero value is <code>nil</code> rather than an empty map to force explicit initialization: Go prefers deliberate intent over convenient defaults when the default leads to a panic. Map iteration order is randomised on purpose so programs cannot accidentally depend on insertion order, which would be a latent bug waiting for the runtime to change.",
	commonMistakes: [
		{
			title: "Writing to a nil map (panic)",
			body: 'Declaring <code>var m map[string]int</code> gives you nil. <code>m["key"] = 1</code> panics. Always use <code>make(map[string]int)</code> or a map literal.',
		},
		{
			title: "Concurrent read + write (panic)",
			body: "Maps are not safe for concurrent use. If multiple goroutines access a map, protect it with <code>sync.RWMutex</code> or use <code>sync.Map</code>.",
		},
	],
	relatedSlugs: ["structs", "sync-waitgroup"],
}
