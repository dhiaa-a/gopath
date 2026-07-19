import { Concept } from "../../content"

export const memoryModel: Concept = {
	slug: "memory-model",
	name: "The memory model",
	tagline:
		"Two goroutines with no happens-before edge between them have no order at all, and your CPU is not on your side.",
	summary:
		"The Go memory model (<code>go.dev/ref/mem</code>, version of June 6, 2022) says exactly one useful thing: a read is only guaranteed to observe a write if that write <em>happens before</em> it. Happens-before is not wall clock time and it is not \"the line above\". It is a relation you create, with a channel operation, a mutex, a <code>sync.Once</code>, a <code>WaitGroup</code>, or the <code>go</code> statement itself. Where you have not created it, the compiler is free to reorder your code and the processor is free to reorder it again, and the program that passed a thousand times this morning is not evidence of anything.",
	mentalModel:
		"Stop imagining your goroutines as instructions on a shared timeline that the scheduler interleaves. There is no timeline. Each goroutine has its own order (\"sequenced before\"), and between two goroutines there is no order whatsoever unless you built one. Happens-before is the transitive closure of those two things: your program's own order within a goroutine, and the edges you explicitly created between them. Everything else is unordered, and unordered does not mean \"probably fine, resolved by whoever gets there first\". It means the question of which write a read sees has no answer. Think of a synchronising operation as the only moment your goroutine's writes become publishable and another goroutine's writes become visible. Between those moments you are looking at a private, stale, reordered view of memory, and it is not lying to you: you simply never asked.",
	retrievalPrompts: [
		"You write a concurrency test, run it 1000 times in CI, and it is clean every time. CI runs in a single-core container. What have you proved? || Close to nothing. The litmus test on this page reports the impossible outcome 355 to 570 times per million rounds on an 8-thread laptop, and exactly 0 times per million under GOMAXPROCS=1, because with one core the store buffer never gets the chance. A single-core run does not exercise the failure, so 1000 green runs are 1000 measurements of an environment that cannot produce the bug. Production has more cores than CI, which is why this bug class ships.",
		"You read the compiler's assembly. Your store really is emitted before your load, no fence, no LOCK prefix. So the ordering is guaranteed on x86, right? || No, and this is the trap. gc emits exactly what you wrote: MOVQ $1, (CX) then MOVQ (DX), SI, in source order. The reordering happens below the instruction stream. x86's store buffer lets a store retire into the buffer while a later load to a different address executes against cache, so both cores read the other's variable before either store lands. The assembly being right is not the ordering being right, and the measured 355 to 570 hits per million is the proof.",
		"Every write to a shared struct is under a mutex. Reads are not, because a stale read is acceptable for this feature. Is that a data race? || Yes, and \"stale read\" is not what you get. The model gives you an edge only between call n of Unlock and call m of Lock for n < m: a reader that never calls Lock has no edge to any writer, so there is no guarantee it observes any particular write, ever. Worse, a struct is multiword. The spec only requires single-word reads to observe a real write; it merely encourages it for anything larger, and says races on (pointer, length) or (pointer, type) pairs can lead to arbitrary memory corruption.",
	],
	codeExample: `package main

import "fmt"

// Two goroutines, two shared ints, no synchronisation between them.
//
// Reason it through: if a == 0, then g1 read y before g2 wrote it, so g1's
// "x = 1" already happened, so g2's "b = x" must see 1. Symmetrically if
// b == 0 then a must be 1. There is no interleaving of these two bodies
// that ends with both a and b at 0. Run it anyway.
func main() {
	var x, y int // shared, unsynchronised
	var a, b int // what each goroutine saw

	run1 := make(chan struct{})
	run2 := make(chan struct{})
	done := make(chan struct{}, 2)

	go func() {
		for range run1 {
			x = 1
			a = y
			done <- struct{}{}
		}
	}()
	go func() {
		for range run2 {
			y = 1
			b = x
			done <- struct{}{}
		}
	}()

	impossible := 0
	const rounds = 1000000
	for i := 0; i < rounds; i++ {
		x, y, a, b = 0, 0, 0, 0
		run1 <- struct{}{} // the channel ops order main against the
		run2 <- struct{}{} // goroutines. Nothing orders g1 against g2.
		<-done
		<-done
		if a == 0 && b == 0 {
			impossible++
		}
	}
	fmt.Printf("impossible outcome in %d of %d rounds\\n", impossible, rounds)
}`,
	codeExplanation:
		"Four consecutive runs on an 8-thread i5 laptop printed <code>impossible outcome in 439 of 1000000 rounds</code>, then 355, then 522, then 470. The outcome you just proved cannot happen happens about 1 round in 2000. Two details make this worth more than a curiosity. First, the compiler did not do it: <code>go build -gcflags=-S</code> shows <code>MOVQ $1, (CX)</code> for <code>x = 1</code> followed by <code>MOVQ (DX), SI</code> for the load of <code>y</code>, in source order, with no fence and no <code>LOCK</code> prefix anywhere. The instructions are exactly what you wrote. The reordering is happening underneath them, in the store buffer: each core parks its store and reads the other's variable out of cache before that store is visible, so both loads see 0. Second, and this is the part to take to work: the same binary under <code>GOMAXPROCS=1</code> printed <code>0 of 1000000</code>, twice. One core, no store buffer window, no bug. Even at 8 threads one run here reported just 5 per million. So a clean run proves that this machine, this afternoon, with this core count, did not hit it. That is the entire content of \"it worked on my machine\", stated numerically.",
	designRationale:
		"Go could have made every shared access sequentially consistent and spared you this page. It would also have meant a memory barrier on essentially every load and store of a shared variable, which is a cost the whole program pays so that the 1% of it that is concurrent can be written carelessly. Instead the model says: you tell us where the edges are, and we will emit fences exactly there. That is why the list of synchronising operations is short and why nothing else on it is free. The more interesting decision is where Go drew the line on what a race may do. In C and C++ a data race is undefined behaviour and the compiler may do literally anything; Go explicitly refuses that. The spec says an implementation \"may always react to a data race by reporting the race and terminating the program\", and otherwise every read of a single-word-sized or sub-word-sized location \"must observe a value actually written to that location and not yet overwritten\", with acausal and out-of-thin-air writes disallowed. The doc states the intent plainly: these constraints make Go \"more like Java or JavaScript, in that most races have a limited number of outcomes, and less like C and C++, where the meaning of any program with a race is entirely undefined\". That bound is what lets Go call itself memory-safe. It stops at the machine word, because guaranteeing it for an interface or a slice would mean fencing every access to a two-word value, and that is the cost the model exists to avoid. So a racy <code>int</code> gives you a wrong number and a racy slice header can give you arbitrary memory corruption, and the difference is a hardware detail, not a design principle. Go 1.19 finished the job by aligning the model with C, C++, Java, JavaScript, Rust and Swift, and offering only sequentially consistent atomics, deliberately none of the relaxed forms. The document's own advice section is the real summary: \"If you must read the rest of this document to understand the behavior of your program, you are being too clever. Don't be clever.\"",
	commonMistakes: [
		{
			title: "Treating a passing run, or a thousand of them, as evidence",
			body: "The litmus test above goes from 0 hits per million on one core to about 500 on eight, and swings 100x between runs on the same machine. Frequency is a property of your hardware, your core count, and your load, none of which your laptop shares with production. Absence of a symptom is not presence of an edge. The only evidence is the edge itself, or <code>go test -race</code>, which reasons about happens-before rather than about outcomes.",
		},
		{
			title: "Assuming a single word is safe to share because it cannot tear",
			body: "Tearing was never the problem. A word-sized read is guaranteed to return some value really written, and that guarantee says nothing about <em>when</em>: with no edge, a goroutine may observe your write immediately, in an hour, or never. The compiler is entitled to hoist an unsynchronised load out of a loop entirely and spin on a register forever. gc 1.22 happens not to on the obvious shapes, which is worse than if it did, because it means your <code>for !done {}</code> works today and is not guaranteed to work after any compiler upgrade.",
		},
		{
			title: "Thinking a goroutine's exit publishes its writes",
			body: "The spec is blunt: \"The exit of a goroutine is not guaranteed to be synchronized before any event in the program.\" Only the <code>go</code> statement is an edge, and it points the wrong way: it orders the parent's earlier writes before the child's start, not the child's writes before anything. Knowing the goroutine finished, however you came to know it, is not an edge. <code>wg.Wait()</code>, a receive, or a <code>Lock</code> is.",
		},
		{
			title: "Using time.Sleep to order two goroutines",
			body: "Sleeping is not in the list of synchronising operations, because duration is not order. A sleep that is long enough to fix the symptom on your laptop is a sleep that is not long enough on a loaded box, and it never creates the edge either way: it only changes how often you lose. If a sleep fixes a test, the test found a real bug and you have hidden it.",
		},
		{
			title: "Reaching for relaxed or acquire-release atomics",
			body: "Go does not have them, on purpose. Since 1.19 the model is explicit that all atomic operations \"behave as though executed in some sequentially consistent order\", the same semantics as C++'s sequentially consistent atomics and Java's <code>volatile</code>, and Go 1.19's release notes say it provides \"not any of the more relaxed forms found in other languages\". Porting a lock-free algorithm that depends on <code>memory_order_relaxed</code> gets you the stronger ordering and the fence you were trying to avoid, so the trick you ported does not buy what it bought in C++.",
		},
	],
	relatedSlugs: ["race-detector", "atomic", "sync-mutex", "channels", "sync-once"],
}
