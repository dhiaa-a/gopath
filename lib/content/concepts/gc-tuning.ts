import { Concept } from "../../content"

export const gcTuning: Concept = {
	slug: "gc-tuning",
	name: "GC tuning: GOGC and GOMEMLIMIT",
	tagline:
		"Lower GOGC spends CPU to save memory, and GOMEMLIMIT is a soft ceiling: it makes the collector try harder, it does not refuse to allocate.",
	summary:
		"The garbage collector has one job with one trade behind it: spend CPU to reclaim memory, and spend less CPU if you can afford to hold more memory. <code>GOGC</code> sets that trade as a growth ratio. The default <code>100</code> lets the heap grow to twice the live set between collections; halving it to <code>50</code> collects roughly twice as often for roughly half the headroom. <code>GOMEMLIMIT</code> (Go 1.19+) is the other knob, a soft ceiling in bytes that makes the collector run harder as the heap approaches it. Both ship with sound defaults (<code>GOGC=100</code>, <code>GOMEMLIMIT=off</code>), and the honest reason to touch either is a profile showing you spend too much CPU collecting or run too close to an out-of-memory kill, never a hunch.",
	mentalModel:
		"Picture a single axis with CPU at one end and memory at the other, and the collector sitting somewhere on it. Every automatic collection costs CPU to find and free garbage, and the payment buys back memory. <code>GOGC</code> is where you sit on that axis, expressed as how far the heap may grow past the live set before the next collection fires: at <code>100</code> the collector waits until the heap doubles, at <code>10</code> it fires after ten percent of growth, ten times as often, for a tenth of the headroom. Nothing here makes your program faster in the sense you usually mean; it moves work between two resources. <code>GOMEMLIMIT</code> is not a third position on the axis, it is a wall near the memory end: as the heap approaches it the collector abandons its normal pacing and runs as hard as it must to stay under, trading away as much CPU as that takes. The trap in both is thinking the knob is the lever. The lever is almost always allocating less, which moves the whole axis at once, and you find it with a profile, not a setting.",
	retrievalPrompts: [
		"You drop GOGC from 100 to 10 to shrink a service's peak heap, and it works. What did you spend to get it, and where does that spend show up in a profile? || Memory came down and you paid for it in CPU, because trading those two is the only thing GOGC ever does. A lower ratio means more frequent collection: the example collects about eight times as often at 10 as at 100 for identical garbage. That extra CPU is not billed to the code that allocated, it lands on the collector's own worker goroutines (runtime.gcBgMarkWorker), which is why the change looks free in your functions and shows up as GC time in a profile. If the service was memory-bound, good trade. If it was CPU-bound, you just made it worse.",
		"You set GOMEMLIMIT to your container's memory limit to stop the OOM kills, and under a real spike the process is OOM-killed anyway. Why did the limit not hold? || Because GOMEMLIMIT is soft. It makes the collector run harder as the heap nears the ceiling, but the runtime caps GC at 50% of CPU so a struggling program still makes progress, and it never refuses an allocation. If the live set genuinely exceeds the limit the collector cannot reclaim memory that is still reachable, so the heap crosses the line and the kernel kills you. A soft limit changes how hard the GC tries, not whether allocation can fail. Set it below the container budget with headroom, and pair it with a real fix for the growth.",
		"Your GOGC change halved HeapAlloc but the RSS your orchestrator alerts on barely moved. Is the tuning doing anything? || Yes, on a number you are not watching. HeapAlloc is live Go heap objects; RSS is every page the OS holds resident for you, including heap the runtime freed but has not returned, goroutine stacks, and the binary itself. The runtime hands freed pages back lazily and the OS reclaims them only under pressure, so RSS lags a collection and can stay high long after the heap shrank. GOGC moves the heap; RSS is a different quantity on a different clock. Tune against the heap to reason about GC, watch RSS for the OOM budget, and do not expect one to track the other.",
	],
	codeExample: `package main

import (
	"fmt"
	"runtime"
	"runtime/debug"
)

// live is a fixed working set the program keeps reachable for its whole run.
// The GC's trigger is computed from the size of the live heap, so pinning it
// makes the pacing predictable: with GOGC=g the next collection is aimed at
// roughly live*(1 + g/100).
var live [][]byte

// churn allocates transient garbage. Each make is unreachable the instant the
// next one runs, so with the collector on it is reclaimed and the live heap
// barely moves; with the collector off it is never reclaimed and the heap
// grows by the full total.
func churn(rounds, size int) {
	var b []byte
	for i := 0; i < rounds; i++ {
		b = make([]byte, size)
	}
	runtime.KeepAlive(b)
}

func numGC() uint32 {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return ms.NumGC
}

func heapMB() float64 {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return float64(ms.HeapAlloc) / (1 << 20)
}

func run(label string, pct, rounds, size int) {
	debug.SetGCPercent(100)
	runtime.GC() // free previous run's garbage: clean baseline
	debug.SetGCPercent(pct)
	before := numGC()
	churn(rounds, size)
	collections := numGC() - before
	if pct < 0 {
		// With the collector off nothing is reclaimed, so the transient
		// garbage is still on the heap. That number is the stable one.
		fmt.Printf("%-9s %4d automatic collections  (heap ballooned to %.1f MB and stayed)\\n",
			label, collections, heapMB())
		return
	}
	fmt.Printf("%-9s %4d automatic collections\\n", label, collections)
}

func main() {
	// Pin an 8 MB working set for the whole run.
	live = make([][]byte, 8)
	for i := range live {
		live[i] = make([]byte, 1<<20)
	}

	const rounds, size = 20000, 4096 // ~78 MB of transient garbage per run

	run("GOGC=off", -1, rounds, size)  // disabled: nothing is ever reclaimed
	run("GOGC=100", 100, rounds, size) // default: collect when the heap doubles
	run("GOGC=10", 10, rounds, size)   // aggressive: collect at +10%, far more often
}`,
	codeExplanation:
		"A representative run prints three lines. <code>GOGC=off</code> reports <code>0 automatic collections</code> and a heap that <code>ballooned to 86.2 MB and stayed</code>; <code>GOGC=100</code> reports <code>8</code>; <code>GOGC=10</code> reports <code>63</code>. Read them as one sentence about a single trade. With the collector off (<code>debug.SetGCPercent(-1)</code>, the programmatic <code>GOGC=off</code>) nothing unreachable is ever reclaimed, so all of the roughly 78 MB of transient garbage plus the 8 MB working set sits on the heap for good: zero collections, 86.2 MB. Turn the collector on at the default <code>100</code> and it fires a handful of times, holding the heap near the live set. Drop it to <code>10</code> and it fires about eight times as often on the identical garbage. That is the whole knob: <code>GOGC</code> buys memory with CPU and does nothing else. The two nonzero counts wobble by a few between runs (across five runs I saw 6 to 8 at <code>100</code> and 60 to 66 at <code>10</code>) because the pacer adapts each cycle, but the direction never moves: off is exactly 0, and <code>10</code> always collects roughly eight times as often as <code>100</code>. The CPU those extra collections cost is not charged to this loop; it lands on the collector's worker goroutines, which is why a GOGC change that looks free here surfaces as GC time in a profile rather than in your functions. <code>GOMEMLIMIT</code> has a programmatic twin too, <code>debug.SetMemoryLimit</code>, left out of the run because its effect (running the GC harder as the heap nears a ceiling) needs sustained pressure to observe and does not reduce to one stable number.",
	designRationale:
		"The default <code>GOGC=100</code> is a deliberate middle of the axis: collect once the heap has doubled, which for most programs keeps GC CPU in the low single digits of percent while holding not much more than twice the live set. It is a ratio rather than an absolute byte count because the runtime cannot know your live set in advance, and a ratio is scale free: the same <code>100</code> is sensible whether the live heap is 8 MB or 8 GB. For most of Go's life that ratio was the only knob, and it has a blind spot. In a container with a fixed memory budget, a workload whose live set spikes can cross the budget before the ratio triggers a collection, and the only defense with <code>GOGC</code> alone was to set it low permanently, paying steady-state CPU to survive a rare spike. Go 1.19 added <code>GOMEMLIMIT</code> for exactly that shape: keep <code>GOGC</code> high and cheap for the common case, and set a soft byte ceiling that makes the collector run harder as the heap approaches it. The word soft is load bearing. A hard limit would have to refuse an allocation, and Go does not fail allocations, so the limit spends CPU instead: as the heap nears the ceiling the pacer collects more and more aggressively, up to a cap the runtime enforces of 50% of CPU time, reserved so that a program that cannot fit still makes progress rather than freezing in a collection death spiral. The consequence is the property people trip on: under genuine pressure the GC hits that CPU ceiling, the heap crosses the limit anyway, and the process is OOM-killed. Both knobs are opt-in because a wrong value is worse than the default. Too low a <code>GOGC</code> wastes CPU, too low a <code>GOMEMLIMIT</code> invites the death spiral, and the runtime would rather ship a default that is merely good than a guess that is occasionally terrible.",
	commonMistakes: [
		{
			title: "Reaching for GOGC without a profile",
			body: "<code>GOGC</code> moves the CPU-memory trade and nothing else, so tuning it before you know which resource you are short on is a coin flip. Turning it down to \"reduce memory\" on a service that was actually CPU-bound makes the collector run more often and steals the CPU you needed; turning it up to \"reduce GC CPU\" on a memory-bound service invites the OOM kill. The default is tuned for the common case. Measure first: <code>GODEBUG=gctrace=1</code> prints collection frequency and pause times to stderr, and an allocation profile shows where the garbage is born.",
		},
		{
			title: "Treating GOMEMLIMIT as a hard cap",
			body: "It is soft by design. It intensifies collection near the ceiling but never refuses an allocation, and the runtime holds GC to 50% of CPU so a program that cannot fit keeps running rather than freezing, which means under real pressure the heap crosses the limit and you are OOM-killed anyway. It shaves the odds of an OOM from a transient spike; it does nothing about a genuine leak, and set at or above the container limit it is useless. Put it below the budget, leave headroom for stacks and non-heap memory, and keep <code>GOGC</code> on underneath it.",
		},
		{
			title: "Disabling the collector and forgetting you own the memory",
			body: "<code>GOGC=off</code> (or <code>debug.SetGCPercent(-1)</code>) stops automatic collection completely, so nothing unreachable is ever reclaimed: the example's off run holds all 78 MB of dead garbage forever. It is a legitimate trick for a short batch job that exits before it matters, and a slow memory leak in anything long-lived. If you turn the collector off you have taken over its job, so bound the work or force collection yourself at a safe point with <code>runtime.GC</code> or <code>debug.FreeOSMemory</code>.",
		},
		{
			title: "Confusing heap size with RSS",
			body: "<code>HeapAlloc</code> and the GC's target are the Go heap; RSS is resident OS memory, which also includes freed pages the runtime has not returned, every goroutine's stack, and the binary. Because the runtime returns memory lazily and the OS reclaims lazily, RSS lags the heap and stays high after a collection. Tuning <code>GOGC</code> to hit an RSS number chases a value the knob does not directly set, so you over-tune and still miss. Watch the heap to reason about GC, watch RSS for the OOM budget, and know they move on different clocks.",
		},
		{
			title: "Tuning the collector when the fix is fewer allocations",
			body: "<code>GOGC</code> and <code>GOMEMLIMIT</code> move work along the CPU-memory axis, but the amount of garbage you generate sets where both ends of that axis sit. If the collector is burning 30% of your CPU, no ratio removes that work, it only changes when it happens; the lever that moves the whole axis is allocating less. Reuse buffers, size slices with <code>make</code>, keep values from escaping to the heap (see escape analysis), reach for <code>sync.Pool</code> on a proven hot path. Tune the knobs to fine-tune a trade you have already measured, cut allocations to actually win.",
		},
	],
	relatedSlugs: ["escape-analysis", "pprof", "benchmarks", "scheduler"],
}
