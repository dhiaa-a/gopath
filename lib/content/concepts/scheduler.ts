import { Concept } from "../../content"

export const scheduler: Concept = {
	slug: "scheduler",
	name: "The goroutine scheduler",
	tagline:
		"Switching goroutines is a user-space function call, not a kernel trap, which is the whole reason a thousand of them cost about what a handful of threads do.",
	summary:
		"Go multiplexes many goroutines onto few OS threads with a scheduler it ships in the runtime, described by three letters: <code>G</code> for goroutines, <code>M</code> for OS threads (machine), and <code>P</code> for logical processors, the scheduling contexts a thread must hold to run Go code. The number of <code>P</code>s is <code>GOMAXPROCS</code>, and it is the ceiling on how many goroutines run <em>in parallel</em>, not how many can exist: a goroutine starts with a couple of kilobytes of growable stack, so a program holds hundreds of thousands of them cheaply. A blocking syscall hands its <code>P</code> to another <code>M</code> so the rest keep running, and since Go 1.14 the scheduler can preempt a goroutine asynchronously instead of waiting for it to cooperate. What it never promises is order or fairness.",
	mentalModel:
		"Hold three things: a goroutine <code>G</code>, an OS thread <code>M</code>, and a logical processor <code>P</code>. A <code>G</code> can only execute while an <code>M</code> is running it and that <code>M</code> holds a <code>P</code>, and there are exactly <code>GOMAXPROCS</code> of those <code>P</code>s, so at any instant at most <code>GOMAXPROCS</code> goroutines are truly running. Every other runnable goroutine is sitting in a queue. The scheduler moves goroutines on and off the <code>P</code>s at safepoints (function calls, channel operations, allocation) and, since Go 1.14, by an asynchronous signal that can interrupt a goroutine mid-loop. This is a performance abstraction, not a correctness one, and confusing the two is where the bugs live. The scheduler decides <em>when</em> and <em>on which thread</em> your goroutines run, never in what <em>order</em> their memory operations become visible to each other; that is the memory model's job and not the scheduler's promise to keep. Assume the interleaving is adversarial: any runnable goroutine may run next, or not for a long time, on any thread, and the only structure over that chaos is the synchronisation you write.",
	retrievalPrompts: [
		"You set GOMAXPROCS=1 so only one goroutine runs at a time and decide the shared counter no longer needs its mutex. Where does that reasoning fail? || GOMAXPROCS=1 caps parallelism, not concurrency. The single P still switches between goroutines at safepoints, and since Go 1.14 an async preemption signal can interrupt one in the middle of a loop, so goroutine A can be paused between reading the counter and writing it back while B runs and updates the same field. One P means no two goroutines execute simultaneously; it does not mean an operation runs to completion uninterrupted. The read-modify-write is still not atomic, go test -race still fires, and the memory model still gives you nothing without an edge.",
		"Goroutines are cheap, so you launch one per request with no ceiling, and the service collapses under load while each goroutine is only a few kilobytes. What actually ran out? || Not the stacks, usually. A few kilobytes times a large in-flight count is real memory, but the thing that falls over first is whatever each goroutine holds while it runs: a connection from a fixed-size pool, an open file descriptor, a buffer. Cheap per goroutine is not free in aggregate, and the scheduler also pays to manage a runnable set that large. Bound concurrency with a worker pool or a semaphore channel, so the number in flight is a number you chose rather than one the load chose for you.",
		"You launch goroutines 0 through 9 in a loop, each prints its index, and the output is neither 0 through 9 nor the same twice. Which assumption broke? || That the order you start goroutines is the order they run. go only makes a goroutine runnable; the scheduler decides when it actually runs and on which P, with no promise of FIFO or fairness, and the new goroutine typically does not run until the launcher reaches a safepoint or blocks, so all ten are often queued before any prints. Ordering is something you impose with synchronisation, a channel that hands off in sequence or a sync.WaitGroup and a sort afterwards, never something you read off the order of the go statements.",
	],
	codeExample: `package main

import (
	"fmt"
	"runtime"
	"sync"
)

func main() {
	// NumCPU and GOMAXPROCS are machine facts. NumCPU is the cores the OS
	// reports; GOMAXPROCS(0) queries (without changing) how many of them Go
	// will run goroutines on at once, i.e. the number of P's. It defaults to
	// NumCPU.
	fmt.Println("NumCPU:              ", runtime.NumCPU())
	fmt.Println("GOMAXPROCS(0):       ", runtime.GOMAXPROCS(0))
	fmt.Println("goroutines at start: ", runtime.NumGoroutine())

	const n = 1000
	var wg sync.WaitGroup
	release := make(chan struct{})

	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			<-release // park here, so all n are alive at the same instant
		}()
	}

	// Every one of the 1000 is launched and blocked on the channel, so all of
	// them are alive right now. NumGoroutine counts them plus main.
	fmt.Println("goroutines after launching 1000:", runtime.NumGoroutine())

	close(release) // wake them all; each runs to completion and exits
	wg.Wait()

	// wg.Wait returns once the counter hits zero, but a goroutine that has run
	// its deferred Done may not be fully reaped yet. Spin until the scheduler
	// has cleaned them up, to show the count returns to the baseline.
	for runtime.NumGoroutine() > 1 {
		runtime.Gosched()
	}
	fmt.Println("goroutines after they finish:   ", runtime.NumGoroutine())
}`,
	codeExplanation:
		"On this machine the run prints <code>NumCPU: 8</code> and <code>GOMAXPROCS(0): 8</code>, then <code>goroutines at start: 1</code>, <code>goroutines after launching 1000: 1001</code>, and <code>goroutines after they finish: 1</code>. The first two are machine facts: <code>NumCPU</code> is the cores the OS advertises and <code>GOMAXPROCS(0)</code> queries the number of <code>P</code>s, which defaults to <code>NumCPU</code>, so you will see your own core count. The goroutine counts do not depend on the machine and are exact. One at the start is <code>main</code> alone; <code>NumGoroutine</code> counts user goroutines, not the runtime's own GC workers and monitor, which is why it is 1 and not more. After the loop it is 1001: all 1000 workers are launched and every one is blocked receiving on the unbuffered <code>release</code> channel, so they are alive at the same instant, plus <code>main</code>. That is the cheapness made literal, a thousand parked goroutines is a few megabytes of stack, not a thousand OS threads, and at most <code>GOMAXPROCS</code> of them, here 8, were ever running at once; the other 992 sat runnable or blocked in the scheduler's queues. The last line is 1 again, and it is deterministic for a subtle reason. <code>wg.Wait</code> returns the moment the counter reaches zero, but a goroutine that has just run its deferred <code>Done</code> is not always reaped in the same instruction, so <code>NumGoroutine</code> can briefly read 2 or 3; the <code>for runtime.NumGoroutine() > 1 { runtime.Gosched() }</code> loop yields until the scheduler has cleaned them all up, which is why the printed value settles at exactly 1.",
	designRationale:
		"One OS thread per concurrent task does not scale to the server workloads Go was built for: an OS thread carries a large stack, is scheduled by the kernel, and a switch between two of them is a trip through the kernel measured in microseconds. Go's answer is an M:N scheduler that lives in the runtime and multiplexes many goroutines onto few threads, so a goroutine can start with a couple of kilobytes of stack that grows on demand and a switch between goroutines is an ordinary function-cheap operation in user space. The <code>P</code> in <code>G-M-P</code> was not in the first design; Go 1.1 added it to replace a scheduler with a single global run queue and lock, which serialised every scheduling decision and wrecked cache locality. Each <code>P</code> owns a local run queue, a thread runs goroutines from the <code>P</code> it holds, and idle <code>P</code>s steal work from busy ones, which is what makes the model scale across cores. <code>GOMAXPROCS</code> is the count of <code>P</code>s and therefore the ceiling on real parallelism; it defaulted to 1 until Go 1.5 made it <code>NumCPU</code>. The hardest corner was preemption. Until Go 1.14 the scheduler was purely cooperative: a goroutine yielded only at safepoints the compiler inserted, essentially function calls, so a tight loop with no calls could hold its <code>P</code> forever, starve every other goroutine, and even hang the garbage collector, whose stop-the-world phase needs every goroutine to reach a safepoint. Go 1.14 added asynchronous preemption: a monitor thread notices a goroutine that has run too long and sends it a signal that stops it at a safe instruction boundary. Fairness and ordering were deliberately left out, because guaranteeing them would mean synchronising on every scheduling decision, and the scheduler is a throughput optimiser. Correctness is delegated to the synchronisation primitives, not promised by the order goroutines happen to run.",
	commonMistakes: [
		{
			title: "Assuming GOMAXPROCS=1 makes concurrency safe",
			body: "It caps parallelism, the number of goroutines running at the same instant, to one. It does not stop the scheduler from switching goroutines at safepoints, and since Go 1.14 an async preemption signal can interrupt one mid-loop, so a read-modify-write on a shared variable can still be split across a switch and lose an update. The memory model also still provides no visibility guarantee without an edge. GOMAXPROCS=1 shrinks the window in which a race manifests, which is exactly why single-core CI passes and multi-core production does not. Synchronise regardless of core count.",
		},
		{
			title: "Spawning goroutines without a bound",
			body: "Each goroutine is cheap, a few kilobytes of stack, and cheap times a million is gigabytes, before counting the stack growth when work recurses and the resources each goroutine pins downstream: a database connection, an open socket, a slice of a response. \"Goroutines are cheap\" is true per goroutine and false in aggregate, and the resource they hold usually falls over long before the stacks do. Bound in-flight work with a worker pool or a buffered channel used as a semaphore.",
		},
		{
			title: "Writing a spin loop that never hits a safepoint",
			body: "The scheduler is mostly cooperative: a goroutine yields at safepoints the compiler places, essentially function calls, channel operations and allocation. A tight <code>for {}</code> with none of those reaches no safepoint, and before Go 1.14 it could hold its <code>P</code> indefinitely, starve other goroutines, and hang the GC, whose stop-the-world needs every goroutine to pause. Go 1.14 added async preemption that breaks such a loop after about 10 ms, but the lesson outlives the fix: code that never yields is trusting a safety net, not cooperating. Block on a channel or a proper primitive instead of spinning.",
		},
		{
			title: "Assuming goroutines run in the order you start them",
			body: "<code>go f()</code> makes a goroutine runnable, it does not run it. The launching goroutine keeps going until its own next safepoint, so all the children can be queued before any of them executes, and the scheduler pulls from local queues and steals across them with no FIFO or fairness promise. Start order, run order and completion order are three different things. If you need an order, impose it with a channel that sequences the work or by collecting results and sorting, never by reading it off the <code>go</code> statements.",
		},
		{
			title: "Blocking every thread with CGO or long syscalls",
			body: "When a goroutine makes a syscall the runtime understands, the runtime detaches its <code>P</code> and hands it to another thread so the rest keep running. A CGO call, or a syscall the runtime cannot preempt, instead pins its OS thread for the call's full duration, and enough concurrent blocking calls force the runtime to spawn more threads to keep the <code>P</code>s busy, up to a default ceiling of 10000 after which the program aborts with <code>too many threads</code>. Each thread is also about a megabyte. Keep C calls short, or cap how many run at once, so the schedulable goroutines always have a thread to run on.",
		},
	],
	relatedSlugs: ["goroutines", "memory-model", "race-detector", "gc-tuning"],
}
