import { Failure } from "../../content"

export const dataRace: Failure = {
	slug: "data-race",
	name: "Data race: the counter that loses",
	category: "Concurrency",
	tagline:
		"Eight goroutines increment one shared integer, the program exits 0, and the total is wrong by a different amount every run.",
	symptom:
		"A page-hit counter fans out to eight workers, each incrementing a shared <code>hits</code> variable 125,000 times, with a WaitGroup holding the report until every worker is done. One run prints <code>counted 402183 of 1000000 hits</code>, the next prints <code>counted 333704</code>, exit code 0 both times. No crash, no error, no log line: reconciliation against an external source is the only reason anyone noticed. Worst of all, on a fast, idle machine a run can come out exactly right, so the first person to investigate closed the ticket as an infrastructure flake.",
	labPath: "labs/failures/data-race",
	runCommand: "go run .",
	tools: [
		"go run, twice: a total that moves between identical runs is already a diagnosis",
		"go run -race: the race detector, the tool that turns \"probably fine\" into proof",
		"the race report's two stacks: the pair of conflicting accesses, plus where each goroutine was born",
	],
	diagnosis: [
		{
			title: "Run it twice; the variance is the evidence",
			body: "Same binary, same input, different answer: the only thing that differs between two runs is how the scheduler interleaved the goroutines, so the result depends on scheduling, and a result that depends on scheduling is a concurrency bug by definition. Six consecutive runs on the lab machine lost between 59% and 67% of all hits, a different amount each time. Do not lean on losses being that dramatic, though: with fewer cores or lighter contention the same bug can lose 0.01%, or nothing at all for a week. The exit code deserves a beat of respect too: this program corrupts its own arithmetic and then exits 0. Nothing in the runtime is obligated to notice.",
			command: "go run .",
			output: `counted 402183 of 1000000 hits
lost: 597817`,
		},
		{
			title: "Read hits++ the way the machine runs it",
			body: "<code>hits++</code> is one token in Go and three operations in hardware: load <code>hits</code> from memory, add one, store it back. Two goroutines can both load 41, both compute 42, and both store 42: two increments happened, the counter moved by one. Under eight goroutines hammering the same address, those windows overlap constantly, which is how a majority of a million increments simply vanished. The memory model makes it worse than interleaving: with no synchronization, the compiler and CPU are allowed to reorder and cache accesses however they like (nothing forbids keeping the counter in a register across iterations), so an unsynchronized program does not even get the \"some sensible interleaving\" guarantee the mental model assumes. Racy programs are not slightly wrong; they are outside the language's promises entirely.",
		},
		{
			title: "Ask the race detector for proof",
			body: "<code>-race</code> rebuilds the program with every memory access instrumented and every synchronization edge tracked. The report is two stacks: the access that just happened (<code>Read at 0x...</code>) and the earlier conflicting access to the same address (<code>Previous write at 0x...</code>), with no happens-before edge between them. Both stacks end at <code>main.go:29</code>, which is <code>hits++</code> racing against itself: the load half of one increment against the store half of another. Below each stack, <code>created at</code> names the <code>go</code> statement that spawned each goroutine, which is how you find the culprits in a real program with fifty goroutine types. It found 2 races because <code>++</code> has two halves: a read/write pair and a write/write pair. The process then exits with status 66, the detector's signature exit code, so CI cannot miss it.",
			command: "go run -race .",
			output: `==================
WARNING: DATA RACE
Read at 0x00c00008e118 by goroutine 13:
  main.main.func1()
      .../labs/failures/data-race/main.go:29 +0x99

Previous write at 0x00c00008e118 by goroutine 7:
  main.main.func1()
      .../labs/failures/data-race/main.go:29 +0xab

Goroutine 13 (running) created at:
  main.main()
      .../labs/failures/data-race/main.go:26 +0x99

Goroutine 7 (running) created at:
  main.main()
      .../labs/failures/data-race/main.go:26 +0x99
==================
[second DATA RACE report trimmed: the write/write pair, same line]
counted 694709 of 1000000 hits
lost: 305291
Found 2 data race(s)
exit status 66`,
		},
		{
			title: "Know what the detector proved, and what it did not",
			body: "A warning is never a false alarm: every report is a pair of unsynchronized accesses that really executed. But the converse does not hold, because <code>-race</code> is dynamic: it only sees races that actually run while instrumented. A racy branch behind a feature flag that your tests never enable stays invisible, and a clean run proves nothing about paths not taken. This lab trips it on every run (eight runs out of eight on the lab machine) only because a million overlapping accesses give the detector endless chances; a race that executes once at startup is caught far less kindly. The working discipline: run the full test suite under <code>-race</code> in CI, every commit. It costs roughly 5 to 10x in CPU and memory, which is why it is a CI setting and not a production default, and it is the single highest-value flag in concurrent Go.",
		},
	],
	fix: "Make the increment indivisible. The fixed variant declares the counter as <code>atomic.Int64</code> and workers call <code>hits.Add(1)</code>: one uninterruptible hardware operation, no load/store window to fall into, and the WaitGroup still provides the happens-before edge that makes the final <code>hits.Load()</code> safe to print. For a bare counter, atomic is the right size of tool. A <code>sync.Mutex</code> around the increment is also correct, and becomes the necessary tool the moment the protected state grows past a single number or two values must change together; the concept pages on atomic and sync-mutex draw that line in detail. The tempting non-fix is the word-size superstition: \"int64 writes are atomic on amd64 anyway, so it is fine.\" Torn writes were never the failure. The race is the read-modify-write window, and no data type fixes a three-step sequence; beyond that, the memory model voids all visibility guarantees for unsynchronized access no matter the width. Lowering GOMAXPROCS or shrinking the worker count until the numbers look right is the same non-fix wearing a different hat. Prove the real fix: <code>go run -tags fixed .</code> prints <code>counted 1000000 of 1000000 hits, lost: 0</code>, and <code>go run -race -tags fixed .</code> prints the same with no warnings and exit 0. Determinism plus a silent detector is the full receipt.",
	production:
		"The production version of this bug does not lose 60%; it loses 0.3%, and only above a traffic threshold your load tests never reach. A metering counter undercounts under peak concurrency, the usage invoices go out slightly low, and no customer files a ticket about being undercharged, so it runs for two quarters until a reconciliation audit finds the books off by a number nobody can explain. The postmortem then finds the second wound: someone had run <code>-race</code> locally months earlier and seen nothing, because on a half-idle laptop with the concurrent path barely exercised, the race never executed while instrumented. Integer races are the cruelest class of race: maps at least have a runtime throw that crashes you honestly, but an int corrupts in silence and the symptom surfaces two systems away, denominated in money or metrics instead of stack traces. Severity scales with traffic, so the bug is weakest exactly where engineers look for it and strongest where they cannot. Treat any unexplained nondeterminism in numbers as a race until proven otherwise, and put <code>-race</code> in CI where a laptop's mood cannot vote.",
	scar: "x++ is a read, an add, and a write, and the scheduler owes you nothing between them.",
	relatedSlugs: [
		"race-detector",
		"atomic",
		"sync-mutex",
		"memory-model",
	],
	unlockTier: 2,
}
