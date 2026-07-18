import { Concept } from "../../content"

export const syncOnce: Concept = {
	slug: "sync-once",
	name: "sync.Once",
	tagline:
		"Exactly once, and every caller waits for it. Which is the wrong guarantee for anything that can fail.",
	summary:
		"<code>once.Do(f)</code> runs <code>f</code> the first time it is called and never again, and every concurrent caller blocks until that first <code>f</code> has returned. The blocking is the point: it is what makes <code>Do</code> returning mean the thing is ready. Two consequences bite. A panicking <code>f</code> still counts as done, so the next caller sails past a resource that was never built. And \"never again\" includes never retrying, which makes <code>Once</code> the wrong tool for anything that can fail. Go 1.21 added <code>sync.OnceFunc</code>, <code>sync.OnceValue</code> and <code>sync.OnceValues</code>, which fix the first of those.",
	mentalModel:
		"A Once is a turnstile with a lamp over it, not a flag. The first goroutine through does the work; everyone else waits at the turnstile, and the lamp comes on when the first one is finished, not when they started. That waiting is the whole product. A flag you compare-and-swap would also run <code>f</code> exactly once, and it would let the second caller walk past while the first was still building the thing they came for. So Once answers \"is it ready?\", not \"has it been started?\". What it never answers is \"did it work?\": the lamp comes on when <code>f</code> returns, and <code>f</code> returning is not <code>f</code> succeeding. Panicking counts. Failing counts.",
	retrievalPrompts: [
		"A Once could be implemented as if done.CompareAndSwap(0, 1) { f() }: one atomic, no mutex, f still runs exactly once. The stdlib deliberately does not do this. Why? || Because Do guarantees that when it returns, f has finished, and the CAS version does not. The winner of the CAS calls f; the loser returns immediately, while f is still halfway through building the resource, and then dereferences it. The source carries this exact code as a comment labelled an incorrect implementation. That is why the slow path takes a mutex and why done is stored only after f returns.",
		"Your init function panics inside once.Do, a recover upstream catches it, and the process stays up. The next once.Do call returns without error. What state are you in? || A resource that was never built, and no signal left anywhere. If f panics, Do considers it to have returned, because the store is a defer rather than a statement after f(), so future calls return without calling f. Nothing has failed from the caller's point of view; the variable f was supposed to fill is simply the zero value. A nil map reads as empty rather than panicking, so this surfaces arbitrarily far away, at the first write, as assignment to entry in nil map.",
		"A colleague wraps a database dial in sync.Once so it only connects once. It works in every test. What happens on the first deploy where the database is slow to boot? || The dial fails, Once marks itself done, and the stale error is returned to every caller for the lifetime of the process while the database sits there healthy. Once cannot retry: that is its contract, not a gap in it. Anything that can fail needs a mutex with a done flag you only set on success, or a real connection pool. Once is for initialisation that cannot fail.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
	"sync"
)

type Conn struct{ dsn string }

// dial fails the first time and succeeds forever after: a database that was
// still booting when your process started. The most ordinary outage there is.
var dialCalls int

func dial() (*Conn, error) {
	dialCalls++
	if dialCalls == 1 {
		return nil, errors.New("connection refused")
	}
	return &Conn{dsn: "db:5432"}, nil
}

// The classic misuse. Once guarantees dial runs one time. That is exactly the
// guarantee you do not want for something that can fail.
var (
	once sync.Once
	conn *Conn
	err  error
)

func Get() (*Conn, error) {
	once.Do(func() {
		conn, err = dial()
	})
	return conn, err
}

// A second Once, to show what a panicking f leaves behind.
var (
	bootOnce sync.Once
	registry map[string]string
)

func boot() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("  recovered from:", r)
		}
	}()
	bootOnce.Do(func() {
		panic("config file missing")
		// registry = map[string]string{"region": "eu-west-1"} // never runs
	})
}

func main() {
	fmt.Println("Once + something that can fail:")
	for i := 1; i <= 3; i++ {
		c, err := Get()
		fmt.Printf("  call %d: conn=%v err=%v (dial called %d time(s))\\n",
			i, c, err, dialCalls)
	}

	fmt.Println("Once + a panicking f:")
	boot() // panics inside Do, recovered here
	bootOnce.Do(func() {
		registry = map[string]string{"region": "eu-west-1"}
		fmt.Println("  retry ran") // never prints: Do considers f to have returned
	})
	fmt.Printf("  second Do returned normally, registry=%v\\n", registry)
	fmt.Println("  the next read of registry is where this surfaces:")
	fmt.Println("  registry[\\"region\\"] =", registry["region"], "(zero value, no panic)")
}`,
	codeExplanation:
		"Two failures, one mechanism, and the output is identical on every run. All three calls print <code>err=connection refused (dial called 1 time(s))</code>. That count is the first failure: <code>dial</code> would succeed now, the database came up seconds ago, and nothing will ever call it again for the life of the process. The Once is spent, and it was spent on a failure. The second half is quieter and worse. <code>f</code> panicked, so nothing was assigned, and the retry's <code>retry ran</code> never prints: the second <code>Do</code> returns normally without calling <code>f</code>, because <code>Do</code> considers a panicking <code>f</code> to have returned. The mechanism is one line in <code>sync/once.go</code>, and it is worth opening: the slow path is <code>defer o.done.Store(1)</code> followed by <code>f()</code>, so the store is a <code>defer</code> and runs on the way out whether <code>f</code> returned or unwound. What that leaves is <code>registry=map[]</code>, a nil map. Reading a nil map returns the zero value rather than panicking, so the last line prints an empty region and the program is happily, silently wrong. The panic finally arrives at the first write, somewhere else entirely, as <code>assignment to entry in nil map</code>, and the stack points at the writer rather than at the initialisation that never happened.",
	designRationale:
		"The most instructive comment in the standard library is inside <code>Once.Do</code>. It carries an implementation the authors call incorrect: <code>if o.done.CompareAndSwap(0, 1) { f() }</code>. One atomic, no mutex, and <code>f</code> still runs exactly once. It is rejected because, in their words, Do guarantees that when it returns, f has finished, and given two simultaneous calls the winner of the CAS would call f while the second returned immediately without waiting. That is the entire design in one paragraph: Once is not a run-once flag, it is a synchronisation primitive whose product is the waiting, and \"exactly once\" is the mechanism rather than the guarantee. The implementation follows from it. The fast path is <code>if o.done.Load() == 0</code>, inlined at every call site (the struct comment says <code>done</code> is first specifically because it is the hot path), so a Once you have already done costs one atomic load and you can put it in a request path without thinking. The slow path takes a mutex, which is why a concurrent caller blocks, and why an <code>f</code> that calls <code>Do</code> on the same Once deadlocks rather than nesting: it prints <code>fatal error: all goroutines are asleep - deadlock!</code> with the goroutine parked in <code>sync.(*Mutex).Lock</code>. And the store is <code>defer o.done.Store(1)</code> rather than a statement after <code>f()</code>, which is what makes a panicking <code>f</code> count as done. Reasonable, since a Once that a panic left unlocked would rerun a half-completed initialisation on the next caller, which is a worse failure. But it is a failure either way, and Go 1.21 finally said so: <code>sync.OnceValue</code> memoises the panic and repanics with the same value on every later call, so the second caller gets the original panic instead of a zero value and a mystery. That is a straight improvement, and it is the strongest available hint about how the old behaviour is regarded.",
	commonMistakes: [
		{
			title: "Using Once for something that can fail",
			body: "A dial, an HTTP fetch, a file read. It fails once at startup and the stale error is served to every caller until the process restarts, while the dependency sits there healthy. Once cannot retry: that is the contract. Anything fallible wants a mutex with a done flag set only on success, or the pool that the library already ships.",
		},
		{
			title: "Assuming a panic in f leaves the Once unused",
			body: "It does not. The store is a <code>defer</code>, so <code>Do</code> considers a panicking <code>f</code> to have returned, and every later <code>Do</code> is a silent no-op. Recover upstream and you have a live process whose initialised variables are all zero values, failing later and elsewhere. <code>sync.OnceValue</code> repanics with the original value instead, which is the behaviour you wanted.",
		},
		{
			title: "Copying a struct that contains a Once",
			body: "The copy gets a fresh, unused Once, so <code>f</code> runs again on the copy and your exactly-once is exactly-twice. It happens through value receivers and passing a config struct around. <code>go vet</code> catches it: <code>Init passes lock by value: Cfg contains sync.Once contains sync/atomic.Uint32 contains sync/atomic.noCopy</code>. Pointer receivers, and pass pointers.",
		},
		{
			title: "Calling Do from inside f on the same Once",
			body: "It deadlocks, and the docs say so directly: because no call to Do returns until the one call to f returns, if f causes Do to be called it will deadlock. The slow path holds a mutex across <code>f</code>. Usually it arrives indirectly, when <code>f</code> calls a helper that lazily initialises the same thing, and it looks like <code>fatal error: all goroutines are asleep</code> with the stack parked in <code>sync.(*Mutex).Lock</code>.",
		},
		{
			title: "Reaching for Once where a package-level var would do",
			body: "<code>var re = regexp.MustCompile(...)</code> at package scope is already lazily initialised once, by the language, before <code>main</code> runs, with no lock in the read path at all. Once earns its place when the work is expensive enough that you do not want it on every startup, or needs a value that does not exist at init time. Otherwise it is ceremony with a mutex in it.",
		},
	],
	relatedSlugs: ["sync-mutex", "atomic", "panic-recover", "init-lifecycle", "maps"],
}
