import { Concept } from "../../content"

export const syncMutex: Concept = {
	slug: "sync-mutex",
	name: "sync.Mutex",
	tagline:
		"One goroutine at a time in the critical section. RWMutex when reads genuinely dominate.",
	summary:
		"A <code>sync.Mutex</code> is a lock: <code>Lock</code> blocks until nobody else holds it, <code>Unlock</code> releases it. It guards data, not code, and the pairing between a mutex and the fields it protects is a convention you maintain rather than something the compiler checks. <code>sync.RWMutex</code> is the variant that admits many readers at once, or one writer, never both.",
	mentalModel:
		"A mutex is the single key to a room. Whoever holds the key may go in; everyone else waits at the door. Two things follow from that picture. The key does not know what is in the room, so nothing stops someone cutting another door into the wall: one goroutine touching the data without taking the key means the lock protects nothing, and the compiler will not mention it. And holding the key while you take a phone call in the middle of the room is how a queue forms outside for no reason.",
	retrievalPrompts: [
		"Two goroutines each lock, read tokens=4, and unlock. Both conclude they may proceed. Both lock again and write 3. Every single access was synchronised. What went wrong? || Atomicity is a property of the whole operation, not of each access inside it. The decision and the write it was based on were separated, so both goroutines read the same 4 and one update was lost. The entire read-modify-write has to sit in one critical section: lock, read, decide, write, unlock.",
		"Your writer holds the mutex. Your reader does not, because it only reads. Why is that still a bug? || A data race is a write happening concurrently with any other read or write to the same location, so a lock-free read still races. Without the lock there is no happens-before edge, and the reader can see a stale value. On a multiword value the Go memory model is blunter: reads of anything larger than a machine word may be treated as several word-sized operations in an unspecified order, so a map, slice, string, or interface can be seen half-updated, which it says can lead to arbitrary memory corruption.",
		"When does RWMutex actually beat Mutex, and when is it just slower? || It pays when reads genuinely dominate and each critical section is long enough to amortise the extra bookkeeping. RLock maintains a reader count rather than flipping a single word, so it does more work than an uncontended Mutex.Lock, which is one compare-and-swap. For short critical sections under low contention RWMutex is slower than a plain Mutex. It is a measurement, not a default.",
	],
	codeExample: `package main

import (
	"fmt"
	"sync"
)

// The mutex sits directly above the field it guards. Nothing in the type
// system ties them together: the pairing is a convention you maintain, which
// is exactly why it belongs next to the data and not somewhere clever.
type Counter struct {
	mu     sync.Mutex
	counts map[string]int
}

func NewCounter() *Counter {
	// No mu here. The zero value of a Mutex is an unlocked, ready mutex.
	return &Counter{counts: make(map[string]int)}
}

// Read, modify, and write inside ONE critical section. Unlocking between the
// read and the write is what loses updates, even though every single access
// was individually synchronised.
func (c *Counter) Incr(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counts[key]++
}

// The read takes the lock too. A race is any concurrent access to the same
// location where at least one side writes, so a lock-free read still races.
func (c *Counter) Get(key string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.counts[key]
}

func main() {
	c := NewCounter() // pointer: a value holding a Mutex must never be copied
	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.Incr("hits")
		}()
	}
	wg.Wait()
	fmt.Println(c.Get("hits")) // 1000. Every run, on every machine.
}`,
	codeExplanation:
		"<code>Incr</code> does the read, the modify, and the write in one critical section. Unlocking between the read and the write is what loses updates, even when each individual access is locked. <code>Get</code> takes the lock as well, because a read racing a write is still a race. The zero value of a <code>Mutex</code> is unlocked and ready, so there is nothing to initialise and no <code>NewMutex</code> to call. The methods are on <code>*Counter</code> and never on <code>Counter</code>, because a value holding a mutex must not be copied: change the receiver to a value and <code>go vet</code> says so directly, with <code>Incr passes lock by value: Counter contains sync.Mutex</code>. This prints 1000 on every run. Delete the two lock lines and it prints a different number nearly every time: twenty runs of exactly that on a stock go1.22 toolchain gave seventeen different answers between 919 and 994, and never 1000.",
	designRationale:
		"Go's proverb is \"do not communicate by sharing memory; share memory by communicating\", and it is a default rather than a prohibition. <code>sync.Mutex</code> ships in the standard library because a counter, a cache, or a map of rate limit buckets is shared state, and routing every read of it through a channel buys ceremony rather than safety. The mutex is then deliberately tiny: <code>Lock</code>, <code>Unlock</code>, and nothing else. It is not reentrant, so a goroutine that locks a mutex it already holds deadlocks instead of nesting, and that is a choice rather than an oversight: a reentrant lock lets a function re-enter a critical section without knowing which invariants the outer holder had already suspended, which turns \"I hold the lock\" into a claim nobody can check. There is also no way to ask a mutex which data it guards, which is why the convention is to write it directly above the fields it protects. What the language does give you is <code>go vet</code>'s copylocks check for the one mistake a compiler could plausibly catch, and a memory model that spells out the edge you are buying: an <code>Unlock</code> is synchronized before any later <code>Lock</code> of the same mutex returns, and that is precisely what makes the writes you did inside the critical section visible to whoever takes the lock next.",
	commonMistakes: [
		{
			title: "Splitting the read-modify-write across two critical sections",
			body: "Lock, read the value, unlock, decide, lock, write. Every access is synchronised and the update is still lost, because two goroutines can both read the old value before either writes. Atomicity belongs to the whole operation. Take the lock once, decide inside it, and release it when the write is done.",
		},
		{
			title: "Copying a value that contains a mutex",
			body: "A copy gets its own lock, so locking the copy protects nothing. It happens quietly through value receivers, range variables, and passing a struct by value. <code>go vet</code> catches this one: <code>passes lock by value: Counter contains sync.Mutex</code>. Use pointer receivers and pass pointers.",
		},
		{
			title: "Leaving reads unlocked",
			body: "\"It only reads\" is not a defence. A race is a write concurrent with any other access, so an unsynchronised read races with a locked write and there is no ordering between them. On maps it is worse than stale data: a concurrent read during a write trips the runtime's own guard and the process dies with <code>fatal error: concurrent map read and map write</code>.",
		},
		{
			title: "Holding the lock across I/O",
			body: "Take the decision under the lock, release it, then do the slow thing. Holding a mutex across an HTTP call, a query, or a downstream handler serialises your whole server behind one lock, and one slow call blocks every other goroutine that needs the data. Locks protect data, not the work you do afterwards.",
		},
		{
			title: "Reaching for RWMutex or sync.Map by default",
			body: "<code>RWMutex</code> costs more per operation than a <code>Mutex</code> and only wins when reads dominate and critical sections are long. <code>sync.Map</code> is built for two narrow shapes, write-once-read-many caches and disjoint key sets per goroutine, and read-modify-write on the same key is neither. A plain map with a Mutex is usually the right answer, and picking the exotic one because a map is \"not thread safe\" is how code gets slower and buggier at once.",
		},
	],
	relatedSlugs: ["race-detector", "goroutines", "maps", "sync-waitgroup"],
}
