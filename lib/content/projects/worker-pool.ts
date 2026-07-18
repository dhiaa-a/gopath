import { Project } from "../../content"

export const workerPool: Project = {
	slug: "worker-pool",
	name: "Worker pool",
	tagline:
		"Process thousands of jobs concurrently with bounded parallelism, backpressure, and a shutdown that cannot panic.",
	code: "WRK",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "13–15 hours",
	tags: ["goroutines", "channels", "sync", "benchmarks", "generics"],
	lab: {
		path: "labs/worker-pool",
		command: "go test ./...",
		summary: {
			en: "A black-box suite pins the pool contract (every accepted job processed exactly once, results delivered, Stop blocking and idempotent, Submit never panicking even when it races Stop), a throughput gate holds the pool above 500,000 jobs/s, and an allocation gate holds the generic pool at zero allocations per job.",
		},
	},
	mentalModels: [
		"bounded parallelism",
		"backpressure via channel buffer",
		"channel ownership: who closes, and when",
		"graceful shutdown out of close semantics alone",
		"monomorphisation instead of boxing",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "You already built a worker pool. It was step 04 of the log parser: a list of file paths, a channel, eight goroutines ranging over it, a WaitGroup closing the results. That pool was correct and it was easy, and it was easy for one reason worth naming, because the reason is gone here. The work was a known, finite list that existed before the pool started. You could buffer the channel to len(paths), fill it, close it, and walk away.",
			},
		},
		{
			type: "text",
			value: {
				en: "This pool takes work over time, from callers you do not control, with no idea how many jobs are coming or when they stop. Every hard question in this project falls out of that one change. What happens when jobs arrive faster than the workers drain them, given that you cannot size a buffer for a list you have never seen? Who closes the intake, when the sender is a stranger who might be mid-send right now? What does Stop even mean when there is no last job? The log parser's pool answered none of these, because it never had to.",
			},
		},
		{
			type: "code",
			value: `Submit(job) → jobs chan[buffer] → [worker×N] → results chan
    ↑ blocks when full            ↑ close(jobs) ends every range
    (backpressure)                  wg.Wait() then close(results)`,
		},
		{
			type: "text",
			value: {
				en: "Note what is absent from that diagram: a context. Stop here is graceful, meaning every accepted job finishes, and graceful shutdown falls out of channel close semantics on their own. No select, no ctx.Done(), no cancellation plumbing. If you also wanted a hard abort that abandons queued work, that is where a ctx.Done() case in the worker would earn its place, and step 06 is where you will be able to say precisely what it would cost you.",
			},
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/worker-pool/pool/
 ├── types.go             Job, Result, GenericJob[In], GenericResult[Out]: pinned
 ├── pool.go              your concrete pool: New, Submit, Results, Stop
 ├── generic.go           your generic pool: NewGeneric, GenericPool[In, Out]
 ├── pool_test.go         the contract, black-box: 8 tests
 ├── generic_test.go      the same contract at three instantiations
 ├── bench_test.go        BenchmarkPool (buffer sweep), BenchmarkPayload (boxed vs generic)
 ├── gate_test.go         TestGateThroughput, TestGateGenericAllocs (gate build tag)
 ├── solution.go          reference (solution build tag)
 └── generic_solution.go  reference (solution build tag)`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Read the contract the suite compiles against" },
			uses: ["goroutines", "channels", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Two lines of this pool can panic, and neither panics in the goroutine that made the mistake. Both are decided before you write any code, by answering one question: which goroutine owns each channel. Get the answer wrong and the failure is a panic on a worker you did not write, at a moment that depends on the scheduler, on maybe one run in fifty. That is why this project starts by reading rather than typing.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Read labs/worker-pool/pool/types.go and pool_test.go before you write anything, then implement against exactly this surface: New(workers, buffer int, fn func(Job) Result) *Pool where buffer is the jobs channel capacity, Submit(Job) error, Results() <-chan Result, and Stop(). Job and Result are pinned in types.go and the suite compiles against them. Everything about the inside of the pool is yours; the surface is not.",
					},
					why: {
						en: "The suite is black-box, in package pool_test, so it can only touch the exported API. That is a deliberate constraint on the lab and a deliberate gift to you: your fields, your locking, your internal names are all free to change without the grader noticing, which is what makes it a contract rather than a diff against one answer. It also means the API is the one thing you cannot iterate on, so it is worth ten minutes now. Answer these before you type: only Submit sends on jobs, so who may close it, and when is that safe? Only the workers send on results, so who may close that, and how would they know they are the last one?",
					},
					stdlibHint: "sync: sync.WaitGroup, sync.Once, sync.RWMutex",
					hints: [
						{
							label: "the ownership rule, in one sentence",
							value: "A channel is closed by its only sender, exactly once, and never while another goroutine could still be sending on it. Every panic in this project is that sentence being violated. The log parser taught you the first two clauses. This project is about the third, which it never had to face.",
						},
						{
							label: "why Stop takes no arguments and returns nothing",
							value: "Because it has exactly one job and one outcome: when it returns, the pool is finished. No error to report (there is nothing that can fail), no timeout to pass (a graceful stop waits for accepted work by definition). An API this small is a claim that the semantics are simple. Steps 05 and 06 are about earning it.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command: "go build ./...\ngo vet ./...\ngo test ./...",
					expect: {
						en: 'build and vet are silent, and go test prints 12 failures, every one of them a named guarantee rather than a crash: "Results() returned a nil channel; implement Results first" from most, "Submit after Stop returned nil; it must return an error, and it must not panic" from two. Read the list as a to-do. Nothing hangs and nothing panics, because the stubs compile and return zero values, which is what a starter is supposed to do.',
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Open types.go and rename Result's Output field to Value. Change nothing else. Rerun go test ./...",
					},
					observe: {
						en: "No test runs at all. The package stops compiling, and the errors are in pool_test.go and generic_test.go, files you did not touch: r.Output undefined (type pool.Result has no field or method Output), several times over.",
					},
					why: {
						en: "This is the pinned API making itself felt, and it is worth feeling once at the start rather than in step 08 when you have real code invested. The suite is a separate package that imports yours, so every name it touches is load-bearing in a way your internal names are not: types.go and the four method signatures are the contract, and the compiler is the thing that enforces it. Everything else, your fields, your mutex, your helper functions, can be renamed and restructured freely and the grader will never know. Restore the field before you continue. The reason to know exactly where that line sits is that most of the design freedom in this lab is on the other side of it, and people who have not located it tend to assume they have none.",
					},
				},
			],
			retrievalPrompt:
				"The suite is black-box, in package pool_test. What does that buy you, and what does it cost you? || It buys design freedom: your fields, locking, and internal names are invisible to the grader, so you can restructure the inside of the pool freely. It costs you the surface: types.go and the four exported signatures are compiled against, so renaming Result.Output breaks tests you never touched. The contract is exactly the exported API and nothing else.",
		},
		{
			n: "02",
			heading: { en: "Start the workers and let close do the shutdown" },
			uses: ["channels", "sync-waitgroup"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The temptation here is to build a shutdown protocol: a quit channel, a done flag, a select in the worker, something that tells the workers to stop. Do not. Go already has a broadcast primitive that reaches every worker at once, needs no counting, and cannot be missed, and you used it in the log parser without noticing it was one. Closing a channel is the message.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Implement New so it creates the jobs and results channels and starts exactly workers goroutines, each ranging over jobs and sending fn(j) onto results. Implement Submit as a plain send, Results as a getter for the channel, and the first cut of Stop: close(jobs), then wait for every worker to exit, then close(results). Use a sync.WaitGroup to know when the workers are gone. Leave idempotency and the Submit-after-Stop error for later steps.",
					},
					why: {
						en: "for j := range p.jobs compiles to a blocking receive that ends when the channel closes. That single fact is the whole shutdown: close(jobs) wakes every worker parked on that receive, each one drains whatever is still buffered, and then each range ends and the goroutine returns. You do not signal N workers, you close one channel and the runtime does the broadcast. The order in Stop is the part that is not obvious and is not negotiable: the workers are the only senders on results, so results cannot close until every one of them has exited, and wg.Wait() is the only thing that knows when that is.",
					},
					stdlibHint: "sync: WaitGroup.Add, WaitGroup.Done, WaitGroup.Wait",
					hints: [
						{
							label: "wg.Add(workers) once, outside the loop",
							value: "Add before you start the goroutines, never inside them. Add inside the goroutine races Wait: the goroutine may not have been scheduled yet when Wait reads the counter, sees zero, and returns to close results while a worker is still coming up. Add on the goroutine doing the starting, Done on the goroutine doing the work.",
						},
						{
							label: "buffer results too",
							value: "make(chan Result, buffer) is a reasonable default. It is not load-bearing for correctness, the suite drains continuously, but an unbuffered results channel makes every worker block on a handshake with the collector and step 07 will show you what that costs.",
						},
						{
							label: "the caller obligation you are inheriting",
							value: "Stop waits for the workers, and the workers are sending on results, so Stop can only return if somebody is draining Results(). That is not a flaw you should engineer around; it is the contract, and the README states it. Every test in the suite starts its collector before it submits anything, for exactly this reason.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command:
						"go test -run 'TestAllJobsProcessedExactlyOnce|TestStopWaitsForAcceptedJobs|TestResultsClosesAfterStop' -v ./...",
					expect: {
						en: "Three PASS lines. TestAllJobsProcessedExactlyOnce is the interesting one: it pushes 1000 jobs through 8 workers with a buffer of 16, so Submit is already exercising backpressure whether or not you thought about it, and it checks that every job came back exactly once with the Result your fn returned, unaltered. Most of the suite still fails. That is the plan.",
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In Stop, delete the wait, so the two closes are adjacent: close(jobs) immediately followed by close(results). Rerun the same command.",
					},
					observe: {
						en: "panic: send on closed channel, from a worker, mid-test. Which worker and which job change between runs.",
					},
					why: {
						en: "close(jobs) does not stop the workers, it tells them there will be no more jobs. They are still running, still holding jobs they already received, still about to send the results of those jobs. Closing results underneath them is closing a channel while its only senders are mid-flight, which is the third clause of the ownership rule, and the runtime's answer to a send on a closed channel is to panic rather than let a program keep running with a channel whose state nobody agrees on. Note where the panic surfaces: on a worker goroutine, with a stack that points at your send, not at Stop, which is the line that actually did it. wg.Wait() is not a politeness. It is the only thing in the program that knows the senders are gone, and it has to run between the two closes.",
					},
				},
			],
			retrievalPrompt:
				"Why can Stop not close jobs and results back to back? || Because close(jobs) ends the intake, not the workers. They keep draining what they already have and keep sending results, so closing results at that moment closes a channel whose senders are still in flight: send on closed channel, panicking on a worker rather than in Stop. wg.Wait() sits between the two closes because it is the only thing that knows the senders have exited.",
		},
		{
			n: "03",
			heading: { en: "Backpressure: Submit blocks, and that is the feature" },
			uses: ["channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Someone will eventually report that Submit is slow, and hand you a profile showing it blocked. The instinct is to fix it: buffer more, or return an error instead of waiting, or spawn a goroutine per job so the caller never waits. All three are the same mistake wearing different clothes, and the third one deletes the entire reason the pool exists.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Submit must block when the jobs buffer is full and every worker is busy. It must not drop the job, must not return an error, and must not start a goroutine to hold it. When it returns nil, the pool has accepted the job and the contract now guarantees that job will be processed exactly once and its Result delivered. The suite holds you to that: TestConcurrentSubmitters drives 16 goroutines through a buffer of 10.",
					},
					why: {
						en: "A blocked Submit is the pool telling its caller the truth: work is arriving faster than it can be done. That signal is worth more than it looks, because it propagates. The caller blocks, so the caller's caller blocks, and the whole pipeline settles at the rate the slowest stage can sustain, using bounded memory, forever. Delete the block and you have to put the excess somewhere. A bigger buffer moves the failure from a blocked caller to an OOM kill an hour later. An error return moves the decision to a caller who has less context than you do. A goroutine per job is unbounded parallelism, which is the exact thing a pool is for: you now have 50,000 goroutines fighting over 8 cores, and the ceiling that made the pool worth building is gone.",
					},
					hints: [
						{
							label: "buffer is capacity, not policy",
							value: "The buffer decides how far Submit can run ahead of the workers before it has to wait. It never decides whether Submit waits. buffer=0 means every Submit is a synchronous handshake with a worker; buffer=1000 means the caller can get 1000 jobs ahead and then blocks exactly the same way. Step 07 measures what the number buys, and the answer is not what most people guess.",
						},
						{
							label: "when dropping IS right",
							value: "Sometimes it is: a metrics pipeline would rather lose a sample than stall the request that emitted it. That is a real design, built with select and a default case, and it is a different product with a different contract. The point is that it is a decision made once, deliberately, and written down. It is not something Submit does because blocking looked like a bug.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command: "go test -run TestConcurrentSubmitters -v ./...",
					expect: {
						en: "PASS. 16 submitters push 200 jobs each through 8 workers behind a buffer of 10, so 3200 jobs move through a queue that can hold ten, which means the submitters spend most of the run blocked. All 3200 results arrive, each exactly once. Blocking and correct are the same run.",
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Make Submit refuse to wait: replace the send with select { case p.jobs <- j: return nil; default: return errors.New("pool: full") }. Rerun go test -run \'TestAllJobsProcessedExactlyOnce|TestConcurrentSubmitters\' ./...',
					},
					observe: {
						en: 'Both fail immediately, and not with a count mismatch: "Submit(N) before Stop: unexpected error: pool: full". The suite treats an error from Submit before Stop as a broken contract, not as a full queue.',
					},
					why: {
						en: "The select-with-default is the standard way to make a channel operation non-blocking, and there is nothing wrong with the mechanism. What it does here is change the promise. Submit returning nil means accepted, and accepted means guaranteed; the moment Submit can refuse, every caller has to grow a retry loop, and a retry loop against a full pool is a spin that burns a core to discover the queue is still full. Look at what the suite asserts, because it is the tell: it never checks that Submit is fast, it checks that Submit either accepts or reports the pool stopped. Latency under load is not in the contract. Delivery is. Blocking is how you keep the second promise when you cannot keep the first, and picking which one to break is the actual design decision here.",
					},
				},
			],
			retrievalPrompt:
				"Submit blocks under load. Why is that not a bug worth fixing with a bigger buffer, an error return, or a goroutine per job? || Because it is the pool telling the truth, and that signal propagates up the pipeline until the whole thing settles at a sustainable rate in bounded memory. A bigger buffer turns a blocked caller into an OOM later. An error return pushes the decision onto a caller with less context and invites a retry spin. A goroutine per job restores unbounded parallelism, which is the exact thing the pool exists to bound.",
		},
		{
			n: "04",
			heading: { en: "Errors are results, not exceptions" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Half your jobs will fail in production: a timeout, a 500, a malformed row. The question is not whether the pool handles that, it is where the failure goes. Reach for a second channel and every caller now has to select over two, forever, and correlate them. Reach for a panic in the worker and you take the process down, which step 09 will show you happening.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "A failing job produces a Result with Err set, delivered on the same results channel as every success. It does not vanish, it does not go to a second channel, and it does not panic the worker. The convention is that exactly one of Output and Err is meaningful. Your pool does not inspect Err at all: whatever Result the worker fn returns travels to the caller unaltered, which is the point.",
					},
					why: {
						en: "Result{Output, Err} is a union with a convention, and it exists so the caller writes one loop instead of a select over two channels plus correlation logic to work out which failure belonged to which job. It also keeps the pool out of the policy business. The pool does not know whether an error means retry, log, or page someone, and it should not: it is a delivery mechanism, and a delivery mechanism that inspects its payload has taken on a decision that belongs to whoever wrote fn. Note the shape this pushes you toward, which is the same one the log parser's ProcessFile ended at: the worker fn returns its failures as values, so the pool stays a pure pipe and every interesting decision lives in code the caller wrote.",
					},
					thirdPartyHint:
						"golang.org/x/sync/errgroup: the other design, where the first error cancels every worker. Worth knowing, wrong here: this pool must deliver all 1000 results, not stop at the first bad one.",
					hints: [
						{
							label: "why not two channels",
							value: "Try writing the caller. You select over results and errors, you get an error, and now you need to know which job it was, so you put the ID in the error, and now your error type is a Result with a worse name. The union type is where that road ends, so start there.",
						},
						{
							label: "the worker fn is allowed to be slow, not allowed to panic",
							value: "A panic in fn takes down the whole process, because it unwinds a worker goroutine nobody is recovering. If you want to survive a hostile fn you would recover inside the worker and convert the panic into a Result with Err set. That is a real technique and it is not in this contract; step 09 shows you the crash it prevents.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command: "go test -run TestErrorResultsAreDelivered -v ./...",
					expect: {
						en: "PASS. 100 jobs, every odd one returning an error from the worker fn, and the test asserts all 100 Results arrive and that the 50 failures carry the exact error the fn returned, checked with errors.Is. Failures and successes come back through one channel, in the same shape.",
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Make the worker filter its own output: change the send to if r := fn(j); r.Err == nil { p.results <- r }, so failed jobs are simply not delivered. Rerun the same command.",
					},
					observe: {
						en: '"delivered 50 results for 100 jobs; failing jobs must produce a Result too, not vanish".',
					},
					why: {
						en: "The line looks like a filter and behaves like a silent drop. Every caller of this pool now counts 50 results for 100 submitted jobs and has no way to find out what happened to the other 50, because the only code that knew, the worker, threw the evidence away. This is the same class of bug as a swallowed error in a CLI, with one difference that makes it worse: the pool crossed a goroutine boundary, so there is no stack, no return value, and no caller frame connecting the missing result to the job that produced it. There is just a number that is too small. That is why the contract says accepted jobs are never dropped and says nothing about whether they succeed: delivery is the pool's promise, and success is fn's business.",
					},
				},
			],
			retrievalPrompt:
				"Why does a failing job come back as a Result with Err set, rather than on a separate errors channel? || Because a second channel forces every caller into a select over two channels plus logic to correlate which failure belonged to which job, and the correlation ends up putting the job ID in the error, which is a Result with a worse name. One channel, one union type, one loop. It also keeps the pool out of policy: it delivers, and fn decides what a failure means.",
		},
		{
			n: "05",
			heading: { en: "Stop is idempotent, and it blocks" },
			uses: ["sync-waitgroup", "defer"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Stop gets called twice. A defer calls it, and the shutdown handler calls it, and on the day something goes wrong both run. The second call must not panic, and, less obviously, it must not return early either: a Stop that returns while the first Stop is still draining is lying to its caller about the pool being finished.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Stop must be safe to call any number of times, from any number of goroutines at once, and every call must block until shutdown is actually complete before it returns. Submit must return a non-nil error once Stop has been called, rather than panicking or blocking forever. Use sync.Once for the idempotency and a stopped flag for the Submit side. The suite calls Stop from four goroutines at once and then once more sequentially.",
					},
					why: {
						en: "sync.Once gives you both halves and the second one is the one people miss. Once.Do does not just skip the function on later calls: it blocks every caller until the first call's function has returned. So if the shutdown work lives inside the Do, every concurrent Stop caller waits for the real shutdown to finish and they all return at the same moment, all of them telling the truth. Do the work outside the Once and guard it with a bool instead, and the second caller returns instantly while workers are still draining, which is a Stop that returned before the pool stopped. The whole reason Stop has no return value is that it is supposed to be unambiguous.",
					},
					stdlibHint: "sync: sync.Once and Once.Do",
					hints: [
						{
							label: "what Once actually guarantees",
							value: "The sync.Once documentation is explicit that Do blocks until the first invocation of f has returned, and that no call to Do returns until f has completed. That is the property you are relying on. It is not a side effect, it is the documented contract, and it is exactly the difference between idempotent and idempotent-and-honest.",
						},
						{
							label: "the stopped flag is a separate problem",
							value: "Once makes Stop idempotent. It does nothing for Submit, which needs to know the intake is closed so it can return an error instead of sending. Those are two different questions and it is worth noticing that Once answers only one of them. The next step is about how badly the obvious answer to the second one fails.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command:
						"go test -run 'TestStopIsIdempotentAndConcurrent|TestSubmitAfterStopReturnsError' -v ./...",
					expect: {
						en: "Both PASS. The first submits 64 jobs, calls Stop from four goroutines simultaneously, waits for all four to return, then calls Stop a fifth time sequentially, and finally checks that all 64 results still arrived. Nothing panicked, every caller returned, and no result was lost in the crossfire.",
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Drop the Once: replace p.once.Do(func(){ ... }) with a plain if p.stopped { return } guard followed by the same shutdown body. Rerun the same command.",
					},
					observe: {
						en: "panic: close of closed channel. Four goroutines called Stop, several of them read the flag before any of them set it, and more than one reached close(jobs).",
					},
					why: {
						en: "Check-then-act across goroutines is not a shortcut for Once, it is the bug Once exists to prevent. Reading a bool and then acting on it is two operations with a window between them, and four concurrent callers all fit inside that window comfortably: they all read false, they all proceed, and the second close panics because close is not idempotent and the language made that deliberate. Now notice the failure you did not get, because it is the one that would have shipped: if the timing had been kinder and only one goroutine had reached the close, the other three would have returned instantly, while the pool was still draining. No panic, no test failure, and a Stop that lied. The panic is the visible half of this bug and it is the less dangerous half.",
					},
				},
			],
			retrievalPrompt:
				"sync.Once makes Stop idempotent. What else does it do that a stopped bool does not? || Once.Do blocks every caller until the first call's function has returned, which the sync documentation states explicitly. So concurrent Stop callers all wait for the real shutdown and all return truthfully. A bool guard lets the second caller return immediately while workers are still draining: a Stop that returned before the pool stopped, with no panic and no failing test.",
		},
		{
			n: "06",
			heading: { en: "Submit must not panic when it races Stop" },
			uses: ["channels", "goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "This is the step the log parser never had to face, and it is the reason this project exists. There, one goroutine owned the sends and closed the channel when its own loop finished; ownership was local and the rule was easy to keep. Here Submit is called by strangers, possibly right now, possibly parked on a full buffer, and Stop has to close that channel underneath them. Two goroutines, one channel, and one of the two operations panics if you get the order wrong.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Submit must never panic, including when Stop closes the intake at the exact moment a Submit is parked on the send. It may return an error (Stop landed first, the job was refused) or accept the job, and every job it accepted must still be delivered. What it may not do is send on a closed channel. The obvious implementation, read p.stopped and then send, is wrong, and TestSubmitStopRace exists to prove it to you rather than tell you.",
					},
					why: {
						en: "The naive version has a window between the read and the send, and Stop's close only has to land inside it. Nothing about a bool fixes that, no matter how carefully you order the statements, because two separate operations can always be interleaved. What closes the window is making the send and the close mutually exclusive: take a read lock around the check and the send, take the write lock to close. An RWMutex is the right shape because it is exactly the asymmetry you have. Many submitters send concurrently and must not serialize against each other, so they share the read lock; exactly one closer needs to exclude all of them, once, at shutdown. Holding the read lock across a blocking send looks alarming and is fine: RLock does not exclude other readers, so submitters still run in parallel, and Stop's Lock waits for the in-flight sends to finish, which is precisely the guarantee you want.",
					},
					stdlibHint: "sync: RWMutex.RLock, RWMutex.Lock",
					hints: [
						{
							label: "why the read lock across a blocking send does not deadlock",
							value: "Stop's Lock() blocks until in-flight Submits release their RLock, and a parked Submit releases only when its send completes. The send completes because the workers are alive until jobs is closed, and jobs is not closed yet, because Stop is still waiting for the write lock. The cycle does not close. Trace it once and the design stops feeling risky.",
						},
						{
							label: "what -race would tell you here",
							value: "The race detector instruments memory accesses and reports a data race when two goroutines touch the same address without synchronization and at least one writes, which is exactly the unguarded stopped bool: Submit reads it, Stop writes it. Go's race detector documentation describes the report you would get, a WARNING: DATA RACE naming the conflicting read and write with both goroutine stacks. It needs cgo, though, so on a stock Windows install with no C toolchain go test -race answers: go: -race requires cgo; enable cgo by setting CGO_ENABLED=1. On Linux or macOS it works out of the box, and it is worth running there once on this exact bug.",
						},
						{
							label: "why the suite loops 100 rounds",
							value: "Because the machine these labs are verified on cannot run the detector, so the suite has to catch the bug without one. One pool is a coin toss: the close has to land in a window a few instructions wide. A hundred rounds, each with eight submitters saturating a one-slot buffer so several are parked on the send when Stop fires, turns a coin toss into a near-certainty. It is a worse tool than -race and it works everywhere.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command:
						"go test -run TestSubmitStopRace -v ./...\n\n# and if you have a C toolchain, the better check:\ngo test -race -run TestSubmitStopRace ./...",
					expect: {
						en: "PASS, in a couple of seconds. 100 rounds, each one a fresh pool with 2 workers and a 1-slot buffer against 8 submitters, with Stop landing mid-traffic. Every round checks that the results delivered are exactly the jobs Submit reported accepting: nothing accepted was dropped, nothing was delivered that Submit refused. If you have cgo, the -race run is the one that would name the mechanism instead of the symptom.",
					},
					labPath: "labs/worker-pool/pool/pool_test.go",
					note: {
						en: 'The -race flag needs cgo. Without a C compiler, go test -race answers "go: -race requires cgo; enable cgo by setting CGO_ENABLED=1" and runs nothing. That is why this test is built to fail loudly on its own: the detector is the better tool and it is not always available, so the suite does not depend on it.',
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Write the obvious version: delete the RWMutex from both Submit and Stop, leaving if p.stopped { return errStopped } then p.jobs <- j in Submit, and p.stopped = true; close(p.jobs) in Stop. Rerun go test -run TestSubmitStopRace ./...",
					},
					observe: {
						en: "panic: send on closed channel. Not sometimes: on essentially every run, because the test reruns the race 100 times and only needs to win once.",
					},
					why: {
						en: "Trace the interleaving. Submit reads stopped, sees false, and is about to send. Before it does, Stop sets stopped and closes jobs. Submit's send now lands on a closed channel and the runtime panics, in Submit's goroutine, which is a caller's goroutine, taking the process with it. Nothing about this is exotic; the window is a few instructions wide and eight submitters parked on a full buffer are sitting in it. Now the part worth carrying: the bool is not fixable. Order the two statements any way you like, add a second check after the first, make it an atomic.Bool, and the window is still there, because check-then-send is two operations and close can always land between them. atomic.Bool is the tempting one and it is the instructive failure: it removes the data race, so -race goes quiet, and the panic stays exactly as likely. That is the distinction this step is really about. A data race is two unsynchronized accesses, and the detector finds those. This is a race condition, an ordering bug between two operations that are each individually fine, and no detector will ever find it for you. The only fix is to stop the two operations from interleaving at all, which is what the lock does: not by making the read safe, but by making the send and the close mutually exclusive.",
					},
				},
			],
			retrievalPrompt:
				"You replace the unguarded stopped bool with an atomic.Bool. The race detector goes quiet. Is Submit safe now? || No. The atomic removes the data race on the flag, which is what -race looks for, and leaves the race condition untouched: check-then-send is still two operations and close can still land between them, so the send still panics on a closed channel. The fix is mutual exclusion between the send and the close, not a safer read. A quiet detector is not a correct program.",
		},
		{
			n: "07",
			heading: { en: "Measure what the buffer buys" },
			uses: ["benchmarks", "buffered-channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have picked a buffer size four times in this project by guessing. The lab ships a benchmark that sweeps it, so the guess is about to become a measurement, and the shape of the curve is the interesting part: it is not the one most people draw when asked.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Read bench_test.go before you run it. benchPool submits b.N jobs to 8 workers, times the whole thing including Stop and the final drain, and reports jobs/s with b.ReportMetric; BenchmarkPool runs it at buffers 0, 10, 100, and 1000. Run it, write down the four numbers, and explain the difference between buffer=0 and buffer=100 before you tune anything. Then explain why 1000 is not better than 100.",
					},
					why: {
						en: "An unbuffered channel makes every Submit a synchronous handshake: the sender parks until a worker is ready to receive, which is two scheduler wakeups per job and no overlap at all between submitting and working. A buffer lets Submit deposit and move on, so the submitter and the workers run at the same time, and the scheduler stops being on the critical path of every single job. That is why the first few slots buy so much. It is also why the curve flattens: once the buffer is deep enough that Submit is never the thing waiting, more slots decouple nothing, because the bottleneck has moved to the workers and a queue in front of a saturated worker pool is just a place for jobs to sit. Note what the benchmark deliberately does not measure. It submits Job{ID: i} with a nil Payload, so nothing is boxed and nothing is allocated: this is channel and scheduler cost, isolated. Step 09 is where the payload comes back and the number changes.",
					},
					stdlibHint: "testing: b.ReportMetric, b.ReportAllocs, b.Run for sub-benchmarks",
					hints: [
						{
							label: "why Stop is inside the timed section",
							value: "Because throughput that only looks good by ignoring shutdown is not throughput. The timed region covers submit, process, drain, and stop, which is the whole unit of work a caller actually pays for. It is easy to write a pool that submits fast and takes a second to stop.",
						},
						{
							label: "read jobs/s, not ns/op",
							value: "They are the same information inverted, but ns/op here is nanoseconds per submitted job across 8 workers running concurrently, which reads like a latency and is not one. jobs/s is the throughput of the whole pool and it is the number the gate checks.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command:
						"go test -tags solution -run '^$' -bench BenchmarkPool -benchmem -count=2 ./...\n\n# then the gate:\ngo test -tags 'solution gate' -run TestGateThroughput -v ./...",
					expect: {
						en: 'On a 2.4 GHz laptop i5 with 8 threads, the reference sweeps roughly: buffer=0 about 1.5M jobs/s (about 640 ns/op), buffer=10 about 2.6M, buffer=100 about 3.9M, buffer=1000 about 3.9M. Your absolute numbers will differ and the shape will not: a big jump from 0, and then nothing after 100. All four report 0 allocs/op, because the payload is nil. The gate then logs a line like "throughput gate: 5241415 jobs/s with 8 workers and buffer 100 (floor 500000)" and passes. Note that the gate\'s in-process rerun reads higher than the sweep\'s buffer=100 row on the same machine; benchmark numbers are comparable within one harness, not across two.',
					},
					labPath: "labs/worker-pool/pool/bench_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In Submit, swap the shared read lock for the exclusive one: RLock becomes Lock, RUnlock becomes Unlock, so every submitter now serializes against every other submitter. Rerun the full suite, then rerun the gate.",
					},
					observe: {
						en: "Every test passes, including TestConcurrentSubmitters and TestSubmitStopRace. The gate passes too: about 4.2M jobs/s against a floor of 500,000. The only evidence that anything changed is that the number moved from about 5.2M to about 4.2M, and you have to have written the old number down to notice.",
					},
					why: {
						en: "Lock is strictly stronger than RLock, so it cannot produce a wrong answer, only a slower one: sixteen submitters that used to enter the critical section together now queue up. No correctness test can catch this, and none ever will. The part worth sitting with is that the gate did not catch it either, and the gate is the thing you would have expected to. A 500,000 floor under a reference that clears 5,000,000 has a factor of ten of headroom, which is deliberate: jobs/s is a property of the machine, and the floor has to survive a CI box with two slow cores. That headroom is exactly why the gate is a smoke alarm and not a regression detector. It catches a pool that has fallen over. It cannot see a 20% regression, and an unbuffered results channel (about 2.4M on this machine) sails through it too, despite being one of the three causes the gate's own failure message tells you to go looking for. That message is advice for someone already under the floor, not a claim about what the gate detects. Hold that thought: step 09 ends with a gate that has no headroom at all, because it measures something that is not a property of the machine.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Worker pool throughput and allocations",
						labPath: "labs/worker-pool",
						description:
							"The lab ships the harness; you port your pool into pool/pool.go and pool/generic.go and run it. Benchmarks: go test -tags solution -run '^$' -bench . -benchmem ./... runs BenchmarkPool (8 workers, buffers 0/10/100/1000, nil payload, jobs/s via b.ReportMetric) and BenchmarkPayload (8 workers, buffer 100, one int payload per job, boxed against generic). Gates: go test -tags 'solution gate' -run TestGate ./... runs both. TestGateThroughput reruns the buffer=100 benchmark in-process and fails at or below 500,000 jobs/s. TestGateGenericAllocs reruns BenchmarkPayload's two halves in one process and fails unless the generic pool allocates zero times per job and the boxed pool allocates at least once.",
						desiredMetrics:
							"BenchmarkPool/workers=8/buffer=100:  > 500,000 jobs/s  (the throughput gate's floor)\nBenchmarkPayload/generic:            0 allocs/op, 0 B/op  (the allocation gate's assertion)\nBenchmarkPayload/boxed:              > 0 allocs/op  (the allocation gate's control)",
						metricsAchievable:
							"On a 2.4 GHz laptop i5 (i5-1135G7, 8 threads) the reference measures: the buffer sweep at roughly 1.5M / 2.6M / 3.9M / 3.9M jobs/s for buffers 0/10/100/1000, and the throughput gate's in-process rerun at about 5.2M jobs/s, roughly ten times the floor. BenchmarkPayload reads boxed at 1 allocs/op and 15 B/op and about 3.3M jobs/s, against generic at 0 allocs/op and 0 B/op and about 5.1M jobs/s. Treat every jobs/s figure as machine-relative and expect yours to disagree; the allocation columns are not machine-relative, which is the entire reason the second gate can assert zero instead of a threshold.",
						hints: [
							{
								label: "b.ReportMetric",
								value: 'b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s") adds a custom column to the benchmark output. testing.Benchmark then hands it back to the gate through res.Extra["jobs/s"], which is how a test asserts on a benchmark.',
							},
							{
								label: "never run a gate under -race",
								value: "The detector instruments every memory access and every channel operation, so the number it produces describes the detector, not your pool. Correctness under -race and throughput without it are two separate runs, and the gate build tag keeps them apart.",
							},
							{
								label: "why one gate has headroom and the other has none",
								value: "Throughput is a property of the machine, so its gate needs a floor low enough for the slowest box that will ever run it, which costs it the ability to see anything but catastrophe. Allocations per job are a property of the code: the same source allocates the same number of times on a Raspberry Pi and a 64-core server. That is why one gate says 500,000 and the other says 0.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"The buffer sweep jumps from about 1.5M jobs/s at buffer=0 to about 3.9M at buffer=100, then does not improve at 1000. Why both halves? || Unbuffered makes every Submit a synchronous handshake, two scheduler wakeups per job and zero overlap between submitting and working, so the first slots buy real decoupling. Once the buffer is deep enough that Submit is never what is waiting, the bottleneck has moved to the workers, and extra slots are just somewhere for jobs to sit in front of a saturated pool.",
		},
		{
			n: "08",
			heading: { en: "Make the pool generic" },
			uses: ["interfaces", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Look at the worker fn you have been writing all project: func(j Job) Result { return Result{JobID: j.ID, Output: j.Payload.(int) * 2} }. That .(int) is the tell. Every caller of this pool writes it, every caller can get it wrong, and the pool's own types are what force them to. Payload is an any because for most of Go's life there was no other way to write a container that held a caller's type. There is now.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Implement GenericPool[In, Out any] in pool/generic.go, against the same four-method surface: NewGeneric(workers, buffer int, fn func(GenericJob[In]) GenericResult[Out]) *GenericPool[In, Out], Submit(GenericJob[In]) error, Results() <-chan GenericResult[Out], Stop(). GenericJob[In] and GenericResult[Out] are pinned in types.go and are Job and Result with the two any fields replaced by type parameters. Do not start until your concrete pool is green: the point of this step is the comparison, and there is nothing to compare against yet.",
					},
					why: {
						en: 'Two type parameters, not one, and the reason is in the tests: TestGenericStringToInt instantiates the pool at [string, int], a worker fn that takes a word and returns its length. A single Pool[T] would force every worker fn to return the type it was handed, which is not what a worker does. In and Out are genuinely independent, so they are two parameters. Note also what does not get a type parameter: Err stays a plain error, because "it failed" is not domain-specific and parameterizing it would buy nothing and cost every caller a type argument. The useful discipline when you reach for generics is exactly this question, asked per field rather than per type: does this position vary with the caller\'s domain, or not?',
					},
					hints: [
						{
							label: "copy the concurrency across unchanged",
							value: "The reference's GenericPool is character-for-character the same program as Pool: same RWMutex around the send, same Once, same WaitGroup, same two closes in the same order. Type parameters change what the channel holds, not how goroutines coordinate. If you find yourself redesigning the shutdown in here, stop: you are changing two things at once and you will not know which one broke it.",
						},
						{
							label: "the names are a lab artifact",
							value: "GenericPool and GenericJob are ugly, and they exist only because both pools live in one package so you can read them side by side and Job was already taken. A real package ships one of these and calls it Pool. Do not carry the naming out of here.",
						},
						{
							label: "type inference at the call site",
							value: "pool.NewGeneric[int, int](8, 100, fn) spells both parameters out. Go can often infer them from the function argument, but the explicit form is what the tests use and it is the form worth writing while the mechanism is new: it puts the instantiation where you can see it.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command: "go test -run TestGeneric -v ./...\n\n# then everything, both pools at once:\ngo test ./...",
					expect: {
						en: "Four PASS lines, then a fully green suite. The generic tests instantiate the pool three ways on purpose: [int, int] (the one the gate benchmarks), [string, int] (In and Out genuinely different), and [req, string] where req is a struct, which is the case that matters most in real code. Read generic_test.go and notice what is not in it: no second race test, no second idempotency test. The concurrency is the concurrency you already proved.",
					},
					labPath: "labs/worker-pool/pool/generic_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Reach for a pointer, the way you would in a language without value semantics: make the jobs channel chan *GenericJob[In], have Submit send &j, and have the worker call fn(*j). Everything still compiles and every test still passes. Now run the allocation gate: go test -tags 'solution gate' -run TestGateGenericAllocs ./...",
					},
					observe: {
						en: '"allocation gate: the generic pool allocated 1 times and 16 bytes per job, want 0; a chan GenericJob[In] stores In values inline, so nothing on the per-job path should reach the heap. Look for an `any` you left behind, a payload you took the address of, or a closure allocated per job."',
					},
					why: {
						en: "&j takes the address of a parameter, the parameter escapes into a channel that outlives the function, so escape analysis moves it to the heap: one 16-byte allocation for every job, forever. The change is invisible to the suite because it is not a correctness bug, and it undoes the entire reason the previous step existed. Sending the value copies 16 bytes into the channel's buffer, which is a memcpy the allocator never hears about; sending the pointer copies 8 bytes and hands the garbage collector a new object per job. The instinct that a pointer is cheaper because it is smaller is the exact instinct to unlearn: it is smaller and it costs an allocation, and for a struct this size the copy is free by comparison. Notice which check caught it. Not the tests, which cannot see performance, and not the throughput gate, which has ten times the headroom it would need. The gate that caught it asserts zero, and it can assert zero because allocations are a property of the code.",
					},
				},
			],
			retrievalPrompt:
				'Why does the pool take two type parameters, In and Out, rather than one Pool[T]? And why does Err stay a plain error? || Because a worker fn does not have to return the type it was handed: the suite instantiates [string, int], a fn taking a word and returning its length, so In and Out vary independently. Err stays plain because "it failed" is not domain-specific, so parameterizing it would buy nothing and cost every caller a type argument. The question to ask per field is whether that position varies with the caller\'s domain.',
		},
		{
			n: "09",
			heading: { en: "What the type parameters actually bought" },
			uses: ["interfaces", "pointers"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have two pools now, doing identical work, differing only in whether the payload travels as an any or as a type parameter. So the question is answerable rather than arguable, and it splits in two: what does the compiler catch that it could not catch before, and what does the machine stop doing. The lab ships a benchmark for the second half, and the compiler is the benchmark for the first.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Run BenchmarkPayload and read the allocs/op column for both halves, then run the allocation gate. Then do the compile-time half by hand: try to submit a string payload to a pool instantiated at [int, int], and try the same mistake against the concrete Job. Be able to explain why one is a compiler message and the other is a process that dies at 3am, and where exactly the boxed pool's per-job allocation comes from.",
					},
					why: {
						en: "An any is two words: a pointer to type information, and a pointer to the value. That second word is the problem, because it is a pointer, so the value has to live somewhere it can point at. Converting an int into an any therefore means putting that int on the heap and pointing at it: one allocation per job, and then work for the garbage collector proportional to your traffic. That is boxing. A chan GenericJob[int] has no such indirection: the compiler generates a version of the pool for the int shape, the channel's buffer holds GenericJob[int] structs laid out inline, and Submit copies 16 bytes into that buffer. Nothing reaches the heap because nothing needs a pointer to point at. That is monomorphisation, roughly: Go's implementation shares one instantiation per GC shape rather than emitting a copy per type, so pointer-shaped types share code while int-shaped ones get layout that does not box. The type assertion tells the same story from the compiler's side. j.Payload.(int) is a runtime check that has to exist because the type is not known until the value arrives; in the generic pool there is nothing to check, because the channel cannot hold anything else.",
					},
					stdlibHint: "testing: b.ReportAllocs, testing.Benchmark, BenchmarkResult.AllocsPerOp",
					hints: [
						{
							label: "compile-time safety, precisely",
							value: 'Submitting GenericJob[int]{Payload: "oops"} to a [int, int] pool does not build: cannot use "oops" (untyped string constant) as int value in struct literal. The type parameters also tie the worker fn to the pool at the instantiation: hand NewGeneric[int, string] a fn that returns GenericResult[int] and the compiler rejects the argument outright. The same two mistakes against the concrete Pool compile clean and vet clean, and surface as panic: interface conversion: interface {} is string, not int, thrown on a worker goroutine that no caller is recovering, which takes the process down.',
						},
						{
							label: "what generics are not for",
							value: "This pool is a container: it holds a caller's type and hands it back untouched, which is the case generics were designed for and the case where they pay. They are not a replacement for interfaces. An interface says what a value can do; a type parameter says what a value is. If your worker fn took an io.Reader you would still want io.Reader, because you want any thing that reads, not one specific type that reads.",
						},
						{
							label: "the honest costs",
							value: "Longer compile times and more machine code, because instantiation multiplies. Worse error messages when constraints do not match. And a real readability tax: GenericPool[In, Out any] with a func(GenericJob[In]) GenericResult[Out] parameter is denser than the any version, and a reader has to hold two type variables in their head. For a container this is a trade worth making. For a function used at one type, it is not: write the concrete one.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/worker-pool",
					command:
						"go test -tags solution -run '^$' -bench Payload -benchmem -count=3 ./...\n\n# then the gate that asserts the difference:\ngo test -tags 'solution gate' -run TestGateGenericAllocs -v ./...",
					expect: {
						en: 'The benchmark is stable across all three runs and the allocation columns are the result: BenchmarkPayload/boxed at 1 allocs/op and about 15 B/op, BenchmarkPayload/generic at 0 allocs/op and 0 B/op. The gate then logs both in one process, close to: "allocation gate: boxed 1 allocs/op (15 B/op), generic 0 allocs/op (0 B/op)" and "throughput, same run, machine-relative: boxed 3303166 jobs/s, generic 5096981 jobs/s". Your jobs/s will differ and are the less interesting half; the allocation columns will not differ, on any machine, which is the point.',
					},
					labPath: "labs/worker-pool/pool/bench_test.go",
					note: {
						en: "The boxed pool reports 1 allocs/op and about 15 B/op rather than 2 and 16, because the payload box and the output box are both 8-byte pointer-free objects and the runtime's tiny allocator merges small pointer-free objects into shared blocks. The exact count is an implementation detail. The difference between allocating and not allocating is not.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Make the boxed benchmark look good: in benchBoxedInts, change the payload from Payload: i to Payload: i % 128. Rerun go test -tags solution -run '^$' -bench Payload -benchmem ./...",
					},
					observe: {
						en: "BenchmarkPayload/boxed now reports 0 allocs/op and 0 B/op, exactly matching the generic pool, and throughput climbs to within a few percent of it. On this evidence, boxing is free and this entire step was a waste of your evening.",
					},
					why: {
						en: 'You benchmarked a cache. The Go runtime keeps a static array of the first 256 unsigned integers, and converting a small int to an interface points the value word at an entry in that array instead of allocating: no heap traffic, because the box already exists and always did. Payloads of 0 to 127 live entirely inside it, and their doubled outputs, 0 to 254, do too. Change one character and the measurement inverts. This is the most useful thing in the step and it is not about generics: it is that a micro-benchmark measures the inputs you gave it and will confidently report whatever those inputs happen to make true. The real benchmark submits Payload: i, which climbs past 255 in the first microsecond and stays there, because the question is what a pool carrying real payloads costs. Now look at what the gate does with this, because it is the same lesson from the other side: TestGateGenericAllocs asserts that the boxed pool allocates, and fails with "there is nothing to compare against" if it does not. A comparison that cannot fail on its control is not a comparison, and this break-it is precisely the failure that check exists to catch. Restore the payload.',
					},
				},
			],
			retrievalPrompt:
				"Passing an int as an `any` allocates, but a benchmark using payloads 0 to 127 reports 0 allocs/op. What happened, and what does the generic pool do differently? || The runtime keeps a static array of the first 256 integers, so converting a small int to an interface points at a pre-existing box instead of allocating: the benchmark measured the cache, not the mechanism. An interface's value word is a pointer, so a real int has to go on the heap for it to point at. A chan GenericJob[int] holds the struct inline and copies it into the buffer, so nothing needs a pointer and nothing reaches the heap.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built the same pool twice and the second one took an hour, because the concurrency never changed: type parameters decide what a channel holds, not how goroutines coordinate. What took the evening was the ownership rule, and it is worth carrying out of here in one sentence. A channel is closed by its only sender, exactly once, and never while another goroutine could still be sending on it. The log parser taught you the first two clauses, where one goroutine owned the sends and closing was easy. This project was the third clause, where Submit is called by strangers and close has to land anyway.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-its were the argument. Two closes back to back panic on a worker rather than in Stop, because close(jobs) ends the intake and not the workers. A stopped bool without a lock sends on a closed channel on essentially every run, and an atomic.Bool silences the race detector while leaving the panic exactly as likely, which is the difference between a data race and a race condition and the reason no tool will find the second one for you. A filter in the worker drops half your results and reports a number that is merely too small. Each one is a mechanism you predicted before you read the answer, which is why you will recognise them somewhere bigger.",
			},
		},
		{
			type: "text",
			value: {
				en: "The two gates are the other half, and they disagree on purpose. Swapping RLock for Lock passes every correctness test and passes the throughput gate too, at about 4.2M jobs/s against a floor of 500,000: ten times the headroom is what it costs to make a jobs/s number survive a slow CI box, and that headroom is exactly why it cannot see a regression. Then the allocation gate asserts zero, with no headroom at all, and catches a pointer-per-job change that nothing else in the lab noticed. The difference is not that one gate is written better. Throughput is a property of the machine and allocations are a property of the code, and knowing which of those you are measuring is what decides whether the check you write is a smoke alarm or a contract.",
			},
		},
	],
}
