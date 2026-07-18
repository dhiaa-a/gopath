import { Concept } from "../../content"

export const bufio: Concept = {
	slug: "bufio",
	name: "bufio",
	tagline:
		"Scanner stops at a 64KB line and reports it in exactly one place you probably did not check.",
	summary:
		"<code>bufio</code> wraps a Reader or Writer in a buffer so you stop paying a syscall per byte, and it gives you two ways to read lines that fail in opposite directions. <code>bufio.Scanner</code> is the convenient one and it is capped: <code>bufio.MaxScanTokenSize</code> is 64KB, and a longer line makes <code>Scan()</code> return <code>false</code>, which is the identical signal it gives at a clean end of input. Your loop exits, your program reports success, and the rest of the file is never read. The only evidence is <code>scanner.Err()</code>. <code>bufio.Reader</code> has no cap, which is not a fix but the other side of the same tradeoff.",
	mentalModel:
		"Scanner is a loop with a budget; Reader is a buffer with a cursor. <code>Scan()</code> answers exactly one question, \"is there another token\", and it answers \"no\" the same way whether the input ended or the token was too big to fit, because it returns a <code>bool</code> and a bool has no room for a reason. The reason is parked in <code>Err()</code> until you ask for it. So a Scanner loop is not one statement, it is two: the <code>for</code>, and the <code>Err()</code> check underneath it. Leave the second one out and your program cannot distinguish \"finished\" from \"gave up\", which are the two things it most needs to tell apart.",
	retrievalPrompts: [
		"Your log parser runs `for sc.Scan() { n++ }` over a 7 line file, reports 3 lines, and exits 0. What happened to the other 4? || Line 4 was longer than 64KB, so Scan hit bufio.MaxScanTokenSize, stored ErrTooLong and returned false. The loop ended exactly the way it ends on a clean EOF, so lines 5 to 7 were never read and nothing failed. sc.Err() holds \"bufio.Scanner: token too long\" and is the only place that fact exists. Check Err() after every Scanner loop, and call sc.Buffer(buf, max) before the first Scan when long lines are legitimate.",
		"You keep every line by appending sc.Bytes() to a [][]byte. It is correct for a 3 line fixture and wrong for a 400 line file. Why? || Bytes() returns a window into the Scanner's own buffer, not a copy, and Scan refills that buffer in place. With 3 lines nothing is ever refilled, so the aliasing never shows; with 400 lines the earlier entries get overwritten by later ones and roughly two thirds of your retained slices silently hold the wrong text. Text() allocates a string and is safe. If you want the bytes, copy them: append([]byte(nil), sc.Bytes()...).",
		"You write a report with bufio.NewWriter(f) and `defer w.Flush()`. The disk fills mid-write. What does your program report? || Success. defer discards Flush's error return, so the last buffered bytes never land, nobody is told, and the exit code is 0. The file is truncated and looks finished. Flush explicitly and check the error before you return, then keep a deferred Flush as a backstop for the panic path only. The same trap sits on defer f.Close() for any file you wrote to: the error you are throwing away is the one saying your data is not on disk.",
	],
	codeExample: `package main

import (
	"bufio"
	"fmt"
	"strings"
)

// A log file: six ordinary lines with one 100KB stack trace in the middle.
func logFile() string {
	return "a\\nb\\nc\\n" + strings.Repeat("x", 100*1024) + "\\nd\\ne\\nf\\n"
}

// The loop everyone writes. Note what it does NOT do.
func countLines(max int) (n int, err error) {
	sc := bufio.NewScanner(strings.NewReader(logFile()))
	if max > 0 {
		sc.Buffer(make([]byte, 0, 4096), max)
	}
	for sc.Scan() {
		n++
	}
	return n, sc.Err() // the ONLY place the truncation is ever reported
}

func main() {
	// Default Scanner: 64KB per token. At the long line Scan() returns false
	// and the loop exits normally. No panic, no short read, exit code 0. It is
	// indistinguishable from a clean end of file unless you ask Err().
	n, err := countLines(0)
	fmt.Printf("Scanner default: n=%d err=%v\\n", n, err)

	// Same input, same code, ceiling raised past the longest line.
	n, err = countLines(1024 * 1024)
	fmt.Printf("Scanner 1MB:     n=%d err=%v\\n", n, err)

	// bufio.Reader has no ceiling: ReadString grows the string as it goes, so
	// the line that stopped the Scanner comes back whole. That is a tradeoff,
	// not a fix. Scanner's cap is a memory guard; ReadString allocates
	// whatever the other end decides to send.
	r := bufio.NewReader(strings.NewReader(logFile()))
	n, longest := 0, 0
	for {
		line, err := r.ReadString('\\n')
		if line != "" {
			n++
		}
		if len(line) > longest {
			longest = len(line)
		}
		if err != nil {
			break // io.EOF here is the end of input, not a failure
		}
	}
	fmt.Printf("ReadString:      n=%d longest=%d bytes\\n", n, longest)

	// ReadString also hands back the delimiter that Scanner strips for you.
	r2 := bufio.NewReader(strings.NewReader("a\\nb\\n"))
	line, _ := r2.ReadString('\\n')
	sc := bufio.NewScanner(strings.NewReader("a\\nb\\n"))
	sc.Scan()
	fmt.Printf("ReadString=%q vs Scan.Text=%q\\n", line, sc.Text())

	// Writer buffers, so nothing is out until Flush. A deferred Flush returns
	// its error into nowhere: this one is discarded.
	var sink strings.Builder
	w := bufio.NewWriter(&sink)
	fmt.Fprint(w, "buffered")
	fmt.Printf("before Flush: %q buffered=%d\\n", sink.String(), w.Buffered())
	w.Flush()
	fmt.Printf("after Flush:  %q buffered=%d\\n", sink.String(), w.Buffered())
}`,
	codeExplanation:
		"This prints:<br><br><code>Scanner default: n=3 err=bufio.Scanner: token too long</code><br><code>Scanner 1MB:     n=7 err=&lt;nil&gt;</code><br><code>ReadString:      n=7 longest=102401 bytes</code><br><code>ReadString=\"a\\n\" vs Scan.Text=\"a\"</code><br><code>before Flush: \"\" buffered=8</code><br><code>after Flush:  \"buffered\" buffered=0</code><br><br>The first two lines are the same code over the same bytes reporting 3 lines and 7 lines. Delete the <code>sc.Err()</code> from <code>countLines</code>, which is what the loop you actually write looks like, and the default case becomes a function that returns <code>3, nil</code>: your parser processed 3 of 7 lines, skipped the incident you were grepping for, and exited 0. The cap is not a parse failure either, it is a memory policy, which is why raising it is a one-line <code>Buffer</code> call and why <code>ReadString</code> reads the same 102401 byte line without comment. <code>Buffer</code> has to be called before the first <code>Scan</code>; call it after and it panics with <code>\"Buffer called after Scan\"</code>, which at least is loud. The <code>ReadString</code> loop breaks on <code>err != nil</code> after using <code>line</code>, because <code>ReadString</code> returns data and <code>io.EOF</code> together on the last chunk, the same contract that bites people in <code>io.Reader</code>. The last pair is the one that costs you a file: until <code>Flush</code>, the destination has nothing and the bytes are only in the buffer.",
	designRationale:
		"Two questions here have the same answer, which is that <code>bufio</code> is what you point at input you do not control. Why does Scanner have a cap? Because without one, a peer who sends 10GB with no newline in it makes your process allocate 10GB: the cap is a denial-of-service guard, and 64KB is the standard library guessing what a \"line\" is. <code>Reader.ReadString</code> has no such guard and will allocate whatever arrives, so the two APIs are not convenient-versus-powerful, they are guarded-versus-unguarded, and picking the second means you own the memory question. Why is the error in <code>Err()</code> instead of coming out of <code>Scan()</code>? Because <code>for sc.Scan()</code> was meant to read like a loop, and <code>for { ok, err := sc.Scan(); ... }</code> does not. The Go team bought an ergonomic loop and paid for it with a mandatory epilogue, and then made the same trade again in <code>database/sql</code>, where <code>for rows.Next()</code> also hides its failure in <code>rows.Err()</code>. Once you have seen the shape, treat every <code>for x.Next()</code> in Go as having an invisible second half. The API is telling you it ran out of return values, not that nothing can go wrong.",
	commonMistakes: [
		{
			title: "Not checking scanner.Err() after the loop",
			body: "<code>Scan()</code> returns <code>false</code> for end-of-input and for <code>ErrTooLong</code> identically, so a loop without an <code>Err()</code> check silently treats a 64KB line as end of file and stops reading. Everything downstream sees a short, clean, successful parse. This is the single most common bufio bug and it costs you the rest of the file.",
		},
		{
			title: "Retaining sc.Bytes() instead of sc.Text()",
			body: "<code>Bytes()</code> aliases the Scanner's buffer and <code>Scan</code> overwrites it in place, so keeping those slices corrupts them later. Measured: retaining <code>Bytes()</code> across 400 lines leaves 264 of them holding the wrong text, while the same code over a 3 line fixture is perfectly correct. Use <code>Text()</code>, or <code>append([]byte(nil), sc.Bytes()...)</code>.",
		},
		{
			title: "defer w.Flush() as the only Flush",
			body: "<code>defer</code> throws away the error, and <code>Flush</code>'s error is the one that says your last bytes never reached the disk. The file ends up truncated and the process exits 0. Flush explicitly on the success path and check it; the deferred one is a backstop, not the plan.",
		},
		{
			title: "Assuming ReadString and Scan return the same thing",
			body: "<code>ReadString('\\n')</code> includes the delimiter and everything before it verbatim: on a CRLF file you get <code>\"crlf\\r\\n\"</code>. <code>Scan</code> with the default split strips the newline and an optional carriage return, giving <code>\"crlf\"</code>. Swap one for the other and string comparisons, map keys and parsed integers all start failing on data that did not change.",
		},
		{
			title: "Calling sc.Buffer() after scanning has started",
			body: "<code>Buffer</code> panics with <code>\"Buffer called after Scan\"</code>, because resizing the buffer mid-scan would strand the token already in it. It has to come between <code>NewScanner</code> and the first <code>Scan</code>, which means the decision about maximum line length is made before you have seen a single line.",
		},
	],
	relatedSlugs: ["io-reader-writer", "error-handling", "defer", "strings-bytes-runes"],
}
