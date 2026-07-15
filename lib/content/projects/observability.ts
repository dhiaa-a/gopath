import { Project } from "../../content"

export const observability: Project = {
	slug: "observability",
	name: "Observability & performance",
	tagline:
		"Profile a real service, find the bottleneck, fix it, and prove the improvement.",
	code: "OBS",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "4–6 hours",
	tags: ["pprof", "benchmarks", "runtime", "trace", "benchstat"],
	lab: {
		path: "labs/observability",
		command: "go test -tags gate -run TestGate ./...",
		summary: {
			en: "An inverted lab: the service ships complete and correct but deliberately slow, and the gate reruns BenchmarkBaseline and BenchmarkOptimized in one process, staying red until your rewrite of svc/optimized.go cuts ns/op by 40 percent and allocs/op by 50 percent against the shipped baseline.",
		},
	},
	mentalModels: [
		"measure before optimising",
		"allocation is the primary cost",
		"flamegraph-driven investigation",
		"before/after proof with benchstat",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "You are given a deliberately slow HTTP service, complete and working, in labs/observability. Attach pprof, generate load, take CPU profiles, identify the bottleneck from the flamegraph, record a baseline with the shipped benchmarks, implement the fix, and prove statistical improvement with benchstat. The project is not complete without the proof.",
			},
		},
		{
			type: "code",
			value: `slow service → pprof + load → flamegraph → bottleneck named
 → baseline benchmark → fix → re-benchmark → benchstat proof`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/observability/
 ├── main.go               — the service; imports _ "net/http/pprof" on :6060
 ├── loadgen/              — stdlib load generator (hey or ab work too)
 └── svc/
     ├── baseline.go       — the slow path, complete; the comparison anchor
     ├── optimized.go      — starts as an exact copy; the file you fix
     ├── correctness_test.go — Optimized must match Baseline byte for byte
     ├── bench_test.go     — BenchmarkBaseline + BenchmarkOptimized
     └── gate_test.go      — TestGateSpeedup, the relative speedup gate`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Profile under real load" },
			uses: ["http-handler"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Run the shipped service from labs/observability with go run . (public port 8080, pprof admin on 6060; main.go imports net/http/pprof on the dedicated admin port, not the public one). Generate load with hey or ab, or go run ./loadgen (minimum 10,000 requests, 50 concurrent). Take a 30-second CPU profile while the load runs. Open the flamegraph. Name the function that appears widest.",
					},
					rationale: {
						en: "pprof registers endpoints on the default ServeMux. Running it on a separate port keeps it off the public interface. The flamegraph's widest bar is the most expensive function: you cannot guess this correctly; the profile must name it. Minimum 10,000 requests ensures enough samples for a statistically representative profile.",
					},
					hints: [
						{
							label: "hey",
							value: "hey -n 10000 -c 50 http://localhost:8080/process",
						},
						{
							label: "no hey installed",
							value: "go run ./loadgen -n 10000 -c 50 from the lab root does the same job with the standard library.",
						},
						{
							label: "flamegraph",
							value: "go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30",
						},
					],
				},
			],
		},
		{
			n: "02",
			heading: { en: "Baseline benchmark before any change" },
			uses: [],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Record the baseline with the shipped benchmarks before any change. From labs/observability/svc, run go test -run '^$' -bench . -benchmem -count=5 and save the output to before.txt. BenchmarkOptimized measures the function you will fix; BenchmarkBaseline pins the shipped anchor. Do not change any code before recording the baseline.",
					},
					rationale: {
						en: "Without a baseline you cannot prove improvement; you can only claim it. The shipped benchmarks use realistic input, the same 1000-entry report the service renders per request: a benchmark on 10-byte strings proves nothing when production builds 70 KB reports. -count=5 gives benchstat enough runs to compute variance. Save before.txt before any code change.",
					},
				},
			],
		},
		{
			n: "03",
			heading: { en: "Implement and verify the fix" },
			uses: [],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Fix the bottleneck identified in the flamegraph. The fix goes in svc/optimized.go; svc/baseline.go is the comparison anchor the gate measures against, leave it untouched. The fix must not change the observable output of the function. Run go test ./... and tests must pass before and after. Common patterns: sync.Pool for per-call allocations, pre-sized slices/maps, strings.Builder over concatenation, map lookup over O(n²) scan.",
					},
					rationale: {
						en: "The most common Go performance issue is unnecessary allocation. sync.Pool recycles objects, eliminating GC pressure. Pre-sizing with make([]T, 0, n) avoids growth copies. strings.Builder avoids the string immutability copies that make concatenation O(n²). A faster function that changes output is a bug, not an optimisation.",
					},
					hints: [
						{
							label: "escape analysis",
							value: "go build -gcflags='-m' ./... shows which values escape to the heap. Heap escapes cause GC pressure; stack values are free.",
						},
						{
							label: "sync.Pool",
							value: "var pool = sync.Pool{New: func() any { return new(MyStruct) }}. Get() retrieves or allocates; Put() returns. Always reset state before Put.",
						},
					],
				},
			],
		},
		{
			n: "04",
			heading: { en: "Prove the improvement with benchstat" },
			uses: [],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Run the benchmarks again with identical flags and -count=5. Save to after.txt. Run benchstat before.txt after.txt. The delta column must show a statistically significant improvement (p < 0.05). Then run the machine gate from the lab root: go test -tags gate -run TestGate ./... fails unless Optimized beats Baseline by at least 40 percent ns/op and 50 percent allocs/op, measured in the same process. Write one paragraph explaining what you changed and why it reduced allocations or CPU time.",
					},
					rationale: {
						en: "A single benchmark run has high variance. benchstat computes mean, variance, and p-value across runs. p > 0.05 means the difference could be noise; you need more runs or a larger improvement. The written explanation is mandatory: if you cannot articulate why it is faster, you do not understand the fix and will not be able to apply it elsewhere.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Before/after benchstat proof",
						labPath: "labs/observability/svc",
						description:
							"Machine check: from labs/observability, go test -tags gate -run TestGate ./... first pins Optimized to Baseline byte for byte (n=0, 1, 1000, since the -run filter skips the correctness suite), then reruns BenchmarkBaseline and BenchmarkOptimized in one process (TestGateSpeedup in svc/gate_test.go) and fails below the thresholds, printing both measured deltas. Human deliverable, unchanged: the flamegraph screenshot naming the bottleneck, benchstat before.txt after.txt output, and a one-paragraph written explanation of the fix.",
						desiredMetrics:
							"≥ 40% reduction in ns/op\n≥ 50% reduction in allocs/op\nbenchstat p-value < 0.05",
						metricsAchievable:
							"The provided slow service has an intentional O(n²) string concatenation in its hot loop. Replacing it with strings.Builder cuts ns/op by ~99% and allocs/op from 1001 to 1 on the 1000-entry input (reference solution, measured by the gate), so the thresholds leave wide room for machine variance. The fix is one function, about a dozen lines.",
						hints: [
							{
								label: "benchstat",
								value: "go install golang.org/x/perf/cmd/benchstat@latest, then: benchstat before.txt after.txt",
							},
							{
								label: "correctness first",
								value: "go test ./... must pass after the fix. A faster function with wrong output is not a fix.",
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
				en: "The professional performance workflow: profile first, baseline second, fix third, prove with data. You used benchmarks from T1 and benchstat to make claims you can defend. The skill is not memorising optimisation techniques; it is knowing how to find which one matters and proving it worked.",
			},
		},
	],
}
