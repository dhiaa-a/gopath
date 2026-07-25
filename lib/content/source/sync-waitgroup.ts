import { SourceWalkthrough } from "../../content"

export const syncWaitgroup: SourceWalkthrough = {
	slug: "sync-waitgroup",
	name: "sync.WaitGroup",
	pkg: "sync",
	order: 3,
	unlockTier: 2,
	tagline:
		"129 lines, three fields, three methods. The smallest complete concurrency primitive in the standard library, and the best place to learn which lines are not for you.",

	why: `<p>Read this file first. Not because it is important, though it is, but because you already know exactly what a <code>WaitGroup</code> does before you open it. Nothing in the file can confuse you about intent, so everything you learn is mechanism.</p>
<p>It also trains the one skill that separates people who read the standard library from people who bounce off it: recognising the lines that are not addressed to you. Fourteen of <code>Add</code>'s forty-one lines exist only in binaries built with <code>-race</code>. A reader who does not know that meets a forty-line function and concludes the standard library is beyond them. A reader who does sees a twelve-line function with some scaffolding around it.</p>`,

	entryFile: "src/sync/waitgroup.go",
	openCommand: 'less "$(go env GOROOT)/src/sync/waitgroup.go"',

	orientation: `<p>Resist reading top to bottom. The file has five parts and only two of them repay a first pass:</p>
<ul>
<li><strong>Lines 1 to 11</strong>, license and imports. Skip, but notice <code>internal/race</code>: that import is your warning that race instrumentation is woven through the file.</li>
<li><strong>Lines 13 to 24</strong>, the doc comment. Read this slowly. It is a specification.</li>
<li><strong>Lines 25 to 30</strong>, the struct. Read this second and read it carefully. Three fields, and one of them gives away the entire design in a trailing comment.</li>
<li><strong>Lines 32 to 85</strong>, <code>Add</code>. The only real logic in the file.</li>
<li><strong>Lines 87 to 129</strong>, <code>Done</code> and <code>Wait</code>. <code>Done</code> is one line. <code>Wait</code> is a retry loop.</li>
</ul>
<p>A useful habit for any stdlib type: fields before methods. The fields tell you what the type <em>is</em>, and the methods are then just transitions on that state. Reading the methods first means holding an unknown data structure in your head while you decode operations on it.</p>
<p>If you would rather stay in the terminal, <code>go doc -src sync.WaitGroup.Add</code> prints the source of a single symbol, which is often all you want.</p>`,

	excerpts: [
		{
			file: "src/sync/waitgroup.go",
			title: "The doc comment is a specification",
			startLine: 19,
			code: `// A WaitGroup must not be copied after first use.
//
// In the terminology of [the Go memory model], a call to [WaitGroup.Done]
// “synchronizes before” the return of any Wait call that it unblocks.
//
// [the Go memory model]: https://go.dev/ref/mem`,
			notice: `<p>Two sentences, both load-bearing, both easy to skim past as boilerplate.</p>
<p><em>Must not be copied after first use</em> is a rule the language will not enforce for you. Pass a <code>WaitGroup</code> by value to a function and you get a copy with its own counter, so the goroutines increment one counter while <code>Wait</code> watches another. The compiler is happy. <code>go vet</code> is not, and the next excerpt shows the trick that lets it complain.</p>
<p>The second sentence is the actual guarantee, written in the vocabulary of the memory model: <code>Done</code> <em>synchronizes before</em> <code>Wait</code> returns. That is what makes it safe to write results into a slice from many goroutines and read the slice after <code>Wait</code> with no mutex at all. Notice what is <em>not</em> promised: nothing about the order goroutines finish in, and nothing about what you may read <em>before</em> <code>Wait</code> returns.</p>`,
		},
		{
			file: "src/sync/waitgroup.go",
			title: "Read the fields before the methods",
			startLine: 25,
			code: `type WaitGroup struct {
	noCopy noCopy

	state atomic.Uint64 // high 32 bits are counter, low 32 bits are waiter count.
	sema  uint32
}`,
			notice: `<p>The trailing comment on <code>state</code> is the whole design. One 64-bit word holds two 32-bit counters: how many goroutines you are waiting for in the high half, how many goroutines are blocked in <code>Wait</code> in the low half. They are packed together so that a single atomic operation updates both, and so no one can ever observe a half-updated pair.</p>
<p><code>noCopy</code> is not data. It is an empty struct with do-nothing <code>Lock</code> and <code>Unlock</code> methods, defined a few files away in <code>sync/cond.go</code>, and its only purpose is to be visible to a tool. Because it has those two methods it satisfies <code>sync.Locker</code>, and <code>go vet</code>'s copylocks pass flags any copy of a struct that contains a <code>Locker</code>. That is how a comment in the docs becomes an error on your screen. Go's own comment on it is blunt: <code>// Lock is a no-op used by -copylocks checker from \`go vet\`.</code></p>
<p><code>sema</code> is a runtime semaphore, the thing blocked goroutines actually park on. Its type is a bare <code>uint32</code> because the runtime addresses it directly.</p>`,
		},
		{
			file: "src/sync/waitgroup.go",
			title: "Add, once you delete the noise",
			startLine: 45,
			code: `func (wg *WaitGroup) Add(delta int) {
	if race.Enabled {
		if delta < 0 {
			// Synchronize decrements with Wait.
			race.ReleaseMerge(unsafe.Pointer(wg))
		}
		race.Disable()
		defer race.Enable()
	}
	state := wg.state.Add(uint64(delta) << 32)
	v := int32(state >> 32)
	w := uint32(state)`,
			notice: `<p>Here is the skill. Everything inside <code>if race.Enabled</code> is compiled out of an ordinary build; it exists to teach the race detector facts it cannot infer, because <code>WaitGroup</code> synchronizes through atomics and a runtime semaphore rather than through a lock the detector already understands. On a first read, delete those blocks on sight.</p>
<p>What survives is three lines. <code>uint64(delta) &lt;&lt; 32</code> shifts the delta into the high half, so one atomic add updates the counter and leaves the waiter count alone. Then the returned word is unpacked twice: <code>v</code> is the counter, taken from the top, and <code>w</code> is the waiter count, taken from the bottom by truncation.</p>
<p>The conversion order matters and rewards a second look. <code>int32(state &gt;&gt; 32)</code> shifts first and narrows second, so the counter keeps its sign and can legitimately go negative, which is what the next excerpt is about. <code>uint32(state)</code> just discards the top half.</p>`,
		},
		{
			file: "src/sync/waitgroup.go",
			title: "The rules from the docs, as panics",
			startLine: 63,
			code: `	if v < 0 {
		panic("sync: negative WaitGroup counter")
	}
	if w != 0 && delta > 0 && v == int32(delta) {
		panic("sync: WaitGroup misuse: Add called concurrently with Wait")
	}`,
			notice: `<p>Every "must" in the doc comment turns up somewhere in the file as a panic you can point at. This is the fastest way to understand any stdlib type: find its panics and you have found its contract.</p>
<p>The first is the one people meet: one <code>Done</code> too many and the counter goes negative. Notice it is <code>Add</code> that panics, not <code>Done</code>, which is why the message says <code>Add</code> even when your code called <code>Done</code>.</p>
<p>The second is subtler and worth decoding. <code>w != 0</code> means somebody is already blocked in <code>Wait</code>. <code>v == int32(delta)</code> means this <code>Add</code> took the counter up from zero. So: a goroutine is waiting, the counter had drained to zero, and now you are starting a new round. That is the reuse race, and it is exactly the bug in the <code>wg-add-after-wait</code> failure lab. The library detects the shape it can prove is wrong and refuses to guess.</p>`,
		},
		{
			file: "src/sync/waitgroup.go",
			title: "Done is not a mechanism, it is a name",
			startLine: 87,
			code: `// Done decrements the [WaitGroup] counter by one.
func (wg *WaitGroup) Done() {
	wg.Add(-1)
}`,
			notice: `<p>Worth the ten seconds it takes to find, because it collapses two concepts into one. There is no separate completion path: <code>Done</code> is <code>Add(-1)</code>, so everything true of <code>Add</code> is true of <code>Done</code>, including which panic you get and which line raises it.</p>
<p>It also explains a piece of Go style you may have wondered about. <code>defer wg.Done()</code> is idiomatic and <code>defer wg.Add(-1)</code> is not, even though they are the same call, because the name states intent at the point where a reader is skimming for it.</p>`,
		},
		{
			file: "src/sync/waitgroup.go",
			title: "Wait is a compare-and-swap loop",
			startLine: 97,
			code: `	for {
		state := wg.state.Load()
		v := int32(state >> 32)
		w := uint32(state)
		if v == 0 {
			// Counter is 0, no need to wait.
			if race.Enabled {
				race.Enable()
				race.Acquire(unsafe.Pointer(wg))
			}
			return
		}
		// Increment waiters count.
		if wg.state.CompareAndSwap(state, state+1) {`,
			notice: `<p>A bare <code>for</code> wrapped around a load, a check, and a compare-and-swap is the standard lock-free retry shape. You will meet it again in <code>sync.Once</code>, in <code>sync/atomic</code> users throughout the runtime, and in plenty of production code. Read it once here and you recognise it everywhere.</p>
<p>The logic: load the packed word, unpack it, and if the counter is already zero there is nothing to wait for, so return without touching anything. Otherwise try to register as a waiter by bumping the low half with <code>CompareAndSwap</code>. Note the <code>state+1</code>: adding one to the whole word increments the low half, because the waiter count lives at the bottom.</p>
<p>The swap can fail, which is the entire reason for the loop. Failure means another goroutine changed the word between the load and the swap, so everything just read is stale and the only correct response is to start over. That is why the loop has no counter and no backoff: it is not retrying a flaky operation, it is re-reading a value that moved.</p>`,
		},
	],

	exercise: {
		question:
			"The panic string \"sync: WaitGroup misuse: Add called concurrently with Wait\" appears twice in waitgroup.go, on two different lines, guarded by two completely different conditions. Find both. Then answer the real question: why does the second one exist at all, when the first has already checked for misuse? The comment above it calls it a \"cheap sanity check\", which is a hint about what it can and cannot promise.",
		command:
			'grep -n "Add called concurrently" "$(go env GOROOT)/src/sync/waitgroup.go"',
		answer: `<p>Lines 67 and 78 on go1.23.12.</p>
<p><strong>Line 67</strong> fires on the way in, from the value <code>Add</code> just wrote. It catches the clean case: waiters exist and this <code>Add</code> lifted the counter off zero, so a new round started while an old <code>Wait</code> was still parked.</p>
<p><strong>Line 78</strong> fires much later, on a different path. Getting there means this call drove the counter <em>to</em> zero while waiters were parked, so this goroutine now owns the job of releasing them. Before it does, it re-reads the word and checks that nothing changed since its own add:</p>
<pre><code>if wg.state.Load() != state {
	panic("sync: WaitGroup misuse: Add called concurrently with Wait")
}</code></pre>
<p>The comment above it explains the reasoning: at this point there <em>must not</em> be concurrent mutations, because a correct program does not call <code>Add</code> concurrently with <code>Wait</code> and <code>Wait</code> does not register as a waiter once it sees the counter at zero. So the load should return exactly what was written. If it does not, the program has already broken the rules and the library says so instead of releasing the wrong number of goroutines.</p>
<p>And that is why the comment says <em>cheap</em>. It is a plain load with no lock and no retry, so it detects a race it happens to observe rather than every race that could occur. A misuse can still slip past it. This is the honest shape of most misuse detection in the standard library: not a guarantee that you will be caught, just a promise that when the library <em>can</em> see the bug for free, it will refuse to continue rather than corrupt your program quietly.</p>
<p>Worth carrying: "no panic" is not "no bug".</p>`,
		answerAnchor: {
			file: "src/sync/waitgroup.go",
			needle: `	// Still do a cheap sanity check to detect WaitGroup misuse.
	if wg.state.Load() != state {`,
		},
	},

	takeaway:
		"A WaitGroup is one 64-bit word plus a semaphore, and every rule in its documentation appears in the file as a panic you can point at.",

	relatedConcepts: ["sync-waitgroup", "memory-model", "atomic", "race-detector", "goroutines"],
	relatedProjects: ["worker-pool", "tcp-echo"],
	relatedFailures: ["wg-add-after-wait", "mutex-by-value"],
}
