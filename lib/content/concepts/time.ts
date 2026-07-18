import { Concept } from "../../content"

export const time: Concept = {
	slug: "time",
	name: "Time, timers, and tickers",
	tagline:
		"Duration is an int64 of nanoseconds, so time.Sleep(1) sleeps 1ns, and whether time.After leaks is decided by your go.mod.",
	summary:
		"<code>time.Duration</code> is not an opaque type, it is an <code>int64</code> counting nanoseconds, which is why <code>time.Sleep(1)</code> compiles and sleeps for one nanosecond. A <code>time.Time</code> is not one clock but two: a wall clock you can format and a monotonic reading you cannot see, which is why <code>time.Since</code> stays correct across an NTP correction and why <code>==</code> on two Times is a trap. And the most famous leak in Go, <code>time.After</code> in a select loop, was fixed in Go 1.23, but only for programs whose <code>go.mod</code> says so.",
	mentalModel:
		"Hold three separate ideas. A <code>Duration</code> is a count of nanoseconds, so it obeys integer arithmetic and untyped constants: <code>5 * time.Second</code> works because <code>5</code> is untyped, and <code>n * time.Second</code> does not when <code>n</code> is an <code>int</code> variable. A <code>Time</code> is a struct carrying a wall clock (what a human wants, and what NTP can move) plus a monotonic reading (what a stopwatch wants, and what nothing can move), so \"which clock am I comparing\" is always a real question. And a timer is not a value you own but an entry in the runtime's timer heap: the runtime holds the reference, which is why an object you dropped on the floor can still be alive an hour later.",
	retrievalPrompts: [
		"Your service does select { case <-work: case <-time.After(time.Hour): } in a hot loop, and it leaks memory. A colleague upgrades the toolchain to Go 1.25 and the leak disappears in his test module but not in production. Why? || The Go 1.23 timer rewrite made unreferenced timers collectable immediately, but the release notes gate it: the new behaviour is only enabled when the main program's go.mod go line says 1.23.0 or later. His scratch module says go 1.25; production's go.mod still says go 1.21, so production runs the old semantics on the new toolchain. The toolchain you build with does not decide, the go directive in the main module's go.mod does. GODEBUG=asynctimerchan=1 forces the old behaviour back even on a modern go.mod.",
		"A config file says timeout: 30 and you write time.Sleep(cfg.Timeout * time.Second). It does not compile. You fix it with time.Sleep(time.Duration(cfg.Timeout * time.Second)). What did you just ship? || A 30 nanosecond sleep, silently. cfg.Timeout is an int, so cfg.Timeout * time.Second is an int multiplication that overflows or, worse, the conversion applies to the wrong expression: you converted the product instead of the operand. The correct form is time.Duration(cfg.Timeout) * time.Second: convert the number to a Duration first, then scale it. The compiler only rejects the first version because Duration and int are different types; both of the others typecheck, and only one is right.",
		"Your tests compare timestamps with == and pass on CI in UTC and on your laptop in Berlin. They fail for a teammate in Mumbai. What is different about Mumbai? || The offset is +05:30 rather than a whole hour. time.Time is a struct containing a *Location pointer, and == compares that pointer. time.Parse caches Locations for whole-hour offsets, so parsing the same string twice returns the identical pointer and == accidentally passes. A half-hour offset like +05:30 misses that cache and produces two distinct *Location values, so == returns false for two Times representing the same instant. == was never correct here, UTC and Berlin were just hiding it. Use t.Equal(u), which compares instants.",
	],
	codeExample: `package main

import (
	"fmt"
	"runtime"
	"time"
)

// liveHeapMB forces a GC and reports what survived it. Anything still on the
// heap here is not garbage: something is still holding a reference to it.
func liveHeapMB() float64 {
	runtime.GC()
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return float64(m.HeapAlloc) / (1 << 20)
}

func main() {
	const n = 200_000
	work := make(chan int)
	close(work) // always ready, so the timeout branch never wins

	base := liveHeapMB()

	// A select evaluates EVERY channel operand before it blocks, so time.After
	// builds a fresh one-hour timer on every iteration even though the timeout
	// never wins. The runtime's timer heap holds each one until it fires.
	for i := 0; i < n; i++ {
		select {
		case <-work:
		case <-time.After(time.Hour):
		}
	}
	afterAfter := liveHeapMB()

	// One timer, reused across every iteration.
	t := time.NewTimer(time.Hour)
	defer t.Stop()
	for i := 0; i < n; i++ {
		select {
		case <-work:
		case <-t.C:
		}
	}
	afterTimer := liveHeapMB()

	fmt.Println("built with", runtime.Version())
	fmt.Printf("baseline          %6.2f MB\\n", base)
	fmt.Printf("after time.After  %6.2f MB  (+%.2f)\\n", afterAfter, afterAfter-base)
	fmt.Printf("after NewTimer    %6.2f MB  (+%.2f)\\n", afterTimer, afterTimer-afterAfter)
}`,
	codeExplanation:
		"On go1.22.1 this prints <code>after time.After 40.02 MB (+39.89)</code> and <code>after NewTimer 40.02 MB (+0.00)</code>. Read what that measures: <code>liveHeapMB</code> calls <code>runtime.GC()</code> first, so 40 MB of one-hour timers survived a full collection. They are not garbage the collector has not gotten to, they are reachable, because the runtime's timer heap holds every pending timer until it fires. Nothing in the loop kept a reference and it made no difference. The <code>NewTimer</code> loop does the identical select 200,000 times and adds <code>0.00 MB</code>, which is the whole argument for the pattern. <b>Then the versions diverge, and this is the part worth memorising.</b> Built with go1.24.10 and a <code>go.mod</code> saying <code>go 1.24</code>, the same program prints <code>+0.01</code>: no leak. Built with <b>the same go1.24.10 toolchain</b> and a <code>go.mod</code> saying <code>go 1.22</code>, it prints <code>+50.81</code>: the leak is back. Setting <code>GODEBUG=asynctimerchan=1</code> on the modern <code>go.mod</code> brings it back too, at <code>+50.60</code>. Your toolchain does not decide this, your <code>go</code> directive does. On the Go Playground you will see <code>+0.00</code> on both loops, because the Playground is a modern toolchain with a modern module, and because its fake clock never advances while your program is runnable, so no timer ever fires: the timers are dropped by the collector rather than never created. That is the fixed behaviour, not the absence of the bug.",
	designRationale:
		"Each of the three sharp edges here is a compatibility decision, not an accident. <b>Duration as int64 nanoseconds</b> is Go rejecting the C tradition of <code>sleep(int seconds)</code>, where the unit lives in the documentation and every call site is a chance to be wrong by 1000x. Making it a named integer type means <code>5 * time.Second</code> reads as a unit-checked expression and the compiler catches <code>Sleep(n)</code> for an <code>int</code> n. The cost is that the type is still an integer, so <code>time.Sleep(1)</code> is legal (untyped constants convert) and means one nanosecond, and 64 bits of nanoseconds caps a Duration at about 292 years. <b>The monotonic clock</b> was added in Go 1.9 to fix a real class of bug: before it, an NTP correction during a measurement could make <code>time.Since</code> return a negative duration, and timeouts computed from wall clock could fire early or never. The design question was whether to add a separate monotonic API or hide the reading inside <code>time.Time</code>. Hiding it meant every existing program's <code>time.Since</code> and <code>Sub</code> silently became correct with no code change, which is enormous. The price was paid by <code>==</code>: a <code>Time</code> now has an invisible field, so two Times for the same instant can compare unequal, and the stdlib's answer is documentation telling you to use <code>Equal</code>. <b>The 1.23 timer rewrite</b> is the same tradeoff run again. Unstopped timers not being collectable was a genuine wart, but fixing it changes observable behaviour: channels went from a one-element buffer to unbuffered, so <code>len(t.C)</code> changed from 1 to 0 and the old stop-and-drain idiom became unnecessary. Rather than break working programs, Go gated the fix behind the <code>go</code> line in <code>go.mod</code>, which is the same mechanism that lets the language evolve loop-variable semantics. It is good engineering and it produces the confusing result above: two builds of one source file, one toolchain, opposite memory behaviour. \"Which Go am I running\" is the wrong question. \"What does my go.mod say\" is the right one.",
	commonMistakes: [
		{
			title: "Converting the product instead of the operand",
			body: "<code>time.Duration(n * time.Second)</code> and <code>time.Duration(n) * time.Second</code> both compile and only the second is right. The first multiplies an <code>int</code> by 1,000,000,000 (overflowing past n=9, and wrapping for larger n) and then relabels the wreckage as a Duration. Convert the number first, then scale. The rule that saves you: a Duration times a Duration is meaningless, so if both operands are Durations you have already made this mistake.",
		},
		{
			title: "time.After in a select loop, on a go.mod below 1.23",
			body: "Every iteration allocates a timer the runtime holds until it fires, so a one-hour timeout in a hot loop pins memory for an hour: 200,000 iterations cost 40 MB that survives an explicit GC. Go 1.23 made these collectable, but only when the main module's <code>go</code> directive says 1.23.0 or later, so a modern toolchain building an old <code>go.mod</code> still leaks. Reach for <code>time.NewTimer</code> plus <code>Reset</code> and the question stops mattering.",
		},
		{
			title: "Creating a Ticker and never stopping it",
			body: "<code>time.NewTicker</code> has no finaliser doing this for you. On a <code>go.mod</code> below 1.23, 100,000 unstopped tickers retain 20 MB and the runtime keeps waking up to fire every one of them forever. Go 1.23 lets an <b>unreferenced</b> ticker be collected, which is not the same promise: a ticker you still hold in a struct field keeps firing and keeps burning CPU no matter the version. <code>defer t.Stop()</code> on the line after <code>NewTicker</code>, always.",
		},
		{
			title: "Comparing Times with == instead of Equal",
			body: "A <code>Time</code> is a struct with a wall clock, a monotonic reading, and a <code>*Location</code> pointer, and <code>==</code> compares all three fields rather than the instant. Two Times parsed from the identical RFC3339 string compare equal for <code>+02:00</code> and unequal for <code>+05:30</code>, because <code>time.Parse</code> caches Locations for whole-hour offsets and half-hour offsets miss that cache. <code>Equal</code> compares instants and is the only correct answer. As a bonus, <code>==</code> also breaks the moment a Time crosses JSON, because serialising strips the monotonic reading.",
		},
		{
			title: "Measuring elapsed time across a serialisation boundary",
			body: "<code>time.Since(start)</code> is correct across an NTP step because both readings are monotonic. <code>end.Sub(start)</code> silently is not when <code>start</code> came back from a database, a JSON body, or an RPC, because <code>Sub</code> only uses the monotonic path when <b>both</b> operands carry a reading, and a round trip strips it. You fall back to wall clock without a compile error, a vet warning, or a runtime hint, and the failure shows up twice a year as a negative latency in your metrics.",
		},
	],
	relatedSlugs: ["select", "context", "server-timeouts", "channels", "modules"],
}
