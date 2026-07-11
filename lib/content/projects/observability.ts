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
				en: "You are given a deliberately slow HTTP service. Attach pprof, generate load, take CPU and heap profiles, identify the bottleneck from the flamegraph, write a baseline benchmark, implement the fix, and prove statistical improvement with benchstat. The project is not complete without the proof.",
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
			value: `service/
 ├── main.go               — imports _ "net/http/pprof" on :6060
 ├── processor.go          — the slow function (provided)
 ├── processor_test.go     — correctness tests (must pass before and after)
 └── processor_bench_test.go  — BenchmarkBefore + BenchmarkAfter`,
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
						en: "Import net/http/pprof on a dedicated admin port (not the public port). Generate load with hey or ab (minimum 10,000 requests, 50 concurrent). Take a 30-second CPU profile. Open the flamegraph. Name the function that appears widest.",
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
						en: "Write BenchmarkBefore for the slow function using realistic input (same shape as production). Run with -benchmem -count=5. Save the output to before.txt. Do not change any code before recording the baseline.",
					},
					rationale: {
						en: "Without a baseline you cannot prove improvement; you can only claim it. The benchmark must use realistic input: a benchmark on 10-byte strings that proves nothing when production processes 10,000-byte strings. -count=5 gives benchstat enough runs to compute variance. Save before.txt before any code change.",
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
						en: "Fix the bottleneck identified in the flamegraph. The fix must not change the observable output of the function. Run go test ./... and tests must pass before and after. Common patterns: sync.Pool for per-call allocations, pre-sized slices/maps, strings.Builder over concatenation, map lookup over O(n²) scan.",
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
						en: "Run the benchmark again with identical flags and -count=5. Save to after.txt. Run benchstat before.txt after.txt. The delta column must show a statistically significant improvement (p < 0.05). Write one paragraph explaining what you changed and why it reduced allocations or CPU time.",
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
						description:
							"Submit: the flamegraph screenshot naming the bottleneck, benchstat before.txt after.txt output, and a one-paragraph written explanation of the fix.",
						desiredMetrics:
							"≥ 40% reduction in ns/op\n≥ 50% reduction in allocs/op\nbenchstat p-value < 0.05",
						metricsAchievable:
							"The provided slow service has an intentional O(n²) string concatenation in its hot loop. Replacing it with strings.Builder reduces ns/op by ~70% and allocs/op by ~85% on n=1000 inputs. The fix is one function, approximately 12 lines.",
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
