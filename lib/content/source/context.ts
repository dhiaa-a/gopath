import { SourceWalkthrough } from "../../content"

export const contextPackage: SourceWalkthrough = {
	slug: "context",
	name: "the context package",
	pkg: "context",
	order: 4,
	unlockTier: 2,
	tagline:
		"792 lines, a four-method interface, and exactly one anonymous goroutine that almost never runs. The file where you learn that the code you can grep for is usually the fallback, not the common case.",

	why: `<p>You have threaded a <code>ctx</code> through a hundred signatures. That is the right condition for a read: nothing in this file can confuse you about intent, so everything you find is mechanism.</p>
<p>The mechanism is not what most people think. Ask a room of Go programmers what <code>context.WithCancel</code> does and someone will tell you it starts a goroutine to watch the parent. The goroutine is real. There is exactly one <code>go func</code> in all 792 lines and you can find it in a second. It is also the last of five exits from the function that wires a child to its parent, and in an ordinary program it never runs. A thousand <code>WithCancel</code> calls, measured below, start zero goroutines.</p>
<p>So the skill this file trains is <strong>reading a function for its exits rather than its logic</strong>, and the habit that follows from it: <em>the code you can find by grepping is usually the fallback, not the common case</em>. General mechanisms are easy to spot because they are written out in full. The fast paths that stop you ever reaching them are three lines each and easy to skim past. Get that backwards and you will describe, confidently and in detail, a program that does not exist.</p>
<p>The second skill is smaller and you will use it in every package that has a plugin point: <strong>notice when a value is used for its identity rather than its contents</strong>. There is a package-level <code>int</code> in here whose numeric value is never read anywhere. Only its address matters, and that address turns <code>Value</code>, the most public method on the interface, into a private channel that only this package can speak on.</p>`,

	entryFile: "src/context/context.go",
	openCommand: 'less "$(go env GOROOT)/src/context/context.go"',

	orientation: `<p>792 lines, and the top of the file is the worst place to start. The package doc runs from line 5 to line 53 and the <code>Context</code> interface is another ninety-seven lines after that, so reading straight down spends a fifth of your attention before you meet a single statement. Read in this order:</p>
<ul>
<li><strong>Lines 64 to 160</strong>, the interface, but only the four signature lines: <code>Deadline</code>, <code>Done</code>, <code>Err</code>, <code>Value</code>. Four methods in ninety-seven lines, and the ratio is the first finding. The second is what is missing: <em>nothing here cancels</em>. A <code>Context</code> can only be asked questions. The power to cancel is handed out separately, as a closure returned beside the context, and that single omission is the whole architecture. Everyone who receives a context can observe; only whoever created it can stop it.</li>
<li><strong>Lines 175 to 221</strong>, <code>emptyCtx</code> and the two types built on it. Forty-seven lines, nearly all of them one-line bodies, and the cheapest exit in the package is paid for in here.</li>
<li><strong>Lines 297 to 358</strong>, <code>AfterFunc</code> and its three supporting types. <strong>Skip these entirely on a first pass.</strong> They arrived in Go 1.21 for <code>os/signal</code> and <code>net/http</code>, they add a branch to the middle of the most important function in the file, and you will never take it. Sixty lines of difficulty removed for free.</li>
<li><strong>Lines 360 to 417</strong>, the plumbing: three package-level variables you would never think to write, <code>parentCancelCtx</code>, <code>removeChild</code>, and the <code>canceler</code> interface. Small, strange, load-bearing.</li>
<li><strong>Lines 419 to 566</strong>, <code>cancelCtx</code>. <strong>This is the file.</strong> Everything else either derives from it or decorates it.</li>
<li><strong>Lines 568 to 759</strong>, <code>WithoutCancel</code>, <code>WithDeadline</code>, <code>timerCtx</code>, <code>WithValue</code>, <code>valueCtx</code>. Read after <code>cancelCtx</code> and most of it is already familiar.</li>
<li><strong>Lines 761 to 792</strong>, <code>value</code>. One function, and every <code>Value</code> method above it ends up here.</li>
</ul>
<p>Three habits cut this file down before you read a line of it.</p>
<p><strong>Find the real constructors by finding the panics.</strong> The package exports eight <code>With</code> functions: <code>grep -c "^func With"</code> returns 8. But <code>grep -c "cannot create context from nil parent"</code> returns 4. Those four are where a context is actually built, and the other four are wrappers that funnel into them, <code>WithTimeout</code> taking two hops to get there. Reading four functions covers all eight. The panic is a reliable marker here because every genuine entry point has to validate its parent, and the wrappers have nothing left to validate.</p>
<p><strong>Find the embedded type and read it once.</strong> <code>timerCtx</code> embeds <code>cancelCtx</code>, and so does <code>afterFuncCtx</code>. There is exactly one cancellation implementation in this package and two decorators on it, so once you have read <code>cancelCtx.cancel</code>, <code>timerCtx.cancel</code> is three extra lines about a timer. Separately, <code>cancelCtx</code> and <code>valueCtx</code> both embed the <code>Context</code> <em>interface</em>, which is how they inherit their parent's behaviour with no code at all. Measured on go1.23.12: <code>cancelCtx</code> never defines <code>Deadline</code>, and a <code>WithCancel</code> child of a 90 minute <code>WithTimeout</code> reports that same deadline to the instant, purely by promotion.</p>
<pre><code>WithCancel(Background()).Deadline()         ok=false
WithTimeout(Background(), 90m).Deadline()   ok=true  in 1h30m0s
WithCancel(&lt;that timeout ctx&gt;).Deadline()   ok=true  in 1h30m0s   same instant: true
WithValue over that.Deadline()              ok=true  in 1h30m0s   same instant: true</code></pre>
<p><strong>Read the import list, then go and find the comment that explains it.</strong> Five imports, two of them odd: <code>internal/reflectlite</code> rather than <code>reflect</code>, and no <code>fmt</code> at all in a file with six <code>String</code> methods. The reason is at line 733, above a helper called <code>stringify</code>: <em>"without using fmt, since we don't want context depending on the unicode tables"</em>. A package this low in the dependency graph pays for every import in binary size for everybody who imports anything. Short import lists in the standard library are almost always deliberate, and the deliberation is usually written down somewhere in the same file.</p>
<p>If you would rather stay in the terminal, <code>go doc -src context.WithCancel</code> prints the source of a single function without opening the file.</p>`,

	excerpts: [
		{
			file: "src/context/context.go",
			title: "The base case is four ways of returning nothing",
			startLine: 175,
			code: `// An emptyCtx is never canceled, has no values, and has no deadline.
// It is the common base of backgroundCtx and todoCtx.
type emptyCtx struct{}

func (emptyCtx) Deadline() (deadline time.Time, ok bool) {
	return
}

func (emptyCtx) Done() <-chan struct{} {
	return nil
}

func (emptyCtx) Err() error {
	return nil
}

func (emptyCtx) Value(key any) any {
	return nil
}`,
			notice: `<p><code>type emptyCtx struct{}</code> is zero-size, the methods take value receivers, and <code>Background()</code> returns a fresh <code>backgroundCtx{}</code> every call. That combination costs nothing: measured with <code>testing.AllocsPerRun</code> over 10000 runs on go1.23.12, both <code>context.Background()</code> and <code>context.TODO()</code> are <strong>0 allocations</strong>. The root of every context tree in your program is not a shared singleton being handed out. It is a value with no bytes in it.</p>
<p><code>Deadline</code> is a naked return, which is worth a second look the first time you meet one in the standard library. The results are named, never assigned, and returned by the bare <code>return</code>, so you get the zero <code>time.Time</code> and <code>false</code>. Nothing is missing; the zero values are the answer.</p>
<p>Now the line that decides the shape of the entire package: <code>Done()</code> returns <strong><code>nil</code></strong>. Not a channel that never closes. Nil. Receiving from a nil channel blocks forever and a nil channel in a <code>select</code> is never ready, so "this context can never be canceled" is implemented by allocating nothing whatsoever. And this is not an implementation detail you are reading over the author's shoulder. The interface's own doc comment licenses it at line 75: <em>"Done may return nil if this context can never be canceled."</em> A nil return that an interface documents as legal is a contract, not an accident, and every consumer has to handle it. Measured:</p>
<pre><code>Background().Done() == nil                true
TODO().Done() == Background().Done()      true   (both nil)
select on Done() with a default           default branch taken</code></pre>
<p>Hold onto that nil, because it is the first thing <code>propagateCancel</code> tests three hundred lines later, and it buys the cheapest exit in the file.</p>
<p>Finally, the thing this excerpt sets up but does not show. Two types embed <code>emptyCtx</code>, <code>backgroundCtx</code> and <code>todoCtx</code>, and they differ in exactly one method: <code>String</code>. Nothing else anywhere separates them, right down to the type switch at the bottom of the file, which handles them in a single arm: <code>case backgroundCtx, todoCtx: return nil</code>. Measured, and the asymmetry is the point:</p>
<pre><code>Background() == Background()   true
TODO() == TODO()               true
Background() == TODO()         false
fmt.Sprint(Background())       "context.Background"
fmt.Sprint(TODO())             "context.TODO"</code></pre>
<p>Two types with identical behaviour that do not compare equal. The split exists for humans and for tools, not for the machine: <code>TODO</code> marks a call site somebody has not finished, and at run time the only thing carrying that information is a debug string. Worth generalising. <strong>When two types in a package behave identically, the difference is being read by something outside the program</strong>, usually a linter, a stack trace, or a person.</p>`,
		},
		{
			file: "src/context/context.go",
			title: "Four field comments that all say the same thing",
			startLine: 419,
			code: `// A cancelCtx can be canceled. When canceled, it also cancels any children
// that implement canceler.
type cancelCtx struct {
	Context

	mu       sync.Mutex            // protects following fields
	done     atomic.Value          // of chan struct{}, created lazily, closed by first cancel call
	children map[canceler]struct{} // set to nil by the first cancel call
	err      error                 // set to non-nil by the first cancel call
	cause    error                 // set to non-nil by the first cancel call
}

func (c *cancelCtx) Value(key any) any {
	if key == &cancelCtxKey {
		return c
	}
	return value(c.Context, key)
}`,
			notice: `<p>Read the trailing comments as a group before you read any of them individually. Five fields, and four of the comments say <em>first cancel call</em>: <code>done</code>, <code>children</code>, <code>err</code> and <code>cause</code>. That is not four authors repeating themselves, it is a state machine written into the field list: a <code>cancelCtx</code> has two states, one transition, and the transition is one-way. Every question you might have about calling a <code>CancelFunc</code> twice is answered here, before you have found the code that enforces it. Measured: a <code>CancelFunc</code> called four times cancels once and never panics.</p>
<p><code>Context</code> is embedded with no field name, so a <code>cancelCtx</code> <em>is</em> its parent for everything it does not override. It overrides <code>Done</code>, <code>Err</code>, <code>Value</code> and <code>String</code>. It does not override <code>Deadline</code>, which is why the promotion measured in the orientation works with no code behind it.</p>
<p><code>done atomic.Value // ... created lazily</code> is the allocation dodge. The channel does not exist until somebody calls <code>Done()</code>. A context created, passed down two layers and canceled without anyone ever selecting on it never allocates one. Measured with <code>testing.AllocsPerRun</code>, 10000 runs, go1.23.12:</p>
<pre><code>WithCancel(Background()); cancel()              2 allocs
WithCancel(Background()); ctx.Done(); cancel()  3 allocs
WithCancel(Background()); Done() x5; cancel()   3 allocs</code></pre>
<p>One channel, created on demand and then memoized: five calls cost the same as one. The two you pay unconditionally are the context itself and the closure <code>WithCancel</code> returns over it at line 237. And note why the field is an <code>atomic.Value</code> when there is a mutex on the line directly above: <code>Done</code> at line 438 loads it without locking and only takes the mutex when that load comes back nil. It is a double-checked lock, and the atomic is what makes the fast half legal rather than a data race.</p>
<p>Then <code>Value</code>, which is four lines and the strangest method in the package. <code>if key == &amp;cancelCtxKey { return c }</code>. Asked for one particular key, a context returns <strong>itself</strong>. Not something it stores. Itself.</p>
<p><code>cancelCtxKey</code> is declared at line 364 as <code>var cancelCtxKey int</code> and its integer value is never read anywhere in the standard library. What is used is its address. Because the variable is unexported, no code outside this package can obtain that address, so no caller can ask this question by accident or on purpose. <code>Value</code> is the one method on the interface that accepts an arbitrary key, which makes it the only channel through which a package can smuggle an internal request across a public interface, and this is what that looks like when it is done deliberately. <strong>An unexported package-level variable's address is an unforgeable token.</strong> What the token buys is the next excerpt.</p>`,
		},
		{
			file: "src/context/context.go",
			title: "An unforgeable question, and a check that distrusts the answer",
			startLine: 366,
			code: `// parentCancelCtx returns the underlying *cancelCtx for parent.
// It does this by looking up parent.Value(&cancelCtxKey) to find
// the innermost enclosing *cancelCtx and then checking whether
// parent.Done() matches that *cancelCtx. (If not, the *cancelCtx
// has been wrapped in a custom implementation providing a
// different done channel, in which case we should not bypass it.)
func parentCancelCtx(parent Context) (*cancelCtx, bool) {
	done := parent.Done()
	if done == closedchan || done == nil {
		return nil, false
	}
	p, ok := parent.Value(&cancelCtxKey).(*cancelCtx)
	if !ok {
		return nil, false
	}
	pdone, _ := p.done.Load().(chan struct{})
	if pdone != done {
		return nil, false
	}
	return p, true
}`,
			notice: `<p>Most doc comments describe. This one defends, and the parenthetical is the part to read twice: <em>"If not, the *cancelCtx has been wrapped in a custom implementation providing a different done channel, in which case we should not bypass it."</em> Somebody was bitten. Twenty-one lines, three guards, three different things being ruled out.</p>
<p><strong>Guard one</strong>, <code>done == closedchan || done == nil</code>. Nil means the parent can never be canceled, <code>closedchan</code> means it already has been, and both are answered by wiring nothing up. <code>closedchan</code> is a single shared pre-closed channel declared at line 413, and it is special-cased here because of an allocation dodge two excerpts down. Hold the question of why a channel identity would ever be ambiguous.</p>
<p><strong>Guard two</strong> asks the unforgeable question from the previous excerpt. Notice what it walks through on the way: <code>Value</code> on a <code>valueCtx</code> that does not hold the key delegates inward, so this finds a <code>*cancelCtx</code> buried under any number of <code>WithValue</code> layers. That is not theoretical, it is the normal shape of a server request. Measured on go1.23.12, 1000 calls per case: deriving from a cancelable context wrapped in twenty <code>WithValue</code> layers behaves exactly as if the wrappers were not there.</p>
<p><strong>Guard three</strong>, <code>if pdone != done</code>, is the real defence and the only one that is not obvious. A <code>*cancelCtx</code> has been found somewhere inside the parent. But the parent is whatever the caller handed over, and it may be a custom type that embeds that <code>*cancelCtx</code> while advertising a Done channel of its own. Registering the child in the inner context's <code>children</code> map would wire it to the <em>inner</em> cancellation and silently ignore the wrapper's. Measured. Conditions: a struct embedding a live cancelable <code>Context</code> and overriding <code>Done()</code> with a channel it owns; close that channel and nothing else.</p>
<pre><code>child.Err() before                &lt;nil&gt;
close(wrapper.done)
child.Err()                       wrapper closed
inner.Err()   (never touched)     &lt;nil&gt;</code></pre>
<p>Delete guard three and that middle line stays <code>&lt;nil&gt;</code> forever: the child would be listening to a cancellation the wrapper never speaks. The standard library's own test says the same thing in a comment beside its assertion, <code>// ctx1 is not providing Done, must not be used</code>.</p>
<p>The reading habit is in the shape rather than the content. <strong>A successful lookup followed by a check that the result is <em>also</em> consistent with something else is a scar.</strong> The first check asked "did I find one"; the second asks "is the one I found the one that is actually in charge". Whenever you meet a function that finds what it wanted and then refuses to use it, work out what the second check knows that the first does not, and you have usually found the bug the author is still angry about.</p>
<p>One more thing to carry forward: every <code>return nil, false</code> in here is a decision with a price attached, and the exercise at the bottom of this page is about what that price is.</p>`,
		},
		{
			file: "src/context/context.go",
			title: "Read the exits, not the body",
			startLine: 460,
			code: `// propagateCancel arranges for child to be canceled when parent is.
// It sets the parent context of cancelCtx.
func (c *cancelCtx) propagateCancel(parent Context, child canceler) {
	c.Context = parent

	done := parent.Done()
	if done == nil {
		return // parent is never canceled
	}

	select {
	case <-done:
		// parent is already canceled
		child.cancel(false, parent.Err(), Cause(parent))
		return
	default:
	}

	if p, ok := parentCancelCtx(parent); ok {
		// parent is a *cancelCtx, or derives from one.
		p.mu.Lock()
		if p.err != nil {
			// parent has already been canceled
			child.cancel(false, p.err, p.cause)
		} else {
			if p.children == nil {
				p.children = make(map[canceler]struct{})
			}
			p.children[child] = struct{}{}
		}
		p.mu.Unlock()
		return
	}`,
			notice: `<p>Start with the doc comment's second line, because it is doing work the function name refuses to: <em>"It sets the parent context of cancelCtx."</em> That is <code>c.Context = parent</code>, the first statement, and it is the only thing this function <strong>always</strong> does. Everything after it is conditional. A function whose name describes one job and whose doc quietly admits to a second is worth reading for the second one first.</p>
<p>Now do not read the body. Count the exits. There are five in the full function and this excerpt shows three:</p>
<ul>
<li><strong>Exit one</strong>, <code>done == nil</code>: the parent can never be canceled, so return having wired up nothing at all. This is the exit <code>context.Background()</code> takes, which is why <code>WithCancel(context.Background())</code> is very nearly free.</li>
<li><strong>Exit two</strong>, the parent is already canceled: cancel the child now and return. The <code>select</code> with an empty <code>default</code> is how you ask a channel a question without agreeing to wait for the answer, and it is the most reusable construct in this file.</li>
<li><strong>Exit three</strong>, <code>parentCancelCtx</code> said yes: take the parent's lock, put the child in its <code>children</code> map, unlock, return. <strong>One map insert.</strong></li>
</ul>
<p>Two details inside exit three. <code>if p.err != nil</code> is not redundant with the <code>select</code> eight lines above, because the parent could have been canceled in the gap between them; under the lock the answer cannot change, and that is the entire reason to ask twice. And <code>if p.children == nil { p.children = make(...) }</code> is the same laziness as the <code>done</code> channel: most contexts never have a child, so most never pay for the map.</p>
<p>Here is the finding, and it is the one to carry out of this file. Exit three is a map insert. Not a goroutine. Measured on go1.23.12 windows/amd64, 1000 calls per case, <code>runtime.NumGoroutine</code> sampled before and 20 ms after, with a control that proves the counter moves at all:</p>
<pre><code>CONTROL: 1000 bare go statements that park       delta=+1000

WithCancel(context.Background())                 delta=+0
WithCancel(a ctx from WithCancel)                delta=+0
WithCancel(WithValue over a cancelable ctx)      delta=+0
WithCancel(20 WithValue layers over cancelable)  delta=+0
WithTimeout(cancelable, 1h)                      delta=+0</code></pre>
<p>And the leak the package documentation warns you about lives on the <code>p.children[child]</code> line. <em>"Failing to call the CancelFunc leaks the child"</em> means precisely this map entry, and it only exists if you took exit three. Measured: 200,000 children created and their CancelFuncs thrown away, two forced GCs, <code>HeapAlloc</code> delta in KiB, reproducible across runs.</p>
<pre><code>forgot cancel, parent = Background()               retained     +0 KiB
forgot cancel, parent = WithCancel(Background())   retained +21004 KiB
called cancel,  parent = WithCancel(Background())  retained     +0 KiB
then cancel the parent                             freed    -20984 KiB</code></pre>
<p>Roughly 107 bytes per forgotten child, and nothing at all when the parent was <code>Background()</code>, because exit one wired up nothing to leak. So a missing <code>cancel()</code> is a memory leak in the parent's map, it lasts exactly as long as the parent does, and cancelling the parent frees all of it at once. <code>defer cancel()</code> is not superstition, but it is not guarding what most people think it is guarding.</p>`,
		},
		{
			file: "src/context/context.go",
			title: "One transition, and a comment where a lock ought to be",
			startLine: 536,
			code: `func (c *cancelCtx) cancel(removeFromParent bool, err, cause error) {
	if err == nil {
		panic("context: internal error: missing cancel error")
	}
	if cause == nil {
		cause = err
	}
	c.mu.Lock()
	if c.err != nil {
		c.mu.Unlock()
		return // already canceled
	}
	c.err = err
	c.cause = cause
	d, _ := c.done.Load().(chan struct{})
	if d == nil {
		c.done.Store(closedchan)
	} else {
		close(d)
	}
	for child := range c.children {
		// NOTE: acquiring the child's lock while holding parent's lock.
		child.cancel(false, err, cause)
	}
	c.children = nil
	c.mu.Unlock()

	if removeFromParent {
		removeChild(c.Context, c)
	}
}`,
			notice: `<p>Seven panics in this file. Six blame you: four copies of <code>"cannot create context from nil parent"</code>, plus <code>"nil key"</code> and <code>"key is not comparable"</code>. This one blames the package. <code>"context: internal error: missing cancel error"</code> tells you that <code>cancel</code> is unexported, that every caller is in this file, and that its preconditions are held up by review rather than by types. An <em>internal error</em> panic is a maintainer talking to other maintainers, and finding one is a fast way to work out which functions are the private plumbing.</p>
<p><code>if c.err != nil { c.mu.Unlock(); return }</code> is the guard that makes <code>defer cancel()</code> safe to call after the context is already dead. Every cancellation in the package funnels through this function, so idempotency is implemented exactly once, and the four field comments in the struct told you to expect it.</p>
<p>Now the interesting three lines. If nobody ever called <code>Done()</code>, <code>d</code> is nil, and rather than allocate a channel purely so it can be closed, the context stores <code>closedchan</code>: the package's single pre-closed channel. On a server that finishes most requests without cancellation that saves an allocation on nearly every context. It is also visible from outside, which is the surprising part. Conditions: two unrelated contexts, both <code>WithCancel(Background())</code>, neither one's <code>Done()</code> ever called, both then canceled.</p>
<pre><code>a, ca := WithCancel(Background())
b, cb := WithCancel(Background())
ca(); cb()
a.Done() == b.Done()      true    &lt;- the same channel

// same test, but calling Done() on each BEFORE cancelling:
c.Done() == d.Done()      false   &lt;- now each owns one</code></pre>
<p>Two contexts with nothing to do with each other hand back an identical channel, and whether they do depends on something as invisible as whether anyone ever selected on them. <strong>Never build anything on the identity of a Done channel.</strong> The first guard in <code>parentCancelCtx</code>, <code>done == closedchan</code>, is the standard library taking its own advice: that channel cannot be used as evidence of who you are.</p>
<p>Then the loop, and the argument matters more than the loop does. <code>child.cancel(false, err, cause)</code> passes <strong>false</strong> for <code>removeFromParent</code>, telling each child not to remove itself from this map. The children could do it themselves, correctly, at the cost of N map deletes and N reentrant lock acquisitions. Instead the parent sets <code>c.children = nil</code> one line later and releases the lot in a single assignment. That whole parameter exists so this loop can switch the work off, which is why you should always read what a boolean parameter is set <em>to</em> at the call site before deciding what it means.</p>
<p>Finally the <code>NOTE</code>, and the line under it that is easy to walk past. The comment documents a lock order, parent before child, that nothing in the language enforces: reverse it anywhere else and you have a deadlock. So check the file. The other place two locks meet is <code>removeChild</code>, which takes the <em>parent's</em> mutex, and look where it is called from: after <code>c.mu.Unlock()</code>, outside the critical section, never while the child's lock is held. That explicit unlock is doing real work. <code>Done</code> at line 444 writes <code>defer c.mu.Unlock()</code> and this function deliberately does not, because deferring it here would push the unlock past <code>removeChild</code> and invert the very order the <code>NOTE</code> is protecting. <strong>When one method in a file defers its unlock and its neighbour spells it out by hand, the difference is never style.</strong></p>`,
		},
		{
			file: "src/context/context.go",
			title: "A walk with no map, and what it costs you",
			startLine: 761,
			code: `func value(c Context, key any) any {
	for {
		switch ctx := c.(type) {
		case *valueCtx:
			if key == ctx.key {
				return ctx.val
			}
			c = ctx.Context
		case *cancelCtx:
			if key == &cancelCtxKey {
				return c
			}
			c = ctx.Context
		case withoutCancelCtx:
			if key == &cancelCtxKey {
				// This implements Cause(ctx) == nil
				// when ctx is created using WithoutCancel.
				return nil
			}
			c = ctx.c
		case *timerCtx:
			if key == &cancelCtxKey {
				return &ctx.cancelCtx
			}
			c = ctx.Context
		case backgroundCtx, todoCtx:
			return nil
		default:
			return c.Value(key)
		}
	}
}`,
			notice: `<p>Read this one for what is absent. There is no map. Anywhere. In the whole package. <code>ctx.Value(k)</code> is a linear scan of a linked list, comparing interface values with <code>==</code> at each step, walking outermost to innermost in the reverse of the order you called <code>WithValue</code>. Everybody knows context values are "a bit slow". Almost nobody knows <em>which</em> lookup is the slow one.</p>
<p>Measured with <code>go test -bench</code> on go1.23.12, windows/amd64, i5-1135G7. Conditions are the whole claim: <strong>one</strong> chain of 50 <code>WithValue</code> layers over <code>Background</code>, built key 1 first so key 1 is innermost and key 50 outermost. Same chain, same call, only the key changes.</p>
<pre><code>Value(key added last,   1 hop)      4.19 ns/op   0 allocs
Value(key at            25 hops)   85.68 ns/op   0 allocs
Value(key added first,  50 hops)  175.8  ns/op   0 allocs
Value(key that is not there)      187.7  ns/op   0 allocs
Value on Background     (0 hops)    1.53 ns/op   0 allocs</code></pre>
<p>About 3.5 ns per hop, a 42x spread inside a single context, and never an allocation. Two things fall out that are worth more than the numbers. <strong>A miss is always the worst case</strong>: the only way to prove a key is absent is to reach the bottom, so a lookup returning nil costs at least the deepest hit, and here a little more because it walks one node further to reach <code>case backgroundCtx, todoCtx</code>. And <strong>the value added earliest is the most expensive to find</strong>: in a server the outermost middleware runs first, so the request ID it stashes ends up deepest in the chain and is exactly the key your logger asks for on every single line.</p>
<p>The other half is the type switch. This function could have been three lines: call <code>c.Value(key)</code> and let each type recurse into its own parent. Instead it enumerates the package's own concrete types and reassigns <code>c</code> inside a <code>for</code>, so a walk down a chain it recognises happens in one stack frame with no interface dispatch at all. The <code>default</code> arm is where that guarantee ends: hand it a Context type this package has never heard of and the loop exits into a virtual call, and what happens next belongs to whoever wrote that type. <strong>A type switch over concrete types with a dispatching <code>default</code> is a package optimising the shapes it can recognise while staying correct for the ones it cannot.</strong> Once you can read it here you will see it in <code>fmt</code>, <code>sort</code> and <code>reflect</code>.</p>
<p>Two arms in the middle repay a stop. <code>case *cancelCtx</code> repeats the self-return you already met at line 431, written a second time because this loop deliberately bypasses the method it duplicates. And <code>case withoutCancelCtx</code> answers the same key with <code>nil</code>, under a comment that states a specification rather than a mechanism: <em>"This implements Cause(ctx) == nil when ctx is created using WithoutCancel."</em> A documented behaviour of an exported function, implemented as one arm of an unexported type switch two hundred lines away from it. Measured:</p>
<pre><code>Cause(canceled ctx under 30 WithValue layers)   upstream 503
Cause(WithoutCancel of that same ctx)           &lt;nil&gt;
WithoutCancel(...).Value(key)                   still found
WithoutCancel(...).Done() == nil                true</code></pre>
<p>Values survive <code>WithoutCancel</code> and cancellation does not, and both halves of that sentence are this one switch.</p>
<p>The habit to leave with: <strong>when the last function in a file switches on concrete types declared hundreds of lines above it, the layout is lying to you about the coupling.</strong> Adding a context type to this package means editing this function, and nothing at the top of the file says so. Read the call graph, not the table of contents.</p>`,
		},
	],

	exercise: {
		question:
			"Everyone will tell you context.WithCancel starts a goroutine to watch the parent. There is exactly one anonymous goroutine in all 792 lines, so the claim looks trivially confirmable, and it is wrong. Find that line. Then answer the real question: what has to be true of the parent for it to run? Four exits sit above it. Rule each one out in turn and what you are left with is not a performance note, it is a one-sentence description of where the parent came from. Finally, find the test in the same directory that pins this down and read its name before you read its body.",
		command:
			'grep -n "go func" "$(go env GOROOT)/src/context/context.go"',
		answer: `<p>One hit: <strong>line 509</strong> on go1.23.12, the last statement of <code>propagateCancel</code>.</p>
<p>Walk the exits above it. To reach line 509 the parent must:</p>
<ul>
<li>return a non-nil <code>Done()</code>, or line 466 returns. So it has to be cancelable at all.</li>
<li>not be canceled already, or the <code>select</code> at line 470 cancels the child and returns.</li>
<li>fail <code>parentCancelCtx</code>, or line 478 registers the child in the parent's <code>children</code> map and returns.</li>
<li>not implement <code>AfterFunc(func()) func() bool</code>, or line 494 registers a callback and returns.</li>
</ul>
<p>Only then:</p>
<pre><code>	goroutines.Add(1)
	go func() {
		select {
		case &lt;-parent.Done():
			child.cancel(false, parent.Err(), Cause(parent))
		case &lt;-child.Done():
		}
	}()</code></pre>
<p>The third condition is the one that decides it, and from the <code>parentCancelCtx</code> excerpt there are exactly two ways to fail it: there is no <code>*cancelCtx</code> anywhere under the parent, or there is one but the parent advertises a different Done channel. Both mean the same thing. <strong>The parent is not a context this package made.</strong> Every type <code>context</code> itself produces either fails condition one (<code>Background</code>, <code>TODO</code>, <code>WithoutCancel</code>) or satisfies condition three (<code>cancelCtx</code>, <code>timerCtx</code>, and any stack of <code>valueCtx</code> over either). So the answer to "when does <code>WithCancel</code> start a goroutine" is: <em>when somebody outside the standard library wrote the parent.</em></p>
<p>Measured on go1.23.12 windows/amd64. 1000 calls per case, <code>runtime.NumGoroutine</code> sampled before and 20 ms after, with a control first so the counter is not taken on trust:</p>
<pre><code>CONTROL: 1000 bare go statements that park           delta=+1000

WithCancel(context.Background())                     delta=+0
WithCancel(a ctx from WithCancel)                    delta=+0
WithCancel(WithValue over a cancelable ctx)          delta=+0
WithCancel(20 WithValue layers over cancelable)      delta=+0
WithTimeout(cancelable, 1h)                          delta=+0
WithCancel(custom wrapper, Done NOT overridden)      delta=+0
WithCancel(custom wrapper, Done OVERRIDDEN)          delta=+1000
WithCancel(hand-written Context, real Done chan)     delta=+1000
WithCancel(hand-written Context, nil Done chan)      delta=+0</code></pre>
<p>Read the last three rows together, because they are the whole answer. Wrapping a real context changes nothing as long as you leave <code>Done</code> alone. Override <code>Done</code>, or write a <code>Context</code> from scratch with a live channel, and you buy a goroutine per derived context. Give your hand-written type a nil <code>Done</code> and you are back to free, because you never got past condition one. What the common case does instead is the single line <code>p.children[child] = struct{}{}</code> under a mutex: no goroutine, no channel, no timer.</p>
<p>Now the test, which is the best part. Line 361 declares <code>var goroutines atomic.Int32</code> under the comment <code>// counts the number of goroutines ever created; for testing</code>, and it is incremented on exactly one line, immediately above the <code>go func</code>. The Go authors instrumented this. Find the reader with <code>grep -rn "goroutines.Load" "$(go env GOROOT)/src/context/"</code> and it lands in <code>context_test.go</code> in a function called <strong><code>XTestCustomContextGoroutines</code></strong>. The name is the answer to the exercise. Its cases are the table above, including a wrapper the test calls <code>myDoneCtx</code>, and the assertion that expects a goroutine carries the comment <code>// ctx1 is not providing Done, must not be used</code>.</p>
<p><strong>The general lesson.</strong> A grep tells you a line exists. It tells you nothing about whether it runs. In any function built as a chain of early returns, the last block is the fallback: the most general case, usually the most expensive, usually the least taken, and reliably the longest and most quotable, which is exactly why folklore attaches itself to it. Before you believe a mechanism you found by searching, count the exits above it and work out what has to be true to get past every one. Here that arithmetic turns a performance myth into a fact about authorship, and no amount of staring at the goroutine itself would have got you there.</p>`,
		answerAnchor: {
			file: "src/context/context.go",
			needle: `	goroutines.Add(1)
	go func() {`,
		},
	},

	takeaway:
		"Deriving a context is a map insert under a mutex, and the goroutine everybody quotes is the fallback for parents the standard library did not make.",

	relatedConcepts: ["context", "graceful-shutdown", "channels", "select", "goroutines", "nil"],
	relatedProjects: ["http-server", "grpc-service", "ship-it"],
	relatedFailures: ["ctx-ignored", "goroutine-leak"],
}
