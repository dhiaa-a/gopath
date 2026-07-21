import { Failure } from "../../content"

export const goroutineLeak: Failure = {
	slug: "goroutine-leak",
	name: "Goroutine leak: the worker nobody dismissed",
	category: "Concurrency",
	tagline:
		"A timeout that abandons its worker mid-send leaks one goroutine per request, and nothing ever crashes.",
	symptom:
		"The service leaks, slowly. RSS climbs all day and the goroutine gauge climbs with it, roughly one goroutine per timed-out upstream call; a nightly restart resets both, which is how it has been \"handled\" for a week. No errors, no crashes, p99 fine, logs clean. The lab compresses the incident into one run: 100 requests with a 5ms budget against an upstream that takes 50ms, and the closing telemetry reads <code>goroutines now: 101</code> in a process that started with 1 and finished every request it was given. Exit code 0. That is the whole horror: by every signal except the gauge, this program works.",
	labPath: "labs/failures/goroutine-leak",
	runCommand: "go run .",
	tools: [
		"the goroutine count: runtime.NumGoroutine in a debug line, or the goroutine gauge every metrics stack already exports",
		"a full goroutine dump: the /debug/pprof/goroutine?debug=2 endpoint, or SIGQUIT for a process without one",
		"the brackets in the dump: the runtime's wait reason on every parked goroutine, and the one source line they all share",
	],
	diagnosis: [
		{
			title: "Trust the gauge: count, then compare against load",
			body: "The first tool costs one line: <code>runtime.NumGoroutine()</code>, or the goroutine gauge your metrics stack exports without being asked. Read it the way you read a memory graph: not the absolute number, the shape against load. This process started at 1, handled 100 requests, finished all of them, and sits at 101. A goroutine count that tracks <em>cumulative</em> requests instead of <em>concurrent</em> requests is the leak signature, and the arithmetic here is almost taunting: one per request, none with anything left to do. Note what did not happen: no crash. The deadlock detector from the deadlock lab needs every goroutine in the process asleep, and main is wide awake here, so the runtime has no objection to 100 permanent sleepers. Exit 0.",
			command: "go run .",
			output: `goroutines at start: 1
handled 100 requests: 0 fresh, 100 from cache
goroutines now: 101`,
		},
		{
			title: "Get the stacks: every leak has an address",
			body: "A count says you leak; only stacks say where. In production you pull them from the <code>/debug/pprof/goroutine?debug=2</code> endpoint if the service wires one up, or send the process SIGQUIT (Ctrl plus Break in a Windows terminal) for a one-shot dump on stderr. Do it here and 101 goroutines collapse into one finding: 100 of them print exactly these two frames, parked in <code>[chan send]</code> at line 25, created at line 24, and the remaining 98 entries differ only in the goroutine number. The brackets are the runtime naming each goroutine's wait reason, the same skill the deadlock lab used on a crash; the new move is aggregation. You are not reading 100 stacks. You are reading one stack with a multiplicity of 100, and the leak lives at whatever line that is.",
			output: `goroutine 6 [chan send]:
main.fetchQuote.func1()
        .../labs/failures/goroutine-leak/main.go:25 +0x5f
created by main.fetchQuote in goroutine 1
        .../labs/failures/goroutine-leak/main.go:24 +0x9d

goroutine 18 [chan send]:
main.fetchQuote.func1()
        .../labs/failures/goroutine-leak/main.go:25 +0x5f
created by main.fetchQuote in goroutine 1
        .../labs/failures/goroutine-leak/main.go:24 +0x9d`,
		},
		{
			title: "Read forward from the parked line",
			body: "Line 25 is <code>ch &lt;- queryUpstream(symbol)</code>, an unbuffered send inside the helper's worker goroutine. Ask the question every parked send gets: who receives, and are they still there? Walk the caller. <code>fetchQuote</code> selects on <code>ch</code> against <code>time.After(budget)</code>; tonight the upstream takes 50ms and the budget is 5ms, so the timeout arm wins every race and <code>fetchQuote</code> returns the cached quote. The select was this channel's only receiver, and it is gone. Forty-five milliseconds later the worker finishes its call and steps up to a rendezvous with nobody on the other side. It is not slow, not stuck on the network, not waiting on a lock: it is waiting for a receive that is provably never coming, once per timed-out request.",
		},
		{
			title: "Why forever: the runtime never reaps a blocked goroutine",
			body: "The last piece is why this accumulates instead of healing. The garbage collector cannot help: a goroutine's stack is a GC root, so the channel, the quote in flight, and the closed-over <code>symbol</code> all stay reachable for as long as the goroutine exists, and the goroutine exists forever. The scheduler will not help either, because Go has no goroutine reaping: nothing in the runtime distinguishes \"parked until a receiver arrives\" from \"parked eternally\", and a blocked goroutine is so cheap that the runtime cannot justify guessing. The only component willing to call a wait hopeless is the deadlock detector, and it demands the whole process be asleep; one live main, one accept loop, one ticker anywhere, and the leak is invisible to everything except the gauge in step one.",
		},
	],
	fix: "Give the reply channel capacity 1: <code>make(chan quote, 1)</code>. The worker's send then completes whether or not anyone is still listening, so when the timeout wins and <code>fetchQuote</code> walks away, the abandoned worker deposits its quote, exits, and the channel, buffer and all, becomes garbage the moment the goroutine releases it. One word of memory buys a guaranteed exit; this is the standard shape for any one-shot reply channel. The tempting non-fix is raising the budget until timeouts get rare: that does not fix the leak, it lowers the leak rate, and the next upstream brownout refills it overnight. The heavier correct alternative is a worker that selects between <code>ch &lt;- q</code> and <code>ctx.Done()</code>, worth it when the work itself should stop early (that thread continues in the ctx-ignored lab); for a fire-and-collect helper like this one, the one-slot buffer is the fix. Prove it: <code>go run -tags fixed .</code> prints the same request telemetry and <code>goroutines now: 1</code>.",
	production:
		"In a real service this bug wears a disguise: a fetch-with-timeout helper exactly like this one wrapped around a database, an auth service, an S3 client, leaking only when the dependency degrades, which is precisely when you are too busy to study a gauge. The arithmetic turns ugly at scale. Every parked goroutine pins its stack (kilobytes at minimum, more if the call went deep), its closure, its channel, its half-built response; at ten thousand timeouts an hour that is tens of megabytes an hour, and a heap profile will cheerfully attribute it to \"channels and closures\" without saying why they are alive. The move that ends the mystery is the one this page drilled: pull <code>/debug/pprof/goroutine?debug=2</code> off the live process, aggregate by stack, read the top multiplicity. Ten thousand goroutines parked in <code>[chan send]</code> at one line is not a mystery, it is an address. And the review question that prevents the next one: for every <code>go</code> statement, name the event that guarantees this goroutine exits, and ask what happens to that guarantee when the other party stops listening.",
	scar: "Every goroutine you start needs a guaranteed way out; a select that can walk away is not one.",
	relatedSlugs: ["goroutines", "buffered-channels", "select", "context"],
	unlockTier: 2,
}
