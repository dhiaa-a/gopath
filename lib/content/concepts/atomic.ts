import { Concept } from "../../content"

export const atomic: Concept = {
	slug: "atomic",
	name: "sync/atomic",
	tagline:
		"One variable, one operation, indivisible. Two variables is a different problem and atomic does not solve it.",
	summary:
		"<code>sync/atomic</code> makes a single operation on a single word indivisible: no other goroutine can observe it half done. Since Go 1.19 the way to reach it is the typed API, <code>atomic.Int64</code>, <code>atomic.Bool</code>, <code>atomic.Pointer[T]</code>, <code>atomic.Value</code>, whose methods replace the old <code>atomic.AddInt64(&amp;x, 1)</code> free functions. It is faster than a mutex on the read path and it buys strictly less: a mutex can protect an invariant across several fields, and an atomic protects one variable against one operation.",
	mentalModel:
		"An atomic is a variable that cannot be caught mid-change. That is the whole guarantee, and the word doing the work is <em>a</em>: one variable. A mutex is different in kind, not in degree: it is a region of exclusion, so everything you touch inside it moves as a unit and other goroutines see the before or the after and nothing between. Atomics have no region. Two atomic operations in a row are two atomic operations, with a gap in the middle that another goroutine can and will land in. So the question that decides which tool you want is never \"is this variable shared?\", it is \"how many things have to change together?\". If the answer is more than one, no amount of atomic gets you there.",
	retrievalPrompts: [
		"Every field is an atomic.Int64, every access goes through Load or Add, and go test -race is silent across the whole suite. Is the code free of concurrency bugs? || No, and the silence is correct rather than lucky. Atomics establish happens-before (the docs: if the effect of A is observed by B, then A synchronizes before B), so there is no unsynchronised pair and nothing for the detector to report. It only ever finds data races. An invariant spanning two atomics is broken by a race condition, an ordering bug between two operations that are each individually fine, and no detector will find that for you.",
		"You replace a mutex-guarded counter with atomic.Int64 and the code reads if n := c.Load(); n < limit { c.Add(1) }. What did the atomic fix and what did it not? || It fixed the lost update: Add is a single indivisible read-modify-write, so no increment goes missing. It did nothing about the limit, because Load and Add are two operations with a gap between them, and every goroutine that Loads before anyone Adds sees the same under-limit value. Check-then-act needs CompareAndSwap in a retry loop, which is one operation, or a mutex.",
		"config-watcher benchmarks atomic.Value against RWMutex: about 1.3ns vs 15.7ns serial, about 80x apart under RunParallel. Why does more parallelism widen the gap instead of leaving it flat? || Because the serial number is instruction cost and the parallel number is cache coherence, and only the second one is the reason for the design. RLock has to write, since the mutex counts its readers, and a write means taking exclusive ownership of that cache line and invalidating it in every other core. Load only reads, so every core holds the line shared and reads it locally. One scales, the other anti-scales, and a one-core benchmark structurally cannot show you which you are holding.",
	],
	codeExample: `package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

// A ledger split across two counters. Both are atomic. Every single operation
// below is atomic. The invariant that ties them together is not, and there is
// nothing in sync/atomic that can make it so.
var (
	available atomic.Int64 // Go 1.19 typed API: no &, no width in the name
	sold      atomic.Int64
)

const stock = 100

// Each half is indivisible. The pair is two separate indivisible things, which
// is a different property, and not the one the invariant needs.
func sell() {
	available.Add(-1)
	sold.Add(1)
}

func main() {
	available.Store(stock)

	var sellers, reader sync.WaitGroup
	stop := make(chan struct{})

	// One reader doing the most innocent thing imaginable: reading the two
	// atomics and checking that they still add up.
	var torn, reads int
	reader.Add(1)
	go func() {
		defer reader.Done()
		for {
			select {
			case <-stop:
				return
			default:
			}
			a := available.Load()
			s := sold.Load()
			reads++
			if a+s != stock {
				torn++ // available+sold == 100 is FALSE, right now, in production
			}
		}
	}()

	for i := 0; i < stock; i++ {
		sellers.Add(1)
		go func() {
			defer sellers.Done()
			sell()
		}()
	}
	sellers.Wait()
	close(stop)
	reader.Wait()

	// The end state is always right. That is what makes this so hard to catch:
	// every number is correct by the time anyone thinks to look.
	fmt.Printf("final: available=%d sold=%d sum=%d\\n",
		available.Load(), sold.Load(), available.Load()+sold.Load())
	fmt.Printf("reader saw a broken invariant in %d of %d reads\\n", torn, reads)
	fmt.Println("go vet is clean and -race is silent: there is no data race here.")
}`,
	codeExplanation:
		"Three runs on a stock go1.22 toolchain printed <code>reader saw a broken invariant in 34 of 62606 reads</code>, then 54 of 55988, then 66 of 65551. The count is nondeterministic and the shape never varies: tens of violations per run, and <code>final: available=0 sold=100 sum=100</code> every single time. That combination is the bug's whole personality. The end state is always right, so every test that checks the numbers after the work is done passes forever, and the broken window is only open for the two instructions between <code>available.Add(-1)</code> and <code>sold.Add(1)</code>. It is wide enough. A metrics endpoint scraped during that gap reports a ledger that does not balance, an alert fires on a discrepancy that no longer exists by the time anyone looks, and reordering the two Adds does not help: it just moves the sum from 99 to 101. The last line is the part to sit with. <code>-race</code> genuinely has nothing to say here, and not because the detector is weak: atomics establish happens-before, so there is no unsynchronised pair anywhere in this program. It is a race condition, not a data race, and the tool that finds the second one has never been able to find the first. The fix is not a better atomic. It is to stop having two variables: put both fields in a struct and swap a whole <code>atomic.Pointer[Ledger]</code>, which is what <code>config-watcher</code> does with its config, or take a mutex around both Adds and both Loads.",
	designRationale:
		"The package doc's own first paragraph says these primitives \"require great care to be used correctly\" and that \"except for special, low-level applications, synchronization is better done with channels or the facilities of the sync package\". That is the standard library telling you atomic is not a default, and the reason is the gap above: a mutex makes a region exclusive, an atomic makes an operation indivisible, and most shared state is an invariant rather than a variable. What atomic does give you is spelled out precisely in the memory model: if the effect of atomic operation A is observed by B then A synchronizes before B, and all atomic operations in a program behave as though executed in some sequentially consistent order, which the docs equate to C++'s sequentially consistent atomics and Java's volatile. That is a real ordering guarantee, not a hint, and it is why atomics are a correctness tool and not merely a fast one. The typed API in Go 1.19 exists to close two holes that the free functions could not. The first is alignment: the bugs section still records that on ARM, 386 and 32-bit MIPS it is the caller's responsibility to arrange 64-bit alignment for the primitive functions, which meant <code>atomic.AddInt64(&amp;s.n, 1)</code> could panic at runtime because someone reordered a struct field, on 32-bit only, having passed every test on amd64. <code>atomic.Int64</code> embeds an <code>align64</code> marker so the compiler guarantees it. The second is copying: a plain <code>int64</code> is copyable and nothing notices, while <code>atomic.Int64</code> embeds <code>noCopy</code>, so <code>go vet</code> says <code>Get passes lock by value: Stats contains sync/atomic.Int64 contains sync/atomic.noCopy</code>. Both holes were bugs you could only find in production on a Raspberry Pi. The typed API turns one into a compiler guarantee and the other into a vet error, which is why the free functions' docs now point at it.",
	commonMistakes: [
		{
			title: "Expecting an invariant across two atomics",
			body: "<code>available.Add(-1)</code> then <code>sold.Add(1)</code>: both indivisible, and a reader between them sees a ledger that does not balance. Atomicity does not compose. Two atomic operations are two operations with a gap, and no ordering of them removes the gap. Put the fields in one struct behind an <code>atomic.Pointer[T]</code>, or use a mutex.",
		},
		{
			title: "Check-then-act on an atomic",
			body: "<code>if c.Load() &lt; limit { c.Add(1) }</code> overshoots the limit, because every goroutine that Loads before anyone Adds sees the same under-limit value. Load and Add are each atomic and the decision is not. <code>CompareAndSwap</code> in a retry loop is the atomic version of the whole operation, and it is the only one that holds.",
		},
		{
			title: "Reading a silent -race run as proof the atomics were enough",
			body: "The detector only finds data races, and atomics synchronize by definition, so it is quiet on every ordering bug you can build out of them. Swapping a racy field for an <code>atomic.Bool</code> reliably makes <code>-race</code> go green while leaving the bug exactly as likely: <code>worker-pool</code> step 08 turns on exactly this, where an <code>atomic.Bool</code> stop flag silences the detector and the send-on-closed-channel panic keeps happening.",
		},
		{
			title: "Storing an inconsistent type, or nil, into an atomic.Value",
			body: "A <code>Value</code> takes one concrete type for its whole life: store a <code>Config</code> once and a <code>*Config</code> later and the second store panics with <code>sync/atomic: store of inconsistently typed value into Value</code>. <code>Store(nil)</code> panics too, with <code>store of nil value into Value</code>, and a typed nil <code>(*Config)(nil)</code> does not: it stores happily and hands every reader a nil pointer to dereference somewhere else. <code>atomic.Pointer[T]</code> moves the first of those to compile time.",
		},
		{
			title: "Reaching for atomic because it benchmarked faster",
			body: "It is faster, and <code>config-watcher</code> measures roughly 1.3ns against 15.7ns serial and about 80x under <code>RunParallel</code>, so the number is real. It is also the reason people put a lock-free algorithm where a mutex belonged. The gap only pays on a path that is genuinely hot and genuinely read-dominated with one thing changing. An uncontended mutex costs tens of nanoseconds, which is nothing next to the request it is inside.",
		},
	],
	relatedSlugs: ["sync-mutex", "race-detector", "memory-model", "benchmarks"],
}
