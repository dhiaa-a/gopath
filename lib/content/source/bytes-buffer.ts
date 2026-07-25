import { SourceWalkthrough } from "../../content"

export const bytesBuffer: SourceWalkthrough = {
	slug: "bytes-buffer",
	name: "bytes.Buffer",
	pkg: "bytes",
	order: 2,
	unlockTier: 1,
	tagline:
		"482 lines around one slice and one integer. Nearly every branch exists to avoid a copy or an allocation, which makes this the file where you learn to read an if statement as a price rather than as logic.",

	why: `<p>You have used this type a hundred times without once thinking about it, which is the right condition for a read: nothing in the file can confuse you about intent, so everything you find is mechanism.</p>
<p>What makes it repay the time is that almost none of it is there for correctness. Strip out every line that exists purely to avoid work and what is left is a slice, an integer, and <code>append</code>. Most of the file is the avoidance: a copy dodged, an allocation deferred, a function call flattened, a page not zeroed. That makes it the best file in the standard library for the reading skill nobody teaches, which is <strong>reading a branch as a price rather than as logic</strong>.</p>
<p>The question to carry through every <code>if</code> here is not "when is this true" but "what does taking this branch save, and what did the author decide that saving was worth". Ask it inside <code>grow</code> and you get a list of answers sorted cheapest first, one of which is a deliberate refusal to be as clever as the code could have been.</p>
<p>The second skill is smaller and you will use it constantly: <strong>every slice expression in this file has a capacity you have to work out yourself</strong>. Nothing prints it, the compiler will not remind you, and at least three of the surprises below are invisible until you do. If <code>len</code> and <code>cap</code> are still one blurry idea, this file will make them two.</p>`,

	entryFile: "src/bytes/buffer.go",
	openCommand: 'less "$(go env GOROOT)/src/bytes/buffer.go"',

	orientation: `<p>482 lines, and the layout is unusually helpful once you know where to jump. Read in this order, not top to bottom:</p>
<ul>
<li><strong>Lines 18 to 24</strong>, the struct. Three fields, two trailing comments. This is the whole type. Read it first, and read the comments as carefully as the code.</li>
<li><strong>Lines 26 to 47</strong>, the <code>readOp</code> enum and the package-level errors. Skip on a first pass. The enum means nothing until you watch <code>lastRead</code> being used, and coming back costs ten seconds.</li>
<li><strong>Lines 49 to 110</strong>, the accessors: <code>Bytes</code>, <code>AvailableBuffer</code>, <code>String</code>, <code>Len</code>, <code>Cap</code>, <code>Available</code>, <code>Truncate</code>, <code>Reset</code>, plus the unexported <code>empty</code>. Nine short methods, every one of them the struct's invariant restated. Read them as a block, and use them as a self-check: if you can predict each body from its name and the two field comments, you have understood the struct.</li>
<li><strong>Lines 112 to 170</strong>, <code>tryGrowByReslice</code>, <code>grow</code>, <code>Grow</code>. <strong>This is the file.</strong> Everything else is a caller.</li>
<li><strong>Lines 172 to 312</strong>, the writers plus the two <code>io</code> methods. <code>Write</code>, <code>WriteString</code>, <code>WriteByte</code> and <code>WriteRune</code> are four lines each and they are the same four lines; read one, skim three. <code>ReadFrom</code> and <code>WriteTo</code> are where the interesting work is.</li>
<li><strong>Lines 314 to 461</strong>, the readers and the <code>Unread</code> pair. Mechanically simple, but three of them share a comment worth chasing, which is what the exercise at the bottom of this page is about.</li>
<li><strong>Lines 463 to 482</strong>, the two constructors.</li>
</ul>
<p>Two things about that layout. <code>growSlice</code>, at lines 227 to 252, sits stranded between <code>ReadFrom</code> and <code>WriteTo</code> with no relationship to either. It belongs with <code>grow</code>, a hundred lines above, and it is where <code>grow</code>'s most expensive branch ends up. Position in a file is a historical accident far more often than it is a design. Follow the calls, not the layout.</p>
<p>And read the last twenty lines early, out of order. <code>NewBuffer</code> and <code>NewBufferString</code> are the only constructors the package exports, and both doc comments end by talking you out of them: <em>"In most cases, new(Buffer) (or just declaring a Buffer variable) is sufficient to initialize a Buffer."</em> A package that argues against its own constructors is telling you the zero value carries real weight, and that hands you a question to hold while you read the rest: what makes a struct whose only slice is <code>nil</code> work? The answer is one line inside <code>grow</code>, and you will walk straight past it if you are not already looking.</p>
<p>If you would rather stay in the terminal, <code>go doc -src bytes.Buffer.Write</code> prints the source of a single method without opening the file.</p>`,

	excerpts: [
		{
			file: "src/bytes/buffer.go",
			title: "Two field comments, and the type is decoded",
			startLine: 18,
			code: `// A Buffer is a variable-sized buffer of bytes with [Buffer.Read] and [Buffer.Write] methods.
// The zero value for Buffer is an empty buffer ready to use.
type Buffer struct {
	buf      []byte // contents are the bytes buf[off : len(buf)]
	off      int    // read at &buf[off], write at &buf[len(buf)]
	lastRead readOp // last read operation, so that Unread* can work correctly.
}`,
			notice: `<p>The two trailing comments are the entire data structure and they are easy to skim as noise. <code>contents are the bytes buf[off : len(buf)]</code> plus <code>read at &amp;buf[off], write at &amp;buf[len(buf)]</code> say: a <code>Buffer</code> is one slice with a cursor partway into it. Reads push <code>off</code> forward. Writes push <code>len(buf)</code> forward. Live data is the middle. Everything from <code>0</code> to <code>off</code> is dead, already handed out and not yet reclaimed, and everything from <code>len(buf)</code> to <code>cap(buf)</code> is free space nobody can see.</p>
<p>Stop on <code>off</code> and ask why it exists, because the obvious design does not need it. After reading <code>n</code> bytes you could write <code>b.buf = b.buf[n:]</code> and be done. That works, it is what most people write, and it throws the front of the array away permanently: the slice header now points into the middle of an allocation whose beginning nothing can reach. An index keeps the header pinned to the start, so the dead prefix stays addressable and can be won back later by a single <code>copy</code>. You will watch that happen twice in this file. <strong>Re-slicing is a one way door. An index is not.</strong></p>
<p><code>lastRead</code> is not data. It records which method ran last so that <code>UnreadByte</code> and <code>UnreadRune</code> can refuse when the previous call was not the read they undo. One third of this struct exists to detect API misuse rather than to hold anything. Its type is <code>readOp</code>, an <code>int8</code> enum defined just below with an explicit instruction not to use <code>iota</code>, and the reason is that the numbers are load-bearing: <code>opReadRune3</code> is literally <code>3</code>, so <code>ReadRune</code> can store the decoded width with <code>b.lastRead = readOp(n)</code> and <code>UnreadRune</code> can step back with <code>b.off -= int(b.lastRead)</code>. The enum is doing double duty as a tag and as a count. Whenever a Go file goes out of its way to say <em>don't use iota here</em>, the values are being read as numbers somewhere.</p>
<p>Finally, hold onto the second line of the doc comment: <em>the zero value for Buffer is an empty buffer ready to use</em>. Nothing in the struct makes that true. A nil slice is not a buffer. The promise is kept a hundred lines later by one <code>nil</code> test inside <code>grow</code>, and if you do not go looking for it you will use this type for years without knowing what holds it up.</p>`,
		},
		{
			file: "src/bytes/buffer.go",
			title: "Two one-line methods under nine lines of warning",
			startLine: 49,
			code: `// Bytes returns a slice of length b.Len() holding the unread portion of the buffer.
// The slice is valid for use only until the next buffer modification (that is,
// only until the next call to a method like [Buffer.Read], [Buffer.Write], [Buffer.Reset], or [Buffer.Truncate]).
// The slice aliases the buffer content at least until the next buffer modification,
// so immediate changes to the slice will affect the result of future reads.
func (b *Buffer) Bytes() []byte { return b.buf[b.off:] }

// AvailableBuffer returns an empty buffer with b.Available() capacity.
// This buffer is intended to be appended to and
// passed to an immediately succeeding [Buffer.Write] call.
// The buffer is only valid until the next write operation on b.
func (b *Buffer) AvailableBuffer() []byte { return b.buf[len(b.buf):] }`,
			notice: `<p>Start with the ratio. Five lines of comment on a one-line body, then four on another. When a function's documentation is several times the size of its implementation, the comment <em>is</em> the API and the body is a formality, and skimming the comment to get to "the real code" gets it exactly backwards.</p>
<p>Then read the body anyway, because it says something the comment does not. <code>b.buf[b.off:]</code> is a two-index slice expression, and a two-index slice of a slice inherits capacity all the way to the end of the array. So <code>Bytes()</code> does not hand you a five-byte view of a five-byte thing. It hands you a five-byte view sitting on top of the buffer's private free space, with a legal path into it.</p>
<p>Measured on go1.23.12. The conditions are the whole claim: a zero-value <code>bytes.Buffer</code>, one <code>WriteString("hello")</code>, nothing else.</p>
<pre><code>b.WriteString("hello")
s := b.Bytes()               // len 5, cap 64
s2 := append(s, "XXXXX"...)  // 10 &lt;= 64, so append writes IN PLACE
s2                           // "helloXXXXX"
b.WriteString("world")       // b writes over those same bytes
b.String()                   // "helloworld"
s2                           // "helloworld"  &lt;- changed under you, silently</code></pre>
<p>That <code>cap</code> of 64 is a condition, not a constant: it is <code>smallBufferSize</code>, the bootstrap allocation you meet in <code>grow</code>. Push the buffer past its capacity first and the <code>append</code> reallocates instead, the aliasing vanishes, and the bug goes quiet until the day the sizes line up again. This is the <code>append-sharing</code> failure lab with the standard library cast as the base slice.</p>
<p><code>AvailableBuffer</code> is the same trick with the safety on, and its placement is the lesson. <code>b.buf[len(b.buf):]</code> starts at the write point with length zero, so its capacity is exactly the free space and there is no live data to clobber. Measured with the same setup: <code>len 0, cap 59</code>, which is the 64 minus the five bytes in use. The doc tells you the intended shape, which is to append into it and hand the result straight to <code>Write</code>: same array, no allocation, and this time the buffer knows about it. When you find a dangerous expression in a stdlib file, look at its neighbours. The sanctioned version is often the very next function.</p>`,
		},
		{
			file: "src/bytes/buffer.go",
			title: "A function that exists because of the inliner",
			startLine: 112,
			code: `// tryGrowByReslice is an inlineable version of grow for the fast-case where the
// internal buffer only needs to be resliced.
// It returns the index where bytes should be written and whether it succeeded.
func (b *Buffer) tryGrowByReslice(n int) (int, bool) {
	if l := len(b.buf); n <= cap(b.buf)-l {
		b.buf = b.buf[:l+n]
		return l, true
	}
	return 0, false
}`,
			notice: `<p>The word to stop on is in the first line: <code>inlineable</code>. That is not describing behaviour, it is describing a compiler decision, and it tells you this function was carved out of another one for a reason that has nothing to do with readability.</p>
<p>What it does is small. If there are <code>n</code> unused bytes past <code>len(b.buf)</code>, stretch the length into them and report the index the caller should write at. Otherwise report failure. No allocation, no copy, one branch.</p>
<p>Now find the redundancy, because it is the point. <code>grow</code> calls <code>tryGrowByReslice</code> on its fourth line. And <code>Write</code> calls <code>tryGrowByReslice</code> too, falling through to <code>grow</code> only when it fails:</p>
<pre><code>m, ok := b.tryGrowByReslice(len(p))
if !ok {
	m = b.grow(len(p))
}</code></pre>
<p>So the same check runs at the call site and then again inside the callee. Written the normal way, <code>Write</code> would just call <code>grow</code> and let <code>grow</code> do the reslice. Four methods carry this duplication: <code>Write</code>, <code>WriteString</code>, <code>WriteByte</code> and <code>WriteRune</code>.</p>
<p>You do not have to guess why. Ask the compiler with <code>go build -gcflags='-m -m' bytes</code>, on go1.23.12 (paths trimmed):</p>
<pre><code>buffer.go:115:6: can inline (*Buffer).tryGrowByReslice with cost 30 as: ...
buffer.go:126:6: cannot inline (*Buffer).grow: function too complex: cost 220 exceeds budget 80
buffer.go:175:6: cannot inline (*Buffer).Write: function too complex: cost 119 exceeds budget 80
buffer.go:133:32: inlining call to (*Buffer).tryGrowByReslice
buffer.go:177:29: inlining call to (*Buffer).tryGrowByReslice</code></pre>
<p><code>grow</code> is nearly three times over the inlining budget and can never be pasted into anything. So the hot path, a write into a buffer that already has room, was lifted into a function cheap enough to inline and then stamped at five call sites, one of which is inside <code>grow</code> itself. Be precise about what this buys: <code>Write</code> is over budget too, so its caller still pays one call. What the split removes is the <em>second</em> one, on the path taken by almost every write.</p>
<p>The habit worth keeping: <strong>duplicated logic in the standard library is usually a compiler boundary, not sloppiness.</strong> When the same two lines appear at a call site and again inside the callee, or a suspiciously tiny helper turns up with a comment about being cheap, the missing explanation is the inliner, and <code>-gcflags=-m</code> prints it.</p>`,
		},
		{
			file: "src/bytes/buffer.go",
			title: "Four ways not to allocate, cheapest first",
			startLine: 126,
			code: `func (b *Buffer) grow(n int) int {
	m := b.Len()
	// If buffer is empty, reset to recover space.
	if m == 0 && b.off != 0 {
		b.Reset()
	}
	// Try to grow by means of a reslice.
	if i, ok := b.tryGrowByReslice(n); ok {
		return i
	}
	if b.buf == nil && n <= smallBufferSize {
		b.buf = make([]byte, n, smallBufferSize)
		return 0
	}
	c := cap(b.buf)
	if n <= c/2-m {
		// We can slide things down instead of allocating a new
		// slice. We only need m+n <= c to slide, but
		// we instead let capacity get twice as large so we
		// don't spend all our time copying.
		copy(b.buf, b.buf[b.off:])
	} else if c > maxInt-c-n {
		panic(ErrTooLarge)
	} else {
		// Add b.off to account for b.buf[:b.off] being sliced off the front.
		b.buf = growSlice(b.buf[b.off:], b.off+n)
	}
	// Restore b.off and len(b.buf).
	b.off = 0
	b.buf = b.buf[:m+n]
	return m
}`,
			notice: `<p>This is the file. Do not read it as logic, read it as a price list. Every branch answers the same request, "give me room for <code>n</code> more bytes", and they are ordered by what they cost.</p>
<ul>
<li><strong>Free, and not an alternative.</strong> <code>if m == 0 &amp;&amp; b.off != 0 { b.Reset() }</code>. The buffer is drained but the cursor is parked in the middle. Zero live bytes, so winning the whole array back costs two assignments. This is not one of the ways to grow, it is a free move that makes the next one more likely to succeed.</li>
<li><strong>Free.</strong> <code>tryGrowByReslice(n)</code>. The room is already there, so move <code>len</code> and return.</li>
<li><strong>One allocation, nil buffer only.</strong> <code>if b.buf == nil &amp;&amp; n &lt;= smallBufferSize</code>. This is the line that makes the doc comment's zero-value promise true. A <code>Buffer</code> with a nil slice needs no special case anywhere else because this one branch turns it into a real allocation on first use. Note it asks for more than it was given: <code>make([]byte, n, smallBufferSize)</code>, so a one-byte first write buys 64 bytes of capacity.</li>
<li><strong>One copy, no allocation.</strong> <code>if n &lt;= c/2-m</code>. Slide the live bytes down to the front and reuse the array.</li>
<li><strong>One allocation and one copy.</strong> <code>growSlice</code>, the last resort.</li>
</ul>
<p>Between the last two sits <code>else if c > maxInt-c-n { panic(ErrTooLarge) }</code>. Read the shape rather than the values: the natural way to write it is <code>2*c+n > maxInt</code>, which cannot work, because computing <code>2*c+n</code> is the exact overflow being tested for. So it is spelled with subtraction, which cannot overflow. Any time you meet a comparison rearranged into a form that looks harder to read, the first hypothesis should be that the readable form would overflow.</p>
<p>The slide is where the <code>off</code> field pays for itself, and its comment is unusually honest about a tradeoff most code buries: they could slide whenever <code>m+n &lt;= c</code>, and they choose not to, <em>"so we don't spend all our time copying"</em>. The condition <code>n &lt;= c/2-m</code> is <code>m+n &lt;= c/2</code> rearranged, so it slides only while the result would still leave the array half empty, and otherwise gives up and doubles. Sliding a nearly full buffer would be an O(n) copy on every single write, forever. This is a branch that exists to <em>stop</em> taking a cheaper branch.</p>
<p>Measured on go1.23.12, and the setup is the claim. Start from <code>bytes.NewBuffer(make([]byte, 0, 128))</code>, write 100 bytes, consume 90 with <code>Next(90)</code>, then write 30 more. At that moment <code>c</code> is 128, <code>m</code> is 10, and the free tail is only 28 bytes, so the reslice fails. But <code>30 &lt;= 128/2-10</code>, so it slides:</p>
<pre><code>NewBuffer(cap 128), Write(100): Cap=128 Len=100
Next(90):                       Cap=128 Len=10
Write(30):                      Cap=128 Len=40   &lt;- same array, nothing allocated</code></pre>
<p>Change one number and the branch changes. Consume 10 instead of 90 and 90 bytes stay live, so <code>c/2-m</code> is <code>-26</code>, the slide is refused, and <code>growSlice</code> runs:</p>
<pre><code>NewBuffer(cap 128), Write(100): Cap=128 Len=100
Next(10):                       Cap=128 Len=90
Write(30):                      Cap=240 Len=120  &lt;- reallocated</code></pre>
<p>Identical buffer size, identical write size, opposite outcome. What decided it was how much had already been read, which is why quoting a growth number for <code>bytes.Buffer</code> without stating the read position means nothing.</p>
<p>One last detail, easy to miss: <code>m := b.Len()</code> on the first line, and <code>return m</code> on the last. The return value is the write index, captured <em>before</em> any of this ran, and it survives because the two lines above it put the buffer back into a known state whichever branch was taken. Every path that did not already return converges on <code>b.off = 0</code> and <code>b.buf = b.buf[:m+n]</code>, and that convergence is what lets the branches above stay three lines long.</p>`,
		},
		{
			file: "src/bytes/buffer.go",
			title: "grow called for its side effect, then immediately undone",
			startLine: 206,
			code: `func (b *Buffer) ReadFrom(r io.Reader) (n int64, err error) {
	b.lastRead = opInvalid
	for {
		i := b.grow(MinRead)
		b.buf = b.buf[:i]
		m, e := r.Read(b.buf[i:cap(b.buf)])
		if m < 0 {
			panic(errNegativeRead)
		}

		b.buf = b.buf[:i+m]
		n += int64(m)
		if e == io.EOF {
			return n, nil // e is EOF, so return nil explicitly
		}
		if e != nil {
			return n, e
		}
	}
}`,
			notice: `<p>Read the first two lines of the loop together and notice they undo each other. <code>i := b.grow(MinRead)</code> ends with <code>b.buf = b.buf[:m+n]</code>, stretching the length by 512. <code>b.buf = b.buf[:i]</code> puts it straight back. The length change is discarded one line after it was made, and what is kept is the other thing <code>grow</code> did, which was guarantee capacity. This is a function called for a side effect the caller wants and a documented effect the caller reverts, and it is the reason to read the callee before the caller.</p>
<p>Then the line that does the work: <code>r.Read(b.buf[i:cap(b.buf)])</code>. Indexing a slice past its own length is legal exactly because capacity extends beyond it, and this is the one construct in the file worth being able to write from memory. The reader is handed the buffer's own uncommitted storage and puts its bytes directly into their final destination. No staging array, no copy.</p>
<p>You can prove there is no copy. Conditions: a zero-value <code>bytes.Buffer</code> and an <code>io.Reader</code> that returns all five of its bytes plus <code>io.EOF</code> in a single call, so the loop runs once and nothing is reallocated underneath the measurement. On go1.23.12:</p>
<pre><code>reader was handed: len(p)=512 cap(p)=512
&amp;p[0] seen by reader = 0xc000078000
&amp;b.Bytes()[0]        = 0xc000078000
same address: true</code></pre>
<p><code>b.buf = b.buf[:i+m]</code> is the commit. Until that line runs, the bytes the reader just wrote are past <code>len</code> and invisible to everything: <code>Len()</code>, <code>Bytes()</code> and <code>String()</code> all stop short of them. <strong>Length is the commit protocol, capacity is the workspace.</strong> That is the same idea as <code>AvailableBuffer</code> back at line 60, and once you have it you can read most buffering code in the standard library.</p>
<p><code>MinRead</code> is a floor, not the read size, which the name does not tell you and the doc only implies. <code>b.buf[i:cap(b.buf)]</code> offers everything free, which after a grow is usually far more than 512. Same setup with a reader that needs three calls:</p>
<pre><code>Read call 0 handed len(p)=512
Read call 1 handed len(p)=1019
Read call 2 handed len(p)=1014
final: 10 bytes of data, b.Cap()=1024</code></pre>
<p>Worth carrying out of this file: <code>ReadFrom</code> over a tiny source still leaves you holding at least 512 bytes and here 1024, because the loop must grow once more to learn that the reader is finished. If you pool <code>bytes.Buffer</code> values, that is what you are pooling.</p>
<p>Last, <code>if m &lt; 0 { panic(errNegativeRead) }</code>. <code>io.Reader</code> is an interface, so <code>r</code> is somebody else's code and the count it returns is unvalidated input. A negative <code>m</code> would make <code>b.buf[:i+m]</code> shrink the buffer back over live data instead of extending it, quietly. The library checks the one lie that would corrupt it and checks nothing else, which is the usual standard-library posture: defend the invariant, not the caller.</p>`,
		},
		{
			file: "src/bytes/buffer.go",
			title: "A comment that argues with the compiler",
			startLine: 229,
			code: `func growSlice(b []byte, n int) []byte {
	defer func() {
		if recover() != nil {
			panic(ErrTooLarge)
		}
	}()
	// TODO(http://golang.org/issue/51462): We should rely on the append-make
	// pattern so that the compiler can call runtime.growslice. For example:
	//	return append(b, make([]byte, n)...)
	// This avoids unnecessary zero-ing of the first len(b) bytes of the
	// allocated slice, but this pattern causes b to escape onto the heap.
	//
	// Instead use the append-make pattern with a nil slice to ensure that
	// we allocate buffers rounded up to the closest size class.
	c := len(b) + n // ensure enough space for n elements
	if c < 2*cap(b) {
		// The growth rate has historically always been 2x. In the future,
		// we could rely purely on append to determine the growth rate.
		c = 2 * cap(b)
	}
	b2 := append([]byte(nil), make([]byte, c)...)
	copy(b2, b)
	return b2[:len(b)]
}`,
			notice: `<p>Twenty-four lines, half of them comment, and the comments are not narrating. They are arguing. When a comment argues, the author knew something you do not, and the paragraph is worth more than the code around it.</p>
<p>First the <code>defer</code>. It catches whatever the runtime throws when the allocation below is impossible and re-panics with <code>ErrTooLarge</code>, the value this package documents. Every "will panic with ErrTooLarge" in the file, on <code>Write</code>, <code>WriteString</code>, <code>Grow</code>, <code>ReadFrom</code> and the rest, funnels through this one deferred closure. Measured on go1.23.12, 64-bit:</p>
<pre><code>var b bytes.Buffer
b.Grow(1 &lt;&lt; 62)
// recovered: bytes.Buffer: too large    (r == bytes.ErrTooLarge is true)

make([]byte, 1 &lt;&lt; 62)
// panic: runtime error: makeslice: len out of range</code></pre>
<p>That is a translation layer: a runtime-owned message nobody should match on, turned into a package-owned sentinel a caller can compare with <code>==</code>. And it explains why this is a separate function rather than four more lines inside <code>grow</code>. The <code>defer</code> guards the only path that can fail, so the reslice, the bootstrap and the slide never carry it. The compiler notices too: <code>cannot inline growSlice: unhandled op DEFER</code>.</p>
<p>Then the block tagged with issue 51462, which is the most interesting comment in the file. It says the obvious implementation, <code>return append(b, make([]byte, n)...)</code>, would be better in one way, since the compiler routes it to <code>runtime.growslice</code> and skips zeroing the first <code>len(b)</code> bytes, and unacceptable in another: it <em>"causes b to escape onto the heap"</em>. You can check that rather than believe it. Two functions, the pattern that comment wants and the pattern it settles for, under <code>go build -gcflags=-m</code> on go1.23.12:</p>
<pre><code>// return append(b, make([]byte, n)...)
esc.go:5:14: leaking param: b to result ~r0 level=0
esc.go:6:23: make([]byte, n) escapes to heap

// b2 := append([]byte(nil), make([]byte, c)...); copy(b2, b); return b2[:len(b)]
esc.go:11:14: b does not escape</code></pre>
<p>And the shipped function agrees: <code>buffer.go:229:16: b does not escape</code>. <em>Leaking param b to result</em> means the compiler must assume the caller's array outlives the call and therefore cannot keep it on the stack. <em>b does not escape</em> means it can prove the parameter is only read and copied out of. The odd-looking <code>append([]byte(nil), ...)</code> then <code>copy</code> is what buys that proof, at the cost of the zeroing that comment would rather avoid.</p>
<p>The last claim in the comment is about size classes, and it is why <code>Cap()</code> on a <code>bytes.Buffer</code> is almost never a number you chose. Appending onto a nil slice lets the runtime round up to the nearest size class instead of handing you exactly what you asked for. Measured:</p>
<pre><code>n= 65  append([]byte(nil), make([]byte,n)...) cap= 80   make([]byte,n) cap= 65
n=100  append([]byte(nil), make([]byte,n)...) cap=112   make([]byte,n) cap=100
n=130  append([]byte(nil), make([]byte,n)...) cap=144   make([]byte,n) cap=130</code></pre>
<p>Those extra bytes were going to be inside the size class either way. This line is the difference between using them and leaving them on the floor. And one habit for reading any stdlib file: a deferred-work comment carrying an issue number is a live argument, not dead wood. Following <code>issue/51462</code> is often the fastest way to find out why a function looks wrong.</p>`,
		},
	],

	exercise: {
		question:
			'The comment "Buffer is empty, reset to recover space." appears three times in buffer.go, in three read methods that never call each other, and a fourth variant of it turns up in a method with nothing to do with reading. Find all four. Then answer the real question: a Read on a drained buffer copies zero bytes and returns io.EOF, so why does it still assign to all three fields of the struct? What is being recovered, why is that particular moment the only free one, and which exported method lets you watch it happen?',
		command:
			'grep -n "reset to recover space" "$(go env GOROOT)/src/bytes/buffer.go"',
		answer: `<p>Four hits on go1.23.12: lines 128, 321, 358 and 375, in <code>grow</code>, <code>Read</code>, <code>ReadByte</code> and <code>ReadRune</code>. Widen the search to <code>grep -n "b.Reset()"</code> and there are six call sites, adding <code>Truncate(0)</code> at line 93 and <code>WriteTo</code> at line 277.</p>
<p><strong>What is recovered</strong> is <code>b.buf[:b.off]</code>. The cursor only ever moves forward, so every read strands a little more of the array behind it: bytes that are allocated, reachable, and permanently useless. Winning them back means moving the live bytes to the front, which is a <code>copy</code>, which costs. Unless there are no live bytes.</p>
<p><strong>Why that moment</strong> is the free one: when the buffer is drained, <code>off == len(b.buf)</code>, so the copy would be zero bytes long. <code>Reset</code> reclaims the entire array for two assignments. This is the same reclamation as <code>grow</code>'s slide-down branch with the price removed, which is why <code>grow</code> agonises over whether to slide but every drained buffer is reset on sight, wherever the file happens to notice one.</p>
<p><strong>Which method shows it</strong>: <code>Available</code>, which returns <code>cap(b.buf) - len(b.buf)</code>. Conditions: a buffer created with an explicit 64-byte capacity, two bytes written and then consumed, so <code>off</code> is 2 and <code>len(b.buf)</code> is 2. Observed on go1.23.12:</p>
<pre><code>drained:            Len=0 Cap=64 Available=62
Read -&gt; n=0 err=EOF
after the EOF read: Len=0 Cap=64 Available=64</code></pre>
<p>Two bytes appeared out of a call that read nothing. <code>ReadByte</code> and <code>ReadRune</code> do the same thing, 62 to 64, from the same starting state.</p>
<p>Now the general lesson, which is bigger than this file. <strong>A method's name tells you the caller's intent, not the memory it touches.</strong> Exactly six exported methods on <code>*Buffer</code> never assign to a field: <code>Len</code>, <code>Cap</code>, <code>Available</code>, <code>Bytes</code>, <code>AvailableBuffer</code> and <code>String</code>. Every other one writes, including all six whose names begin with <code>Read</code>. So a <code>*bytes.Buffer</code> shared between goroutines is a data race even when every goroutine only ever calls <code>Read</code> and every call returns <code>io.EOF</code>, and there is no lock anywhere in the 482 lines to save you.</p>
<p>So the habit: before sharing a value across goroutines, do not reason from method names, and do not accept "they are only readers" as an argument. Open the type and look for assignments to its own fields. Anything with an internal cursor, cache, or reusable scratch space is shaped like this one, and the mutation is always invisible from the call site.</p>`,
		answerAnchor: {
			file: "src/bytes/buffer.go",
			needle: `	if b.empty() {
		// Buffer is empty, reset to recover space.
		b.Reset()
		if len(p) == 0 {
			return 0, nil
		}
		return 0, io.EOF
	}`,
		},
	},

	takeaway:
		"A Buffer is one slice plus a read cursor, and nearly every branch in the file buys back a copy or an allocation that none of them will admit to until you read len and cap as two separate numbers.",

	relatedConcepts: [
		"slice-internals",
		"io-reader-writer",
		"escape-analysis",
		"strings-bytes-runes",
		"bufio",
	],
	relatedProjects: ["log-parser", "tcp-echo"],
	relatedFailures: ["append-sharing", "slice-aliasing"],
}
