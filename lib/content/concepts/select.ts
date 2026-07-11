import { Concept } from "../../content"

export const select: Concept = {
	slug: "select",
	name: "Select",
	tagline:
		"Wait on multiple channel operations simultaneously: take whichever is ready.",
	summary:
		"A <code>select</code> statement is like a switch for channels. It blocks until one of its cases can proceed, then executes that case. If multiple cases are ready simultaneously, one is chosen at random. A <code>default</code> case makes select non-blocking.",
	mentalModel:
		"Select is like a waiter watching multiple tables. Whichever table signals first ('ready to order', 'needs the bill', 'wants dessert') gets served. If nobody is ready and there's a default option, the waiter doesn't stand idle; they do the default instead.",
	retrievalPrompts: [
		"Two channels are both ready when a select executes. Which case runs, and why? || Go picks one at random. The specification guarantees uniform pseudo-random selection when multiple cases are ready. This prevents programs from depending on a specific ordering that might not hold under different scheduling; both cases have equal probability.",
		"Write a select that tries to receive from ch but gives up after 2 seconds. || select { case val := <-ch: return val, nil; case <-time.After(2 * time.Second): return zero, errors.New(\"timed out\") }. time.After returns a channel that fires after the duration: the standard Go timeout pattern.",
		"What does a select with a default case do when no channel is ready? When is it useful, and when is it a problem? || It executes default immediately without blocking. Useful for non-blocking channel checks. A problem in a tight loop: without any blocking the goroutine spins at 100% CPU. Always add time.Sleep or restructure to avoid spinning.",
	],
	codeExample: `package main

import (
	"fmt"
	"time"
)

func main() {
	ch1 := make(chan string)
	ch2 := make(chan string)

	go func() {
		time.Sleep(300 * time.Millisecond)
		ch1 <- "result from ch1"
	}()

	go func() {
		time.Sleep(100 * time.Millisecond)
		ch2 <- "result from ch2"
	}()

	// Wait for whichever arrives first
	for i := 0; i < 2; i++ {
		select {
		case msg := <-ch1:
			fmt.Println("ch1:", msg)
		case msg := <-ch2:
			fmt.Println("ch2:", msg)
		}
	}

	// Timeout pattern
	select {
	case msg := <-ch1:
		fmt.Println(msg)
	case <-time.After(500 * time.Millisecond):
		fmt.Println("timed out")
	}
}`,
	codeExplanation:
		"The first loop picks whichever channel is ready (ch2 arrives first since it sleeps less). The timeout pattern uses <code>time.After</code>, which returns a channel that receives after a duration: a very common Go idiom for preventing indefinite blocking.",
	designRationale:
		"Select is the language-level answer to 'wait for whichever channel event arrives first', modelled on the POSIX <code>select</code> syscall for file descriptors. Without it, waiting on multiple channels simultaneously would require nested goroutines and additional synchronisation: complexity that belongs in the language, not in application code. When multiple cases are ready simultaneously, Go picks one at random to prevent starvation and to ensure programs are correct under any arrival order rather than relying on a specific one.",
	commonMistakes: [
		{
			title: "Busy-looping with default",
			body: "A select with a <code>default</code> case and channel reads in a loop is a busy-wait spin loop that consumes 100% CPU. Add a <code>time.Sleep</code> or restructure to block properly.",
		},
		{
			title: "Random case selection surprises",
			body: "When multiple channels are ready, Go picks one at random. Don't write code that assumes a priority order between channels.",
		},
	],
	relatedSlugs: ["channels", "goroutines", "context"],
}
