import { Failure } from "../../content"

export const wgAddAfterWait: Failure = {
	slug: "wg-add-after-wait",
	name: "WaitGroup misuse: Add racing Wait",
	category: "Concurrency",
	tagline:
		"With Add inside the spawned goroutines, Wait can read the counter before any of them run, see zero, and wave the whole batch through.",
	symptom:
		"The overnight notification batch \"finishes\" in microseconds and sends almost nothing. The program's own reconciliation says it flat out: <code>dispatched 100 jobs</code>, then <code>completed 0 of 100 jobs (100 unaccounted)</code>, exit 0. Nothing panics, nothing errors; the process is simply gone before the work starts. And the WaitGroup is right there: every worker calls <code>wg.Add(1)</code> as its first act and <code>defer wg.Done()</code> right after, main waits on the group before reconciling, and the counter math reads airtight in review. Wait returns anyway, instantly, with a hundred jobs outstanding.",
	labPath: "labs/failures/wg-add-after-wait",
	runCommand: "go run .",
	tools: [
		"the reconciliation line: completed versus dispatched is the whole bug in one number",
		"go vet, to establish what it checks here, which is not this",
		"the race detector, plus the reason it can come back clean on a program with a real race",
		"go doc sync.WaitGroup.Add, where the rule is stated outright",
	],
	diagnosis: [
		{
			title: "Believe the zero: Wait did exactly what it was told",
			body: "Resist \"Wait is broken\". Its contract is mechanical: block while the counter is above zero, return when it is zero. It returned instantly, therefore the counter it read was zero. That single deduction relocates the whole bug: the question is not why Wait failed to wait, it is why the counter was still zero after 100 jobs were dispatched. So sequence the program. Main spawns the dispatcher goroutine and immediately calls <code>wg.Wait()</code>; every <code>Add(1)</code> lives inside the workers; and no worker has run yet, because creating a goroutine schedules it, it does not start it. Main reaches Wait in nanoseconds while the dispatcher is still waiting for a thread. Counter: zero, legitimately. Wait waved the batch through because, as far as any rule of Go is concerned, there was no batch yet.",
			command: "go run .",
			output: `dispatched 100 jobs
completed 0 of 100 jobs (100 unaccounted)`,
		},
		{
			title: "Ask vet, get silence, and know why",
			body: "First tool off the shelf: <code>go vet ./...</code> prints nothing and exits 0. That is worth understanding rather than shrugging past. Vet's WaitGroup knowledge is the <code>copylocks</code> analysis, which catches a <code>sync.WaitGroup</code> passed by value; whether an <code>Add</code> is ordered before a <code>Wait</code> is a happens-before property of the program's execution, not of its syntax, and no static pass in vet models it. This is the general shape of tool literacy this lab is really about: knowing what a clean report proves. Vet's silence proves the program copies no locks. It says nothing at all about whether the counter means anything when Wait reads it.",
			command: "go vet ./...",
		},
		{
			title: "Ask the race detector, get silence, and know exactly why",
			body: "This is the subtle one. The race detector <em>can</em> name this misuse, but only if the racing pair actually executes: internally, Wait publishes a race-detector annotation only when it parks as a waiter, and a zero-to-one <code>Add</code> reads that annotation. In this program Wait wins by such a margin (nanoseconds against a goroutine wakeup) that it returns through its counter-is-zero fast path, never parks, and the racing pair never runs. Nothing executed, nothing to report: same telemetry, no warning, exit 0. While building this lab we verified the flip side: move the fan-out loop directly into main, so workers start Add-ing while main is still spawning, and <code>go run -race .</code> then prints <code>WARNING: DATA RACE</code> pointing at the <code>wg.Add(1)</code> line and the <code>wg.Wait()</code> line, while the batch, slowed by the detector, completes 100 of 100 with the symptom gone. Run that experiment yourself. The lesson generalizes to every concurrency bug you will ever chase: <strong>-race reports interleavings that happened in this run, not interleavings your program permits</strong>. A clean -race run is evidence, never acquittal.",
			command: "go run -race .",
			output: `dispatched 100 jobs
completed 0 of 100 jobs (100 unaccounted)`,
		},
		{
			title: "Read the rule, then the mechanism under it",
			body: "The first paragraph of the note is the law this program breaks: a positive-delta Add that takes the counter from zero must <em>happen before</em> Wait starts, and \"typically\" means Add goes in front of the <code>go</code> statement, on the goroutine that will Wait (or one sequenced before it). The mechanism under the law: <code>go dispatch(orders, &amp;wg)</code> creates a goroutine but promises nothing about when it runs, so every Add in that subtree is concurrent with main's Wait, and concurrent means Wait may legally read the counter from before all of them. Note that this program even puts <code>Add(1)</code> textually inside each worker \"as its first act\", which sounds disciplined and orders nothing. And the same trap has a second layer here: hoisting <code>Add(1)</code> above the inner <code>go</code> but leaving the dispatch loop in a background goroutine still breaks the rule, because now the dispatcher itself races Wait. The rule was never \"Add above go in the source\". It is \"Add happens-before Wait starts\".",
			command: "go doc sync.WaitGroup.Add",
			output: `    Note that calls with a positive delta that occur when the counter is
    zero must happen before a Wait. Calls with a negative delta, or calls
    with a positive delta that start when the counter is greater than zero,
    may happen at any time. Typically this means the calls to Add should execute
    before the statement creating the goroutine or other event to be waited for.`,
		},
	],
	fix: "Restore the ordering at both levels: <code>wg.Add(1)</code> moves out of the worker to just before its <code>go</code> statement, and the dispatch loop moves back onto main so those Adds are themselves sequenced before <code>wg.Wait()</code>. One rule, applied twice; by the time Wait runs, the counter already holds the whole batch, and when a batch is all-or-nothing you can say the same thing in one call with <code>wg.Add(len(orders))</code> above the loop. (Go 1.25 later packaged this discipline as <code>wg.Go</code>, which is exactly Add-before-spawn under the hood.) The tempting non-fix is a sleep before Wait, \"to give the workers time to register\": that does not restore ordering, it narrows the window and ships the race to the one loaded machine where the window reopens; a Wait retried in a loop is the same bet with extra steps. Ordering, not delay, is what the contract wants. Prove it: <code>go run -tags fixed .</code> reports <code>completed 100 of 100 jobs (0 unaccounted)</code>, every run.",
	production:
		"In production this bug is a shapeshifter, because which interleaving you get depends on the machine. On the busy eight-core CI box the workers get scheduled early, Wait catches a live counter, and everything completes: green for months. On the two-vCPU runner at 3am, main wins, the batch \"finishes\" instantly, and the output is quietly truncated, sometimes, which is the worst word in debugging. This is the anatomy behind exports that arrive incomplete and get blamed on the object store, notification batches that sent 7 of 900 emails once and never again while anyone was watching, migration runners that reported done before migrating. The family also has a louder sibling: in the interleaving where Wait does park and a straggler's zero-to-one Add lands at the wrong instant, the runtime itself panics with <code>sync: WaitGroup misuse: Add called concurrently with Wait</code>, a crash that reads like a runtime bug and is actually your line number. The review heuristic that catches the whole family: point at the Wait, then at every Add, and say out loud which statement orders that Add before it. If the answer leans on the scheduler (\"the goroutine will have started by then\"), you are holding this lab.",
	scar: "Wait can only see Adds that happen-before it starts: Add goes in front of the go statement, never inside it.",
	relatedSlugs: [
		"sync-waitgroup",
		"goroutines",
		"memory-model",
		"race-detector",
	],
	unlockTier: 2,
}
