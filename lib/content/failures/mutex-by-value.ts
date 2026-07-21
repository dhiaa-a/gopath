import { Failure } from "../../content"

export const mutexByValue: Failure = {
	slug: "mutex-by-value",
	name: "The mutex that guarded nothing: locks copied by value",
	category: "Concurrency",
	tagline:
		"Every map write sits between Lock and Unlock, and the runtime still catches two writers colliding: each goroutine locked its own private copy of the mutex.",
	symptom:
		"A concurrent tally crashes with <code>fatal error: concurrent map writes</code> on nearly every run, exit status 2, and the fatal line sometimes prints two or three times before the goroutine dump. The team's defense is reasonable: every write to the shared map is wrapped in <code>mu.Lock()</code> and <code>mu.Unlock()</code>, the mutex was added for exactly this purpose, and review approved it. Wrapping the workers in <code>recover()</code> changes nothing, which rules out the usual panic-handling reflexes. The code looks locked. The runtime says it is not.",
	labPath: "labs/failures/mutex-by-value",
	runCommand: "go run .",
	tools: [
		"go vet, first: the copylocks analyzer catches this class before the program ever runs",
		"the fatal error text: which runtime throw fired and what invariant it defends",
		"the goroutine dump's argument values: the copied struct is printed inline in every frame",
		"go run -race, as confirmation: map internals racing on a line that is \"locked\"",
	],
	diagnosis: [
		{
			title: "Trust the throw: this is not a panic",
			body: "A <code>fatal error</code> is a runtime throw, not a panic: <code>recover()</code> cannot catch it and the process is over, by design, because the map's internals may now be arbitrarily corrupt. Go maps carry a cheap concurrency tripwire (a writer flag checked on entry, not a full detector, and not guaranteed to fire), and it fired here, three times, because several workers hit it in the same instant. Take the runtime's claim literally: at least two goroutines were inside a map write simultaneously. Every write in this program is between Lock and Unlock, and there is no sneaky unlocked path. So either the runtime is wrong, or those goroutines were not holding the same lock. Hold that second option while you collect one more piece of evidence.",
			command: "go run .",
			output: `fatal error: concurrent map writes
fatal error: concurrent map writes
fatal error: concurrent map writes

goroutine 8 [running]:
main.picker({{0x0, 0x0}, 0xc000020180}, {0xc000032100, 0x4, 0x0?}, 0xc00000a100)
        .../labs/failures/mutex-by-value/main.go:40 +0x16d
created by main.main in goroutine 1
        .../labs/failures/mutex-by-value/main.go:52 +0xf1
exit status 2`,
		},
		{
			title: "Run go vet before reading any more code",
			body: "The copylocks analyzer flags both ends of the mistake: the declaration (<code>picker passes lock by value</code>, because the parameter type contains a <code>sync.Mutex</code>) and every call site that performs the copy. Mechanically, a <code>sync.Mutex</code> is a tiny struct whose fields are the lock state itself. Copying it forks that state: the copy is an independent, freshly-unlocked mutex with the original's history and no future connection to it. That is why vet can catch this without running anything: no schedule or timing is involved, the bug is visible in the types alone. One sharp edge worth knowing: <code>go test</code> runs only a vet subset (atomic, bool, printf and friends) and copylocks is not in it, so a plain test pipeline sails past this. An explicit <code>go vet ./...</code> in CI is the fence.",
			command: "go vet ./...",
			output: `# gopath.dev/labs/failures/mutex-by-value
# [gopath.dev/labs/failures/mutex-by-value]
./main.go:35:15: picker passes lock by value: gopath.dev/labs/failures/mutex-by-value.Store contains sync.Mutex
./main.go:52:13: call of picker copies lock value: gopath.dev/labs/failures/mutex-by-value.Store contains sync.Mutex`,
		},
		{
			title: "Find the fork: eight mutexes, one map",
			body: "<code>func picker(s Store, ...)</code> takes its receiver-shaped argument by value, so each <code>go picker(store, ...)</code> hands that goroutine a copy of the whole struct. The two fields copy very differently. The <code>sync.Mutex</code> copies as plain data: eight workers, eight private locks, and locking a lock that nobody else can see excludes exactly nobody. The map field copies as a header: a map value is a small reference to shared bucket storage, so all eight copies point at the same buckets. Net effect: the lock forked, the data did not, and every worker politely serializes against itself while stomping a shared map. The crash dump already showed this if you knew where to look: every <code>picker</code> frame prints its Store argument as <code>{{0x0, 0x0}, 0xc000020180}</code>, a private mutex copy followed by the same map pointer, <code>0xc000020180</code>, in every single frame. Go's value semantics are the whole story here: some fields copy deep, reference-shaped fields copy shallow, and a struct mixing the two forks its lock away from its data.",
		},
		{
			title: "Confirm with the race detector, and watch it agree",
			body: "Both stacks run through the map runtime (<code>mapaccess</code> racing <code>mapassign</code>) from <code>main.go:40</code>, the exact line wrapped in Lock and Unlock. That pattern is the signature of this bug class: when a locked line races with itself, stop suspecting the scheduler and start suspecting lock identity. <code>-race</code> builds its happens-before graph from the actual mutex instances at runtime, and two different mutexes contribute no edge, no matter how faithfully each is locked. One honest note from this run: after four warnings the process still died of <code>concurrent map writes</code>; the detector and the map's own tripwire race to report first, and either way the answer is the same.",
			command: "go run -race .",
			output: `==================
WARNING: DATA RACE
Read at 0x00c00008c150 by goroutine 9:
  runtime.mapaccess1_faststr()
      .../src/runtime/map_faststr.go:13 +0x0
  main.picker()
      .../labs/failures/mutex-by-value/main.go:40 +0x1b8

Previous write at 0x00c00008c150 by goroutine 7:
  runtime.mapassign_faststr()
      .../src/runtime/map_faststr.go:223 +0x0
  main.picker()
      .../labs/failures/mutex-by-value/main.go:40 +0x1ec
[remainder of the report trimmed; it ends in the same
fatal error: concurrent map writes, exit status 2]`,
		},
	],
	fix: "Stop copying the Store: <code>func picker(s *Store, ...)</code> and <code>go picker(&store, ...)</code>. Now every worker locks the one mutex that guards the one map, mutual exclusion means something again, vet goes silent, and the run completes. The durable rule: a struct containing a sync primitive has identity, so it travels by pointer, and methods on such a type take pointer receivers without exception. The tempting non-fix is to change the field to <code>mu *sync.Mutex</code> so all the copies share one lock. It compiles, it silences vet, and today it even runs correctly, which is exactly what makes it poison: the copying that caused the bug is now blessed, and the next value-typed field added to Store (a counter, a small slice being appended) forks silently in every copy with no analyzer left to complain. The copy was the bug; share the Store, not just its lock. Prove it: <code>go run -tags fixed .</code> prints <code>recorded 400000 of 400000 picks</code> and exits 0, and <code>go vet -tags fixed ./...</code> has nothing to say.",
	production:
		"The way this ships is almost always a signature nobody reads twice: a worker function or an <code>http.Handler</code> that takes its stateful struct by value. In staging, at three requests per second, two goroutines are never inside the map in the same instant, the tripwire stays quiet, and the tally is merely, silently wrong. The first real traffic spike turns it into a crash loop, and the incident channel fills with the worst sentence in operations: \"no deploy went out, it just started crashing at peak.\" The nastier sibling skips the map: if the copied struct guards plain ints or slices instead, there is no runtime throw at all, only drift, and you are back in the data-race lab's silent-corruption territory with a lock in the code to point at and swear by. The whole class is catchable before merge for the price of one CI line, and the catch is not free by accident: <code>go test</code>'s vet subset does not include copylocks, so the pipeline must run <code>go vet ./...</code> explicitly. It is the cheapest concurrency insurance Go sells.",
	scar: "A copied mutex is a different mutex: a lock excludes only goroutines that share it, so a struct with a Mutex travels by pointer or not at all.",
	relatedSlugs: [
		"sync-mutex",
		"value-semantics",
		"maps",
		"race-detector",
	],
	unlockTier: 2,
}
