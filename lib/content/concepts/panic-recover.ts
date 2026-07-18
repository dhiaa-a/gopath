import { Concept } from "../../content"

export const panicRecover: Concept = {
	slug: "panic-recover",
	name: "Panic and recover",
	tagline:
		"panic is not an exception. A panic in another goroutine ends the process no matter how many recovers you wrote.",
	summary:
		"A panic unwinds one goroutine's stack, running its deferred functions on the way down, and if nothing stops it the runtime prints that goroutine's trace and kills the whole process. <code>recover</code> is the only brake, and it works only from a deferred function running on the panicking goroutine's own stack, called directly by that deferred function. That last clause is exact and unforgiving. A <code>recover</code> in <code>main</code>, or the per-request <code>recover</code> in <code>net/http</code>, sits on a different stack from any goroutine you launch, so a panic in the goroutine you launched takes the entire process down while your carefully placed recover watches from a stack that is never asked to unwind.",
	mentalModel:
		"A panic is a controlled demolition of exactly one goroutine. It stops normal execution, walks back down that goroutine's stack running every deferred call it finds, and if it reaches the bottom without being stopped, the runtime dumps the goroutine's stack and ends the program. <code>recover</code> is the one thing that stops the walk, and it is bolted to a single stack: it does something only when a deferred function on the unwinding stack calls it directly. It cannot reach into another goroutine, because goroutines do not share a stack and there is no frame of yours for a stranger's panic to unwind into. So the question is never \"is there a recover somewhere in the program\". It is \"is there a deferred recover on the one stack that is currently coming apart\".",
	retrievalPrompts: [
		"You wrap main's body in a deferred recover, then start a pool of workers. One worker panics on a bad input. Does main's recover keep the program alive? || No. A panic unwinds only the stack of the goroutine it happened on, and main's deferred recover is on main's stack, a different stack entirely. The worker runs its own defers, finds no recover among them, and the runtime prints the worker's trace and ends the process. The number of recovers in the program is irrelevant; their location is everything. The only recover that could have saved that worker is a deferred one inside the worker itself, which is why any library that spawns goroutines has to recover inside each one or hand the panic back as a value.",
		"net/http recovers panics per request, so you treat handlers as crash-safe. Inside one handler you launch a goroutine for background work, and it panics. What happens? || The whole server goes down. net/http's recover is deferred on the request goroutine's stack, and the goroutine you launched has its own stack with no recover on it, so its panic is uncaught and takes the process with it, every other in-flight request included. The per-request safety net is real and it stops precisely at the goroutine boundary. If you fan out inside a handler, each goroutine you start needs its own deferred recover, or a helper that supplies one, because the server's cannot reach across the boundary to find them.",
		"You tidy your recovery code into a helper and write defer func() { cleanup() }(), where cleanup() calls recover(). A panic fires. Is it caught? || No, and cleanup's recover() returns nil. recover does something only when called directly by a function that was deferred, and here the deferred function is the closure; cleanup is a further call it makes, one frame too deep, so it is not on the exact boundary recover checks. Change it to defer cleanup() and it works, because now cleanup itself is the deferred function and its recover call is direct. The rule is about being the deferred call, not about running somewhere inside a deferred region.",
	],
	codeExample: `package main

import (
	"fmt"
	"time"
)

func main() {
	// This recover is on main's stack. It catches panics that unwind through
	// main. A goroutine's stack is not main's stack.
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("main recovered:", r)
		}
	}()

	safe := make(chan struct{})
	go func() {
		// The only recover that can save this goroutine is this one:
		// deferred, on the panicking goroutine's OWN stack, called directly.
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("worker recovered:", r)
			}
			close(safe)
		}()
		panic("worker one")
	}()
	<-safe

	go func() {
		panic("worker two") // identical panic, nobody recovering on this stack
	}()
	time.Sleep(50 * time.Millisecond)

	fmt.Println("never reached")
}`,
	codeExplanation:
		"This prints <code>worker recovered: worker one</code>, then <code>panic: worker two</code> with a goroutine stack trace, and the process exits with status 2. It never prints <code>never reached</code>, and it never prints <code>main recovered:</code>. Two goroutines run the same statement, <code>panic</code> with a string, and they end differently for one reason: the first has a deferred recover on its own stack and the second does not. The first goroutine's panic starts unwinding, hits its deferred function, that function calls <code>recover</code> directly, the value comes back non-nil, and the unwinding stops; the goroutine finishes normally and closes <code>safe</code>. The second goroutine's panic unwinds its stack, finds no recover, and the runtime does the only thing it can with an uncaught panic: it prints that goroutine's trace and terminates the program. Notice what does nothing here. <code>main</code>'s deferred recover, at the top, is on <code>main</code>'s stack, and the panic that kills the program is on a goroutine's stack, so <code>main</code>'s recover is never even consulted; it is not that it runs and fails, it is that the unwinding it is attached to never happens. This is the fact that survives everything else on the page: recover is per-stack, and a goroutine you launch is a stack you did not attach a recover to unless you did it inside that goroutine. The <code>time.Sleep</code> exists only to give the second goroutine time to run before <code>main</code> would otherwise exit; delete it and the program may print <code>never reached</code> and leave, because the panic had not fired yet, which is its own lesson about how little you control a goroutine's timing.",
	designRationale:
		"panic and recover are deliberately not exceptions, and the naming is the first clue: Go did not call them <code>throw</code> and <code>catch</code>, because they are not meant to be the mechanism you route ordinary failures through. Ordinary failures are values. A function that can fail returns an <code>error</code>, the caller inspects it, and control flow stays visible and local. panic is reserved for the other category: a bug, an impossible state, a violated invariant, a program that cannot sensibly continue. Reaching for it as flow control is the mistake the design is shaped to discourage, which is why it is verbose, why it prints a full stack, and why it defaults to ending the process. recover exists for a narrow and real purpose: to let a package stop a panic at its own boundary, usually to convert an internal panic back into an error before it escapes. <code>encoding/json</code> is the canonical example; its recursive decoder panics on malformed structure internally and recovers at the top-level call so the caller gets an <code>error</code>, never a crash. The single-stack rule is the load-bearing constraint, and it is a consequence of the concurrency model rather than an arbitrary limit. Each goroutine has its own stack, a panic unwinds a stack, and there is simply no frame belonging to your goroutine for another goroutine's panic to unwind into, so recover cannot span them and the runtime does not offer a global \"a goroutine died\" handler. That absence is on purpose: such a handler would let goroutine panics be swallowed program-wide, which would hide exactly the bugs panic is trying to make loud. <code>net/http</code>'s per-request recover is the exception that proves the rule, and even that is scoped honestly, to the request goroutine only, which is why a goroutine a handler spawns can still kill the server. Two edges are worth carrying. First, some failures are below panic and cannot be recovered at all: a concurrent map write, a deadlock, or stack exhaustion produce a <code>fatal error:</code> from <code>runtime.throw</code>, not a <code>panic:</code>, and a deferred recover never sees them, because by then the runtime's own invariants are broken. Second, <code>panic(nil)</code> used to be a genuine trap, making <code>recover</code> return <code>nil</code> and so indistinguishable from no panic; Go 1.21 fixed it, and <code>recover</code> now returns a <code>*runtime.PanicNilError</code> instead.",
	commonMistakes: [
		{
			title: "Expecting a recover on another stack to protect a goroutine",
			body: "A deferred recover in <code>main</code>, or in a top-level HTTP middleware, covers exactly the stack it is deferred on. A goroutine you <code>go</code> off has its own stack, and its panic runs its own defers only, so it crashes the whole process past every recover you wrote elsewhere. The rule for spawning goroutines is unforgiving: if the goroutine can panic and you want to survive it, the deferred recover has to live inside that goroutine, or the code has to hand its failures back as values instead of panicking.",
		},
		{
			title: "Calling recover from a function the deferred function calls",
			body: "<code>recover</code> returns a non-nil value only when called <em>directly</em> by a function that was deferred. <code>defer func() { cleanup() }()</code> where <code>cleanup</code> calls <code>recover</code> catches nothing, because <code>cleanup</code> is one call deeper than the deferred closure; <code>recover</code> returns nil and the panic keeps going. <code>defer cleanup()</code> works, because now <code>cleanup</code> is the deferred function itself. The distinction is about being the deferred call, not about executing somewhere inside a deferred region, and it is easy to reintroduce while refactoring for tidiness.",
		},
		{
			title: "Using panic and recover as exceptions for handleable failures",
			body: "A file that will not open, a request that times out, a row that will not parse: these are ordinary failures a caller can decide about, so they are <code>error</code> values, not panics. Panicking through them and recovering at a top layer rebuilds try/catch on top of a language that chose not to have it, hides the control flow, and crosses the one boundary panic cannot cross the moment any of that work moves to a goroutine. Reserve panic for bugs and impossible states, where crashing loudly is the correct outcome.",
		},
		{
			title: "Believing every re-panic loses the original stack",
			body: "It depends on when you re-raise, and the common advice is imprecise. Re-raising from inside the deferred recover, <code>panic(r)</code> or <code>panic(fmt.Errorf(\"...: %w\", r))</code> while the stack is still unwinding, <em>keeps</em> the original trace: the runtime prints it annotated <code>[recovered]</code> with the original panic site intact. You lose the origin only if you recover, let the stack unwind fully by returning from the deferred function, stash the value, and panic with it later from an unrelated frame; then the trace points at the re-raise site and the original site is gone. If you must defer the re-raise, capture the stack yourself first.",
		},
		{
			title: "Expecting recover to catch a fatal runtime error",
			body: "A concurrent map write, a <code>send on closed channel</code> is recoverable, but <code>concurrent map writes</code> and <code>all goroutines are asleep - deadlock!</code> are not: they print <code>fatal error:</code>, come from <code>runtime.throw</code>, and unwind past every deferred recover, even one in the very goroutine that triggered them. The runtime treats these as evidence that its own invariants are already violated, so continuing is not offered. No amount of recover code turns a data-race-induced fatal error into something you handle; the fix is to not have the race.",
		},
	],
	relatedSlugs: ["defer", "error-handling", "goroutines", "typed-nil", "http-handler"],
}
