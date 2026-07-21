import { Failure } from "../../content"

export const deferInLoop: Failure = {
	slug: "defer-in-loop",
	name: "Defer in a loop: the cleanup that all ran at the end",
	category: "Standard library",
	tagline:
		"Forty deferred flushes stack up behind a loop and fire only at function return, so the job verifies its files before a single byte has reached disk.",
	symptom:
		"The nightly report job fails every run with <code>verified: 0 of 40 reports complete (40 empty)</code> and exits 1, yet whenever anyone inspects the staging directory afterwards, the reports are all there: full contents, footer and all. While debugging, the on-call added a second count in <code>main</code>, right after the export function returns, calling the same counting helper on the same directory. It prints <code>re-check from main: 40 of 40 reports complete</code> in the same run that verified zero. Two calls to the same function disagree about the same files, and the on-call has stopped trusting the verifier.",
	labPath: "labs/failures/defer-in-loop",
	runCommand: "go run .",
	tools: [
		"the contradiction itself: two counts of the same directory, moments apart, treated as both true",
		"the timeline question: what executed between the count that said 0 and the count that said 40",
		"the defer statements, read as a schedule: how many calls are registered, and exactly when they fire",
		"a probe print pairing what is buffered in memory against what is on disk",
	],
	diagnosis: [
		{
			title: "Believe both numbers",
			body: "The tempting first move is to pick a side: decide the verifier is buggy and reread <code>countComplete</code> until something confesses. But it is one function called twice, and functions do not grow bugs between call sites. The productive assumption is the opposite one: both numbers were true at the instant they were computed. The files really were empty during the first count, and really were complete during the second. Accepting that converts the question from \"which count is lying\" into \"what happened between them\", which is a question about time, and the source answers it: between the two counts, exactly one thing happened. <code>exportAll</code> returned.",
			command: "go run .",
			output: `verified: 0 of 40 reports complete (40 empty)
re-check from main: 40 of 40 reports complete
reportgen: verification failed: 0 of 40 reports complete (40 empty)
exit status 1`,
		},
		{
			title: "Ask when the flushes ran, not whether",
			body: "The loop writes each report through <code>bufio.NewWriter</code> and registers <code>defer w.Flush()</code> and <code>defer f.Close()</code> per file. Defer's contract, from the defer concept, is exact: a deferred call runs when the surrounding <em>function</em> returns, and the surrounding function here is <code>exportAll</code>. A loop body is not a function; it contributes no boundary for defer to fire at. So iteration one's flush does not run at the end of iteration one, it joins a stack, and by the bottom of the loop that stack holds 80 pending calls: a flush and a close for each of 40 files. At the moment the in-function verification walks the directory, none of them has run. Every report's bytes sit in one of 40 live <code>bufio</code> buffers, and the files on disk are the zero-length entries <code>os.Create</code> made. Then <code>exportAll</code> returns, the stack unwinds in reverse, each file's flush runs just before its close, the bytes land, and the count in <code>main</code> finds 40 complete files. Nothing was flaky. The program did all of its cleanup, correctly, at the only moment defer ever does it: the end of the function.",
		},
		{
			title: "Check the arithmetic that kept every byte in memory",
			body: "Why perfectly empty files rather than partial ones? A <code>bufio.Writer</code> touches the file only when its buffer fills or someone calls <code>Flush</code>. Put real numbers on that with a probe print at the bottom of the loop body: each report is 64 or 65 bytes against a default buffer of 4096, so a whole report occupies under two percent of its buffer and no write in this program can ever spill to disk on its own. That arithmetic is what made the symptom clean: 40 files, all exactly empty. Reverse it and the same bug wears a nastier costume: reports larger than the buffer would spill their early bytes and hold back the tail, verification would find plausible-looking truncated files, and you would chase a truncation ghost instead of a timing one. Empty files say \"never flushed\" out loud; short files only whisper it.",
			command: "go run .",
			output: `user01: buffered=64 bytes, on disk=0 bytes (buffer cap 4096)
user13: buffered=65 bytes, on disk=0 bytes (buffer cap 4096)`,
		},
		{
			title: "Count what else the loop is holding",
			body: "The verifier caught the flush half. The quiet half is the handles: <code>defer f.Close()</code> in the same loop means that at the bottom of the final iteration this process holds 40 open files at once, and that number tracks the roster. At 40 nobody notices. Point the same shape at 5,000 users and it dies mid-loop with <code>too many open files</code> on Unix systems, where the per-process descriptor limit is commonly 1024, and 256 on a stock macOS shell, with the crash blaming whichever innocent <code>os.Create</code> crossed the line, far from the defer that caused it. Windows speaks a different dialect: an open handle blocks deletion. Reproduced with this lab's exact write shape, removing a report whose handle is still open fails with <code>The process cannot access the file because it is being used by another process</code>. Any cleanup that runs while the loop's handles are alive fails that way, which is how this bug also produces staging directories that refuse to die. The broken variant escapes that fate only because its cleanup is deferred in <code>run</code>, which fires after <code>exportAll</code> has returned and closed everything.",
		},
	],
	fix: "Give each report its own function, which is the shape in <code>fixed.go</code>: <code>writeReport</code> opens the file, writes, flushes, closes, and its deferred call fires when it returns, once per iteration. The resource lifetime and the function boundary now coincide, and that is the idiom to keep: in Go the function is the unit of resource lifetime, so when a loop needs per-iteration cleanup, the body must become a function, named or an immediately-invoked closure. The helper also repairs the error discipline for free: <code>Flush</code> is called explicitly and its error returned, because a deferred flush discards the one error that says your bytes never landed (the trap the bufio concept warns about), and <code>Close</code>'s error feeds a named return instead of vanishing. Prove it: <code>go run -tags fixed .</code> prints <code>verified: 40 of 40 reports complete (0 empty)</code>, the re-check agrees, and the job exits 0. The tempting non-fix is a bare <code>w.Flush()</code> at the bottom of the loop. It makes tonight's verify pass and preserves everything else: 40 handles still accumulate until return, both errors still evaporate, and any early return mid-batch skips the flush for the file in flight. Patching the one symptom the verifier happened to catch is not the same as ending the lifetime per iteration.",
	production:
		"The costume this usually wears is write-then-ship inside one function: a worker writes files and hands them to an uploader a few lines later, and every shipped object is zero bytes. By the time a human pulls the files to investigate, the process has exited, the defers have run, the local copies are perfect, and the ticket closes as flaky object storage until it reopens the next night. The second costume is worse. Move the same loop into a long-lived daemon and function return never comes: buffers never flush, handles never close, and the process dies hours in with <code>too many open files</code> at a line that opens files legitimately. Or a shutdown path calls <code>os.Exit</code>, which runs no deferred calls at all, and the final buffered batch evaporates behind an exit code of 0. The habit that catches this family early is cheap: treat <code>defer</code> inside <code>for</code> as a finding whenever the loop is unbounded or the function is long-lived, and read every long function asking of each defer \"when does this actually run\". It is one of the few production bugs you can find reliably with your eyes.",
	scar: "Defer waits for the function, not the loop: when a loop needs cleanup per iteration, the loop body has to become its own function.",
	relatedSlugs: ["defer", "bufio", "io-reader-writer", "error-handling"],
	unlockTier: 1,
}
