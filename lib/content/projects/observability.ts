import { Project } from "../../content"

export const observability: Project = {
	slug: "observability",
	name: "Observability & performance",
	tagline:
		"Profile a real service, find the bottleneck, fix it, and prove the improvement.",
	code: "OBS",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "14–16 hours",
	tags: ["pprof", "benchmarks", "runtime", "benchstat"],
	lab: {
		path: "labs/observability",
		command: "go test -tags gate -run TestGate ./...",
		summary: {
			en: "An inverted lab: the service ships complete and correct but deliberately slow, and the gate reruns BenchmarkBaseline and BenchmarkOptimized in one process, staying red until your rewrite of svc/optimized.go cuts ns/op by 40 percent and allocs/op by 50 percent against the shipped baseline.",
		},
	},
	mentalModels: [
		"measure before optimising",
		"the profiler tells you where, not whether it matters",
		"allocation is the primary cost",
		"one run is an anecdote, not a measurement",
		"the control group is the experiment",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Every other project on this site hands you stubs and asks you to fill them in. This one hands you a finished service. It compiles, it passes its tests, it returns exactly the right bytes on every request, and it is roughly thirteen times slower than it should be. Nothing here is broken. Your job is not to make it work, it is to find out where the time goes and prove you moved it.",
			},
		},
		{
			type: "text",
			value: {
				en: "That inversion is the point. Optimising code you just wrote is easy and misleading, because you remember what you did and you will guess right for the wrong reasons. Optimising a service you have never read is the actual job, and the only tool that survives contact with it is measurement. You will guess wrong at least once in this project. The guess is not the problem; shipping the guess without measuring it is.",
			},
		},
		{
			type: "text",
			value: {
				en: "The discipline underneath every step: measure, form one hypothesis, change one thing, measure again. Skip the first measurement and you cannot tell improvement from noise. Change two things and you cannot tell which one worked. This project is built so that shortcut hurts immediately rather than six months later.",
			},
		},
		{
			type: "code",
			value: `throughput number → live CPU profile → read it (flat vs cum)
 → allocation profile names the line → baseline benchmark
 → one fix → benchstat proves it → gate measures it → service re-measured`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/observability/
 ├── main.go               - the service; blank-imports net/http/pprof on admin :6060
 ├── loadgen/              - stdlib load generator, so the lab needs no external tool
 └── svc/
     ├── svc.go            - Entry, GenEntries: the input everything measures on
     ├── baseline.go       - the slow path, complete; the anchor, pinned by a golden test
     ├── optimized.go      - starts as an exact copy of Baseline; the only file you edit
     ├── solution.go       - the reference fix (build tag solution)
     ├── correctness_test.go - Optimized must match Baseline byte for byte
     ├── bench_test.go     - BenchmarkBaseline + BenchmarkOptimized, same input
     └── gate_test.go      - TestGateSpeedup: correctness, then the relative speedup`,
		},
	],
	constraints: [
		{
			type: "list",
			items: [
				{
					en: "svc/baseline.go never changes. It is the fixed point every number in this lab is relative to, and a golden test fails loudly if it drifts. Editing the anchor to make your number look better is not a fix, it is moving the goalposts, and the suite treats it as a failure.",
				},
				{
					en: "The output must not change. Optimized is pinned to Baseline byte for byte at n=0, 1, and 1000, and the gate rechecks that before it measures anything. A faster function with different output is a bug you have not noticed yet.",
				},
				{
					en: "Every threshold is relative to Baseline measured in the same process, never an absolute nanosecond count. Both sides move together on a slow or loaded machine; the ratio does not. That is what makes the gate portable to your laptop.",
				},
				{
					en: "Never profile or gate under -race. The detector instruments every memory access and allocation, so you would be measuring the instrumentation. The one race this lab could produce does not exist in a pure function.",
				},
				{
					en: "One change at a time. The lab is small enough that you could rewrite Optimized three ways in an afternoon; if you do it in one pass you will not know which change bought the win, and that knowledge is the entire deliverable.",
				},
			],
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Get the number before you get an opinion" },
			uses: ["http-handler"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been told this service is slow. That is a claim, not a measurement, and you cannot improve a claim. Before you open a profiler, before you read a line of svc/, get the number the service actually produces under load, because every decision from here is a comparison against it and \"it feels faster\" is not a comparison. This is also the last moment you are allowed to be innocent of the code: read svc/optimized.go now and you will spend the rest of the project confirming a hunch instead of following evidence.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "From labs/observability, start the service with go run . and drive it with go run ./loadgen -n 10000 -c 50 in a second terminal. Write down the requests per second. Then run the cheapest experiment available: restart the service with go run . -n 100, which renders 10 times fewer entries per request, and load it again. Compare the two throughput numbers before you form any theory about the cause.",
					},
					rationale: {
						en: "That second measurement is a complexity probe, and it settles something a profiler cannot. If the render were linear in n, then shrinking n by 10 shrinks per-request time from (overhead + 1000c) to (overhead + 100c), and throughput can rise by at most 10x, hitting exactly 10x only if the fixed overhead were zero. So any ratio above 10x is proof the render is superlinear in its input, with no profiler, no flags, and no reading of the source. That is worth internalising: scaling the input is the cheapest experiment in performance work, it runs from outside the process, and it tells you the shape of the cost before you know a single function name.",
					},
					hints: [
						{
							label: "why 50 concurrent and not 1",
							value: "A single sequential client measures latency on an idle machine, which is the one condition production never has. Fifty in flight makes the goroutines compete for cores and for the allocator, and the cost this service has gets dramatically worse under exactly that pressure. The number you want is the one taken under contention.",
						},
						{
							label: "hey and ab work too",
							value: "hey -n 10000 -c 50 http://127.0.0.1:8080/process is the same experiment. loadgen exists so the lab needs nothing installed, and it drains every response body, which matters: a dropped body forces a new TCP connection per request and you would be measuring the handshake.",
						},
						{
							label: "what the probe does not tell you",
							value: "It says superlinear. It does not say quadratic, and it cannot: the fixed HTTP overhead sits in both measurements and flattens the ratio away from the true exponent. Read it as a direction, not a number. Naming the exponent is what the profile and the benchmark are for.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability",
					command:
						"# terminal 1:\ngo run .\n\n# terminal 2:\ncurl -s -o /dev/null -w \"%{size_download} bytes\\n\" http://127.0.0.1:8080/process\ngo run ./loadgen -n 10000 -c 50\n\n# then restart terminal 1 with 10x less input and repeat terminal 2:\ngo run . -n 100",
					expect: {
						en: "A 67238-byte response and something near \"10000 requests in 51.054s (196 req/s)\" at n=1000, then a 6633-byte response and something near \"10000 requests in 1.846s (5416 req/s)\" at n=100. Your absolute numbers will differ with your machine and the ratio is the part that matters: 10 times less input bought about 27 times more throughput. Linear code cannot do that. Something in the render is superlinear in the number of entries, and you have not read a line of it.",
					},
					labPath: "labs/observability/loadgen/main.go",
					note: {
						en: "Keep both numbers. The 196 req/s at n=1000 is the headline you will re-measure in step 09, and it is the only number in this project that a user of the service would ever notice.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Run the load generator against a service that is not running: stop terminal 1, then run go run ./loadgen -n 10000 -c 50 anyway.",
					},
					observe: {
						en: "It exits 1 almost instantly with \"10000 of 10000 requests failed; is the service running on http://127.0.0.1:8080/process?\" rather than reporting a spectacular req/s.",
					},
					why: {
						en: "This is a load generator refusing to report a number it did not earn, and it is worth seeing once because the opposite is a genre of self-inflicted wound. A harness that counts failed requests as completed requests measures the speed of your connection errors, and connection errors are extremely fast. The result is a benchmark that improves every time the service gets worse, which is the most expensive kind of wrong: it is not noise, it is a number pointing confidently backwards. Any time a performance result surprises you in the good direction, check that the work actually happened before you go and celebrate.",
					},
				},
			],
			retrievalPrompt:
				"You shrink the input 10x and throughput rises 27x. What have you proved, and what have you not? || You have proved the cost is superlinear in the input: linear code has per-request time (overhead + c·n), so cutting n by 10 can raise throughput by at most 10x, and only if overhead were zero. You have not proved it is quadratic. The fixed HTTP overhead sits in both measurements and pulls the ratio below the true exponent, so the probe gives you a direction, not a degree.",
		},
		{
			n: "02",
			heading: { en: "Profile the process that is actually serving traffic" },
			uses: ["http-handler", "packages"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You know the render is superlinear. You do not know which line. The next instinct is to read svc/ until the bug jumps out, and on a file this small that would even work, which is exactly why it is a bad habit to build here: the service you debug at 02:00 will be forty thousand lines written by people who left, and reading it is not an option. The profiler is not a shortcut for small programs. It is the only thing that scales.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Take a CPU profile of the live service while the load generator is running against it, over HTTP from the admin port: go tool pprof -top \"http://127.0.0.1:6060/debug/pprof/profile?seconds=10\". Start the load first and take the profile while it runs. Name the function at the top of the flat column. Do not act on it yet.",
					},
					rationale: {
						en: "Two things are load-bearing here and neither is obvious. First, the blank import _ \"net/http/pprof\" in main.go does all of this: its init function registers the /debug/pprof/ handlers on http.DefaultServeMux, which is why a package imported purely for its side effect is worth understanding rather than copying. Second, main.go serves that default mux on a separate admin listener while the public mux gets its own. That split is not tidiness. Import net/http/pprof into a service whose public listener uses DefaultServeMux and you have published a handler that will take a 30-second CPU profile, or dump every goroutine stack, to anyone who asks. It is a real and repeatedly exploited denial of service, and the fix is the one this service already does: profiling endpoints live on an interface the internet cannot reach.",
					},
					hints: [
						{
							label: "why the load has to be running",
							value: "pprof is a sampling profiler: the runtime interrupts about 100 times a second and records the stack of whatever is on CPU. An idle process is on no stack, so the profile comes back empty. It samples what is happening, so you have to make the thing you care about happen.",
						},
						{
							label: "seconds=10 versus seconds=30",
							value: "The parameter is how long the server samples before it answers, so the command blocks for that long. Ten seconds is enough here because the load is saturating the machine and every sample lands in the same place. Thirty is the better default for a real service, where the interesting path might be a small fraction of traffic.",
						},
						{
							label: "the flamegraph, honestly",
							value: "go tool pprof -http=:8081 \"http://127.0.0.1:6060/debug/pprof/profile?seconds=10\" opens the browser UI, and View > Flame Graph is the view people mean when they say flamegraph. It is genuinely the best way to see a call tree at a glance. It also needs a browser and Graphviz, which is why every check in this project uses -top and -list instead: those print to a terminal and are the same data.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability",
					command:
						"# terminal 1:\ngo run .\n\n# terminal 2, start the load first:\ngo run ./loadgen -n 10000 -c 50\n\n# terminal 3, while the load runs:\ngo tool pprof -top -nodecount=8 \"http://127.0.0.1:6060/debug/pprof/profile?seconds=10\"",
					expect: {
						en: "A header reading \"Duration: 10.18s, Total samples = 51.94s (510.31%)\" and a table whose widest flat entry is runtime.memmove at about 24.76%. Two things to notice before you move on. The percentage is over 100 because samples are per-core and five of them were busy. And the most expensive function in your service is memmove, which is the standard library copying bytes: you did not write it, you cannot edit it, and it is not the bug. It is the symptom of the bug.",
					},
					labPath: "labs/observability/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Take the same profile with no load running. Stop the load generator, wait for it to exit, then rerun the pprof command against the idle service.",
					},
					observe: {
						en: "\"Total samples = 0\" and a table with nothing in it. Ten seconds of profiling a service that is doing nothing produces no evidence at all.",
					},
					why: {
						en: "A sampling profiler can only see stacks that are on a CPU when the timer fires, and an idle process has none. This is the single most common way a first profiling attempt gets thrown away: the profile is taken, it is empty or nearly so, and the conclusion drawn is that the code is fine. The profile is not a description of your program. It is a description of what your program did during those ten seconds, which is why the load has to be running and has to be representative. Profile the wrong traffic and you will optimise the wrong path with total confidence and a graph to back it up.",
					},
				},
			],
			retrievalPrompt:
				"Why does main.go serve pprof on a second listener instead of registering it on the public mux? || Because net/http/pprof's init registers its handlers on http.DefaultServeMux, so any service whose public listener uses that mux is offering strangers a handler that will burn 30 seconds of CPU profiling, or dump every goroutine stack, on request. It is a free denial of service and an information leak. The endpoints belong on an interface only your own tooling can reach.",
		},
		{
			n: "03",
			heading: { en: "Read the profile instead of skimming it" },
			uses: ["goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The profile named runtime.memmove. That is useless as an instruction and perfect as a clue, and the gap between those two is the skill this step is about. Almost everyone reads the first column of pprof output, sees runtime functions they cannot edit, and concludes the profiler is not telling them anything. It is telling them everything. They are reading the wrong column.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Work from a benchmark profile now rather than the live service, because it is repeatable and it takes two seconds: from labs/observability/svc, run go test -run '^$' -bench BenchmarkOptimized -benchmem -cpuprofile cpu.out. Then read it three ways. go tool pprof -top cpu.out ranks by flat. go tool pprof -top -cum cpu.out ranks by cumulative. go tool pprof -list 'Optimized$' cpu.out attributes time to individual source lines. Find the line number in svc/optimized.go that the profiler blames, and account for where the rest of the CPU went.",
					},
					rationale: {
						en: "Flat is time spent executing that function's own instructions. Cumulative is flat plus everything it called. A function that does nothing but call expensive things has zero flat and enormous cum, and svc.Optimized is exactly that: it has no flat time at all, because a += compiles to a call into runtime.concatstrings and the actual work happens in there. Rank by flat and your function is invisible. Rank by cum and it is the widest thing you wrote. This is why the first pprof view most people ever see appears to be about the runtime: it is, because that is where the instructions are, and the question you actually have is which of your lines sent them there. -list answers that directly, and it is the command to reach for once -top -cum has told you which function to open.",
					},
					hints: [
						{
							label: "the regex is a regex",
							value: "go tool pprof -list Optimized cpu.out matches BenchmarkOptimized as well, because -list takes a pattern and matches anywhere in the qualified name. 'Optimized$' anchors it to the end. Small thing, but the un-anchored version prints two routines and quietly makes you read the wrong one.",
						},
						{
							label: "account for the missing time",
							value: "Add up the cum of svc.Optimized and you will find it is well under half the total samples, in a benchmark that does nothing else. The rest is not overhead and it is not measurement error. Find it in the -cum listing before you read the answer below: the function names begin with gc.",
						},
						{
							label: "-http on a file works too",
							value: "go tool pprof -http=:8081 cpu.out opens the same browser UI on a saved profile, flamegraph included, with no service running and no load. Once you have a cpu.out you can look at it any way you like, any time, which is the argument for saving profiles rather than reading them once.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability/svc",
					command:
						"go test -run '^$' -bench BenchmarkOptimized -benchmem -cpuprofile cpu.out\ngo tool pprof -top cpu.out\ngo tool pprof -top -cum cpu.out\ngo tool pprof -list 'Optimized$' cpu.out",
					expect: {
						en: "The benchmark reports about 5065254 ns/op and 1001 allocs/op. -top puts runtime.memmove first at about 20.48% flat, with runtime.concatstrings at 37.20% cum and runtime.scanobject at 25.94% cum. -top -cum shows the line that matters: \"0 0% svc.Optimized (inline)\" with 1.10s cumulative, 37.54%. Zero flat, a third of the profile. And -list prints your loop with 1.09s of that 1.10s parked on one line: report += e.Stamp + \" [\" + ... The profiler has now named a source line, which is what you came for.",
					},
					labPath: "labs/observability/svc/optimized.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Take the numbers seriously. svc.Optimized is 37.54% of the profile, and the benchmark loop calls nothing else. Predict what the other 62% is, then find it: go tool pprof -top -cum cpu.out and read the entries whose names start with runtime.gc.",
					},
					observe: {
						en: "runtime.gcBgMarkWorker.func2 at 0.99s, 33.79%, and runtime.gcDrain right behind it. The garbage collector is very nearly as expensive as your function, and it sits in a completely separate branch of the profile. Look back at the live profile header too: 51.94s of samples in 10.18s of wall time. Five cores busy, and only one of them was running your handler.",
					},
					why: {
						en: "The GC's mark workers are their own goroutines, so their cost is charged to them and never appears under the function whose garbage they are chasing. Your loop allocates; the bill arrives on someone else's stack. This is the most important thing to understand about reading a Go CPU profile, and it cuts both ways. It means a function's cum is a floor on its true cost, not the cost: Optimized reads as 37% and is responsible for something closer to 70% once the collection it caused is counted. And it means you cannot fix a GC-heavy profile by optimising the functions at the top of the flat column, because those functions are gcDrain and scanobject and they are working perfectly. The only way to make the collector cheaper is to stop making it work, which is a question about allocation, and the CPU profile is the wrong instrument for that question.",
					},
				},
			],
			retrievalPrompt:
				"svc.Optimized shows 0 flat and 37.54% cum, while GC mark workers account for another 33.79% in a separate branch. What does that tell you about the true cost of Optimized? || That 37.54% is a floor, not the answer. Flat is zero because += compiles to a call into runtime.concatstrings, so the instructions are attributed there. And the garbage it produces is collected by gcBgMarkWorker, which is a different goroutine, so that cost is charged to the collector rather than to the code that caused it. Optimized is responsible for roughly both numbers, and the CPU profile will never show that as one line.",
		},
		{
			n: "04",
			heading: { en: "Ask the allocation profile, which has no such tact" },
			uses: ["pprof", "escape-analysis"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The CPU profile made you work: your function had zero flat time, the expensive names were all in the runtime, and a third of the cost was hiding on the collector's goroutines. The allocation profile does not make you work. It names your function, with 100% next to it, in the first line of output. That difference is not luck. It is the instrument matching the question, and knowing which question you are asking is most of performance work.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "From labs/observability/svc, take a memory profile: go test -run '^$' -bench BenchmarkOptimized -benchmem -memprofile mem.out. Read it with go tool pprof -top mem.out, then read the same file again with go tool pprof -top -sample_index=inuse_space mem.out. Explain the difference between the two totals before you continue. Then go tool pprof -list 'Optimized$' -sample_index=alloc_objects mem.out for the per-line object count.",
					},
					rationale: {
						en: "One memory profile carries four different measurements and answers two unrelated questions. alloc_space and alloc_objects are cumulative since the process started: everything ever allocated, including every byte already collected. inuse_space and inuse_objects are a snapshot of what is still reachable right now. Leak hunting is an inuse question, because a leak is memory that is still held. GC pressure is an alloc question, because churn is memory that was allocated and immediately thrown away, and by definition none of it is still there to be counted. Reach for the wrong index and the profile will honestly and precisely tell you nothing is wrong. The defaults make this worse rather than better, which is why this step has you run both by hand.",
					},
					hints: [
						{
							label: "the defaults disagree with each other",
							value: "go test -memprofile defaults to alloc_space when you open it. The live endpoint at /debug/pprof/heap defaults to inuse_space. Same tool, same file format, opposite default, and nothing tells you which one you are looking at except the \"Type:\" line in the header. Read that line every time. It is the difference between 11GB and 512kB in this very lab.",
						},
						{
							label: "-benchmem is the cheap version of this",
							value: "The B/op and allocs/op columns you have been printing all along are the same fact in miniature: 36208545 B/op and 1001 allocs/op is the whole story of this bug in two numbers. The profile is how you find out which line, when the answer is not one function long.",
						},
						{
							label: "why allocation is the thing to look at first in Go",
							value: "Not because allocation is slow. mallocgc is fast. It is that every allocation is a future obligation: something has to scan it, mark it, and free it, and that work happens later, on other threads, charged to the collector. A hot path that allocates per iteration is buying CPU on credit, and step 03 is where you saw the bill.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability/svc",
					command:
						"go test -run '^$' -bench BenchmarkOptimized -benchmem -memprofile mem.out\ngo tool pprof -top mem.out\ngo tool pprof -top -sample_index=inuse_space mem.out\ngo tool pprof -list 'Optimized$' -sample_index=alloc_objects mem.out",
					expect: {
						en: "The first read says \"Type: alloc_space\", a total of about 11.09GB, and svc.Optimized flat at 100% of it. The second says \"Type: inuse_space\", a total of about 512.05kB, and svc.Optimized does not appear anywhere in it: the top entry is runtime.acquireSudog, which is the collector's own bookkeeping. Same file, same run, same function: eleven gigabytes or nothing at all, depending on one flag. The -list run puts about 330633 allocated objects, 98.37% of the profile, on the one line you already know.",
					},
					labPath: "labs/observability/svc/bench_test.go",
					note: {
						en: "11.09GB is the total across every warm-up and timed iteration the harness ran, not per operation. Per operation it is the 36208545 B/op the benchmark prints. Both are true and the units are different, which is worth being careful about before you quote a number to anybody.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Go back to the live service and ask it the same question both ways. Start it with go run ., start the load, and while it runs: go tool pprof -top -nodecount=4 \"http://127.0.0.1:6060/debug/pprof/heap\" and then the same command with -sample_index=alloc_space.",
					},
					observe: {
						en: "The default view says \"Type: inuse_space\" and puts svc.Optimized at 5341.70kB, about 67%. Five megabytes, on a service that is on fire. Add -sample_index=alloc_space and the same function, in the same process, at the same instant, reads 217.83GB at 100%.",
					},
					why: {
						en: "Both numbers are correct. Five megabytes is genuinely what is live at the moment of the snapshot: fifty concurrent renders each holding an intermediate string, and nothing else, because every other string this service has ever built is already garbage. 217 gigabytes is what it allocated to get there. The gap between them is not a bug in the tool, it is the definition of churn, and it is why an engineer who opens /debug/pprof/heap to investigate a CPU problem finds a perfectly healthy five megabyte heap and goes looking somewhere else. The garbage is invisible to inuse_space precisely because the collector is doing its job. Memory that causes your problem by being created and destroyed forty thousand times a second is memory that is never there when you look.",
					},
				},
			],
			retrievalPrompt:
				"A service is burning CPU on GC. You open /debug/pprof/heap, see a healthy 5MB heap, and conclude memory is not the problem. What did you get wrong? || The heap endpoint defaults to inuse_space, which is a snapshot of what is still reachable. Churn is by definition already collected, so it cannot appear there: the same process at the same instant showed 217GB under -sample_index=alloc_space. inuse answers \"do I have a leak\". alloc answers \"am I making the collector work\". Those are different questions and the default only answers one of them.",
		},
		{
			n: "05",
			heading: { en: "Record the baseline, and find out how much your machine lies" },
			uses: ["benchmarks"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You know the line. The temptation now is to fix it, run the benchmark, see a smaller number, and call it done. Do not, and not because process is virtuous: because you are about to discover that this machine reports the same unchanged code as 10.2ms and 19.1ms in the same minute, and any conclusion you draw from a single before-and-after pair is a coin flip you have dressed up as engineering.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Before you change any code, record the baseline. From labs/observability/svc: go test -run '^$' -bench . -benchmem -count=10 > before.txt. Read the ten BenchmarkBaseline lines and note the spread between the fastest and the slowest. Note separately what the allocs/op column does across those same ten runs. Do not edit anything until before.txt exists.",
					},
					rationale: {
						en: "-count runs the whole benchmark that many times as independent samples, which is the raw material for deciding whether a difference is real. Ten is the number to use here and it is not arbitrary: benchstat needs at least six samples to compute a confidence interval at the 0.95 level and prints ± ∞ on every row below that, and ten leaves margin for the machine to misbehave during one of them. The deeper reason to take the baseline first is that it is the only measurement you can never take again. Once optimized.go is edited, the state that produced 196 req/s is gone, and \"I think it was about ten milliseconds\" is not a baseline, it is a memory.",
					},
					hints: [
						{
							label: "the two columns behave completely differently",
							value: "ns/op is a wall clock reading and it is at the mercy of thermal throttling, other processes, and where the scheduler put your goroutine. allocs/op is a count the runtime increments; it does not care that you opened a browser. Watch which one moves across the ten runs and which one does not. That asymmetry decides which number you should be arguing from.",
						},
						{
							label: "PowerShell will corrupt this file",
							value: "> in PowerShell writes UTF-16, and benchstat cannot read it. Use | Out-File -Encoding utf8 before.txt, or run these commands in Git Bash or cmd. Worth knowing before you spend twenty minutes debugging a statistics tool that is not broken.",
						},
						{
							label: "what a real measurement environment looks like",
							value: "Close the browser, disable the turbo, pin the CPU governor, and use a machine nobody is logged into. You are not going to do that for this lab and you do not need to, because both sides of the comparison move together. Know the difference between measurements you can defend on a laptop, which are ratios, and measurements you cannot, which are absolutes.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability/svc",
					command:
						"go test -run '^$' -bench . -benchmem -count=10 > before.txt\ncat before.txt",
					expect: {
						en: "Twenty lines, ten per benchmark. The BenchmarkBaseline lines will spread substantially: a representative run here gave 10159848, 19146624, 14781590, 17100272 and 11114729 ns/op among them, nearly a factor of two, with nothing changed and nothing running but the benchmark. Now look left at the allocs/op column on those same lines: 1000, ten times out of ten, exactly. Nothing in this project is a better argument than those two columns sitting next to each other.",
					},
					labPath: "labs/observability/svc/bench_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Simulate the mistake rather than making it. Take the fastest BenchmarkBaseline line in your before.txt and the slowest one, and read them as if they were a before and an after: pretend you had run -count=1, made a change, and run -count=1 again.",
					},
					observe: {
						en: "Depending on which way round they fall, you have either made the code 47% faster or 88% slower. The code is identical. Both files are BenchmarkBaseline, a function nobody has touched, measured minutes apart on an idle machine.",
					},
					why: {
						en: "This is what a single benchmark run is worth, and the number was large enough to be completely convincing in either direction. A 47% win is the kind of result that gets written up and merged. The mechanism is mundane, which is the point: thermal state, another core waking up, where the scheduler happened to put the goroutine, whether the GC was mid-cycle when the timer started. None of it is under your control and all of it is bigger than most real optimisations. This is why the whole discipline exists, and it is why the gate in this lab measures Baseline and Optimized in one process, back to back, rather than trusting two files written minutes apart. The 40% ns threshold sounds generous until you notice this machine can produce 88% of drift on its own.",
					},
				},
			],
			retrievalPrompt:
				"Across ten runs of untouched code, ns/op swung nearly 2x while allocs/op was identical every time. Why, and which number should you argue from? || ns/op is a wall clock reading, so it absorbs thermal state, scheduling, other processes, and GC timing. allocs/op is a counter the runtime increments as it hands out memory, so it is deterministic for deterministic code. Argue from allocs when you can: it is the number that does not move when your laptop does. That is also why the gate's alloc threshold can be strict while the ns threshold needs headroom.",
		},
		{
			n: "06",
			heading: { en: "One change, on the line the profiler named" },
			uses: ["slices"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Everything so far was to earn the right to edit one line. The profile named it, the allocation profile counted it, and the baseline is on disk. Now the temptation flips: having spent five steps investigating, it feels proportionate to rewrite the function properly, add a sync.Pool, maybe cache the whole report. Resist all of it. One change, then measure. If you make three and the number moves, you have learned nothing about which of them mattered, and you will carry all three into the next codebase.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Fix svc/optimized.go and nothing else. Strings in Go are immutable, so report += ... cannot append: it must allocate a new string the size of everything so far plus the new piece, copy the old bytes in, copy the new bytes in, and abandon the previous one. That is one allocation and a full copy per iteration, which is 1000 allocations and roughly 30MB of memmove to produce a 67KB report. Replace it with a single growing buffer via strings.Builder, size the buffer once up front with Grow, and return Builder.String(). The output must remain identical: go test ./... has been green since before you started and must stay green.",
					},
					rationale: {
						en: "strings.Builder is a []byte and an append, with one trick that matters: String() converts the buffer to a string with an unsafe pointer conversion rather than a copy, which it is allowed to do only because the Builder guarantees nobody else has a reference to those bytes. That is the whole reason it exists instead of just using bytes.Buffer and calling String(), which does copy. Grow is the second-order win: without it the buffer doubles as it fills, so a 67KB report costs about a dozen reallocations and copies rather than one. With it there is exactly one allocation for the whole function, which is the 1 in the allocs/op column you are about to see. Note what this fix is not: it is not a cleverer algorithm. It is the same loop over the same entries doing the same concatenation, and every byte of the win comes from not throwing the buffer away 1000 times.",
					},
					hints: [
						{
							label: "the copyCheck, and why Builder must not be copied",
							value: "Builder holds a pointer to itself to detect being copied by value after first use, and panics with \"illegal use of non-zero Builder copied by value\" if you do. That is because the unsafe String() trick is only sound while exactly one Builder owns the buffer. Declare it as var b strings.Builder and never pass it by value, and you will never meet the panic.",
						},
						{
							label: "how much to Grow by",
							value: "len(entries) * 80 is a fine estimate: about 67 bytes per line here, rounded up, and Grow only ever over-allocates at worst. It does not need to be exact. It needs to be one call instead of a doubling sequence, and an estimate that is close is worth more than a computation that is precise.",
						},
						{
							label: "what about sync.Pool",
							value: "It is the right tool for recycling expensive per-call objects across requests, and it is the wrong tool here: after Grow there is exactly one allocation left, and pooling it would add complexity and a Reset you can forget in exchange for removing one alloc per call. Reach for a Pool when the profile says allocation is still your cost after the obvious fix. Here the profile will not say that.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability/svc",
					command:
						"go test ./...\ngo test -run '^$' -bench BenchmarkOptimized -benchmem -count=1",
					expect: {
						en: "The suite stays green, including the 1000-entry production-shape case and the ones for a nil slice, a zero-value entry, and a message with an embedded newline. The benchmark falls to a few tens of microseconds, from about 10 million ns/op: runs on this machine landed anywhere between 29000 and 81000 ns/op, which is step 05's variance turning up exactly where you would now expect it. The two columns either side of it do not wobble at all: 81920 B/op and 1 allocs/op, every run. The allocs column going 1001 to 1 is the fix; the ns column is the consequence. 81920 bytes rather than the 80000 you asked Grow for is the allocator rounding up to a size class.",
					},
					labPath: "labs/observability/svc/correctness_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Write the fast, wrong version on purpose: delete the b.WriteByte('\\n') from the end of your loop, so the report is built without its line breaks. Then run the benchmark and the gate, in that order: go test -run '^$' -bench BenchmarkOptimized -benchmem, then go test -tags gate -run TestGate ./...",
					},
					observe: {
						en: "The benchmark is delighted: about 25250 ns/op, against the roughly 44000 your correct version managed. Note what did not move: still 1 allocs/op, still 81920 B/op, because the Grow you asked for dominates the byte count and the report being smaller does not change it. The only number that moved is the one that looks like a win. The gate fails anyway, at n=1, with \"Optimized output is wrong at n=1 entries (got 58 bytes, want 59)\".",
					},
					why: {
						en: "A benchmark cannot fail. It has no assertions; it is a stopwatch, and a stopwatch times whatever you give it, including nonsense. This is not hypothetical: the fastest possible implementation of any function is the one that returns immediately without doing the work, and every optimisation is a step along that road with correctness as the only thing telling you where to stop. It is why the gate rechecks the output before it looks at a single nanosecond, and why it does it at n=1 as well as n=1000: a dropped trailing newline is one byte in 67238 at production size, comfortably inside the range where a skim would miss it, and it is 1 byte in 59 where the check will catch it. Restore the WriteByte before you continue.",
					},
				},
			],
			retrievalPrompt:
				"strings.Builder and bytes.Buffer both build byte sequences. Why does the standard library ship Builder at all? || Builder.String() converts its buffer to a string with an unsafe pointer conversion and no copy, which is sound only because the Builder guarantees sole ownership of those bytes: that is what the copy-check panic protects. bytes.Buffer.String() has to copy, because the Buffer's bytes can still be written to afterwards. On a 67KB report that is one whole extra copy of the result, on the way out of the function.",
		},
		{
			n: "07",
			heading: { en: "Prove it, with the control group you have had all along" },
			uses: ["benchmarks"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The number went from ten milliseconds to sixty microseconds. You do not need statistics to believe a 99% cut, and this step is not really about believing this result. It is about the results you will get for the rest of your career, which look like 4%, and about the fact that this lab hands you a control group most benchmark comparisons do not have and almost nobody thinks to build.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Re-measure with identical flags and the same -count=10: go test -run '^$' -bench . -benchmem -count=10 > after.txt. Run benchstat before.txt after.txt. Read the Optimized row, then read the Baseline row, which is the more informative of the two. Then write the paragraph that is this project's real deliverable: what you changed, and why it reduced allocation and copying. If you cannot write the mechanism down in your own words, you have a number rather than an understanding.",
					},
					rationale: {
						en: "benchstat compares two sets of samples and reports a percentage only when a Mann-Whitney U test says the difference is unlikely to be chance, printing ~ when it is not. That is the guard against the coin flip you performed by hand in step 05. But the reason to run the whole -bench . rather than just BenchmarkOptimized is subtler and it is the point of this step: BenchmarkBaseline is a control group. You did not touch svc/baseline.go, so its row should read ~. If it does not, the two files were measured under different conditions and every conclusion you draw from the comparison inherits that drift, including the one you like.",
					},
					hints: [
						{
							label: "installing benchstat on this toolchain",
							value: "go install golang.org/x/perf/cmd/benchstat@latest fails on Go 1.22: x/perf now requires Go 1.25 or newer and the module refuses to build. Pin a commit from before that bump instead: go install golang.org/x/perf/cmd/benchstat@400946f43c82. It is the one external tool in this project and it stays optional; the gate in step 09 is the machine check and needs nothing installed.",
						},
						{
							label: "p < 0.05 is not a synonym for real",
							value: "It means \"unlikely to be chance\", nothing more. In this very lab, -count=5 reports Baseline's allocs/op as +0.10% with p=0.008, which is a rock solid statistical finding about an integer rounding artifact in AllocsPerOp. Significance answers whether the difference exists. Whether it matters is a question no test will ever answer for you.",
						},
						{
							label: "~ is a result",
							value: "It does not mean the tool failed or that you need more runs. It means the data does not support a claim of difference, and reporting that honestly is the whole job. On the Baseline row it is the outcome you want.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability/svc",
					command:
						"go test -run '^$' -bench . -benchmem -count=10 > after.txt\nbenchstat before.txt after.txt",
					expect: {
						en: "Three tables, one per metric. The Optimized rows are unambiguous: sec/op about -99.57% with p=0.000, allocs/op -99.90%, both far outside anything noise could produce. The allocs/op table is the cleanest thing benchstat will print for you all year: Optimized 1001.000 ± 0% becomes 1.000 ± 0%, and Baseline reads ~ (p=1.000 n=10), a perfect null result on code nobody edited. And no ± ∞ anywhere, because you used -count=10 rather than 5.",
					},
					labPath: "labs/observability/svc/bench_test.go",
					note: {
						en: "benchstat is a separate binary, not a go tool subcommand. If the command is not found, the hint above has the install line that actually works on Go 1.22.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Do not change anything. Just read the Baseline row of the sec/op table, the one for the function you never edited, and take its claim as seriously as you took Optimized's.",
					},
					observe: {
						en: "A representative run here reported Baseline-8 at 9.188m ± 25% before and 5.878m ± 34% after: -36.03%, with p=0.019. benchstat is stating, correctly and with statistical significance, that a function nobody touched got 36% faster between the two files.",
					},
					why: {
						en: "Nothing is wrong with benchstat. The machine drifted between the runs, exactly as step 05 promised, and the test faithfully reports a real difference between two sets of samples: it has no way to know the code was identical, because that is your job. This is why the control group is not ceremony. Had you run only BenchmarkOptimized, you would have -99.57% with p=0.000 and complete confidence, never learning that this measurement environment was manufacturing 36% swings underneath you. Here the win is so large it survives, and that is luck rather than method. On the 4% optimisation you will actually be arguing about next year, a 36% drift is not a footnote, it is the entire result. It is also the argument for the gate in step 09: it measures both functions in the same process, seconds apart, because two files written minutes apart are two different experiments.",
					},
				},
			],
			retrievalPrompt:
				"benchstat says your optimisation is -99.57% with p=0.000. Why is the row for the function you did not touch the more important one to read? || Because it is the control. Untouched code should report ~, and if it instead reports a significant change, the two sample sets were taken under different conditions and that drift contaminates every row in the table, including the one you like. p=0.000 says a difference exists between two sets of numbers. It cannot say the difference came from your edit rather than from your laptop warming up.",
		},
		{
			n: "08",
			heading: { en: "Confirm the mechanism, and learn what the tool cannot see" },
			uses: ["pointers"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have a fix and a proof. What you do not have yet is the compiler's account of why, and there is one available: escape analysis will tell you, per line, which values it was forced to put on the heap. It is also the right moment to learn where this tool stops, because it is the single most over-recommended instrument in Go performance work and it could not have found the bug you just fixed.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "From labs/observability, ask the compiler what it decided: go build -gcflags='-m' ./svc/ against your fixed code, and against the shipped anchor, whose concatenation is still there. Find the line that reports the concatenation escaping to the heap and the line that reports entries not escaping. Then answer the question the output cannot: how many times does that escaping line run?",
					},
					rationale: {
						en: "A value lives on the stack when the compiler can prove its lifetime ends with the function, and the stack is free: the frame pops and it is gone, with no allocator and no collector involved. When it cannot prove that, the value escapes to the heap and becomes the collector's problem. -m prints those decisions. Here it will tell you the concatenation result escapes, which is true and is the mechanism behind your 1000 allocations. But look carefully at what it says: it is a statement about a line of source, not about an execution. -m has no idea that line sits inside a loop, and no notion of how many times anything runs, because it is the output of a static analysis that happens before your program has ever executed. The line inside the loop that escapes a thousand times per call and a line at the top of main that escapes once produce identical output.",
					},
					hints: [
						{
							label: "why -m could never have found this bug",
							value: "The report string has to escape. It is returned to a caller, so it outlives the frame, and no rewrite changes that: the fixed version's buffer escapes too. Both versions escape, and -m says so about both. The bug was never whether something escaped; it was that something escaped 1000 times where once would do. Count is not a thing -m measures, which is why the allocation profile found this in one line of output and the compiler could not.",
						},
						{
							label: "-m -m for the reasoning",
							value: "Doubling the flag raises the verbosity and prints why each decision was made, following the chain of assignments that forced a value to the heap. It is noisy and occasionally the only way to understand a decision you disagree with. Start with one -m.",
						},
						{
							label: "expect artifacts in the output",
							value: "Against the fix, -m reports the string \"strings: illegal use of non-zero Builder copied by value\" escaping to the heap. That is the panic message inside Builder's copy check, a constant that is never allocated unless the panic fires. -m output includes inlining decisions and dead paths and is not a tidy report. Read it for the lines you asked about, not top to bottom.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability",
					command:
						"# the anchor still has the concatenation; this is the line to find:\ngo build -gcflags='-m' ./svc/ 2>&1 | grep 'escapes to heap'\n\n# and your fixed Optimized, for contrast:\ngo build -gcflags='-m' ./svc/ 2>&1 | grep 'optimized.go'",
					expect: {
						en: "From the anchor: baseline.go:17:71: e.Stamp + \" [\" + e.Level + \"] \" + e.Source + \": \" + e.Msg + \"\\n\" escapes to heap. That is the mechanism, stated by the compiler, on the line the profiler blamed. From your fixed file the concatenation line is simply gone, because there is no longer a concatenation, and what remains is optimized.go: entries does not escape, plus a run of inlining notes for the Builder's methods. One line of compiler output per source line, whether that line runs once or a million times.",
					},
					labPath: "labs/observability/svc/baseline.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Predict before you run it. Comment out the b.Grow(len(entries) * 80) line in your fix, leaving the Builder and the loop exactly as they are. Predict what -gcflags='-m' will say differently, then run it, then run the benchmark: go test -run '^$' -bench BenchmarkOptimized -benchmem",
					},
					observe: {
						en: "The escape analysis output does not change at all. Diff the two runs and they are byte for byte identical. The benchmark tells a completely different story: allocs/op goes from 1 to 20, B/op from 81920 to about 284073, and ns/op roughly doubles, because the buffer is now doubling its way up to 67KB instead of being sized once. The gate still passes, comfortably: 97.6% and 98.0%.",
					},
					why: {
						en: "A real, measured, twentyfold regression in allocation count and a tripling of bytes, completely invisible to the tool people reach for when they want to talk about allocation. Nothing escaped that was not escaping before; the same line allocates, it just allocates twenty times while the buffer doubles. That is the boundary of static analysis, and it is worth carrying: -m tells you whether a value goes to the heap, the allocation profile tells you how often and how much, and only the second one is a measurement. Reach for -m to understand a mechanism you have already found. Reach for it to find one and you will read a wall of true statements and learn nothing. Note also that the gate never noticed, which is honest about what a gate is: a floor, not a standard. Uncomment the Grow before you move on.",
					},
				},
			],
			retrievalPrompt:
				"Both the slow and the fast version of this function make a string that escapes to the heap, and -gcflags='-m' says so about both. So what use is escape analysis here, and what found the bug? || -m explains the mechanism: the concatenation result cannot stay on the stack, so every += is a heap allocation. But it is a static, per-line statement with no notion of how many times a line runs, and the bug was entirely about count, 1000 allocations where 1 would do. The allocation profile found it, because counting is a measurement and -m is not one.",
		},
		{
			n: "09",
			heading: { en: "Pass the gate, then go back and ask the service" },
			uses: ["pprof"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The gate is the machine check and it is the easy part now. The last thing this project asks is the thing almost nobody does: go back to step 01's terminal, run the same load against the fixed service, and find out what the 99.5% you just proved is worth to a user. The two numbers are not the same number, and the distance between them is the most useful thing in this project.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Run the gate from labs/observability: go test -tags gate -run TestGate ./... and get it green. Then re-run the exact experiment from step 01 against the fixed service: go run . in one terminal, go run ./loadgen -n 10000 -c 50 in another. Compare the throughput to the 196 req/s you wrote down, and compare that ratio to the ratio the benchmark reports. Then finish the written deliverable: the profile output naming the line, the benchstat comparison, and the paragraph explaining the mechanism.",
					},
					rationale: {
						en: "The benchmark says the function got about 186 times faster. The service gets about 13 times faster. Both are correct, and the second one is the one that exists: a user cannot experience your ns/op, only your response. The rest of the request, parsing the HTTP, writing 67KB to a socket, the scheduler, did not get faster because you did not touch it, and once the render stops dominating, those costs are what is left. This is Amdahl's law arriving in person, and it is why the next optimisation on this service would be worth almost nothing. You have taken the render from most of the request to a rounding error inside it. There is no second 99% available here, and knowing when to stop is the part of this skill that does not show up in a profile.",
					},
					hints: [
						{
							label: "why the gate measures in one process",
							value: "It calls testing.Benchmark on both functions back to back inside the same binary, rather than comparing two files. Step 07 showed why: a control group that drifted 36% between two runs minutes apart. Same process, same thermal state, same seconds, and the ratio is the only thing it asserts on.",
						},
						{
							label: "the thresholds are deliberately loose",
							value: "40% ns and 50% allocs, against a reference that delivers 99.5% and 99.9%. That gap is not generosity, it is step 05's variance: a machine that swings 88% on untouched code needs a gate that fails on real regressions rather than on a background process. It bites when it should. Restore the += loop and it fails on both metrics at once.",
						},
						{
							label: "the paragraph is the deliverable",
							value: "A gate proves your code is fast. It cannot prove you know why, and the difference shows up the first time you meet this pattern somewhere the fix is not strings.Builder. Write down: which line, why it allocated per iteration, what the buffer changed, and what the numbers were before and after.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/observability",
					command:
						"go test ./...\ngo test -tags gate -run TestGate -v ./svc/\n\n# then the number that actually matters, against step 01's 196 req/s:\ngo run .\ngo run ./loadgen -n 10000 -c 50\n\n# and prove the gate is passable, which is the only reason to trust it:\ngo test -tags 'solution gate' -run TestGate -v ./svc/",
					expect: {
						en: "The gate prints both measurements and its verdict, reading close to: Baseline 5032650 ns/op 1002 allocs/op, Optimized 27034 ns/op 1 allocs/op, gate passed: ns/op cut 99.5%, allocs/op cut 99.9%. Then the load generator answers the real question: about \"10000 requests in 3.779s (2646 req/s)\", against 196 req/s in step 01. The response is still exactly 67238 bytes, because the output never changed. A 186x function bought a 13.5x service, and that sentence is the whole of Amdahl's law.",
					},
					labPath: "labs/observability/svc/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Run the gate against the reference and watch it pass, then break the reference on purpose: in svc/solution.go, replace the Builder loop body with the original report += ... concatenation. Rerun go test -tags 'solution gate' -run TestGate ./svc/, then restore it with git checkout.",
					},
					observe: {
						en: "The reference fails exactly as your code would have: \"gate failed: ns/op cut 15.3% (need >= 40%), allocs/op cut 0.0% (need >= 50%)\". The allocs number is the honest one, 0.0% between two functions that are now character for character identical. The 15.3% on ns/op is pure drift between two benchmark runs seconds apart, which is step 05's lesson turning up one last time, in the gate, on purpose-identical code.",
					},
					why: {
						en: "That is what makes it a gate rather than a diff against one answer. It builds whatever the tags select and measures observable cost: the reference gets no credit for being the reference, and your fix gets no penalty for not matching it line for line. Any Optimized that produces Baseline's bytes for meaningfully less allocation passes, and strings.Builder is not the only way to write that: a pre-sized []byte with append, or bytes.Buffer at a small extra copy, both clear it honestly. This is also why the lab ships the reference behind the same gate rather than as prose. An unverified reference is an opinion, and this one is held to the same two numbers you are.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Before/after benchstat proof",
						labPath: "labs/observability/svc",
						description:
							"Machine check: from labs/observability, go test -tags gate -run TestGate ./... first pins Optimized to Baseline byte for byte (n=0, 1, 1000, since the -run filter skips the correctness suite), then reruns BenchmarkBaseline and BenchmarkOptimized in one process (TestGateSpeedup in svc/gate_test.go) and fails below the thresholds, printing both measured deltas. Human deliverable: the pprof output naming the source line (go tool pprof -list 'Optimized$' cpu.out is the non-interactive form; the flamegraph via -http is the same data), the benchstat before.txt after.txt comparison at -count=10 including the Baseline control row, and a one-paragraph written explanation of the mechanism.",
						desiredMetrics:
							"≥ 40% reduction in ns/op\n≥ 50% reduction in allocs/op\nbenchstat p-value < 0.05 on the Optimized row, and ~ on the Baseline control row",
						metricsAchievable:
							"The provided slow service has an intentional O(n²) string concatenation in its hot loop: strings are immutable, so every += allocates and copies the whole report so far. Replacing it with a pre-sized strings.Builder cuts ns/op by ~99% and allocs/op from 1001 to 1 on the 1000-entry input. Measured against the reference on a stock go1.22 toolchain, the gate reported Baseline 5032650 ns/op / 1002 allocs/op against Optimized 27034 ns/op / 1 allocs/op: a 99.5% ns cut and a 99.9% alloc cut. The 40/50 thresholds leave wide room for machine variance, which is not theoretical: ten runs of the untouched Baseline on the same laptop spanned 10.2ms to 19.1ms, while allocs/op read exactly 1000 every time. End to end the service went from 196 to 2646 req/s under go run ./loadgen -n 10000 -c 50, a 13.5x throughput gain from a 186x function speedup, with byte-identical 67238-byte responses. The fix is one function, about a dozen lines.",
						hints: [
							{
								label: "benchstat on Go 1.22",
								value: "go install golang.org/x/perf/cmd/benchstat@latest fails: x/perf now requires Go 1.25 or newer. Pin a commit from before that bump: go install golang.org/x/perf/cmd/benchstat@400946f43c82, then benchstat before.txt after.txt. It stays optional; the gate is the machine check and needs nothing installed.",
							},
							{
								label: "use -count=10, not -count=5",
								value: "benchstat needs at least 6 samples to compute a confidence interval at the 0.95 level and prints ± ∞ on every row below that. -count=10 leaves margin for the machine to misbehave during one of them.",
							},
							{
								label: "correctness first",
								value: "go test ./... must pass after the fix. A benchmark has no assertions: it is a stopwatch, and the fastest implementation of any function is the one that returns without doing the work. The gate rechecks the bytes before it measures anything.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"The benchmark says the function got 186x faster. The service got 13.5x faster. Why isn't that a contradiction, and which number do you report? || Because the request is more than the render: parsing HTTP, writing 67KB to a socket, and scheduling did not change, and once the render stops dominating, those costs are what is left. That is Amdahl's law. You report both, and you act on the service number, because it is the only one a user can experience. It is also what tells you to stop: there is no second 99% here.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The workflow is the deliverable, not the fix. Measure the service, form one hypothesis, change one thing, measure again. The fix itself was a dozen lines and you could have guessed it from the file name; what you could not have guessed is whether it mattered, by how much, or when to stop. That is what the eight steps before it were buying.",
			},
		},
		{
			type: "text",
			value: {
				en: "Most of this project was about instruments knowing different things, and picking the wrong one is silent. The CPU profile showed your function at 0% flat and a third of the tree, with another third charged to collector goroutines it never mentioned. The heap endpoint showed a healthy 5MB while the same process at the same instant had allocated 217GB, because churn is invisible to inuse_space by definition. Escape analysis stated the mechanism perfectly and could never have found the bug, because the bug was a count and -m does not count. Every one of those tools was telling the truth. Only one of them was answering the question.",
			},
		},
		{
			type: "text",
			value: {
				en: "And the numbers lie by default. The same untouched function measured 10.2ms and 19.1ms on an idle laptop minutes apart, which is a bigger swing than most optimisations you will ever ship, and benchstat will report a machine warming up as a statistically significant 36% improvement if you let it. The habits that survive this are cheap: take the baseline before you edit, keep a control group you never touch, use enough samples that the tool will speak, and argue from allocs/op when you can, because it is the column that does not move when your laptop does.",
			},
		},
	],
}
