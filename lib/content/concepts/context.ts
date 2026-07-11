import { Concept } from "../../content"

export const context: Concept = {
	slug: "context",
	name: "Context",
	tagline:
		"Carry cancellation signals and deadlines across API boundaries.",
	summary:
		"A <code>context.Context</code> carries a cancellation signal, an optional deadline, and optional key-value pairs. It threads through your call stack so that when an HTTP request is cancelled, every goroutine working on it can stop. Pass context as the first argument to any function that does I/O or spawns goroutines.",
	mentalModel:
		"Context is like a project cancellation memo that travels with every piece of work. If the client disconnects, the memo says 'stop everything'. Every worker checks the memo before starting the next unit of work. If the memo says cancel, they stop cleanly instead of continuing to do useless work.",
	retrievalPrompts: [
		"A 3-second context timeout is passed to a function making two sequential 2-second HTTP calls. What happens on the second call? || The context expires at the 3-second mark. The first call uses 2 seconds, leaving 1 second. The HTTP client checks ctx.Done() and cancels when the deadline fires, so the second call gets context.DeadlineExceeded.",
		"Why is context.Context always the first parameter by convention? What does it communicate? || Convention from the standard library, reinforced by linters. Putting it first signals: this function does I/O or can be cancelled. It also means the context is always at a known position, making call signatures immediately scannable without reading the full signature.",
		"You store a context in a struct field and use it in a method called later. Why is this wrong? || Context carries cancellation for a specific request at a specific moment. Stored in a struct, it is divorced from its lifecycle: by the time the method runs, the context may already be cancelled or belong to a different request. Pass context as a parameter to each method that needs it.",
	],
	codeExample: `package main

import (
	"context"
	"fmt"
	"time"
)

func doWork(ctx context.Context, name string) error {
	select {
	case <-time.After(2 * time.Second):
		fmt.Println(name, "finished")
		return nil
	case <-ctx.Done():
		fmt.Println(name, "cancelled:", ctx.Err())
		return ctx.Err()
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel() // always call cancel to free resources

	if err := doWork(ctx, "task-1"); err != nil {
		fmt.Println("Error:", err)
	}
}`,
	codeExplanation:
		"<code>context.WithTimeout</code> creates a context that auto-cancels after 1 second. <code>doWork</code> uses <code>select</code> to race between doing real work and the context being cancelled. <code>defer cancel()</code> ensures resources are freed even if we return early.",
	designRationale:
		"Go rejected thread-local storage and hidden ambient state because both make the flow of cancellation invisible: a cancelled request cannot propagate the signal to everything working on its behalf without explicit threading. Passing <code>context.Context</code> as the first argument makes deadlines and cancellation visible in the call graph and forces every function doing I/O to acknowledge them. The convention is enforced by idiom rather than the type system, which means any deviation is immediately visible during code review.",
	commonMistakes: [
		{
			title: "Not calling cancel()",
			body: "<code>WithCancel</code>, <code>WithTimeout</code>, and <code>WithDeadline</code> all leak resources if <code>cancel()</code> is never called. Always <code>defer cancel()</code> immediately after creating the context.",
		},
		{
			title: "Storing context in a struct",
			body: "Don't store context in a struct and use it later. Context should flow through function parameters. Storing it detaches it from the request lifecycle it was meant to control.",
		},
		{
			title: "Using context.Background() everywhere",
			body: "<code>context.Background()</code> never cancels; it's for top-level use (main, tests, server startup). If you're inside an HTTP handler, use <code>r.Context()</code> so the work cancels when the client disconnects.",
		},
	],
	relatedSlugs: ["goroutines", "select", "http-handler"],
}
