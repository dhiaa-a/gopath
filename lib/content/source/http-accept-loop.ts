import { SourceWalkthrough } from "../../content"

export const httpAcceptLoop: SourceWalkthrough = {
	slug: "http-accept-loop",
	name: "the net/http Server accept loop",
	pkg: "net/http",
	order: 5,
	unlockTier: 3,
	tagline:
		"3,908 lines, 148 function declarations, and the whole of Go's HTTP concurrency model is 33 of them. The file where you stop reading large files and start navigating them.",

	why: `<p>This is the file people bounce off. Everything else on this page is 129 to 792 lines and you can hold the shape of it in your head. <code>src/net/http/server.go</code> is 3,908 lines, and the honest reaction to opening it is that you are not going to finish. That reaction is correct and it is also irrelevant, because nobody finishes this file. They navigate it.</p>
<p>So the skill here is not reading. It is <strong>entering a large file at the right symbol and refusing everything else</strong>. This page quotes 121 lines of <code>server.go</code> in six pieces, which is 3% of it, and the 33 that matter most you can print without opening the file at all: <code>go doc -src net/http.Server.Serve</code> is 75 lines, 1.9% of the file, and the accept loop is inside it.</p>
<p>The second skill is specific to this shape of code and you will use it in every worker, dispatcher and server you ever read: <strong>in a loop that ends in a <code>go</code> statement, the position of that statement is a specification.</strong> Everything above it runs once per item on one shared goroutine. Everything below it runs per item on its own. Nothing in the language marks that boundary and no comment in this file points at it, but it decides which of your callbacks can stall the entire server and which panics take the process down. Measured below, on both sides of the line.</p>
<p>The third thing this file gives you is rarer, and it is the moment the intimidation breaks. The accept loop's second-to-last statement is a single method call that jumps 1,486 lines <em>backwards</em>, to a nineteen-line function whose own first statement calls forward again to line 3433, which is seventy-four lines <em>below</em> where you started. Follow that once and the layout of a big file stops feeling like an obstacle and starts feeling like what it is: an accident of edit history that your tools already route around.</p>`,

	entryFile: "src/net/http/server.go",
	openCommand: "go doc -src net/http.Server.Serve",

	orientation: `<p>Do not open this file at line 1. The single most useful fact about its layout is this one: <strong><code>type Server</code> is declared at line 2880</strong>, which is 74% of the way through a file named <code>server.go</code>. Read top to bottom and you will spend three thousand lines on connections, responses and routing before you meet the type in the filename. Most people who give up on this file gave up somewhere in there, and concluded that the standard library is too dense for them. It is not. They entered at the wrong door.</p>
<p>Here is the strategy, and it generalises to any file too big to read.</p>
<p><strong>1. Enter at a symbol you already know, not at a line number.</strong> You have called <code>http.ListenAndServe</code>. Start there and let the call chain carry you:</p>
<pre><code>go doc -src net/http.Server.ListenAndServe   # 24 lines, ends: return srv.Serve(ln)
go doc -src net/http.Server.Serve            # 75 lines, and the loop is in it</code></pre>
<p>Two commands, 99 lines, and you have arrived. No editor, no scrolling, no 3,908-line buffer. <code>go doc -src</code> prints one symbol's source together with its doc comment, and for a first pass it is almost always what you actually wanted.</p>
<p><strong>2. Get a table of contents before you get a file.</strong> When you do open it, the first thing to run is not a read, it is an index:</p>
<pre><code>grep -n "^func " "$(go env GOROOT)/src/net/http/server.go"   # 148 lines
grep -n "^type " "$(go env GOROOT)/src/net/http/server.go"   #  28 lines</code></pre>
<p>176 lines of output that tell you where everything is. Skim that instead of the file. Then jump.</p>
<p><strong>3. Name the path before you walk it.</strong> For the accept loop it is five hops, and writing them down keeps you from wandering:</p>
<pre><code>ListenAndServe   3247   -&gt;  Serve   3300
Serve            3300   -&gt;  the for at 3329
the loop         3329   -&gt;  go c.serve(connCtx) at 3360
setState         3359   -&gt;  back up to 1873
c.serve          3360   -&gt;  1937 (the other 197-line function)</code></pre>
<p><strong>4. Decide what you are refusing, out loud, with line numbers.</strong> Skipping is only cheap if it is deliberate. On a first pass through this file, refuse all of it:</p>
<ul>
<li><strong>Response writing.</strong> <code>chunkWriter</code> at 350, <code>response</code> at 424, <code>chunkWriter.writeHeader</code> at 1302. That last one is 279 lines and is the longest function in the file. It has nothing to do with accepting connections.</li>
<li><strong>Request reading.</strong> <code>connReader</code> at 654, <code>conn.readRequest</code> at 1019, the <code>bufio</code> pools at 812 to 915.</li>
<li><strong>Routing.</strong> <code>ServeMux</code> at 2505 and everything to 2854. Roughly 350 lines that never run until a request has already been read off a connection that was already accepted.</li>
<li><strong>HTTP/2.</strong> <code>setupHTTP2_Serve</code> at 3577, <code>onceSetNextProtoDefaults</code> at 3593, every mention of <code>TLSNextProto</code>. Twenty-four lines of this file mention http2 and every one of them is a hook into a package that lives somewhere else. Skipping them costs you nothing, because the code is not here to be read.</li>
<li><strong>The handler decorators.</strong> <code>StripPrefix</code>, <code>Redirect</code>, <code>TimeoutHandler</code> at 3620, <code>globalOptionsHandler</code> at 3778, <code>loggingConn</code> at 3823.</li>
</ul>
<p>What survives is a short list: <code>newConn</code> 631, <code>setState</code> 1873, <code>conn.serve</code> 1937, <code>Server</code> 2880, <code>Shutdown</code> 3049, <code>closeIdleConns</code> 3100, <code>ConnState</code> 3136, <code>ListenAndServe</code> 3247, <code>Serve</code> 3300, <code>trackListener</code> 3414, <code>trackConn</code> 3433, <code>shuttingDown</code> 3464. Around 580 lines out of 3,908, one seventh of the file, and it is the whole lifecycle. A third of that total is <code>conn.serve</code> by itself, so the part you need today to understand how connections arrive is well under three hundred lines.</p>
<p><strong>5. Use function length as a filter, not as a warning.</strong> Rank the file by function size and the top five are:</p>
<pre><code>279 lines  1302  (*chunkWriter).writeHeader     skip
197 lines  1937  (*conn).serve                  the destination
 99 lines  1019  (*conn).readRequest            skip
 63 lines  3300  (*Server).Serve                READ THIS ONE
 55 lines  2585  (*ServeMux).findHandler        skip</code></pre>
<p>In a file this size the thing you are looking for is usually small and the things surrounding it are large. That is not a coincidence. Long functions in the standard library are almost always serialisation, parsing, or protocol formatting: mechanical work that has to enumerate cases. The interesting decisions are short, because a decision is an <code>if</code> and a call.</p>
<p><strong>6. When you know the answer's shape, grep for it directly.</strong> "One goroutine per connection" means there is a <code>go</code> statement somewhere. There are only a handful in the file, and the one you want reads exactly as you would guess. That is the exercise at the bottom of this page, so do not run it yet.</p>
<p>One last note before the excerpts. About a hundred and seventy lines of this file are about shutting down, spread over lines 2999 to 3134, 3414 to 3444 and 3464 to 3466, and they are the part nobody reads. If you only ever read the accept loop you will believe an HTTP server is a <code>for</code> and a <code>go</code>. The reason it is 3,908 lines is that stopping is harder than starting.</p>`,

	excerpts: [
		{
			file: "src/net/http/server.go",
			title: "Twelve lines of prologue, and every one is a defence",
			startLine: 3305,
			code: `	origListener := l
	l = &onceCloseListener{Listener: l}
	defer l.Close()

	if err := srv.setupHTTP2_Serve(); err != nil {
		return err
	}

	if !srv.trackListener(&l, true) {
		return ErrServerClosed
	}
	defer srv.trackListener(&l, false)`,
			notice: `<p>This is what sits between <code>Serve</code>'s doc comment and its loop. Read it for what it is guarding against and then move on, but do read it, because three separate bugs are being paid off here and none of them is obvious from the outside.</p>
<p>Start with the first two lines, which are the tell. <code>origListener := l</code> saves a variable one statement before that variable is overwritten. A copy taken immediately before an assignment has exactly one job: to survive it. So find the single use. <code>origListener</code> appears twice in the entire file, here and at line 3320, <code>baseCtx = srv.BaseContext(origListener)</code>. That is the whole reason it exists: your <code>BaseContext</code> hook is handed the listener <em>you</em> passed in, not the wrapper the standard library just put around it. Measured, with a custom listener type:</p>
<pre><code>BaseContext received: main.countingListener
  (not *http.onceCloseListener, which is what Serve is using internally)</code></pre>
<p>Now the wrapper itself. <code>onceCloseListener</code> is fourteen lines at 3762, a <code>net.Listener</code> embedded next to a <code>sync.Once</code>, and it exists because this listener is going to be closed twice by two different code paths that do not know about each other: <code>defer l.Close()</code> on the line above, and <code>Shutdown</code> reaching in through <code>closeListenersLocked</code>. Measured, with a listener that counts its own <code>Close</code> calls, after a full <code>Shutdown</code> plus <code>Serve</code>'s deferred close:</p>
<pre><code>my Close() calls BEFORE Shutdown:                    0
my Close() calls AFTER Shutdown AND Serve's defer:   1</code></pre>
<p>Two closes went in, one came out. <strong>A <code>sync.Once</code> inside a decorator is almost always a sign that two owners are going to try to release the same resource</strong>, and finding one is a fast way to discover a lifecycle you did not know was shared.</p>
<p><code>setupHTTP2_Serve()</code> is here so you can practise. Skip it. It configures a protocol handled by a package that is not in this file, it cannot fail in any way that concerns the accept loop, and reading it now would cost you twenty minutes and teach you nothing about accepting connections.</p>
<p>Then <code>if !srv.trackListener(&amp;l, true) { return ErrServerClosed }</code>, which is the first of two exits that return that error and by far the less famous one. This one fires <em>before the loop starts</em>, so a <code>Serve</code> call on a server somebody already shut down never touches the listener at all. Measured:</p>
<pre><code>srv.Shutdown(ctx)
srv.Serve(anotherListener)   returned after 0.0ms: http: Server closed
                             (Accept was never called)</code></pre>
<p>And note the argument: <code>&amp;l</code>, the address of the local variable, taken <em>after</em> the reassignment, so the add and the deferred remove both name the same slot holding the same wrapper. Why a pointer at all is a genuinely strange choice with a four-line justification attached, and it gets its own excerpt further down.</p>`,
		},
		{
			file: "src/net/http/server.go",
			title: "The loop, and the twenty-one lines about accept going wrong",
			startLine: 3329,
			code: `	for {
		rw, err := l.Accept()
		if err != nil {
			if srv.shuttingDown() {
				return ErrServerClosed
			}
			if ne, ok := err.(net.Error); ok && ne.Temporary() {
				if tempDelay == 0 {
					tempDelay = 5 * time.Millisecond
				} else {
					tempDelay *= 2
				}
				if max := 1 * time.Second; tempDelay > max {
					tempDelay = max
				}
				srv.logf("http: Accept error: %v; retrying in %v", err, tempDelay)
				time.Sleep(tempDelay)
				continue
			}
			return err
		}`,
			notice: `<p>Here it is: <code>for {</code>, no condition, at line 3329 of 3908. The body runs to 3361, so the entire accept loop is 33 lines, and this excerpt is the 21 of them that are about failure. Sit with that ratio for a second. Two thirds of the loop handles the case where nothing arrived.</p>
<p><strong>Read the guard order, because the order is the design.</strong> <code>srv.shuttingDown()</code> is asked <em>first</em>, before a single property of <code>err</code> is inspected. The loop asks "did I do this to myself" before it asks "what went wrong". That inversion is what lets <code>Shutdown</code> stay simple: it sets a flag, closes the listener, and lets <code>Accept</code> fail in whatever platform-specific way it likes, with no obligation to produce an error anyone can recognise. Measured:</p>
<pre><code>srv.Shutdown(context.Background())
Serve returned:                          http: Server closed
errors.Is(err, http.ErrServerClosed)     true</code></pre>
<p><strong>Now the line that should stop you.</strong> <code>ne.Temporary()</code>. Go and read what that method's own package says about it, in <code>src/net/net.go</code> at line 419:</p>
<pre><code>// Deprecated: Temporary errors are not well-defined.
// Most "temporary" errors are timeouts, and the few exceptions are surprising.
// Do not use this method.
Temporary() bool</code></pre>
<p>The standard library deprecated this method, told you not to use it, and then kept calling it in its own HTTP server. This is not sloppiness and it is not hypocrisy, it is the compatibility promise: <code>net.Error</code> is an exported interface, so <code>Temporary</code> can never be removed, and anything already branching on it cannot change behaviour under people who depend on it. Measured, and worth knowing about your own code too:</p>
<pre><code>a program that calls ne.Temporary():
  go build   exit 0, no output
  go vet     exit 0, no output</code></pre>
<p><strong>Deprecation in Go is a doc comment and nothing else.</strong> No compiler warning, no vet check. It is visible in <code>go doc</code> and in your editor and nowhere in your build. Grep the whole package and <code>.Temporary()</code> appears exactly once in all of <code>net/http</code>: this line.</p>
<p>The backoff is easy to verify because it needs no real failure at all: write a <code>net.Listener</code> whose <code>Accept</code> returns an error satisfying <code>net.Error</code> with <code>Temporary() == true</code>, hand it to <code>Serve</code>, and read <code>srv.ErrorLog</code>. Ten consecutive temporary errors on go1.23.12:</p>
<pre><code>http: Accept error: ...; retrying in 5ms
http: Accept error: ...; retrying in 10ms
http: Accept error: ...; retrying in 20ms
http: Accept error: ...; retrying in 40ms
http: Accept error: ...; retrying in 80ms
http: Accept error: ...; retrying in 160ms
http: Accept error: ...; retrying in 320ms
http: Accept error: ...; retrying in 640ms
http: Accept error: ...; retrying in 1s
http: Accept error: ...; retrying in 1s     &lt;- capped, and it stays there</code></pre>
<p>Pure doubling from 5ms, clamped at one second, and no jitter, which is fine here because there is only ever one accept loop per listener contending for anything. The reset lives in the <em>other</em> half of the loop, and it is unconditional on success. Same harness, script "temp, temp, success, temp, temp":</p>
<pre><code>retrying in 5ms
retrying in 10ms
   ... one real connection accepted ...
retrying in 5ms      &lt;- back to the floor
retrying in 10ms</code></pre>
<p>Last, read the two failure exits against each other, because only one of them says anything. A temporary error is logged and retried. A fatal one is <code>return err</code> at the bottom, with no <code>srv.logf</code> anywhere near it. Measured: an <code>Accept</code> error that is not temporary, and one that is not even a <code>net.Error</code>, both end <code>Serve</code> with <strong>an empty ErrorLog</strong>. <em>If you launch your server with <code>go srv.Serve(ln)</code> and throw the return value away, that is the one class of failure that leaves no trace at all.</em></p>
<p>One small thing for the collection: <code>if max := 1 * time.Second; tempDelay &gt; max</code> shadows <code>max</code>, which has been a builtin since Go 1.21. Perfectly legal, and a useful reminder that code in the standard library is often older than the language feature it appears to conflict with.</p>`,
		},
		{
			file: "src/net/http/server.go",
			title: "The twelve lines you came for",
			startLine: 3350,
			code: `		connCtx := ctx
		if cc := srv.ConnContext; cc != nil {
			connCtx = cc(connCtx, rw)
			if connCtx == nil {
				panic("ConnContext returned nil")
			}
		}
		tempDelay = 0
		c := srv.newConn(rw)
		c.setState(c.rwc, StateNew, runHooks) // before Serve can return
		go c.serve(connCtx)`,
			notice: `<p>The success path. Twelve lines, and the last one is Go's entire HTTP concurrency model.</p>
<p><code>go c.serve(connCtx)</code> is <strong>unconditional</strong>. There is no pool, no queue, no semaphore, no counter, and no way to configure one: <code>http.Server</code> has fourteen exported fields and not one of them caps concurrency. If you want a limit you wrap the <code>net.Listener</code> before you hand it over, which works precisely because <code>Serve</code> takes an interface and never asks what is behind it. Measured with raw TCP clients, so no <code>http.Transport</code> goroutines contaminate the count, and a control first so the counter is not taken on trust:</p>
<pre><code>CONTROL 1000 parked goroutines            delta=+1000

Serve() running, 0 connections            delta=+1
1 conn, 100 requests, conn STILL OPEN     delta=+1
  ... same conn, after client Close()     delta=+0
200 conns, 1 request each, ALL OPEN       delta=+200
  ... after all 200 client Close()        delta=+0
200 conns accepted, ZERO bytes sent       delta=+200
  ... after all 200 client Close()        delta=+0</code></pre>
<p>Conditions matter here or the numbers mean nothing. It is <strong>one goroutine per open connection, not per request</strong>: a hundred keep-alive requests down one socket is still <code>+1</code>, and it stays <code>+1</code> for as long as that socket is open, parked in <code>conn.serve</code> waiting for the next request. So a goroutine count taken after the clients disconnect will always look healthy. And the last pair is the one to remember: <strong>two hundred clients that connected and sent nothing still cost two hundred goroutines</strong>, because the <code>go</code> is on this line and not somewhere after the first byte is read.</p>
<p>Now the finding that makes this line worth its own page. <strong>The position of the <code>go</code> statement inside the loop partitions the code either side of it into shared fate and private fate.</strong> Everything above it runs on the accept goroutine, one connection at a time, for every connection this server will ever see. Five connections dialed in parallel against a server where one thing sleeps 300ms:</p>
<pre><code>baseline: nothing slow                     first done    1ms   last done      2ms
slow HANDLER (per-conn goroutine)          first done  301ms   last done    301ms
slow ConnContext (accept-loop goroutine)   first done  301ms   last done   1505ms
slow ConnState hook (accept-loop for New)  first done  301ms   last done   1503ms</code></pre>
<p>The slow handler costs 300ms total because it is below the line. The slow <code>ConnContext</code> costs 1.5 seconds because it is above it, and five connections have to queue through it single file. Nothing in the documentation for <code>ConnContext</code> or <code>ConnState</code> says "this runs on the accept path". The line number says it.</p>
<p>The same boundary decides what a panic costs you. <code>conn.serve</code> opens with a deferred <code>recover()</code> at line 1944; <code>Serve</code> has no recover anywhere. Measured, same panic, two locations:</p>
<pre><code>panic in the Handler:
  conn 1: EOF     conn 2: EOF     conn 3: EOF
  still alive at the end of main
  ErrorLog: http: panic serving 127.0.0.1:10133: boom from the handler

panic in ConnContext:
  conn 1: HTTP/1.1 200 OK
  panic: boom from ConnContext
  net/http.(*Server).Serve(...)  server.go:3352
  exit status 2</code></pre>
<p>Below the line, one connection dies and the server logs it. Above the line, the process is gone, and the runtime even prints the offending line number for you.</p>
<p>Two smaller things. <code>connCtx</code> is derived <em>per connection</em>, from an outer <code>ctx</code> built once at line 3328 as <code>context.WithValue(baseCtx, ServerContextKey, srv)</code>, which is why both of these resolve inside any handler:</p>
<pre><code>r.Context().Value(http.ServerContextKey)      -&gt; *http.Server
r.Context().Value(http.LocalAddrContextKey)   -&gt; 127.0.0.1:57640</code></pre>
<p>The first was attached once for the whole server, the second is added inside <code>conn.serve</code> at line 1941, per connection. And <code>panic("ConnContext returned nil")</code> is the second of two panics on this path that blame the caller, the other being <code>panic("BaseContext returned a nil context")</code> at 3322. Both are hooks you supply; both take the process down; neither is recovered.</p>
<p>Finally, <code>tempDelay = 0</code>. It is the only statement in this block with nothing to do with the connection just accepted, and logically it belongs directly under the error branch it resets, five lines up. Its behaviour is identical either way, and that is the point worth carrying: <strong>when a statement's position makes no difference, its position is telling you about edits rather than about design.</strong> <code>ConnContext</code> was added to <code>Server</code> long after this loop was written, and it was inserted here.</p>
<p>Which leaves the comment on line 3359, seven words long, explaining an ordering constraint that costs the next excerpt 1,486 lines of backtracking.</p>`,
		},
		{
			file: "src/net/http/server.go",
			title: "The call that jumps 1,486 lines backwards",
			startLine: 1868,
			code: `const (
	runHooks  = true
	skipHooks = false
)

func (c *conn) setState(nc net.Conn, state ConnState, runHook bool) {
	srv := c.server
	switch state {
	case StateNew:
		srv.trackConn(c, true)
	case StateHijacked, StateClosed:
		srv.trackConn(c, false)
	}
	if state > 0xff || state < 0 {
		panic("internal error")
	}
	packedState := uint64(time.Now().Unix()<<8) | uint64(state)
	c.curState.Store(packedState)
	if !runHook {
		return
	}
	if hook := srv.ConnState; hook != nil {
		hook(nc, state)
	}
}`,
			notice: `<p><code>c.setState(c.rwc, StateNew, runHooks)</code> reads like a status update. It is nineteen lines that do three unrelated jobs, and the accept loop depends on all three.</p>
<p>The constants first, because they are a technique worth stealing. <code>runHooks = true</code> and <code>skipHooks = false</code> exist so that no call site in this file ever passes a bare boolean. Compare <code>c.setState(c.rwc, StateNew, true)</code> with what is actually written and you can see what it buys: the argument is readable at the call site, where a reader is skimming, without a comment and without a struct. There are six <code>setState</code> calls in the file and exactly one of them passes <code>skipHooks</code>, at line 1999. Worth finding, and worth asking why that one connection's transition is deliberately invisible to your monitoring.</p>
<p><strong>Job one is the one the accept loop never mentions.</strong> <code>srv.trackConn(c, true)</code> puts this connection into <code>Server.activeConn</code>, the map that <code>Shutdown</code> walks. Grep the accept loop for <code>trackConn</code> and you will not find it, because it is reached only through this switch. If you were reading <code>Serve</code> looking for where connections get registered, you would conclude they never do.</p>
<p><strong>Job two is a bit-packing trick you have already met.</strong> <code>packedState := uint64(time.Now().Unix()&lt;&lt;8) | uint64(state)</code> stores a timestamp and a state in one word, and the field it lands in carries a trailing comment in the same style as <code>sync.WaitGroup</code>'s: <code>curState atomic.Uint64 // packed (unixtime&lt;&lt;8|uint8(ConnState))</code>. One atomic store, one atomic load, no lock, and no way to observe a state paired with the wrong timestamp. That is why <code>getState</code> at line 1894 exists and why it returns two values from one <code>Load</code>.</p>
<p>The guard above it belongs to a species you should learn to recognise. <code>if state &gt; 0xff || state &lt; 0 { panic("internal error") }</code> defends the packing, not the caller: eight bits are reserved for the state, so a <code>ConnState</code> outside that range would silently corrupt the timestamp sharing the word. And there are only five <code>ConnState</code> values, all of them 0 to 4, all unexported to construct. So this can only fire if somebody editing <code>net/http</code> gets it wrong. <strong>An "internal error" panic is a maintainer talking to other maintainers</strong>, and finding one tells you instantly that you are in private plumbing rather than public API.</p>
<p><strong>Job three is your <code>ConnState</code> hook</strong>, called synchronously, on whatever goroutine called <code>setState</code>. For <code>StateNew</code> that is the accept goroutine, which is the measurement in the previous excerpt.</p>
<p>Now the seven-word comment: <code>// before Serve can return</code>. Read it as an ordering constraint and the question becomes obvious. Why not move this call into <code>conn.serve</code>, where every other <code>setState</code> in the connection's life happens? Because <code>go</code> does not run anything. It makes a goroutine runnable and returns, and the scheduler decides the rest. Register the connection inside <code>c.serve</code> and there is a window, unbounded in principle, where a connection has been accepted, the client believes it is connected, and <code>Shutdown</code> cannot see it in <code>activeConn</code> to close or wait for it. Putting it one line above the <code>go</code> closes that window by construction. The trace, with the hook installed:</p>
<pre><code>  102ms  client: Dial
  103ms  ConnContext called (accept-loop goroutine)
  103ms  ConnState -&gt; new           &lt;- before the client sends any byte
  303ms  client: request 1
  303ms  ConnState -&gt; active
  303ms          handler running
  304ms  ConnState -&gt; idle
  454ms  client: request 2
  455ms  ConnState -&gt; active
  455ms  ConnState -&gt; idle
  605ms  client: Close
  605ms  ConnState -&gt; closed</code></pre>
<p>Two hundred milliseconds of silence between <code>new</code> and <code>active</code>, and the whole time the server is holding a goroutine and a map entry for a client that has said nothing. Hold that gap, because it turns into a graceful shutdown that never finishes.</p>
<p>And read the two statements at the top of the function in order, because their order creates a case somebody had to handle elsewhere. <code>trackConn</code> takes <code>Server.mu</code>, inserts, and releases it. The <code>Store</code> to <code>curState</code> happens afterwards, outside that lock. So between those two statements the connection is <em>in</em> <code>activeConn</code> with <code>curState</code> still zero, and anything iterating that map under <code>Server.mu</code> can see it. Nothing here mentions that. The handling is a comment at line 3113, more than twelve hundred lines further down, and neither site points at the other.</p>`,
		},
		{
			file: "src/net/http/server.go",
			title: "Four lines of doc comment defending one asterisk",
			startLine: 3404,
			code: `// trackListener adds or removes a net.Listener to the set of tracked
// listeners.
//
// We store a pointer to interface in the map set, in case the
// net.Listener is not comparable. This is safe because we only call
// trackListener via Serve and can track+defer untrack the same
// pointer to local variable there. We never need to compare a
// Listener from another caller.
//
// It reports whether the server is still up (not Shutdown or Closed).
func (s *Server) trackListener(ln *net.Listener, add bool) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.listeners == nil {
		s.listeners = make(map[*net.Listener]struct{})
	}
	if add {
		if s.shuttingDown() {
			return false
		}
		s.listeners[ln] = struct{}{}
		s.listenerGroup.Add(1)
	} else {
		delete(s.listeners, ln)
		s.listenerGroup.Done()
	}
	return true
}`,
			notice: `<p>Most doc comments describe. This one argues, and it argues about a single character: the <code>*</code> in <code>map[*net.Listener]struct{}</code>. Four lines of prose for a pointer. <strong>When a comment is that far out of proportion to the code, somebody was bitten.</strong></p>
<p>The bite is a piece of Go semantics that is easy to know and easy to forget under pressure. <em>Interface values are comparable, but comparing two of them compares their dynamic values, and if that dynamic type is not comparable the comparison panics at run time.</em> A map insert hashes the key, so it panics too. <code>Serve</code> accepts any <code>net.Listener</code> anybody cares to write, and nothing stops that being a struct with a slice, a map or a func field in it. Measured, using the same listener type that had just served real traffic through <code>Serve</code> a moment earlier:</p>
<pre><code>the listener Serve just used is a main.countingListener with a func field

map[net.Listener]struct{}{ln}    -&gt; PANIC: runtime error: hash of unhashable
                                    type main.countingListener
map[*net.Listener]struct{}{&amp;ln}  -&gt; fine, 1 entry</code></pre>
<p>So the obvious map would turn a legal user-defined listener into a runtime panic inside the standard library. The pointer sidesteps it entirely: every pointer is comparable regardless of what it points at. And the comment's second sentence is the safety argument, which is the part worth learning from. Keying by address only works if the same address is used for both the add and the remove, and it is: <code>Serve</code> takes <code>&amp;l</code> of a local variable and pairs it with a <code>defer</code> three lines later. <strong>The comment is not explaining the trick, it is explaining the invariant that makes the trick sound</strong>, and it names the exact scope in which that invariant holds: "we only call trackListener via Serve".</p>
<p>Now read the <code>add</code> branch as the answer to something from the first excerpt. <code>if s.shuttingDown() { return false }</code> sits <em>inside</em> the mutex, which is what makes <code>Serve</code>'s <code>return ErrServerClosed</code> at line 3313 correct rather than racy: the flag is checked and the listener registered without anything in between. Ask the question outside the lock and a <code>Shutdown</code> landing in the gap would close a set of listeners that does not yet include this one, and <code>Serve</code> would go on to accept connections on a listener nobody can find.</p>
<p><code>listenerGroup</code> is a <code>sync.WaitGroup</code>, and if you have read that file already you can predict this one exactly. <code>Add(1)</code> under the lock on the way in, <code>Done()</code> on the way out, and <code>Shutdown</code> calling <code>srv.listenerGroup.Wait()</code> at line 3058. Note what that <code>Wait</code> is waiting for: not for connections, and not for the listener to close, but for every <code>Serve</code> call to have <em>returned</em>. The counter is incremented before the accept loop begins and decremented by <code>Serve</code>'s own <code>defer</code>, so it is measuring the lifetime of the loop itself.</p>
<p>Put the pieces in the order <code>Shutdown</code> actually runs them and the whole stop sequence falls out of three functions: set <code>inShutdown</code> so <code>shuttingDown()</code> starts returning true, close every tracked listener so the parked <code>Accept</code> fails, <code>Wait</code> until every accept loop has seen that and returned <code>ErrServerClosed</code>. Only then does it start on the connections, which is the last excerpt.</p>`,
		},
		{
			file: "src/net/http/server.go",
			title: "Where the timestamp gets read back",
			startLine: 3100,
			code: `func (s *Server) closeIdleConns() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	quiescent := true
	for c := range s.activeConn {
		st, unixSec := c.getState()
		// Issue 22682: treat StateNew connections as if
		// they're idle if we haven't read the first request's
		// header in over 5 seconds.
		if st == StateNew && unixSec < time.Now().Unix()-5 {
			st = StateIdle
		}
		if st != StateIdle || unixSec == 0 {
			// Assume unixSec == 0 means it's a very new
			// connection, without state set yet.
			quiescent = false
			continue
		}
		c.rwc.Close()
		delete(s.activeConn, c)
	}
	return quiescent
}`,
			notice: `<p>Twenty-three lines, sitting 259 lines <em>above</em> the <code>setState</code> call that wrote what they read, and this is where the accept loop's second-to-last statement is finally cashed. <code>c.getState()</code> unpacks the word <code>setState</code> packed at line 1884, and both halves are used: the state decides what to do, the timestamp decides whether the state can still be believed.</p>
<p>The <code>Issue 22682</code> comment is the most valuable thing in this excerpt, and not because of what it says. <strong>An issue number in a standard library comment is a bug that escaped, and the line under it is the fix.</strong> Read the line: a connection sitting in <code>StateNew</code> for more than five seconds is treated as idle and closed. Which means that without it, one client that opened a socket and said nothing would hold <code>Shutdown</code> open forever, because <code>StateNew</code> is not <code>StateIdle</code>, so <code>quiescent</code> would never become true, so the polling loop in <code>Shutdown</code> would never return. A graceful shutdown that a single silent connection can hang indefinitely is not graceful, and somebody found that out in production.</p>
<p>You can watch the whole thing. Open a raw TCP connection, send nothing at all, call <code>Shutdown</code> with a generous context, and time it. Conditions: one connection, connected and silent, no requests ever made, <code>Shutdown(context.Background())</code>. Two runs on go1.23.12:</p>
<pre><code>silent for 0s before Shutdown:   Shutdown returned after 5.85s / 5.90s   err=&lt;nil&gt;
silent for 6s before Shutdown:   Shutdown returned after 0.00s / 0.00s   err=&lt;nil&gt;</code></pre>
<p>Identical connection, identical call, and the only thing that changed was the value of a clock reading taken at line 1884 when the accept loop registered it. That is what makes the timestamp in the packed word load-bearing rather than diagnostic. The extra 0.85 to 0.90 seconds over the nominal five is the polling: <code>Shutdown</code> is not woken by anything, it re-runs this function on a jittered schedule that doubles up to <code>shutdownPollIntervalMax</code>, 500ms, so it finds out late by up to one interval.</p>
<p>Now the second comment, <em>"Assume unixSec == 0 means it's a very new connection, without state set yet"</em>, which is where the reading pays off. That case looks impossible until you have read <code>setState</code>. There, <code>trackConn</code> takes <code>Server.mu</code>, inserts into <code>activeConn</code>, and releases the lock, and only <em>afterwards</em> does <code>curState.Store</code> run. So between those two statements the connection is in the map with a zero state word. This function iterates that same map under that same mutex, so it can absolutely land in the gap. Two statements in a nineteen-line function at line 1877 create a case handled by a comment at line 3113, and nothing at either site points at the other. <strong>You can only find this by following the data, never by reading in file order.</strong></p>
<p>And notice the resolution: not a lock, not a retry, just <code>quiescent = false</code>. Treat it as busy, poll again in a few milliseconds, and by then the <code>Store</code> will have happened. <strong>When a race window is bounded by a couple of instructions and the caller is already in a retry loop, the cheapest correct fix is to report "not done yet".</strong></p>
<p>Last, what this function does <em>not</em> do. It closes idle connections and skips active ones, which is the entire graceful part of graceful shutdown. Measured, with a handler that sleeps two seconds and a request already in flight:</p>
<pre><code>Shutdown returned after 2.14s / 2.17s   err=&lt;nil&gt;
in-flight request still got:            "HTTP/1.1 200 OK\r\n"</code></pre>
<p>Compare that with three keep-alive connections sitting idle, where <code>Shutdown</code> returns in 0ms and closes all three. Same server, same method, and the difference is one byte of a packed integer that the accept loop wrote before it ever started the goroutine.</p>`,
		},
	],

	exercise: {
		question:
			"Find the exact line where http.Server decides to spawn a goroutine per connection. That part takes one command. Then answer the real question, which is about the line number rather than the line: what runs before it, on the same goroutine, for every connection this server will ever accept? Name the two Server fields that put your code up there, and work out what that costs you when yours is slow, and when yours panics. Finally, look at the statement immediately above it and explain its seven-word comment: why is that call in Serve at all, rather than in conn.serve where every other state transition happens?",
		command: 'grep -n "go c.serve" "$(go env GOROOT)/src/net/http/server.go"',
		answer: `<p>One hit: <strong>line 3360</strong> on go1.23.12, <code>go c.serve(connCtx)</code>.</p>
<p><strong>The surrounding condition is that there isn't one.</strong> It is the last statement of the <code>for</code> body in <code>Server.Serve</code>, reached on every iteration where <code>l.Accept()</code> returned a nil error, with nothing guarding it. No pool, no queue, no semaphore, no counter. <code>http.Server</code> has fourteen exported fields and not one of them limits concurrency; the whole struct is timeouts, TLS, logging, header size and hooks. The only limiter available to you is the <code>net.Listener</code> you pass in, and it works because <code>Serve</code> takes an interface and never asks what is behind it.</p>
<p>The negative result is worth more than the positive one. People go looking in this file for the tuning knob, find the loop, and assume they missed it. There is nothing to miss. <strong>"One goroutine per connection" is not a default, it is the entire policy</strong>, and the goroutine starts at accept time rather than at first byte:</p>
<pre><code>CONTROL 1000 parked goroutines            delta=+1000

Serve() running, 0 connections            delta=+1
1 conn, 100 requests, conn STILL OPEN     delta=+1
200 conns, 1 request each, ALL OPEN       delta=+200
200 conns accepted, ZERO bytes sent       delta=+200
  ... after all 200 client Close()        delta=+0</code></pre>
<p>Measured on go1.23.12 windows/amd64 with raw TCP clients so no <code>http.Transport</code> goroutines are counted, <code>runtime.NumGoroutine</code> sampled 150ms after each step. State the conditions or the number is meaningless: a keep-alive connection keeps its goroutine parked for as long as the socket is open, so <strong>every one of these counts was taken while the clients were still connected</strong>. Take the same measurement after they disconnect and every line reads <code>+0</code>.</p>
<h3>Now the real question</h3>
<p>Everything from line 3350 to line 3359 runs on the accept goroutine, in series, once per connection. Two <code>Server</code> fields put your code in there:</p>
<ul>
<li><strong><code>ConnContext</code></strong>, called at line 3352.</li>
<li><strong><code>ConnState</code></strong>, called for <code>StateNew</code> at line 3359, indirectly, through <code>setState</code>, which invokes it at line 1890.</li>
</ul>
<p>Neither field's documentation mentions the accept path. The line number is the only place that fact is written down. Five connections dialed in parallel, one thing sleeping 300ms:</p>
<pre><code>baseline: nothing slow                     first done    1ms   last done      2ms
slow HANDLER (per-conn goroutine)          first done  301ms   last done    301ms
slow ConnContext (accept-loop goroutine)   first done  301ms   last done   1505ms
slow ConnState hook (accept-loop for New)  first done  301ms   last done   1503ms</code></pre>
<p>The handler is below the line, so five of them cost 300ms. The hooks are above it, so five of them cost 1.5 seconds and the sixth client is still waiting on a TCP handshake nobody has accepted yet. <strong>A slow <code>ConnContext</code> is not slow for that connection, it is slow for the whole server.</strong></p>
<p>Panics divide on the same line, because <code>conn.serve</code> opens with a deferred <code>recover()</code> at line 1944 and <code>Serve</code> has no recover at all. Same panic, two locations:</p>
<pre><code>panic in the Handler:
  conn 1: EOF     conn 2: EOF     conn 3: EOF
  still alive at the end of main
  ErrorLog: http: panic serving 127.0.0.1:10133: boom from the handler

panic in ConnContext:
  conn 1: HTTP/1.1 200 OK
  panic: boom from ConnContext
  net/http.(*Server).Serve(...)  server.go:3352
  exit status 2</code></pre>
<p>Below the line a panic costs one connection and a log entry. Above it, it costs the process. The same is true of <code>BaseContext</code>, and the file even hands you the evidence: <code>panic("ConnContext returned nil")</code> at 3354 and <code>panic("BaseContext returned a nil context")</code> at 3322 are two panics deliberately placed on an unrecovered goroutine, which is how the library tells you it would rather die loudly than serve traffic with a nil context.</p>
<h3>And the comment</h3>
<p>Line 3359 is <code>c.setState(c.rwc, StateNew, runHooks) // before Serve can return</code>. The reason it is not inside <code>conn.serve</code> is that <code>go</code> does not run anything. It makes a goroutine runnable and returns immediately, and when that goroutine first executes is the scheduler's business, not yours. <code>setState(StateNew)</code> calls <code>srv.trackConn(c, true)</code> at line 1877, which is what puts the connection into <code>Server.activeConn</code>, the map <code>Shutdown</code> walks. Move that call inside <code>c.serve</code> and you open a window where the client is connected, the accept loop has moved on, and <code>Shutdown</code> cannot see the connection to close it or wait for it. Doing it one line above the <code>go</code> closes the window by construction rather than by timing, which is the only kind of fix worth having.</p>
<p>That is also why <code>Serve</code> never mentions <code>trackConn</code>. Read the accept loop looking for where connections are registered and you will conclude they never are.</p>
<h3>The general lesson</h3>
<p><strong>In any loop that ends in a <code>go</code> statement, find the <code>go</code> first and read the loop body as two zones.</strong> Above it is shared fate: serial, one at a time, and a stall or a panic there is a property of the whole system. Below it is private fate: concurrent, isolated, recoverable if somebody wrote a recover. The boundary is invisible in the type system, absent from the documentation of every field that lands on the wrong side of it, and it is the single most consequential fact about the code. You get it for free by asking one question that a 3,908-line file cannot hide the answer to: <em>where does the goroutine start?</em></p>
<p>Which is the other reason this was worth doing. You did not read <code>server.go</code>. You ran one <code>grep</code>, followed one call chain, and never opened five sixths of it. That is what reading a large file looks like when it works.</p>`,
		answerAnchor: {
			file: "src/net/http/server.go",
			needle: `		c.setState(c.rwc, StateNew, runHooks) // before Serve can return
		go c.serve(connCtx)`,
		},
	},

	takeaway:
		"An http.Server is a 33-line for loop that ends in a go statement, and the position of that statement decides which of your callbacks can stall every connection on the server and which panics take the process with them.",

	relatedConcepts: [
		"goroutines",
		"graceful-shutdown",
		"server-timeouts",
		"http-handler",
		"context",
		"scheduler",
	],
	relatedProjects: ["http-server", "tcp-echo", "ship-it"],
	relatedFailures: ["goroutine-leak", "ctx-ignored"],
}
