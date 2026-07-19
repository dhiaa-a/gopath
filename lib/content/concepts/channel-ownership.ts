import { Concept } from "../../content"

export const channelOwnership: Concept = {
	slug: "channel-ownership",
	name: "Channel ownership and closing",
	tagline:
		"close is a send-side broadcast, not cleanup. Whoever sends, closes. Everyone else receives the news.",
	summary:
		"Closing a channel is not releasing a resource: channels are garbage collected like anything else, and a channel nobody references is collected whether you closed it or not. <code>close(ch)</code> is a message, and the only message a sender can broadcast to every receiver at once: there will be no more values. That is why the rule is that the sender closes. A receiver closing a channel it receives from is not a style violation, it is a receiver trying to send.",
	mentalModel:
		"Think of close as the last send, one that every receiver gets a copy of and that can never be taken back. Everything else follows from reading it that way. Only a sender may do it, because it is a send. It cannot happen twice, because the last send is the last one. It cannot happen while another sender might still send, because then it was not the last. And a receiver must never do it, because a receiver has no idea whether the sender has more to say and no right to speak for it. So the answer to \"how do I tell the producer to stop?\" is not to close its channel. It is to notice that you now want to broadcast in the other direction, and to build a second channel that you are the sender of.",
	retrievalPrompts: [
		"A fan-in has 8 producers on one channel. Each one closes it when its own work is done. Test suite is green. What happens in production, and why did the tests miss it? || The first producer to finish closes, and the next producer's send panics with send on closed channel, taking the process down from a goroutine nobody is recovering. The second producer to finish panics with close of closed channel instead. Tests miss it because they use small inputs where producers finish in staggered order. The rule is that the sender closes, singular: with many senders no individual one owns the close, so the close belongs to whoever knows they have all finished, which is a WaitGroup and a goroutine that does wg.Wait() then close.",
		"You range over a results channel and the producers can outlive the consumer. The consumer returns early on the first error. What breaks, and where? || The producers block forever on a send nobody will ever receive, and every one of them leaks: goroutine, stack, and everything the closure captured, for the life of the process. Nothing panics and nothing logs, so it shows up as memory that only grows. Returning early from a receiver is abandoning a rendezvous, and the fix is a stop channel the consumer closes, selected against in the producer's send, so an abandoned send has somewhere to go.",
		"A select loop reads from a done channel and a work channel. done gets closed. The goroutine now burns 100% of a core instead of exiting. What did you forget? || That a closed channel is always ready to receive, forever, returning the zero value. If the done case does not return, the select picks it again immediately, every time, which is roughly 150,000 iterations in 10ms on a laptop. Closing broadcasts by making a receive always succeed, and that is exactly why it can never be undone and why the case must exit or the channel variable must be set to nil to disable it.",
	],
	codeExample: `package main

import "fmt"

// The receiver has had enough and closes the channel to make the producer
// stop. It reads like cleanup. It is a send-side broadcast fired from the
// receiving end, and the producer is standing in front of it.
func receiverCloses() {
	ch := make(chan int)
	dead := make(chan struct{})

	go func() { // the producer: the only sender, and not the one closing
		defer close(dead)
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("  producer:", r)
			}
		}()
		for i := 0; ; i++ {
			ch <- i // parked here when the close lands
		}
	}()

	for i := 0; i < 3; i++ {
		fmt.Println("  received", <-ch)
	}
	close(ch) // "stop sending". The producer is blocked on a send right now.
	<-dead
}

// The same intent, with each close fired by the goroutine that owns that
// channel's send side. Two channels, two closes, pointing opposite ways.
func ownersClose() {
	ch := make(chan int)
	stop := make(chan struct{}) // owned by the receiver: nobody ever sends on it

	go func() {
		defer close(ch) // the sender closes ch, because the sender owns ch
		for i := 0; ; i++ {
			select {
			case ch <- i:
			case <-stop: // the receiver's broadcast, received not sent
				return
			}
		}
	}()

	for i := 0; i < 3; i++ {
		fmt.Println("  received", <-ch)
	}
	close(stop) // the receiver closes stop, because the receiver owns stop

	// Drain: the producer may already have a value in flight, and it cannot
	// exit until someone takes it. The loop ends when the producer's own
	// deferred close(ch) lands, which is the sender saying "that was the last".
	for range ch {
	}
	fmt.Println("  producer stopped, ch drained and closed by its sender")
}

func main() {
	fmt.Println("receiver closes the channel it receives from:")
	receiverCloses()
	fmt.Println("each channel closed by its own sender:")
	ownersClose()
}`,
	codeExplanation:
		"Identical on five consecutive runs: the first half prints three received values and then <code>producer: send on closed channel</code>. Note where the panic happened. Not at the <code>close</code>, which succeeded quietly, but in the producer's goroutine, which was parked on a send at the time. Closing a channel wakes every goroutine blocked on it, and a blocked sender is woken into a panic. In this program a deferred <code>recover</code> catches it because the recover is in the goroutine that panicked, which is the only place it could be: <code>main</code> cannot recover another goroutine's panic, so in real code this is not a caught error, it is the process. The second half wants the same thing and gets it: three values, then <code>producer stopped, ch drained and closed by its sender</code>, no panic. Nothing was made safer by adding a check. There are two channels, and each is closed by the goroutine that sends on it. <code>stop</code> is the interesting one, because the receiver of <code>ch</code> is the sender of <code>stop</code>, and it sends by closing, which is what makes it a broadcast that reaches every producer at once rather than one value that reaches one of them. The <code>select</code> is what makes the producer's send abandonable: without it, a producer parked on <code>ch &lt;- i</code> with a consumer that has walked away is a goroutine leak, closed stop channel or not. And the drain loop at the end is not politeness. The producer may be holding a value in flight, and it cannot reach its <code>return</code> until someone takes it.",
	designRationale:
		"Close is asymmetric because the information is asymmetric. A sender knows when it has no more to send; a receiver cannot know, which is exactly why it needs to be told, and a broadcast is the only shape that tells all of them at once without knowing how many there are. Go implements this by making a closed channel permanently ready: every receive returns immediately with the zero value and <code>ok == false</code>, forever. That single decision explains the whole surface. It is why <code>range ch</code> terminates. It is why <code>close</code> is irreversible, since there is no state to go back to, only a channel that now always answers. It is why a second <code>close</code> panics with <code>close of closed channel</code> rather than being a harmless no-op: a no-op would let two goroutines both believe they were the last sender, which is the bug, and Go would rather crash than let you keep the belief. It is why <code>close</code> of a nil channel panics too, with <code>close of nil channel</code>. And it is why there is no <code>IsClosed(ch)</code>, which is the API everyone reaches for first. It could not work: the answer is stale before you can act on it, since a close can land between the check and the send, and the send panics anyway. That is not an oversight, it is a refusal to ship an API whose only use is a race. The one honest check is the receive form, <code>v, ok := &lt;-ch</code>, which is not a check but a receive that reports what it found, and only a receiver can do it. <code>worker-pool</code> step 08 walks straight into all of this: a <code>stopped</code> bool guarding <code>Submit</code> cannot be fixed, not by reordering, not by a second check, not by making it an <code>atomic.Bool</code>, because check-then-send is two operations and the close can always land between them. The atomic version is the instructive one: it removes the data race, so <code>-race</code> goes quiet, and the panic stays exactly as likely.",
	commonMistakes: [
		{
			title: "Closing from the receiver to stop the producer",
			body: "The producer's next send panics with <code>send on closed channel</code>, in the producer's goroutine, which is usually a caller's goroutine and usually the process. Closing wakes blocked senders into that panic. You wanted a broadcast in the other direction: make a second channel that the receiver is the sender of, and close that.",
		},
		{
			title: "Letting each of N producers close the shared channel",
			body: "The first to finish closes, the rest panic with <code>send on closed channel</code>, and the second one to try closing gets <code>close of closed channel</code>. No individual sender owns the close when there are several. Give it to whoever knows they have all finished: <code>go func() { wg.Wait(); close(ch) }()</code>.",
		},
		{
			title: "Guarding a close or a send with a bool, or an atomic.Bool",
			body: "<code>if !stopped { ch &lt;- v }</code> is check-then-send, two operations with a window between them, and the close lands in that window under load. An <code>atomic.Bool</code> is the trap: it silences <code>-race</code>, since the data race is gone, and leaves the panic exactly as likely, because a race condition is an ordering bug and the detector only finds data races. A mutex making the send and the close mutually exclusive is the fix, or a <code>select</code> on a stop channel.",
		},
		{
			title: "A closed channel case in a select that does not exit",
			body: "A closed channel is always ready, so <code>select</code> takes that case every time and the loop spins at 100% of a core: about 150,000 iterations in 10ms on a laptop, doing nothing. Either the case returns, or you set the channel variable to <code>nil</code>, which disables the case permanently since a nil channel is never ready. That is what nil channels in <code>select</code> are for.",
		},
		{
			title: "Returning early from a receiver without unblocking the senders",
			body: "The consumer sees an error and returns; every producer parked on a send waits forever, holding its goroutine, its stack, and everything its closure captured. Nothing panics and nothing logs. It looks like memory that only grows and goroutine counts that never come down, and it is the most common leak in Go. Senders need a <code>select</code> with a stop case so an abandoned send has an exit.",
		},
	],
	relatedSlugs: ["channels", "buffered-channels", "select", "context", "sync-waitgroup"],
}
