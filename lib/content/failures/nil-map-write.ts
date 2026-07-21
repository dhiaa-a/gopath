import { Failure } from "../../content"

export const nilMapWrite: Failure = {
	slug: "nil-map-write",
	name: "Write to nil map: the zero value that reads but won't write",
	category: "Language semantics",
	tagline:
		"A zero-value map answers every read with zeros, so the program sails past its checks and dies at the first write, far from where the map was never made.",
	symptom:
		"The weekly digest job panics on every run now. It is not dead on arrival: it prints its header and a progress line first, then dies with <code>panic: assignment to entry in nil map</code> and exit status 2. Two things about it refuse to add up. Nothing in the file assigns nil to anything, and searching for the word nil finds only the panic text itself. And the lines printed right above the crash read from the very stats the panic is about, and printed zeros without complaint, so the stats were visibly working moments before they were fatal.",
	labPath: "labs/failures/nil-map-write",
	runCommand: "go run .",
	tools: [
		"the panic text read literally, three words at a time: assignment, entry, nil map",
		"the stack trace as a trailhead, not a destination: it names the write site, and the bug lives at the construction site",
		"grep for the map field's name: every read, every write, and the make that never ran",
	],
	diagnosis: [
		{
			title: "Read the panic as three separate claims",
			body: "<code>assignment to entry in nil map</code> is dense with information if you take it one term at a time. <code>assignment</code>: a write, so every read this program did was fine, which matches the zeros in the progress lines. <code>entry</code>: storing a value under a key, an operation that needs somewhere to put it. <code>nil map</code>: the map was never <code>make</code>d, so the hash table that would hold the entry does not exist. The runtime is not reporting a corrupted map or a bad key. It is reporting that this map has no storage behind it, and the first operation that needed storage is where that fact finally mattered.",
			command: "go run .",
			output: `report: weekly word digest
tracking "config": seen 0 times so far
release-notes: 11 words, 0 distinct so far
panic: assignment to entry in nil map

goroutine 1 [running]:
main.(*Stats).Count(...)
        .../nil-map-write/main.go:21
main.main()
        .../nil-map-write/main.go:55 +0x4bf
exit status 2`,
		},
		{
			title: "The trace names the scene of the crash, not the cause",
			body: "The top frame is <code>(*Stats).Count</code>, at the line <code>s.counts[strings.ToLower(word)]++</code>. The instinct is to fix that line, and the instinct is exactly wrong, because that line is correct on any map that exists. A nil map is a where-did-it-come-from bug, so the move is to walk backward from the write to the birth: list every touch point of the field and look for the one that allocates. The grep answers in six lines: the field is declared once, written once, read twice, and <code>make</code> appears nowhere. A map that is never made stays nil forever. This program's map has no birthplace, and the two comment hits in the output are a reminder that grep is a blunt tool that still gets you there.",
			command: "grep -n \"counts\" main.go",
			output: `3:// wordstats builds the weekly word digest for the team channel: it counts
13:// Stats accumulates word counts across every batch fed to it.
15:	counts map[string]int
21:	s.counts[strings.ToLower(word)]++
27:	return len(s.counts)
32:	return s.counts[strings.ToLower(word)]`,
		},
		{
			title: "Why the reads let it get this far",
			body: "The panic feels like it comes out of nowhere precisely because everything before it worked, and that is not luck, it is the language rule. A nil map is a legal empty map for every read: <code>len</code> reports 0, a missing key hands back the zero value, <code>range</code> visits nothing. So the tracking line and the progress line printed honest zeros off a map that does not exist. Go permits this on purpose, so that zero values are usable without ceremony, and refuses only the write, because a write needs a real table to store into and allocating one silently behind your back was ruled out; the nil concept covers where that line sits for maps, slices, and channels. Notice the surgical precision here: <code>s.counts[w]++</code> is a read and then a write, and the read half of that very expression succeeded before the write half killed the process. Working reads are the camouflage. Never let one convince you a map was initialised.",
		},
		{
			title: "Find where the map was born",
			body: "Walk up the trace to the caller: main built the value with <code>r := Report{Title: \"weekly word digest\"}</code>. A composite literal fills every field you do not mention with its zero value, and the zero value of a map is nil. That line is the whole bug. It does not look like the whole bug, because it is far from the panic, mentions no map, and produces a <code>Report</code> that compiles and reads perfectly. The distance between that literal and the first write, one function call here, a package boundary in real code, is what makes nil-map panics feel random. The misconception underneath is treating a zero-value struct as a working struct. Some are designed to be, <code>bytes.Buffer</code> and <code>sync.Mutex</code> famously so; this one merely compiles.",
		},
	],
	fix: "Give the struct a birthplace: <code>NewReport</code> makes the map in the same moment the struct comes to exist, so no code path, present or future, can reach a write before the <code>make</code>. That is the shape in <code>fixed.go</code>, and the design rule it enacts: either make the zero value genuinely work, or make the constructor unavoidable, and never ship the in-between where reads work and writes are fatal. Prove it: <code>go run -tags fixed .</code> prints both batches and <code>words counted: 20 (15 distinct)</code>, exit 0. The tempting non-fix is lazy initialisation at the crash site: <code>if s.counts == nil { s.counts = make(map[string]int) }</code> at the top of <code>Count</code>. It makes this run print, and it scatters: every future mutating method must repeat the guard or panic, the struct's invariant now lives in n places instead of one, and the day two goroutines feed the aggregator, two of those lazy makes can race. Initialisation wants one home, at construction.",
	production:
		"The lab's distance between literal and write is one function call; in production it is usually a package boundary, and the classic carrier is decoding. <code>json.Unmarshal</code> allocates a map field only when the key is present in the document, so the config struct works for every tenant whose file has an <code>overrides</code> section and carries a nil map for the one tenant whose file does not. The panic then fires only for that tenant, on the one write path, while every test fixture, being complete, passes. Blast radius depends on where the write runs: inside an HTTP handler, <code>net/http</code> recovers the panic into a dropped connection and a stack trace in the logs; in a background goroutine there is no recover, and the whole process dies of one nil map. The diagnostic move does not change with the scale: read the panic's three claims, take the trace's write site as a trailhead, and hunt the construction site, grepping for the field and looking for the make that is not there.",
	scar: "A nil map answers every read with zeros and panics on the first write, so the bug lives where the map was born, not where the panic points.",
	relatedSlugs: ["nil", "maps", "structs", "pointers"],
	unlockTier: 1,
}
