import { Failure } from "../../content"

export const ctxIgnored: Failure = {
	slug: "ctx-ignored",
	name: "Cancellation ignored: the worker that outlives its caller",
	category: "Concurrency",
	tagline:
		"cancel() is a request, not a stop: a worker that never reads ctx.Done() finishes the whole batch for a caller who already left.",
	symptom:
		"During the deploy the export batch was cancelled, the log dutifully says <code>cancel sent at 45ms</code>, and then the worker kept going: the run's own reconciliation shows it returning at 209ms with all 20 items processed and <code>items started after cancel: 15</code>. Fifteen exports began after the caller said stop, on every run, and the program exits 0. The insult is that the code looks textbook: the worker takes a <code>context.Context</code>, main calls <code>cancel()</code>, a WaitGroup joins them at the end. Every piece of cancellation machinery is present except the one that does anything.",
	labPath: "labs/failures/ctx-ignored",
	runCommand: "go run .",
	tools: [
		"the run log as a timeline: every work timestamp after the cancel timestamp is a finding",
		"a grep for ctx through the worker's call path: received is not consulted, so find one place Done is actually read",
		"the fixed variant as an experiment: add one select per loop pass, rerun, and watch which numbers move",
	],
	diagnosis: [
		{
			title: "Read the log as a timeline, not as lines",
			body: "Each line alone looks healthy: cancel was sent, the worker returned, the batch completed. Lined up on one clock they are damning: the cancel landed at 45ms, the worker returned at 209ms, and its last fifteen items <em>started</em> after the cancellation it was supposedly honoring. That is 164ms of work performed for a caller that had already left. The instinct at this point is to suspect delivery, and teams have burned days there: was cancel() actually called, did the ctx get passed down, is there a bug in the context package? Flip it. The cancel was delivered perfectly, because delivery is trivial; the program itself logged it. The question a timeline like this actually raises is what, mechanically, anyone ever agreed to do about it.",
			command: "go run .",
			output: `cancel sent at 45ms
worker returned at 209ms
processed 20/20 items, cancelled=true, obeyed=false
items started after cancel: 15`,
		},
		{
			title: "Know what cancel() is before blaming it",
			body: "Strip the abstraction: <code>context.WithCancel</code> hands you a context whose <code>Done()</code> method returns a channel, and <code>cancel()</code> closes that channel and sets <code>Err()</code> to <code>context.Canceled</code>. That is the entire mechanism. No goroutine is preempted, no sleep is interrupted, nothing is signalled, the scheduler does not so much as glance at the worker. A closed channel is a fact made available, not a force applied. So \"did the cancellation arrive?\" is the wrong question; it always arrives, instantly, to anyone who looks. The only question with diagnostic power is: <em>where does this worker look?</em> Cancellation in Go is cooperative by design, because only the code doing the work knows where stopping is safe, which means a context is only as good as the polling of it.",
		},
		{
			title: "Grep for the poll, find decoration",
			body: "Four hits, and the shape of the bug is visible in the line numbers alone: a comment promising abandonment, a signature accepting <code>ctx</code>, main constructing and passing it, and then nothing. Inside <code>process</code> the loop is <code>export</code> then <code>append</code>, twenty times, with no exit except the end of the slice; <code>ctx.Done()</code> is read nowhere in the program. This is the signature to learn: <strong>a context that flows through signatures but is never read is cancellation theater</strong>. Nothing flags it. Unused function parameters are legal Go, so it compiles; <code>go vet</code> has no opinion; reviews wave it through because the signature looks responsible. The grep is the whole tool, and \"where is Done read?\" is the whole question.",
			command: "grep -n \"ctx\" main.go",
			output: `25:// It takes ctx so a caller can abandon the batch partway through.
26:func process(ctx context.Context, items []string, start time.Time) []record {
47:	ctx, cancel := context.WithCancel(context.Background())
55:		log = process(ctx, items, start)`,
		},
		{
			title: "Name the model, and why kill was never on the table",
			body: "The misconception that ships this bug is \"I passed ctx down, therefore I support cancellation.\" Accepting a context is a promise; polling it is the implementation; the type system enforces only the promise. It is worth asking why Go does not just kill the goroutine, because the answer locates the fix. A kill at the cancel instant would land mid-item: a half-written export, a mutex still held with no owner-death cleanup, invariants torn in whatever the worker touched. Go deliberately has no way to kill a goroutine from outside. Instead the worker declares its own safe stopping points, and cancellation lands exactly there. In a loop like this one the natural checkpoint is the loop boundary: between items, where nothing is half-done, check whether the world still wants the next item.",
		},
	],
	fix: "Give the loop its checkpoint. In <code>fixed.go</code>, each pass runs a non-blocking <code>select</code> on <code>ctx.Done()</code> (with an empty <code>default</code>) before starting the next item, and returns what it has once the batch is abandoned. The granularity is honest: the item in flight when cancel lands still finishes, which is why the fixed run reports <code>processed 5/20</code> (four before the cancel, one straddling it) and that is correct behavior, not sloppiness; stopping between items is precisely the safety the cooperative model buys. The tempting non-fix is wrapping the worker in a second goroutine and abandoning it when Done fires: the caller returns early but the work keeps running, which converts disobedience into the goroutine-leak lab's bug and hides it from the logs. The real strengthening runs the other direction: push ctx one level deeper, into ctx-aware item work (<code>http.NewRequestWithContext</code>, <code>QueryContext</code>), so even the in-flight item can stop early. Prove it: <code>go run -tags fixed .</code> returns by about 52ms with <code>items started after cancel: 0</code> and <code>obeyed=true</code>.",
	production:
		"The production version is every service where a request's work outlives the request. A client times out and retries; the server cancelled the first request's ctx on disconnect, but the handler's loop never reads Done, so the original work is still running when the retry lands, and the same row gets written twice. That is the actual anatomy of many \"we have duplicate charges\" tickets: cancellation that was logged and ignored, times client retry policy. The same shape at batch scale: a deploy \"cancels all workers\" and then waits behind 40 minutes of politely ignored context; a reporting job finishes an hour of queries into a bucket nobody will read; the database executes to completion for callers that hung up long ago, billing you for abandoned work. The audit is cheap and brutal: for every long-running loop, retry ladder, and pipeline stage that accepts a ctx, point to the line where Done is read. A useful discipline while you write: check ctx roughly wherever you would tolerate the work stopping. If the honest answer is \"we never check\", then the system's entire cancellation story is a log line that says cancel sent.",
	scar: "Cancellation is cooperative: cancel() states a fact, and only code that reads ctx.Done() acts on it.",
	relatedSlugs: ["context", "select", "goroutines", "channels"],
	unlockTier: 2,
}
