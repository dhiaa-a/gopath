import { Concept } from "../../content"

export const raceDetector: Concept = {
	slug: "race-detector",
	name: "The race detector",
	tagline: "A green test run is not evidence. -race is.",
	summary:
		"<code>go test -race</code> rebuilds your program with ThreadSanitizer, which watches memory accesses as they happen and reports any two that touch the same location with no ordering between them when at least one is a write. It is the only practical way to find data races, because a racy Go program usually works. It is a dynamic tool: it sees the interleavings that actually occurred, so it finds the races you ran, not the races you have.",
	mentalModel:
		"The detector is not a proofreader, it is a flight recorder. It does not reason about what your program could do; it watches what it actually did and flags any two accesses to the same memory that nothing ordered. So a clean run is not a certificate. It means the detector never saw the bad pair, and there are three reasons for that: the pair cannot happen, or your test never took that path, or the scheduler simply did not go that way this afternoon. Only the first one is good news, and the run cannot tell you which you got.",
	retrievalPrompts: [
		"You take the mutex off a shared map and go test passes twenty-seven times out of thirty. What did those twenty-seven runs prove? || Nothing about correctness. Without synchronisation there is no happens-before edge between those goroutines, so a green run means the scheduler did not interleave the bad pair this time. The three failures were not the detector either: they were the runtime's own map guard, a best-effort smoke alarm that is always on and only watches maps. -race is what turns a coin flip into a report, and it needs cgo.",
		"You run the full suite with -race and it reports nothing. What have you actually learned? || That the detector observed no racing pair on the paths you exercised. It is dynamic, so it only sees interleavings that really happened: a race in a code path the suite never runs, or one that needs an ordering the scheduler did not produce, is invisible to it. Zero reports is a statement about your test coverage as much as about your code, which is why the suites that matter drive their requests from concurrent goroutines rather than in a loop.",
		"A racy int counter and a racy map. Why is only one of them a memory-safety problem? || The memory model requires a read of a word-sized location to observe some value actually written, and forbids out-of-thin-air values, so the racy int gives you a wrong count and nothing worse. It only encourages, and does not require, the same for larger values: implementations may treat them as several machine-word operations in an unspecified order. So a map, slice, string, or interface can be seen with a mismatched pointer and length, which the memory model says can lead to arbitrary memory corruption.",
	],
	codeExample: `package main

import (
	"fmt"
	"sync"
)

func main() {
	count := 0
	var wg sync.WaitGroup

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// count++ is not one operation. It is a load, an add, and a
			// store, and nothing orders those three against the other 999
			// goroutines doing the same thing to the same location.
			count++
		}()
	}
	wg.Wait()

	// go build is clean. go vet is clean. Neither of them runs your program,
	// and a race is a property of an execution.
	//
	// Twenty runs of this on a stock go1.22 toolchain printed seventeen
	// different answers between 919 and 994. Never 1000, and never a crash.
	//
	// Run it as: go run -race .
	// One report, every time, naming both accesses, both stacks, and the
	// line each goroutine was created on.
	fmt.Println(count)
}`,
	codeExplanation:
		"<code>count++</code> compiles to a load, an add, and a store. Two goroutines that both load 41 before either stores will both store 42, and one increment is gone; that is the whole mechanism, and it is why the total drifts down rather than up. Nothing catches it at build time, because a race is a property of an execution and neither the compiler nor <code>go vet</code> runs your program. The flag is the tool: <code>go run -race .</code>, <code>go test -race ./...</code>, <code>go build -race</code>. A report leads with <code>WARNING: DATA RACE</code>, then gives the two conflicting accesses with the goroutine that made each and its stack, and then the stack where each of those goroutines was created, which is usually the line that tells you what to fix. The fixes are the usual three: a <code>sync.Mutex</code>, a <code>sync/atomic</code> operation, or giving one goroutine ownership of the value and sending it increments over a channel.",
	designRationale:
		"Go shipped goroutines as a headline feature, so it also had to ship the tool for the bug class goroutines create, and in 2013 it did. The detector is dynamic rather than static because deciding whether an arbitrary program contains a data race is undecidable in general, and static approximations of it produce enough false alarms that people stop reading them. ThreadSanitizer instead tracks happens-before information at run time and only reports pairs it actually observed to be unordered. That trade is the entire design, and it cuts both ways: the reports you get are about real executions and worth acting on, and the races you never execute are invisible. The price is what you would expect from instrumenting every memory access: the Go docs put it at 5 to 10 times the memory and 2 to 20 times the execution time, which is why <code>-race</code> is a test and CI flag rather than a production build. It is built on ThreadSanitizer and therefore needs cgo and a C toolchain, so on Windows it wants an installed gcc, and without one <code>go test -race</code> refuses to build at all rather than quietly running unwatched. Supported platforms are listed in the docs and cover linux, darwin and windows on amd64, plus arm64 on linux and darwin, among others.",
	commonMistakes: [
		{
			title: "Reading a green -race run as \"no races\"",
			body: "It means no racing pair was observed on the paths that ran. The detector cannot see a race in code your test never executes, or one that needs a scheduling order that did not happen. Absence of a report is not absence of a race, and the gap between those two is where the 3am pages live.",
		},
		{
			title: "Running -race against a suite with no concurrency",
			body: "The detector needs the bad interleaving to actually occur before it can report it. A suite that drives every case sequentially gives it nothing to watch, and passes with the flag on while proving nothing about the concurrent path. Tests aimed at shared state should deliver their work from concurrent goroutines on purpose.",
		},
		{
			title: "Mistaking the runtime's map guard for the detector",
			body: "<code>fatal error: concurrent map writes</code> comes from Go's map implementation, which sets a flag on entry and throws if it is already set. It is always on, needs no cgo, is best-effort, and only watches maps. It is a smoke alarm that fires when the fire reaches it, not a detector, and it catches only a fraction of the runs.",
		},
		{
			title: "Shipping -race to production",
			body: "5 to 10 times the memory and 2 to 20 times the execution time, per the Go docs, plus an extra 8 bytes per <code>defer</code> and <code>recover</code> that is not reclaimed until the goroutine exits. It belongs in CI and in the suites you run before merging. A canary build with the flag on is a real technique, but it is a deliberate capacity decision, not a default.",
		},
		{
			title: "Assuming a race is harmless because it is \"just an int\"",
			body: "A racy word-sized value gives you a wrong number, which the memory model does bound: the read must observe some value actually written. Anything larger has no such guarantee. Interfaces, maps, slices and strings are pointer-and-length or pointer-and-type pairs, and a torn pair is not a wrong value, it is arbitrary memory corruption.",
		},
	],
	relatedSlugs: ["sync-mutex", "goroutines", "maps", "channels"],
}
