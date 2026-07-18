import { Concept } from "../../content"

export const bufferedChannels: Concept = {
	slug: "buffered-channels",
	name: "Buffered vs unbuffered channels",
	tagline:
		"Capacity is not a speed knob. It is how much lying you will tolerate about how far behind you are.",
	summary:
		"<code>make(chan T)</code> is a rendezvous: the send does not complete until a receiver takes the value, so both goroutines meet and both learn something. <code>make(chan T, n)</code> is a queue with a lid: the send completes as soon as the value is in the box, and the sender learns nothing except that the box was not full. The capacity does not decide whether the sender ever blocks, only how far ahead it gets before it does. That makes <code>n</code> a backpressure policy, not a tuning parameter.",
	mentalModel:
		"An unbuffered channel is a handshake and a buffered channel is a mailbox. Both deliver the value; they differ in what the sender knows afterwards. After a handshake returns, someone is holding your value right now, and you were slowed to their speed to make that true. After a mailbox accepts, all you know is that there was room. Now the useful part: a mailbox with n slots does not exempt the sender from the consumer's pace, it prepays for n of them. Once the slots are full the sender is back to running at exactly the consumer's rate, and it never escapes it again. So capacity buys a burst and nothing else. If the producer is faster on average, every capacity is the same capacity, and you have only chosen how much memory to hold and how late you find out.",
	retrievalPrompts: [
		"Throughput is short of target. Someone doubles the channel buffer from 500 to 1000 and it does not move. What did they get for the extra 500 slots? || 500 more sends of runway during the first burst, and nothing at steady state. Once the buffer is full the producer runs at the consumer's rate no matter how deep it is; a queue in front of a saturated consumer is only somewhere for work to sit. worker-pool measures this: 1.5M jobs/s at buffer=0, 2.6M at 10, 3.9M at 100, and 3.9M at 1000. The first few slots buy real decoupling by taking the scheduler off the critical path of every job, and after that the bottleneck has moved to the workers.",
		"Your handler does results <- r on a buffered channel and returns 200. Under load, users report accepted work that never happened. What did the send returning actually prove? || That the buffer had room. Nothing else. A send on a buffered channel completes against the queue, not against a consumer, so there is no evidence that anyone will ever receive it, and if the process exits or the consumer dies the buffered values evaporate with no trace. An unbuffered send returning proves a receiver took the value, and even that only proves receipt, not that the work was done. Acknowledge after the work, not after the send.",
		"You add a buffer to fix a deadlock and the deadlock goes away in tests, then returns in production under load. Why is that the expected outcome? || Because the buffer did not remove the send that had no receiver, it just delayed it by n sends. The deadlock was a missing receiver and it still is; the capacity only decided how many values had to pile up before the sender blocked. Tests push fewer than n values so they never reach the lid. Buffering a deadlock converts a reproducible test failure into a load-dependent production hang, which is a strictly worse bug.",
	],
	codeExample: `package main

import (
	"fmt"
	"time"
)

// One worker that takes 100ms per job. That is the consumer's rate, and it is
// the only thing in this program that decides how fast the producer may run.
func run(capacity, jobs int) {
	ch := make(chan int, capacity)
	done := make(chan struct{})

	go func() {
		defer close(done)
		for range ch {
			time.Sleep(100 * time.Millisecond)
		}
	}()

	fmt.Printf("capacity=%d\\n", capacity)
	start := time.Now()
	for i := 0; i < jobs; i++ {
		ch <- i
		// When did this send RETURN? That is the whole experiment. A send that
		// returned means the value left your hands, and nothing more than that.
		fmt.Printf("  send %d returned at %v\\n", i, time.Since(start).Round(50*time.Millisecond))
	}
	close(ch)
	<-done
	fmt.Printf("  all %d jobs done at %v\\n\\n", jobs, time.Since(start).Round(50*time.Millisecond))
}

func main() {
	run(0, 6) // rendezvous: every send waits for the worker to take it
	run(3, 6) // a queue with a lid: 4 sends of runway, then the same wait
}`,
	codeExplanation:
		"At <code>capacity=0</code> the sends return at 0ms, 100, 200, 300, 400, 500: the producer is pinned to the worker's rate from the very first job, because each send waits for the worker to take it. At <code>capacity=3</code> sends 0 through 3 all return at <code>0s</code> and then send 4 returns at <code>100ms</code> and send 5 at <code>200ms</code>. Two things in that. Four sends of runway from a buffer of three, because the worker is holding one while three sit in the box, so the arithmetic is <code>cap+1</code> and not <code>cap</code>. And then the runway ends and the producer is back to one send per 100ms, permanently, exactly like the unbuffered case. The line that matters most is the one that does not change: <code>all 6 jobs done at 650ms</code> in both runs. The buffer bought zero throughput. It moved four sends from later to earlier and changed nothing else, because the worker was always the bottleneck and a queue in front of a bottleneck is furniture. Now delete the <code>close(ch)</code> and the whole thing hangs at <code>fatal error: all goroutines are asleep - deadlock!</code>, which is the other half of the lesson: the lid does not remove the rules, it postpones them. On this Windows box the timer granularity drifts each 100ms sleep by a few milliseconds, which is why the total rounds to 650ms rather than 600ms and why the per-send figures wobble by one tick between runs; on the Playground the clock is synthetic and you get exact multiples. The shape is what is stable, and it is stable on every run.",
	designRationale:
		"Go took channels from CSP, where communication is unbuffered by definition and a send and a receive are one event that two processes participate in. That is why <code>make(chan T)</code> with no capacity gives you a rendezvous rather than a one-slot queue: the unbuffered channel is the primitive, and the buffer is the option. It is also why unbuffered channels carry a happens-before edge in both directions, which the memory model states explicitly: a receive on an unbuffered channel is synchronized before the send on that channel completes. Both goroutines learn something, because both were there. Buffering breaks the symmetry on purpose. The send only synchronizes before the receive that takes the value, so the ordering still holds for the data, and the sender no longer learns anything about the receiver, because it never met one. That loss is the entire cost and it is what people spend without noticing when they add a capacity to make a warning go away. The deeper reason capacity is policy rather than tuning is arithmetic that predates Go: if the producer is faster than the consumer on average, no finite buffer holds, and the only question is whether you would rather find out at the send or at the OOM killer. A blocked send is the system telling its caller the truth, and the truth propagates: the caller blocks, its caller blocks, and the pipeline settles at the rate the slowest stage can sustain in bounded memory, forever. Which is why the standard library's own queue, <code>http.Server</code>, has no job queue at all, and why <code>worker-pool</code> makes <code>Submit</code> block rather than buffer harder, error, or spawn.",
	commonMistakes: [
		{
			title: "Sizing the buffer by feel and calling it tuning",
			body: "The number is a policy: how much work may pile up unacknowledged before the producer is told to slow down. Pick it from what you can afford to hold and to lose, not from what made the graph move. <code>worker-pool</code>'s sweep flattens completely after 100 (3.9M jobs/s at both 100 and 1000), so the tuning instinct is buying memory and latency for no throughput.",
		},
		{
			title: "Adding a buffer to silence a deadlock",
			body: "The deadlock was a send with no receiver, and it still is. The capacity only decides how many values pile up before the sender blocks, so tests that push fewer than <code>n</code> pass and production hangs under load. You converted a deterministic failure into a load-dependent one and deleted the evidence.",
		},
		{
			title: "Treating a completed send as delivery",
			body: "On a buffered channel the send completes against the queue. Nobody has received it, nobody may ever receive it, and if the process exits those values vanish silently with no error anywhere. Acknowledging a request because the send returned is how work gets accepted and dropped. Acknowledge after the work.",
		},
		{
			title: "Reading len(ch) to decide anything",
			body: "<code>len</code> and <code>cap</code> work on channels (<code>len</code> is how many values are queued), and the length is stale the instant it returns, because a receiver can drain the channel between the check and the next line. It is fine in a log line or a metric, and it is a race condition in <code>if len(ch) &lt; cap(ch) { ch &lt;- v }</code>. Use <code>select</code> with <code>default</code> if you need a non-blocking send.",
		},
		{
			title: "Using a big buffer as the retry queue",
			body: "A buffer is not durable, not observable, not ordered across producers in any way you control, and not recoverable. Every value in it dies with the process, and its depth is the amount of work you silently lose on a deploy. If the work must survive a restart, the thing you want is a queue with a disk behind it, and the channel is the wrong layer to notice that at.",
		},
	],
	relatedSlugs: ["channels", "channel-ownership", "select", "goroutines", "memory-model"],
}
