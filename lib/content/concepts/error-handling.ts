import { Concept } from "../../content"

export const errorHandling: Concept = {
	slug: "error-handling",
	name: "Error handling",
	tagline: "Errors are values: explicit, returnable, wrappable.",
	summary:
		"Go has no exceptions. Errors are ordinary values of type <code>error</code> returned alongside results. Every caller decides what to do with them: log, wrap, return, or ignore. This explicitness is Go's superpower: you can always see exactly which calls can fail.",
	mentalModel:
		'Think of every function with a possible failure as returning two things: the result and a verdict. Like a restaurant order: you get either (food, nil) or (nil, "kitchen is closed"). You check the verdict before eating the food.',
	retrievalPrompts: [
		"Without looking, write a function that opens a file and returns its contents as a string, including every place it can fail. || Signature: func readFile(path string) (string, error). It can fail on Open (return \"\", fmt.Errorf(\"open: %w\", err)) and on Read (return \"\", fmt.Errorf(\"read: %w\", err)). The caller always gets two values and must check error before trusting the result.",
		"What is the difference between fmt.Errorf with %v and %w? When does it matter to the caller? || %v formats the error as a string and the original is lost. %w wraps it so errors.Is and errors.As can unwrap through the chain. The distinction matters when callers need to match a specific error type; with %v they can only do string comparison.",
		"A colleague proposes replacing all if err != nil blocks with panic to reduce verbosity. What breaks in production? || Panics crash the goroutine unless recovered. In a server, an unrecovered panic in a handler kills the request goroutine. You lose the ability to return user-friendly errors, wrap context, or handle expected failures gracefully. Errors are control flow, not exceptional events.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("item not found")

func findUser(id int) (string, error) {
	if id != 42 {
		return "", fmt.Errorf("findUser %d: %w", id, ErrNotFound)
	}
	return "Alice", nil
}

func main() {
	name, err := findUser(99)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			fmt.Println("User does not exist")
		} else {
			fmt.Println("Unexpected error:", err)
		}
		return
	}
	fmt.Println("Found:", name)
}`,
	codeExplanation:
		"We define a sentinel error with <code>errors.New</code>. We wrap it with context using <code>fmt.Errorf + %w</code>. The caller uses <code>errors.Is</code> to match the underlying error type, even through multiple layers of wrapping.",
	designRationale:
		"Go has no exceptions because exceptions hide control flow: a function can fail invisibly without that failure appearing anywhere in its signature. Errors are ordinary values so every failure path is visible in the type system: if a function can fail, its return type says so. This is deliberately verbose. The verbosity is the point, forcing every call site to declare what it does with failure rather than letting it propagate silently.",
	commonMistakes: [
		{
			title: "Ignoring errors with _",
			body: "Writing <code>result, _ := doThing()</code> silently discards errors. Only do this when you're absolutely certain the error can't happen, which is rarer than you think.",
		},
		{
			title: "Losing context when wrapping",
			body: 'Use <code>fmt.Errorf("context: %w", err)</code> not <code>fmt.Errorf("context: %v", err)</code>. The <code>%w</code> verb preserves the original error for <code>errors.Is</code> and <code>errors.As</code> checks.',
		},
		{
			title: "Returning non-nil error with a valid result",
			body: "If you return an error, callers expect the other return values to be zero values. Don't return partial results alongside errors; it forces callers to guess what to trust.",
		},
	],
	relatedSlugs: ["interfaces", "defer"],
}
