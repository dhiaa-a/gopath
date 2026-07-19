import { Concept } from "../../content"

export const benchmarks: Concept = {
	slug: "benchmarks",
	name: "Benchmarks",
	tagline:
		"You never write the loop count, you never trust one run, and the tool that proves the difference will not install on this Go.",
	summary:
		"A Go benchmark is a function <code>BenchmarkXxx(b *testing.B)</code> whose body runs <code>b.N</code> times, where <code>b.N</code> is the framework's dial and never yours: it reruns your body at growing N until the total time reaches <code>-benchtime</code> (1 second by default), then divides to get ns/op. Get that one thing wrong, hard-code the count, and the number is off by a factor of a billion. Two more facts decide whether your comparison means anything. One run has no error bar, so you take <code>-count</code> samples and let <code>benchstat</code> judge them; and <code>benchstat</code> needs at least 6 samples for a confidence interval, printing <code>± ∞</code> below that. On Go 1.22 the current <code>benchstat</code> will not even install.",
	mentalModel:
		"Stop thinking of a benchmark as \"run it and read the time\". Think of it as an experiment the framework calibrates for you. It does not know how fast your function is, and it cannot, because that depends on the machine, so it discovers the right iteration count by running your body at N=1, then a larger N, then larger, until the elapsed wall time is big enough to divide accurately against a clock whose resolution is coarse compared to a nanosecond. That is the entire reason <code>b.N</code> exists and the entire reason you must loop exactly <code>for i := 0; i < b.N; i++</code>: the framework is turning the dial, and if your loop ignores it, you have disconnected the measurement from the thing measuring it. Everything else follows from treating the result as a sample rather than a fact. A sample has noise, so you take several and compare distributions, not points. A sample can measure the wrong thing, so you exclude setup with <code>ResetTimer</code> and defeat the optimiser with a sink. The benchmark is a stopwatch with no opinions: it times whatever loop you hand it, including a loop that does nothing, and tells you the number with total confidence.",
	retrievalPrompts: [
		"Your benchmark loops for i := 0; i < 1000; i++ instead of i < b.N, and it reports 0.01 ns/op. Did you find the fastest code on earth? || No, you found a broken benchmark. b.N is the framework's dial: it reruns your body at larger and larger N until the total reaches -benchtime, then divides. Hard-code the count and the body does the same fixed work regardless of b.N, so the framework keeps raising N, sees no growth, gives up at the 1e9 cap, and divides one body's time by a billion. A clock cycle on a 2.4GHz machine is about 0.42 ns, so 0.01 ns/op is a claim to have worked in a fraction of one cycle. That impossibility is the tell.",
		"You run -count=5, feed the output to benchstat, and every row reads ± ∞. Is the tool broken? || No, it is declining to lie. benchstat reports a 95% confidence interval and needs at least 6 samples to compute one, so at 5 it prints the median with ± ∞ and a footnote saying exactly \"need >= 6 samples for confidence interval at level 0.95\". It is refusing to claim a spread it cannot support, which is the honest behaviour. Use -count=10: it clears the threshold and leaves margin for the machine to misbehave during one of the runs.",
		"You measure 20µs before your change and 18µs after, both at -count=1, and report a 10% win. Why is that not a result? || Because a single run has no spread and this is a noisy measurement. Ten runs of this untouched code gave a 64% confidence interval on sec/op while allocs/op held at 14.00 ± 0% every time. One before and one after is a coin flip dressed as engineering: the 2µs could be your edit or your laptop warming up. Take -count=10 on each side and let benchstat's Mann-Whitney test decide, or argue from allocs/op, the column that does not move when the machine does.",
	],
	codeExample: `package main

import (
	"fmt"
	"strings"
	"testing"
)

var sink string

func render(entries []string) string {
	var b strings.Builder
	for _, e := range entries {
		b.WriteString(e)
		b.WriteByte('\\n')
	}
	return b.String()
}

func main() {
	entries := make([]string, 1000)
	for i := range entries {
		entries[i] = "line of log output"
	}

	// Wrong: the loop count is hard-coded, so the body does the same fixed
	// work no matter what b.N is. The framework raises b.N looking for a
	// duration that never grows, gives up at 1e9, and divides.
	wrong := testing.Benchmark(func(b *testing.B) {
		for i := 0; i < 1000; i++ {
			sink = render(entries)
		}
	})

	// Right: b.N is the framework's variable, not yours.
	right := testing.Benchmark(func(b *testing.B) {
		b.ReportAllocs()
		for i := 0; i < b.N; i++ {
			sink = render(entries)
		}
	})

	fmt.Println("ignores b.N:", wrong)
	fmt.Println("uses b.N:   ", right, right.MemString())
}`,
	codeExplanation:
		"A run of this prints <code>ignores b.N: 1000000000\t0.01371 ns/op</code> and <code>uses b.N: 65341\t20256 ns/op\t83368 B/op\t16 allocs/op</code>. The two lines call the identical <code>render</code> on the identical input. The only difference is the loop bound, and it moves the reported cost by a factor of well over a million. The wrong line ran its fixed 1000-iteration body once, saw a duration that did not grow when the framework raised <code>b.N</code>, kept raising it to the <code>1e9</code> cap, and divided one body's time by a billion, yielding <code>0.01371 ns/op</code>. A single clock cycle on this 2.4 GHz machine is about 0.42 nanoseconds, so that number is a claim to have done real work in a small fraction of one cycle, which is impossible and is exactly how you spot the bug: a benchmark result faster than physics is a benchmark that is not measuring your code. The right line loops on <code>b.N</code>, so the framework's dial actually drives the work, and it reports tens of thousands of iterations at roughly 20000 ns/op with <code>83368 B/op</code> and <code>16 allocs/op</code> from <code>b.ReportAllocs</code>. Your ns/op will differ, the allocation columns will not. This example uses <code>testing.Benchmark</code>, which runs a benchmark from ordinary code and is why it works as a standalone program; in a real project the same function lives in a <code>_test.go</code> file as <code>func BenchmarkRender(b *testing.B)</code> and you run it with <code>go test -bench . -benchmem</code>.",
	designRationale:
		"The reason <code>b.N</code> belongs to the framework and not to you is the clock. To measure a function that takes a few nanoseconds you cannot time one call, because the monotonic clock's resolution is coarse compared to a nanosecond and a single reading is mostly rounding error. You have to run the function enough times that the total is milliseconds the clock can resolve, then divide. The right number of times depends on how fast the function is and how fast the machine is, neither of which is known in advance, so the framework discovers it at run time: it runs your body at N=1, estimates from that how many iterations would fill <code>-benchtime</code>, runs that many, and reports the per-op cost of the final timed run. That is why hard-coding the count breaks everything, and why <code>-benchtime</code> is expressed as a duration rather than a count, though you can pin the count directly with <code>-benchtime=100x</code> when you want exactly that many iterations. The sink exists to fight a different mechanism. The compiler is allowed to delete a pure computation whose result nobody uses, so a benchmark that calls <code>render</code> and discards the string can be optimised down to an empty loop, and the empty loop benchmarks at a fraction of a nanosecond just like the broken <code>b.N</code> did. Assigning to a package-level variable gives the result an observable use the optimiser must preserve. <code>ResetTimer</code>, <code>StopTimer</code> and <code>StartTimer</code> exist because the measured window starts when the benchmark function is entered, so any setup before the loop is charged to every iteration's average unless you zero the clock after it, and <code>RunParallel</code> exists because a serial <code>b.N</code> loop measures latency on one idle core, which production never is: contention only appears when GOMAXPROCS goroutines actually compete, and a lock that looks free serially can dominate under load. All of this produces a single number with no error bar, which is why <code>benchstat</code> is a separate tool rather than part of <code>go test</code>. ns/op is a wall-clock reading and it drifts with thermal state, scheduling and other processes, so <code>benchstat</code> takes the <code>-count</code> samples, computes a median and a confidence interval, and reports a delta between two files only when a Mann-Whitney U test says the difference is unlikely to be chance, printing <code>~</code> when it is not. The confidence interval is why it demands at least 6 samples and prints <code>± ∞</code> below that: with five points there is not enough data to bound the spread at the 0.95 level, and the tool says so rather than inventing a number. The one wrinkle on this toolchain is that <code>benchstat</code> is not part of the standard distribution and its module moved its floor to Go 1.25 in early 2026, so <code>go install golang.org/x/perf/cmd/benchstat@latest</code> fails on Go 1.22 with a version error rather than installing something broken. Pinning a commit from before that bump is the working install.",
	commonMistakes: [
		{
			title: "Writing your own loop instead of looping on b.N",
			body: "<code>for i := 0; i < 1000; i++</code> instead of <code>i < b.N</code> disconnects your body from the framework's calibration. It raises <code>b.N</code>, your fixed loop ignores it, the duration never grows, and it divides by the <code>1e9</code> cap, reporting sub-nanosecond nonsense for work that takes microseconds. The result being faster than a single clock cycle is the signature. The loop bound is always exactly <code>b.N</code>.",
		},
		{
			title: "Letting the compiler delete the work",
			body: "A benchmark whose body computes a result nobody reads can be optimised to an empty loop, because the computation is pure and the result is dead. It then benchmarks at a fraction of a nanosecond and looks like a triumph. Assign the result to a package-level <code>var sink</code>, so the optimiser sees an observable use it must keep. If your \"optimisation\" produces a suspiciously round sub-nanosecond number, you deleted the work rather than speeding it up.",
		},
		{
			title: "Timing the setup",
			body: "The measured window opens when the benchmark function is entered, so a <code>GenEntries</code> call, a file read, or a fixture build before the loop is charged to every iteration's average, and inflated further because the framework reruns the whole function at growing N. Call <code>b.ResetTimer()</code> after the setup, or bracket a mid-loop expensive step with <code>b.StopTimer()</code> and <code>b.StartTimer()</code>. Turn on <code>b.ReportAllocs()</code> too, so a setup that allocates shows up as B/op you can see.",
		},
		{
			title: "Reporting one run as a result",
			body: "A single <code>-count=1</code> measurement has no spread, and ns/op is noisy: the untouched <code>render</code> above spanned a 64% confidence interval across ten runs while allocs/op stayed at exactly 14. A before and an after at count 1 is a coin flip, and the swing is routinely bigger than the optimisation you are trying to prove. Take <code>-count=10</code> on each side and compare with <code>benchstat</code>, and lean on allocs/op, which is a counter and does not drift with the machine.",
		},
		{
			title: "Running benchstat @latest on Go 1.22",
			body: "<code>go install golang.org/x/perf/cmd/benchstat@latest</code> fails on Go 1.22: as of early 2026 the module requires Go 1.25 or newer and refuses to build, reporting <code>requires go >= 1.25.0 (running go 1.22.1)</code>. It is not a network error and retrying will not fix it. Pin a commit from before the bump: <code>go install golang.org/x/perf/cmd/benchstat@400946f43c82</code>, which installs and runs cleanly on this toolchain.",
		},
	],
	relatedSlugs: ["pprof", "escape-analysis", "testing", "table-driven-tests", "tooling"],
}
