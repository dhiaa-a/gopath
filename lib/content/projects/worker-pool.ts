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
			value: `pool/
 ├── pool.go           — Pool, New, Submit, Results, Stop
 ├── pool_test.go      — correctness + race tests
 └── pool_bench_test.go — throughput benchmarks`,
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
						en: "Define Job{ID int, Payload any} and Result{JobID int, Output any, Err error}. Expose New(workers int, fn func(Job) Result) *Pool, Submit(Job) error, Results() <-chan Result, and Stop(). Stop must block until all workers exit and be safe to call multiple times.",
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
						en: "Write a benchmark: submit 10,000 no-op jobs to 8 workers. Measure jobs/second with b.ReportMetric. Then vary the jobs channel buffer (0, 10, 100, 1000) as sub-benchmarks and plot the throughput difference.",
					},
					why: {
						en: "You already know how to write benchmarks from T1. Apply that knowledge here with b.ReportMetric for custom units. Buffer size is the primary tuning knob: an unbuffered channel forces Submit to block until a worker is free (maximum backpressure), a large buffer decouples submission from processing. Data from your benchmark, not intuition, drives the choice.",
					},
					stdlibHint:
						"testing: b.ReportMetric, b.Run for sub-benchmarks",
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Worker pool throughput",
						description:
							"go test -race -bench=BenchmarkPool -benchmem -count=5. Achieve the target with 8 workers and buffer=100.",
						desiredMetrics:
							"> 500,000 jobs/sec with 8 workers\nSubmit p99 latency < 5 µs\n0 allocs/op in the worker receive-process-send path",
						metricsAchievable:
							"A no-op WorkerFunc with buffer=100 achieves ~1.1M jobs/sec on an M1 Mac. The bottleneck is channel scheduling overhead. Your actual WorkerFunc cost is on top of this; measure them separately.",
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
