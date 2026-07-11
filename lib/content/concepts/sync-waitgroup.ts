import { Concept } from "../../content"

export const syncWaitgroup: Concept = {
	slug: "sync-waitgroup",
	name: "sync.WaitGroup",
	tagline:
		"Wait for a collection of goroutines to finish before proceeding.",
	summary:
		"A <code>sync.WaitGroup</code> is a counter. You increment it before launching each goroutine (<code>Add</code>), decrement it when each goroutine finishes (<code>Done</code>), and block until it reaches zero (<code>Wait</code>). It's the standard Go pattern for fan-out concurrency.",
	mentalModel:
		"Imagine handing out raffle tickets. Before each person goes off to do a task, you give them a ticket. When they return, they hand it back. You wait at the door until every ticket has been returned. <code>Add</code> = hand out ticket, <code>Done</code> = return ticket, <code>Wait</code> = watch the door.",
	retrievalPrompts: [
		"You call wg.Add(1) inside the goroutine instead of before launching it. Describe the race condition. || Main may call wg.Wait() before the goroutine has executed wg.Add(1). If the counter is 0 at that moment, Wait returns immediately; the program proceeds as if all goroutines finished, even though they have not started. Always call Add before go.",
		"Why must you pass &wg and never copy a WaitGroup by value? What breaks? || Copying creates a separate counter. Done calls on the copy do not decrement the original's counter, so the original's Wait never returns. The race detector catches this; go vet also flags it.",
		"A WaitGroup's counter reaches zero and Wait returns. You call wg.Add(1) again. Is this valid? What constraint must hold? || Yes, a WaitGroup can be reused. The constraint: Add must not be called concurrently with Wait when the counter is zero. If a goroutine races to call Add(1) at the exact moment Wait sees zero and starts to return, you get a race. Ensure all Add calls happen-before the corresponding Wait.",
	],
	codeExample: `package main

import (
	"fmt"
	"sync"
	"time"
)

func worker(id int, wg *sync.WaitGroup) {
	defer wg.Done() // always called, even on panic
	time.Sleep(time.Duration(id) * 100 * time.Millisecond)
	fmt.Printf("Worker %d done\n", id)
}

func main() {
	var wg sync.WaitGroup

	for i := 1; i <= 5; i++ {
		wg.Add(1)         // increment before launching
		go worker(i, &wg) // pass pointer — never copy a WaitGroup
	}

	wg.Wait()
	fmt.Println("All workers finished")
}`,
	codeExplanation:
		"<code>wg.Add(1)</code> is called before <code>go worker()</code>, never inside the goroutine. <code>defer wg.Done()</code> ensures Done is called even if the function panics. The WaitGroup is passed as a pointer; never copy it.",
	designRationale:
		"WaitGroup lives in the <code>sync</code> package rather than being a language built-in because Go's designers believe concurrency primitives should be composable library types rather than special syntax. The counter-based API (Add, Done, Wait) is minimal by design: it does exactly one thing and nothing else. Requiring a pointer instead of a value receiver is an enforced constraint; copying a WaitGroup resets the counter in the copy, which the race detector will catch and report.",
	commonMistakes: [
		{
			title: "Calling Add inside the goroutine",
			body: "If you call <code>wg.Add(1)</code> inside the goroutine, the main goroutine might call <code>wg.Wait()</code> before the goroutine runs and adds itself, causing Wait to return immediately.",
		},
		{
			title: "Copying the WaitGroup",
			body: "Passing a WaitGroup by value creates a copy with a separate counter. Always pass <code>&wg</code>.",
		},
	],
	relatedSlugs: ["goroutines", "channels", "context"],
}
