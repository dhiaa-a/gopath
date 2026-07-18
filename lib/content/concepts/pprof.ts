import { Concept } from "../../content"

export const pprof: Concept = {
	slug: "pprof",
	name: "pprof",
	tagline:
		"The profiler answers precisely the question you asked, which is rarely the question you have.",
	summary:
		"<code>go test -cpuprofile cpu.out</code> and <code>go tool pprof</code> are the whole toolchain, plus a blank import of <code>net/http/pprof</code> to profile a live process. Two distinctions decide whether you read it right or waste an afternoon. <strong>Flat versus cum</strong>: flat is time in a function's own instructions, cum is flat plus everything it called, and the function you are looking for usually has zero flat. <strong>alloc_space versus inuse_space</strong>: alloc is everything ever allocated, inuse is what is still reachable, and for the same program at the same instant those two numbers differ by four orders of magnitude. Reach for the wrong one and the profile will tell you, honestly and precisely, that nothing is wrong.",
	mentalModel:
		"A CPU profile is not a description of your program. It is a description of what your program did during the seconds you were watching, sampled about 100 times a second, recording whatever was on a CPU when the timer fired. That single fact explains most of the confusion. An idle process profiles to nothing, so the load has to be running and has to be representative. The samples land in the functions where the instructions actually are, which is the runtime, not your code, so the top of the flat column is memmove and gcDrain and always will be. And work done on your behalf by another goroutine, above all the garbage collector chasing the garbage your loop made, is charged to that goroutine and appears in a completely different branch of the tree. So a function's cum is a floor on its true cost, never the cost. The profiler is a witness, not an auditor: it reports what it saw, on the stacks where it saw it, and connecting that to what you should change is your job.",
	retrievalPrompts: [
		"A service is burning CPU on garbage collection. You open /debug/pprof/heap, find a healthy 512kB heap, and conclude memory is not the problem. What did you get wrong? || The heap endpoint defaults to inuse_space, a snapshot of what is still reachable, and churn is by definition already collected so it cannot appear there. The same benchmark that reads 0 under inuse_space reads 9.48GB under -sample_index=alloc_space, same file, same run. inuse answers \"do I have a leak\". alloc answers \"am I making the collector work\". The default only answers one of them, and the Type: line in the header is the only thing that tells you which you are reading.",
		"pprof -top says runtime.memmove is your most expensive function at 23% flat. What do you optimise? || Not memmove, which you did not write and cannot edit. It is the symptom. Rank by cum instead and svc.Optimized shows up at 35.93% with 0.01s flat, because += compiles to a call into runtime.concatstrings and the instructions get attributed there. The flat column is where the instructions are; the question you have is which of your lines sent them there. -top -cum names the function, then -list attributes it to a source line.",
		"Your benchmark's only work is one function, and its cum is 35.93% of the profile. Where is the other 64%? || Largely the garbage collector, in a separate branch: runtime.gcBgMarkWorker.func2 at 35.65% cum in the same profile. Mark workers are their own goroutines, so the cost of collecting your garbage is charged to them and never appears under the function that made it. That is why cum is a floor, not a total, and why you cannot fix a GC-heavy profile by optimising the top of the flat column: gcDrain and scanobject are working perfectly. The only way to make the collector cheaper is to allocate less.",
	],
	codeExample: `package main

import (
	"bytes"
	"fmt"
	"runtime"
	"runtime/pprof"
	"strings"
)

var sink string

// render is the shape of a hot path that churns: every += allocates a new
// string and abandons the previous one.
func render(n int) string {
	report := ""
	for i := 0; i < n; i++ {
		report += "line of log output\\n"
	}
	return report
}

func main() {
	// Record every allocation instead of sampling one per 512kB, so the
	// profile's numbers are exact rather than extrapolated.
	runtime.MemProfileRate = 1

	for i := 0; i < 200; i++ {
		sink = render(500)
	}

	runtime.GC() // the heap profile is a sample set updated at GC

	// The debug=1 header carries both questions on one line:
	//   heap profile: <inuse_objects>: <inuse_bytes> [<alloc_objects>: <alloc_bytes>]
	var buf bytes.Buffer
	pprof.Lookup("heap").WriteTo(&buf, 1)
	fmt.Println(strings.SplitN(buf.String(), "\\n", 2)[0])

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	fmt.Printf("total allocated over the whole run: %d bytes\\n", ms.TotalAlloc)
}`,
	codeExplanation:
		"A run of this prints <code>heap profile: 59: 29336 [99858: 507984408] @ heap/2</code> and <code>total allocated over the whole run: 508373520 bytes</code>. Read the header: 59 objects and 29336 bytes are <em>live</em>, while the bracketed 99858 objects and 507984408 bytes are what the program <em>allocated</em>, and <code>TotalAlloc</code> independently confirms the second number. Same profile, same instant, one bracket apart: 29kB or 508MB, a factor of 17000, and both are correct. 29kB is genuinely all that is reachable, because every other string is already garbage. 508MB is what it cost to get there. That gap is the definition of churn, and it is invisible to <code>inuse_space</code> precisely because the collector is doing its job: memory that hurts you by being created and destroyed 100000 times is never there when you look. Your exact numbers will differ; the ratio is the point. In real work you do not read the header, you run the tool: <code>go test -run '^$' -bench . -benchmem -memprofile mem.out</code>, then <code>go tool pprof -top mem.out</code> for alloc_space and <code>go tool pprof -top -sample_index=inuse_space mem.out</code> for the snapshot. On the observability lab's benchmark those two commands print <code>Type: alloc_space</code> with 9.48GB at 100% on one function, and <code>Type: inuse_space</code> with <code>0, 0% of 0 total</code>. Note the defaults disagree with each other: <code>go test -memprofile</code> opens at alloc_space, the live <code>/debug/pprof/heap</code> endpoint opens at inuse_space, same tool and same format. The <code>Type:</code> line is the only thing that tells you which you got.",
	designRationale:
		"pprof samples because the alternative does not survive contact with production. Instrumenting every function entry and exit gives exact counts and an overhead that changes the program you were trying to measure, so Go's CPU profiler takes the other trade: a SIGPROF at about 100Hz, a stack walk, and an overhead small enough that the profiling endpoint can be left registered in a live service. What you buy is statistical, and that is fine for finding a bottleneck, where you want the function that owns 30% of the samples, and useless for questions about rare events, which is why the allocation profiler is a separate instrument with a separate sampling rate you can set to 1. The flat/cum split falls out of the same design. A sample is a whole stack, so pprof can attribute a sample to the leaf (flat) or to every frame on the stack (cum), and it reports both because neither alone is enough: flat finds the function that is genuinely slow, cum finds the function that is responsible. Go's compiler makes this sharper than it is elsewhere, because so much of what your code does is a call into the runtime. <code>+=</code> on a string is a call to <code>runtime.concatstrings</code>; a map insert, an interface conversion, a slice grow are all runtime calls. So the flat column of a Go profile is mostly the runtime by construction, and a first-time reader concludes the profiler is telling them nothing when it is telling them everything, in the column they are not reading. The one thing the design cannot fix is the collector. Mark workers are ordinary goroutines, so the cost of collecting your garbage lands on their stacks, and no view will ever draw that as one line with the loop that caused it.",
	commonMistakes: [
		{
			title: "Reading the flat column and concluding the runtime is the problem",
			body: "<code>runtime.memmove</code> at 23% flat is not something you can fix; it is the standard library copying the bytes your code asked it to copy. The function you want has zero flat time and lives in the cum column: in the observability lab <code>svc.Optimized</code> reads 0.01s flat and 35.93% cum, invisible at the top of <code>-top</code> and the widest thing you wrote under <code>-top -cum</code>. Rank by cum to find the function, then <code>-list</code> to find the line.",
			},
		{
			title: "Profiling an idle process",
			body: "A sampling profiler can only see stacks that are on a CPU when the timer fires. Take a 10 second profile of a service with no load and you get <code>Total samples = 0</code> and an empty table, and the conclusion drawn is usually that the code is fine. Start the load first, profile while it runs, and make sure the traffic is representative: profile the wrong path and you will optimise it, confidently, with a graph.",
		},
		{
			title: "Trusting the default sample_index",
			body: "<code>go test -memprofile</code> opens at <code>alloc_space</code>; <code>/debug/pprof/heap</code> opens at <code>inuse_space</code>. Same tool, same file format, opposite default, and nothing announces it except the <code>Type:</code> line in the header. In the observability lab that default is the difference between 9.48GB and zero on the identical run. Read the <code>Type:</code> line every time, and say which index you mean before you quote a number to anybody.",
		},
		{
			title: "Assuming a function's cum is what it costs",
			body: "It is a floor. Allocation is billed to the garbage collector's own goroutines: in that same profile <code>runtime.gcBgMarkWorker.func2</code> holds 35.65% cum in a branch that never mentions the loop whose garbage it is chasing. A function reading 36% can easily be responsible for 70%. It also cuts the other way, and it is why optimising whatever sits at the top of the flat column of a GC-heavy profile does nothing at all.",
		},
		{
			title: "Registering net/http/pprof on your public mux",
			body: "The blank import's <code>init</code> registers the handlers on <code>http.DefaultServeMux</code>. If your public listener serves that mux, you have published an endpoint that will burn 30 seconds of CPU profiling, or dump every goroutine stack, for anyone who asks. It is a free denial of service and an information leak, and it has been exploited repeatedly. Serve the default mux on a separate admin listener the internet cannot reach.",
		},
	],
	relatedSlugs: ["benchmarks", "escape-analysis", "goroutines", "http-handler", "tooling"],
}
