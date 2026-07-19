import { Concept } from "../../content"

export const defer: Concept = {
	slug: "defer",
	name: "Defer",
	tagline:
		"Schedule cleanup to run when the function returns, no matter what.",
	summary:
		"A <code>defer</code> statement schedules a function call to run just before the surrounding function returns. Deferred calls run in LIFO order (last in, first out). They run even if the function panics, making them perfect for cleanup: closing files, releasing locks, stopping timers.",
	mentalModel:
		"Defer is like leaving a sticky note for your future self: 'when you're done here, do this.' You write the cleanup right next to the resource acquisition, which makes code far easier to audit. You can't forget to clean up if the cleanup is defined the moment you open something.",
	retrievalPrompts: [
		"Where exactly do you place defer f.Close() in openAndRead, and why does position matter? || After os.Open and the error check, never before. If you defer before checking the error and Open fails, f is nil and Close will panic. The pattern is: open, check error, then defer close, in that order.",
		"A function registers deferred calls in order A, B, C. What order do they execute in, and why? || C, B, A: last in, first out (LIFO). This is intentional: if you open a file then acquire a lock, LIFO ensures you release the lock before closing the file, the correct cleanup order for nested resources.",
		"You write defer f.Close() inside a loop that opens 100 files. When do the 100 Close calls happen? What is the fix? || All 100 run when the enclosing function returns, not at the end of each loop iteration. All 100 files stay open until the function exits. Fix: extract the open-read-close into a helper function called per iteration, so defer runs at the end of each helper call.",
	],
	codeExample: `package main

import (
	"fmt"
	"os"
)

func readFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open: %w", err)
	}
	defer f.Close() // runs when readFile returns, no matter what

	buf := make([]byte, 100)
	n, err := f.Read(buf)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}

	return string(buf[:n]), nil
}

func main() {
	content, err := readFile("go.mod")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println(content)
}`,
	codeExplanation:
		"<code>defer f.Close()</code> is written immediately after successfully opening the file. No matter how many early returns or errors follow, the file will be closed. Without defer you'd need <code>f.Close()</code> before every return.",
	designRationale:
		"Go's designers wanted resource cleanup to be written at the same point as resource acquisition, not duplicated across every early-return path. Without defer, adding an error return means remembering to insert a cleanup call before it; missing one leaks the resource. Defer registers the cleanup immediately and guarantees it runs on function exit regardless of how the function returns. LIFO ordering ensures nested resources (open a file, then acquire a lock) are released in the correct reverse sequence.",
	commonMistakes: [
		{
			title: "Defer in a loop",
			body: "Deferred calls run when the function returns, not when the loop iteration ends. Deferring <code>f.Close()</code> inside a loop that opens many files will hold all files open until the function exits. Move the work into a helper function instead.",
		},
		{
			title: "Ignoring deferred function's return value",
			body: "<code>defer f.Close()</code> ignores the error Close returns. In critical code, capture it: <code>defer func() { if err := f.Close(); err != nil { log.Println(err) } }()</code>",
		},
	],
	relatedSlugs: ["error-handling", "interfaces"],
}
