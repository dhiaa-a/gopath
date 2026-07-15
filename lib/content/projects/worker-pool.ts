import { Project } from "../../content"

export const workerPool: Project = {
	slug: "worker-pool",
	name: "Worker pool",
	tagline:
		"Process thousands of jobs concurrently with bounded parallelism, cancellation, and no goroutine leaks.",
	code: "WRK",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "4–5 hours",
	tags: ["goroutines", "channels", "context", "errgroup", "benchmarks"],
	lab: {
		path: "labs/worker-pool",
		command: "go test -race ./...",
		summary: {
			en: "A black-box suite pins the pool contract (every accepted job processed exactly once, results delivered, Stop blocking and idempotent) and a gate benchmark holds it above 500,000 jobs/s.",
		},
	},
	mentalModels: [
		"bounded parallelism",
		"structured concurrency",
		"backpressure via channel buffer",
		"graceful shutdown with context",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "N workers range over a buffered jobs channel. Results and errors flow out on separate channels. A context cancels all workers cleanly. The pool must not leak goroutines: every goroutine started must eventually exit, proven by the race detector and goroutine leak checks.",
			},
		},
		{
			type: "code",
			value: `Submit(job) → jobs chan[buffer] → [worker×N] → results chan
                              ctx.Cancel() → all workers exit via select`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/worker-pool/pool/
 ├── pool.go        your implementation: Pool, New, Submit, Results, Stop
 ├── types.go       Job and Result, pinned by the suite
 ├── pool_test.go   black-box correctness suite, run with -race
 ├── bench_test.go  BenchmarkPool: jobs/s across buffer sizes
 ├── gate_test.go   TestGateThroughput, behind the gate build tag
 └── solution.go    reference, sealed behind the solution build tag`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Design the Pool API" },
			uses: [],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Define Job{ID int, Payload any} and Result{JobID int, Output any, Err error}. Expose New(workers, buffer int, fn func(Job) Result) *Pool (buffer is the jobs channel capacity), Submit(Job) error, Results() <-chan Result, and Stop(). Stop must block until all workers exit and be safe to call multiple times. This exact surface is what the lab suite compiles against.",
					},
					why: {
						en: "Designing the API surface before implementation forces you to answer ownership questions: who closes which channel, who can safely call Stop. Answering these questions with sync.Once (Stop is idempotent) and the sender-closes rule (only the pool closes results) prevents the entire class of 'send on closed channel' panics.",
					},
					stdlibHint: "sync: sync.Once, sync.WaitGroup",
				},
			],
		},
		{
			n: "02",
			heading: { en: "Workers with context cancellation" },
			uses: ["goroutines","channels","context"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Each worker must exit when the pool's context is cancelled. Every blocking operation (receiving a job, sending a result) needs a ctx.Done() escape hatch via select. A worker that blocks forever on either channel is a goroutine leak.",
					},
					why: {
						en: "You used ctx.Done() in the config watcher's event loop to exit cleanly. The pattern is identical here: select on the operation channel and ctx.Done(). The difference is that workers block on both receive (jobs) and send (results), so both need the escape hatch.",
					},
					stdlibHint: "context, select",
					hints: [
						{
							label: "select on send",
							value: "select { case results <- r: case <-ctx.Done(): return }. Worker exits if context cancels while blocked on sending a result.",
						},
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "Error collection without losing results" },
			uses: ["channels","error-handling"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "A Result that carries either Output or Err (not both simultaneously) lets callers handle them uniformly from one channel. Alternatively use errgroup to manage goroutine lifecycles and collect the first error. Choose one approach and justify it in a comment.",
					},
					why: {
						en: "Separate error and result channels force the caller to select over two channels simultaneously: workable, but verbose. A Result{Output, Err} union type with 'exactly one is set' convention is more composable. errgroup.WithContext is the stdlib-adjacent choice when you need the first error to cancel all workers automatically.",
					},
					thirdPartyHint:
						"golang.org/x/sync/errgroup: manages goroutines, cancels on first error",
				},
			],
		},
		{
			n: "04",
			heading: { en: "Benchmark throughput and buffer sizes" },
			uses: [],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "The lab ships this benchmark: bench_test.go submits no-op jobs to 8 workers, measures jobs/second with b.ReportMetric, and varies the jobs channel buffer (0, 10, 100, 1000) as sub-benchmarks. Read it, run go test -bench . -benchmem ./..., and explain the jobs/s difference between buffer=0 and buffer=100 before you tune anything.",
					},
					why: {
						en: "You already know how to write benchmarks from T1; this one ships with the lab so your numbers and the gate measure the same thing. Buffer size is the primary tuning knob: an unbuffered channel forces Submit to block until a worker is free (maximum backpressure), a large buffer decouples submission from processing. Data from your benchmark run, not intuition, drives the choice.",
					},
					stdlibHint:
						"testing: b.ReportMetric, b.Run for sub-benchmarks",
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Worker pool throughput",
						labPath: "labs/worker-pool",
						description:
							"The lab ships the harness. bench_test.go: go test -bench . -benchmem ./... runs BenchmarkPool (8 workers, buffers 0/10/100/1000, no-op worker fn, jobs/s via b.ReportMetric). The gate in gate_test.go: go test -tags gate -run TestGate ./... reruns the 8-worker buffer=100 benchmark in-process and fails at or below 500,000 jobs/s, printing the measured number. The gate enforces the jobs/s line; check the latency and allocation lines yourself in the -benchmem output.",
						desiredMetrics:
							"> 500,000 jobs/sec with 8 workers\nmean ns/op via -benchmem (the jobs/s figure inverted)\n0 allocs/op in the worker receive-process-send path",
						metricsAchievable:
							"A no-op worker fn with buffer=100 clears 1M jobs/sec on an M1 Mac; the reference measures ~3.8M jobs/sec and 0 allocs/op on a 2.4 GHz laptop i5. The bottleneck is channel scheduling overhead. Your actual worker fn cost is on top of this; measure them separately.",
						hints: [
							{
								label: "b.ReportMetric",
								value: 'b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s") adds a custom metric column to benchmark output.',
							},
						],
					},
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built structured concurrency from scratch: bounded workers, context cancellation, backpressure, no leaks. The select-on-send pattern for cancellation is the same one you used in the config watcher. The benchmark methodology is from T1. You are reusing tools, not learning new ones.",
			},
		},
	],
}
