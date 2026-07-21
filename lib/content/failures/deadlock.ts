import { Failure } from "../../content"

export const deadlock: Failure = {
	slug: "deadlock",
	name: "Deadlock: the send nobody receives",
	category: "Concurrency",
	tagline:
		"An unbuffered send with no receiver at the other end, and the runtime proves nothing can ever run again.",
	symptom:
		"The job crashes instantly, every run, with <code>fatal error: all goroutines are asleep - deadlock!</code> and a stack trace pointing at an ordinary-looking channel send. It worked before the reporting was \"made concurrent\": a channel was introduced, producers write results into it, a loop below drains it. Rolling back the refactor fixes it, so the channel is implicated, but the code reads like a textbook producer/consumer split.",
	labPath: "labs/failures/deadlock",
	runCommand: "go run .",
	tools: [
		"the crash text itself: the first line names the failure class",
		"the goroutine dump: the [chan send] bracket is the runtime's wait reason",
		"the source, read forward from the blocked line: who is on the other end?",
	],
	diagnosis: [
		{
			title: "Read the first line, not the wall",
			body: "The instinct is to scroll into the stack trace. Resist it for one line, because the first line is a precise claim: <code>all goroutines are asleep</code> means the runtime checked every goroutine in the process and found every single one blocked on something that only another goroutine could provide. That is not a guess or a timeout. The scheduler had nothing to run, could prove it would never have anything to run, and crashed on purpose rather than idle forever. This detector fires only on that global proof, which is worth remembering for later: one unrelated live goroutine anywhere in the process and this crash becomes a silent hang instead.",
			command: "go run .",
			output: `fatal error: all goroutines are asleep - deadlock!

goroutine 1 [chan send]:
main.main()
        .../labs/failures/deadlock/main.go:29 +0x2ad
exit status 2`,
		},
		{
			title: "The bracket is the wait reason",
			body: "<code>goroutine 1 [chan send]</code> reads as: goroutine 1, which is <code>main</code>, is parked in the runtime's channel-send queue. Every goroutine in a dump carries its wait state in those brackets (<code>[chan receive]</code>, <code>[select]</code>, <code>[sync.Mutex.Lock]</code>, <code>[IO wait]</code>), and diagnosing any concurrency bug starts by reading them. Here there is exactly one goroutine, so the whole story is: main tried to send on a channel and nobody ever came. The line number under it is not where the bug conceptually lives, but it is where the waiting happens, and that is the right place to start reading.",
		},
		{
			title: "Ask the channel question at the blocked line",
			body: "Line 29 is <code>results &lt;- result{...}</code> on an unbuffered channel. An unbuffered send is a rendezvous: it completes only if a receiver is at the channel <em>at that moment</em>. So the question is never \"why is this send slow\", it is \"who receives, and are they running yet?\" Read the program forward from the send: the receive loop (<code>for r := range results</code>) is below the send loop, in the <em>same goroutine</em>. Main cannot reach its own receive loop until every send completes, and no send can complete until main is at the receive loop. The program is waiting for itself. The channel did not malfunction; it did exactly what an unbuffered channel does, on the very first value.",
		},
		{
			title: "Name the misconception before fixing it",
			body: "The broken code treats the channel as a mailbox: drop values in now, collect them later. A buffered channel is a mailbox, with capacity you chose; an unbuffered channel is a meeting. This misread survives review because the code is shaped exactly like correct concurrent code, and the only missing ingredient is a second goroutine to stand at the other end. That also answers the question of why the runtime could be so certain: with one goroutine parked in <code>[chan send]</code> and no other goroutine in existence, there is provably no future in which a receiver appears.",
		},
	],
	fix: "Give the channel a second side. Move production onto its own goroutine and leave main as the consumer, which is the shape in <code>fixed.go</code>: the goroutine sends, main ranges, and the sender closes the channel when it is done because the sender is the only party who knows when that is (the ownership rule from the channel-ownership concept). Prove it: <code>go run -tags fixed .</code> prints the three-line report and exits 0. The tempting non-fix is <code>make(chan result, len(inputs))</code>, a buffer big enough to absorb every send. It makes this program print, but it papers over the design instead of fixing it: the buffer size is now load-bearing, silently wrong the day inputs outgrow it, and the pipeline degrades back into \"build the whole result set, then report\", which is what the channel was introduced to avoid.",
	production:
		"You will almost never see this crash in production, and that is the trap. The detector needs <em>every</em> goroutine asleep, and a real service always has something alive: the HTTP accept loop, a metrics ticker, a signal handler. So the deadlocked goroutines do not crash the process, they accumulate. Each stuck request holds its memory, its connection, its locks, forever. The pager says \"latency through the roof, RSS climbing slowly\", not \"deadlock\". The diagnostic move is the same one this page started with, just aimed at a live process: get a goroutine dump (send the process <code>SIGQUIT</code>, or hit the <code>/debug/pprof/goroutine?debug=2</code> endpoint the observability project wires up) and read the brackets. Ten thousand goroutines parked in <code>[chan send]</code> at the same line is this exact lab, minus the courtesy of the crash.",
	scar: "An unbuffered send is a meeting, not a mailbox: if nobody is waiting to receive, you wait forever.",
	relatedSlugs: [
		"channels",
		"channel-ownership",
		"buffered-channels",
		"goroutines",
	],
	unlockTier: 2,
}
