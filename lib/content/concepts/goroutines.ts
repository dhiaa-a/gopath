import { Concept } from "../../content"

export const goroutines: Concept = {
	slug: "goroutines",
	name: "Goroutines",
	tagline:
		"Lightweight concurrent functions, cheaper than threads by orders of magnitude.",
	summary:
		"A goroutine is a function running concurrently with other goroutines in the same address space. Starting one is as cheap as a few kilobytes of stack. The Go runtime multiplexes thousands of goroutines onto a small number of OS threads, handling scheduling for you.",
	mentalModel:
		"Think of goroutines as tasks on a to-do list that a team of workers (OS threads) picks up and executes. You can add thousands of tasks and the team handles it; you don't manage which worker does what. The key: goroutines are cheap to create, but you must coordinate their results via channels or sync primitives.",
	retrievalPrompts: [
		"What happens to a goroutine if main() returns before it finishes? What is the correct way to wait for it? || The goroutine is killed immediately. The program exits and all goroutines terminate without cleanup. The correct way: use sync.WaitGroup. Call wg.Add(1) before launching, defer wg.Done() inside the goroutine, and wg.Wait() in main.",
		"You launch 100 goroutines, each appending to a shared slice. What goes wrong, and give two ways to fix it. || Data race: multiple goroutines read and write the slice header concurrently, causing corruption or panics. Fix 1: protect the append with a sync.Mutex. Fix 2: have each goroutine send its value on a channel, and one goroutine collects and appends.",
		"A goroutine is blocked waiting to receive from a channel nobody will ever write to. What is this, and how do you prevent it? || A goroutine leak. The goroutine runs forever, consuming memory and scheduler resources. Prevent it by always giving goroutines an exit path: pass a context.Context and select on ctx.Done(), or ensure the channel will eventually be closed.",
	],
	codeExample: `package main

import (
	"fmt"
	"sync"
)

func fetch(url string, wg *sync.WaitGroup) {
	defer wg.Done()
	// Simulate work
	fmt.Println("Fetching:", url)
}

func main() {
	urls := []string{
		"https://api.example.com/users",
		"https://api.example.com/posts",
		"https://api.example.com/comments",
	}

	var wg sync.WaitGroup

	for _, url := range urls {
		wg.Add(1)
		go fetch(url, &wg)
	}

	wg.Wait()
	fmt.Println("All done")
}`,
	codeExplanation:
		"<code>go fetch(url, &wg)</code> launches each fetch concurrently. <code>wg.Add(1)</code> registers a task, <code>wg.Done()</code> marks it complete (via defer), and <code>wg.Wait()</code> blocks until all tasks finish.",
	designRationale:
		"Go was designed for servers, and servers must handle many concurrent requests without allocating an OS thread per request. Goroutines are the answer: a scheduling abstraction so cheap (a few kilobytes of initial stack) that spawning one per request is the idiomatic approach. The runtime multiplexes goroutines onto OS threads automatically, so the programmer expresses concurrency naturally without managing thread pools. Concurrency is not a library added later; it is built into the language because the designers expected it to be used pervasively.",
	commonMistakes: [
		{
			title: "Launching goroutines and not waiting",
			body: "If main() returns, all goroutines are killed instantly. Always use <code>sync.WaitGroup</code> or a channel to wait for goroutines to finish before the program exits.",
		},
		{
			title: "Closing over a loop variable",
			body: `In older Go (<1.22), <code>for _, v := range items { go func() { use(v) }() }</code> captures the variable <em>reference</em> not the value, so all goroutines may see the last value. Fix: pass as argument: <code>go func(v T) { use(v) }(v)</code>.`,
		},
		{
			title: "Goroutine leaks",
			body: "A goroutine blocked on a channel that nobody writes to will leak forever. Always ensure goroutines have a way to exit; use <code>context.Context</code> for cancellation.",
		},
	],
	relatedSlugs: ["channels", "sync-waitgroup", "context", "select"],
}
