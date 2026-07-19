import { Concept } from "../../content"

export const ioReaderWriter: Concept = {
	slug: "io-reader-writer",
	name: "io.Reader and io.Writer",
	tagline:
		"Two one-method interfaces the whole standard library composes from, and one Read contract almost everyone implements wrong.",
	summary:
		"<code>io.Reader</code> is one method. <code>io.Writer</code> is one method. That is the entire reason <code>*os.File</code>, <code>net.Conn</code>, <code>*bytes.Buffer</code>, <code>*strings.Reader</code> and <code>http.Request.Body</code> are interchangeable, and why <code>io.Copy</code> can move bytes between any two of them while knowing what neither one is. The catch is in <code>Read</code>'s signature. It returns <code>(n int, err error)</code>, and it is allowed to return <code>n > 0</code> and <code>io.EOF</code> on the same call. A loop that checks <code>err</code> before it spends <code>n</code> throws that data away and reports success.",
	mentalModel:
		"<code>Read</code> does not return data or an error. It returns data and a status, and they are independent facts: <code>n</code> says how much of your buffer is now valid, <code>err</code> says what will happen on the next call. A Reader that hands you the last five bytes of a stream together with <code>io.EOF</code> is not reporting a failure, it is saving you a round trip, and the contract explicitly permits it. So every read loop is: spend n, then read the note. <code>Writer</code> is the mirror image and is far stricter, because a short write is always an error. That asymmetry is deliberate, and it is why the dangerous half of io is the reading half.",
	retrievalPrompts: [
		"Your read loop breaks on err != nil before appending buf[:n]. It passes every test against strings.Reader. Where does it lose data? || Against any Reader that returns n > 0 with io.EOF on the same call. That is legal, and net/http's response body does it on purpose: if the body fits in your buffer you get (5, io.EOF) from one call, and your loop discards all five bytes and returns nil. strings.Reader returns (5, nil) then (0, io.EOF), so a test built on it can never see the bug. Spend n before you look at err, or call io.Copy and never write the loop.",
		"May Read return n < len(p) with err == nil? May Write return n < len(p) with err == nil? || Read yes, Write no. io.Writer's contract is one sentence stricter: \"Write must return a non-nil error if it returns n < len(p).\" A short read is normal and you are told to loop; a short write is a bug in the Writer. That is why reading needs io.Copy and io.ReadFull and writing needs nothing: on the way out, err == nil already means all of it landed.",
		"You cap an upload with io.LimitReader(r, 1<<20) and a client sends 2MB. What does your handler see? || A clean io.EOF at exactly 1MB, indistinguishable from a complete upload. LimitReader is a budget, not a guard: it stops at N and never mentions that it clipped anything, so you silently persist a truncated file. http.MaxBytesReader is the one that fails instead, with *http.MaxBytesError (\"http: request body too large\"). Truncating a body without telling anyone is worse than rejecting it.",
	],
	codeExample: `package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
)

// The loop everyone writes first: check err, then use n.
func drainErrFirst(r io.Reader) string {
	var out []byte
	buf := make([]byte, 32)
	for {
		n, err := r.Read(buf)
		if err != nil {
			break // the bug: n bytes are sitting in buf, unread
		}
		out = append(out, buf[:n]...)
	}
	return string(out)
}

// The loop the contract requires: use n, THEN look at err.
func drainNFirst(r io.Reader) string {
	var out []byte
	buf := make([]byte, 32)
	for {
		n, err := r.Read(buf)
		out = append(out, buf[:n]...) // n is valid even when err != nil
		if err != nil {
			break
		}
	}
	return string(out)
}

func main() {
	// The unit test. strings.Reader returns (5, nil) and then (0, io.EOF),
	// never both, so the broken loop passes here and ships.
	fmt.Printf("errFirst + strings.Reader: %q\\n", drainErrFirst(strings.NewReader("hello")))
	fmt.Printf("nFirst   + strings.Reader: %q\\n", drainNFirst(strings.NewReader("hello")))

	// Production. Same interface, same loops, a different Reader.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "hello")
	}))
	defer srv.Close()

	show := func(label string, drain func(io.Reader) string) {
		resp, err := http.Get(srv.URL)
		if err != nil {
			panic(err)
		}
		defer resp.Body.Close()
		fmt.Printf("%-26s %q\\n", label, drain(resp.Body))
	}
	show("errFirst + resp.Body:", drainErrFirst)
	show("nFirst   + resp.Body:", drainNFirst)
	show("io.Copy  + resp.Body:", func(r io.Reader) string {
		var sb strings.Builder
		io.Copy(&sb, r) // handles both halves of the contract
		return sb.String()
	})

	// Composition: every piece here is one of the two methods wrapping the
	// other. TeeReader is a Reader that writes what it reads, MultiWriter is a
	// Writer that fans out, LimitReader is a Reader with a budget.
	var audit, a, b strings.Builder
	src := io.TeeReader(io.LimitReader(strings.NewReader("hello world"), 5), &audit)
	n, err := io.Copy(io.MultiWriter(&a, &b), src)
	fmt.Printf("copied=%d err=%v a=%q b=%q audit=%q\\n", n, err, a.String(), b.String(), audit.String())
}`,
	codeExplanation:
		"This prints:<br><br><code>errFirst + strings.Reader: \"hello\"</code><br><code>nFirst   + strings.Reader: \"hello\"</code><br><code>errFirst + resp.Body:      \"\"</code><br><code>nFirst   + resp.Body:      \"hello\"</code><br><code>io.Copy  + resp.Body:      \"hello\"</code><br><code>copied=5 err=&lt;nil&gt; a=\"hello\" b=\"hello\" audit=\"hello\"</code><br><br>Line 1 and line 3 are the whole lesson: the same broken function, the same interface, and the entire response body gone. No error, no panic, no short read. <code>drainErrFirst</code> is correct against <code>strings.Reader</code> and returns the empty string against <code>resp.Body</code>, which means the test you would write for it cannot fail. This is not a contrived Reader, it is <code>net/http</code>, and it is deliberate: <code>body.readLocked</code> in <code>net/http/transfer.go</code> carries a comment saying it returns EOF alongside the data because doing so \"helps the HTTP transport code recycle its connection earlier\". Shrink the buffer and the failure changes shape rather than going away: with a 4 byte buffer the body arrives as <code>(4, nil)</code> then <code>(1, io.EOF)</code>, so the broken loop returns <code>\"hell\"</code> and you get silent truncation instead of silent emptiness. The last line is the payoff for keeping the interfaces at one method: <code>LimitReader</code>, <code>TeeReader</code> and <code>MultiWriter</code> know nothing about each other or about <code>strings.Builder</code>, and they still stack.",
	designRationale:
		"One method is not minimalism for its own sake, it is what makes implicit satisfaction useful. Because <code>io.Reader</code> demands exactly one method and Go has no <code>implements</code> keyword, a type written before <code>io</code> existed, in a package that never imports it, satisfies it anyway. That is why the ecosystem composes: <code>gzip.NewReader</code> takes your <code>net.Conn</code>, <code>json.NewDecoder</code> takes the gzip reader, and none of those authors coordinated. Contrast Java's <code>InputStream</code>, an abstract class you must extend, which forces every stream type into one vendor's hierarchy and makes retrofitting impossible. The harder question is why the contract permits <code>n > 0</code> with <code>io.EOF</code> at all, given how many callers get it wrong. Forbidding it would mean an implementation that already knows the stream ended must stay silent and make you call <code>Read</code> once more to be told. For <code>net/http</code> that extra call is what stands between a connection and the pool, so the stdlib takes the deal, and the io docs pay for it in one sentence: \"Callers should always process the n > 0 bytes returned before considering the error err.\" The cost was consciously pushed onto callers to keep implementations fast. Read that sentence as the API's price tag, not as advice.",
	commonMistakes: [
		{
			title: "Checking err before spending n",
			body: "<code>if err != nil { break }</code> above <code>out = append(out, buf[:n]...)</code> discards data whenever a Reader returns <code>n > 0</code> with <code>io.EOF</code>, which <code>http.Response.Body</code> and <code>gzip.Reader</code> both do. Your tests use <code>strings.Reader</code>, which never does, so the bug is invisible until production. Append first, then break.",
		},
		{
			title: "Treating io.EOF as a failure",
			body: "<code>if err != nil { return err }</code> inside a read loop returns <code>io.EOF</code> to your caller as if the read broke. <code>io.EOF</code> is the success terminator: it is how a Reader says \"that was all of it\". Only <code>io.ErrUnexpectedEOF</code> means the stream died early. Compare against <code>io.EOF</code> explicitly and turn it into a clean exit.",
		},
		{
			title: "Hand-rolling the copy loop",
			body: "<code>io.Copy</code> is not sugar for your loop. It checks whether <code>src</code> implements <code>WriterTo</code> or <code>dst</code> implements <code>ReaderFrom</code> and hands off to them, which is how a file-to-socket copy reaches the kernel's zero-copy path. Your loop gets the contract wrong and drags every byte through userspace to do it.",
		},
		{
			title: "Returning (0, nil) from a Read you wrote",
			body: "The io docs: implementations are \"discouraged from returning a zero byte count with a nil error\", and callers must treat it as \"nothing happened\", explicitly not as EOF. A Reader that returns <code>(0, nil)</code> while waiting for data spins its caller in a hot loop that pins a core and never terminates. Block, or return an error.",
		},
		{
			title: "Using io.LimitReader as a size guard",
			body: "It is a budget, not a guard. <code>io.ReadAll(io.LimitReader(r, 10))</code> on 100 bytes returns 10 bytes and <code>err == nil</code>: the truncation is never reported, so you persist half a payload and log success. <code>http.MaxBytesReader</code> returns <code>*http.MaxBytesError</code> instead, which is the difference between clipping a request and rejecting it.",
		},
	],
	relatedSlugs: ["interfaces", "bufio", "http-client", "strings-bytes-runes", "error-handling"],
}
