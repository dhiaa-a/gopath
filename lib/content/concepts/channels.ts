import { Concept } from "../../content"

export const channels: Concept = {
	slug: "channels",
	name: "Channels",
	tagline: "Typed pipes for communicating between goroutines safely.",
	summary:
		"Channels are Go's way of sharing data between goroutines without shared memory or locks. A channel is a typed conduit: you send values in, receive them out. The Go proverb: <em>don't communicate by sharing memory; share memory by communicating.</em>",
	mentalModel:
		"A channel is a conveyor belt between goroutines. One goroutine puts items on the belt, another picks them off. An unbuffered channel means the sender waits until a receiver is ready, so they synchronize. A buffered channel has capacity, so the sender can keep going until the buffer is full.",
	retrievalPrompts: [
		"Two goroutines share an unbuffered channel: A sends, B receives. Which blocks first, and what unblocks it? || Whichever reaches the channel operation first blocks until the other arrives; they rendezvous. The sender blocks on ch <- value until a receiver is ready; the receiver blocks on <-ch until a sender arrives. An unbuffered channel is a synchronisation point, not a buffer.",
		"When should you close a channel, and who should do it? What happens if you send to it after closing? || Close when no more values will be sent; it signals receivers to stop waiting. Only the sender should close; receivers cannot know when sending is done. Sending to a closed channel panics immediately. Receiving from a closed channel returns the zero value and false for the ok flag.",
		"When is a channel the right tool, and when is a mutex simpler? Give a concrete rule. || Use a channel when passing ownership of data between goroutines, or signalling events. Use a mutex when multiple goroutines share and update state (a counter, a cache, a map). Rule: if you are moving data, use a channel; if you are protecting data, use a mutex.",
	],
	codeExample: `package main

import "fmt"

func generate(nums []int, out chan<- int) {
	for _, n := range nums {
		out <- n // send
	}
	close(out) // signal: no more values
}

func square(in <-chan int, out chan<- int) {
	for n := range in { // receive until closed
		out <- n * n
	}
	close(out)
}

func main() {
	nums := make(chan int)
	squares := make(chan int)

	go generate([]int{1, 2, 3, 4, 5}, nums)
	go square(nums, squares)

	for s := range squares {
		fmt.Println(s) // 1 4 9 16 25
	}
}`,
	codeExplanation:
		"Two goroutines form a pipeline. <code>generate</code> sends numbers, <code>square</code> receives them and sends results. <code>close(ch)</code> signals that no more values will be sent, enabling <code>range ch</code> to terminate naturally.",
	designRationale:
		"Go adopted CSP (Communicating Sequential Processes) as its concurrency model because shared memory leads to data races that are difficult to reason about under concurrent access. Channels transfer ownership of a value from one goroutine to another, so only one goroutine holds the value at a time, eliminating the need for locks on the data itself. The language proverb captures the intent: don't communicate by sharing memory; share memory by communicating.",
	commonMistakes: [
		{
			title: "Sending to a closed channel (panic)",
			body: "Sending to a closed channel panics. The rule: only the sender should close a channel, and only when they're certain no more sends will happen.",
		},
		{
			title: "Forgetting to close, causing deadlock",
			body: "A goroutine doing <code>for n := range ch</code> will block forever if <code>ch</code> is never closed. Always close channels when the sender is done.",
		},
		{
			title: "Using channels when a mutex is clearer",
			body: "Channels are best for passing ownership of data. For protecting shared state (a counter, a map), a <code>sync.Mutex</code> is often simpler and more readable.",
		},
	],
	relatedSlugs: ["goroutines", "select", "sync-waitgroup"],
}
