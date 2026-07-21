import { Failure } from "../../content"

export const timeAfterLeak: Failure = {
	slug: "time-after-leak",
	name: "Timer leak: time.After in a hot loop",
	category: "Concurrency",
	tagline:
		"Every pass through the select arms a fresh one-hour timer nothing can stop, and whether the GC may rescue you is decided by the go directive in go.mod, not by your toolchain.",
	symptom:
		"An event-drain loop's memory grows with every burst it processes and never returns to baseline. Cut down to a minimal reproduction (drain 200,000 already-queued events, keep nothing, force a GC, measure), it still holds fifty megabytes: <code>heap retained 50.9 MB after GC</code>, exit 0, every run. The loop stores no slice, no map, nothing across iterations, yet a heap profile blames timers the code never keeps. The report's most confusing line is also its best clue: a sister service with the same loop shape does not leak, and the only defensible diff between the two projects is their go.mod files.",
	labPath: "labs/failures/time-after-leak",
	runCommand: "go run .",
	tools: [
		"runtime.MemStats around a forced GC: proof the memory is reachable, not merely uncollected",
		"reading the select: count what each iteration allocates and ask who can still reach it",
		"the Go 1.23 release notes and GODEBUG=asynctimerchan: this leak has a version number",
	],
	diagnosis: [
		{
			title: "Prove retention, then stop blaming the GC",
			body: "The lab measures <code>HeapAlloc</code> after a forced <code>runtime.GC()</code> on both sides of the loop, and the delta is the whole diagnosis: memory that survives a forced collection is reachable memory, full stop. The GC is not lazy, behind, or confused; something can still get to those bytes. Your own code keeps nothing, so inventory what else in a Go process can hold a reference: package-level variables (none here), other goroutines' stacks (none), finalizers (none), and the runtime's own bookkeeping. That last one is the unfamiliar suspect, and the arithmetic points straight at it: 50.9 MB across 200,000 iterations is about 267 bytes per pass, a suspiciously per-iteration number for a loop that allocates \"nothing.\"",
			command: "go run .",
			output: `drained 200000 events
heap retained 50.9 MB after GC`,
		},
		{
			title: "Count what one select pass creates",
			body: "A select evaluates every arm's channel expression before it chooses a winner. <code>&lt;-queue</code> costs nothing, but <code>time.After(time.Hour)</code> is a function call, and it runs on every iteration whether or not its case fires. Each call makes a new timer and a new channel and registers the timer in the runtime's timer heap, scheduled for one hour out. The runtime must hold a reference until delivery: it made a promise. And <code>time.After</code> returns only the channel, so there is nothing for you to <code>Stop()</code>, ever. Two hundred thousand passes, two hundred thousand pending one-hour timers the GC is obligated to respect. The old documentation said this in one dry clause (\"the underlying Timer is not recovered by the garbage collector until the timer fires\"), and even setting memory aside, the loop paid 200,000 allocations plus heap maintenance for timeouts that never happened.",
		},
		{
			title: "Explain the sister service: the go directive gates the new timers",
			body: "Go 1.23 rewrote timers: unstopped, unreferenced timers became garbage-collectable, timer channels became unbuffered, and <code>time.After</code> in a loop stopped being a leak. But the rewrite is gated on the module's <code>go</code> directive, not the toolchain, for compatibility. The output above is this lab's exact <code>main.go</code>, on this same go1.23 toolchain, after one edit: <code>go.mod</code> says <code>go 1.23</code> instead of <code>go 1.22</code>, and 50.9 MB becomes 0.0. That is the sister service explained: same code, same binary toolchain, different directive, opposite behavior. It is also why this lab's go.mod pins <code>go 1.22</code> with a comment saying the pin is the lesson, and it is a genuinely rare thing worth savoring: a memory leak whose minimal fix is one line in go.mod.",
			command: "go run .   # same main.go, go.mod edited to say: go 1.23",
			output: `drained 200000 events
heap retained 0.0 MB after GC`,
		},
		{
			title: "GODEBUG=asynctimerchan=1 is the escape hatch, and a diagnostic",
			body: "The old timer behavior stays available behind a GODEBUG flag even on a bumped module: this run kept the <code>go 1.23</code> directive and got the leak back on demand. That is Go's standard mechanism for behavior changes: the directive opts you in, the GODEBUG opts you back out at runtime, no rebuild of your reasoning required. Use it in both directions. If memory mysteriously improves or regresses after touching go.mod, one run with this flag tells you whether timers are the moving part. And if a directive bump ever breaks timing-sensitive code (the 1.23 rewrite also changed timer channel semantics: <code>len</code> and <code>cap</code> of a timer channel are now 0, and stale-value patterns around Reset behave differently), the flag is the emergency revert while you fix the code properly. The time concept page runs this same before-and-after measurement if you want the concept-first walk.",
			command: "GODEBUG=asynctimerchan=1 go run .   # still with go 1.23 in go.mod",
			output: `drained 200000 events
heap retained 50.8 MB after GC`,
		},
	],
	fix: "There are two real fixes, and knowing which one you are reaching for is the lesson. The code fix, which works on every Go version, is what <code>fixed.go</code> does: hoist one <code>time.NewTimer(time.Hour)</code> out of the loop, <code>watchdog.Reset(time.Hour)</code> at the top of each pass, select on <code>watchdog.C</code>, and <code>defer watchdog.Stop()</code>. One timer for the whole loop, one allocation total, and the runtime holds a reference to exactly one thing you also hold. (The old-timer rules about draining before Reset do not bite here: a one-hour timer re-armed every microsecond never gets within a country mile of firing.) This is the fix when you do not control the module: library code has to assume it may be compiled into a <code>go 1.21</code> module until the ecosystem moves. The real-world resolution for code you own is the directive bump: set <code>go 1.23</code> or later in go.mod, test, and <code>time.After</code> in a loop simply stops leaking, demoting the hoisted-timer pattern from correctness fix to micro-optimization. Note that the bump is a semantic change, not a formality (timer channel behavior shifts with it), and that upgrading your toolchain does nothing by itself: the directive does not bump itself. The tempting non-fix is shrinking the timeout, <code>time.After(time.Second)</code> instead of an hour, so timers expire and free themselves faster. That converts unbounded retention into a rolling window, changes your actual timeout semantics to do it, and still pays an allocation per pass: it manages the number while mistaking it for the cause. Prove the code fix on this still-pinned module: <code>go run -tags fixed .</code> prints <code>drained 200000 events</code> and <code>heap retained 0.0 MB after GC</code>, same go 1.22 directive, no leak.",
	production:
		"The canonical victim is a message gateway doing a per-message read with <code>select { case m := &lt;-ch: ... case &lt;-time.After(30 * time.Second): ... }</code>. At 5,000 messages a second, pending timers reach steady state at rate times window: 150,000 live timers, several hundred megabytes of heap plus the GC churn of allocating 5,000 of them every second. The graphs show the classic shape: memory sawtooths with traffic but each valley is higher than the last, until the container is OOMKilled at peak, which is the one moment the service cannot afford it. The heap profile points at <code>time.After</code>, which half the team reads as \"allocation happens, profiles say so\" until someone notices it is inuse_space, not alloc_space, that keeps growing. Then the twist this lab exists for: the team upgrades to the Go 1.23 toolchain, because the timer fix made every newsletter, deploys, and nothing changes, because go.mod still says <code>go 1.21</code>. The audit that actually closes the incident is cheap: grep the fleet for <code>time.After</code> inside loops and selects, check each module's go directive, bump the ones you own, and hoist a Reset timer (or use <code>context.WithTimeout</code>) in the hot paths that must keep old pins.",
	scar: "time.After hands the runtime an unstoppable timer on every call, and in a loop that is a leak or not depending on the go directive in go.mod, never on the toolchain that built it.",
	relatedSlugs: [
		"time",
		"select",
		"modules",
		"gc-tuning",
	],
	unlockTier: 2,
}
