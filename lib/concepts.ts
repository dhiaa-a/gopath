export type Concept = {
	slug: string
	name: string
	tagline: string
	summary: string
	mentalModel: string
	codeExample: string
	codeExplanation: string
	fromOtherLang: string
	commonMistakes: { title: string; body: string }[]
	relatedSlugs: string[]
}

export const concepts: Concept[] = [
	{
		slug: "error-handling",
		name: "Error handling",
		tagline: "Errors are values — explicit, returnable, wrappable.",
		summary:
			"Go has no exceptions. Errors are ordinary values of type <code>error</code> returned alongside results. Every caller decides what to do with them — log, wrap, return, or ignore. This explicitness is Go's superpower: you can always see exactly which calls can fail.",
		mentalModel:
			'Think of every function with a possible failure as returning two things: the result and a verdict. Like a restaurant order: you get either (food, nil) or (nil, "kitchen is closed"). You check the verdict before eating the food.',
		codeExample: `package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("item not found")

func findUser(id int) (string, error) {
	if id != 42 {
		return "", fmt.Errorf("findUser %d: %w", id, ErrNotFound)
	}
	return "Alice", nil
}

func main() {
	name, err := findUser(99)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			fmt.Println("User does not exist")
		} else {
			fmt.Println("Unexpected error:", err)
		}
		return
	}
	fmt.Println("Found:", name)
}`,
		codeExplanation:
			"We define a sentinel error with <code>errors.New</code>. We wrap it with context using <code>fmt.Errorf + %w</code>. The caller uses <code>errors.Is</code> to match the underlying error type — even through multiple layers of wrapping.",
		fromOtherLang:
			"Coming from Python/JS: there are no try/catch blocks. You check <code>if err != nil</code> after every call that can fail. It feels verbose at first but makes error paths explicit and impossible to accidentally swallow. Coming from Java: no checked exceptions — just return values.",
		commonMistakes: [
			{
				title: "Ignoring errors with _",
				body: "Writing <code>result, _ := doThing()</code> silently discards errors. Only do this when you're absolutely certain the error can't happen — which is rarer than you think.",
			},
			{
				title: "Losing context when wrapping",
				body: 'Use <code>fmt.Errorf("context: %w", err)</code> not <code>fmt.Errorf("context: %v", err)</code>. The <code>%w</code> verb preserves the original error for <code>errors.Is</code> and <code>errors.As</code> checks.',
			},
			{
				title: "Returning non-nil error with a valid result",
				body: "If you return an error, callers expect the other return values to be zero values. Don't return partial results alongside errors — it forces callers to guess what to trust.",
			},
		],
		relatedSlugs: ["interfaces", "defer"],
	},
	{
		slug: "interfaces",
		name: "Interfaces",
		tagline:
			"Implicit satisfaction — if you have the methods, you implement the interface.",
		summary:
			"A Go interface is just a set of method signatures. Any type that has those methods automatically satisfies the interface — no <code>implements</code> keyword needed. This makes interfaces incredibly flexible and enables loose coupling you'd struggle to achieve in other languages.",
		mentalModel:
			"An interface is a contract defined by the consumer, not the producer. If you need something that can be written to, you define <code>type Writer interface { Write([]byte) (int, error) }</code> and anything with a <code>Write</code> method fits — files, buffers, network connections, your custom type. You never touch those types.",
		codeExample: `package main

import "fmt"

type Stringer interface {
	String() string
}

type User struct {
	Name  string
	Email string
}

func (u User) String() string {
	return fmt.Sprintf("%s <%s>", u.Name, u.Email)
}

type Bot struct {
	ID string
}

func (b Bot) String() string {
	return fmt.Sprintf("bot:%s", b.ID)
}

func printAll(items []Stringer) {
	for _, item := range items {
		fmt.Println(item.String())
	}
}

func main() {
	items := []Stringer{
		User{Name: "Alice", Email: "alice@example.com"},
		Bot{ID: "worker-01"},
	}
	printAll(items)
}`,
		codeExplanation:
			"<code>printAll</code> accepts any slice of <code>Stringer</code>. Both <code>User</code> and <code>Bot</code> have a <code>String()</code> method, so both satisfy the interface — without either type knowing about the interface.",
		fromOtherLang:
			"Coming from Python: this is duck typing, but checked at compile time. Coming from Java/C#: there's no <code>implements Stringer</code> declaration. The type just needs the methods. Coming from TypeScript: closer to structural typing — shape matters, not the declaration.",
		commonMistakes: [
			{
				title: "Pointer vs value receiver mismatch",
				body: "If a method is defined on <code>*T</code> (pointer receiver), then <code>*T</code> satisfies the interface but <code>T</code> does not. If defined on <code>T</code>, both <code>T</code> and <code>*T</code> satisfy it. Mix-ups here cause 'does not implement interface' errors.",
			},
			{
				title: "Returning concrete types instead of interfaces",
				body: "Functions should accept interfaces, return concrete types. Returning interfaces couples the caller to an abstraction and prevents them from accessing type-specific methods.",
			},
			{
				title: "The empty interface any",
				body: "<code>any</code> (alias for <code>interface{}</code>) accepts everything. Use it sparingly — you lose all type safety. Prefer a specific interface with the methods you actually need.",
			},
		],
		relatedSlugs: ["http-handler", "error-handling"],
	},
	{
		slug: "goroutines",
		name: "Goroutines",
		tagline:
			"Lightweight concurrent functions — cheaper than threads by orders of magnitude.",
		summary:
			"A goroutine is a function running concurrently with other goroutines in the same address space. Starting one is as cheap as a few kilobytes of stack. The Go runtime multiplexes thousands of goroutines onto a small number of OS threads, handling scheduling for you.",
		mentalModel:
			"Think of goroutines as tasks on a to-do list that a team of workers (OS threads) picks up and executes. You can add thousands of tasks and the team handles it — you don't manage which worker does what. The key: goroutines are cheap to create, but you must coordinate their results via channels or sync primitives.",
		codeExample: `package main

import (
	"fmt"
	"sync"
)

func fetch(url string, wg *sync.WaitGroup) {
	defer wg.Done()
	// Simulate work
	fmt.Println("Fetching:", url)
}

func main() {
	urls := []string{
		"https://api.example.com/users",
		"https://api.example.com/posts",
		"https://api.example.com/comments",
	}

	var wg sync.WaitGroup

	for _, url := range urls {
		wg.Add(1)
		go fetch(url, &wg)
	}

	wg.Wait()
	fmt.Println("All done")
}`,
		codeExplanation:
			"<code>go fetch(url, &wg)</code> launches each fetch concurrently. <code>wg.Add(1)</code> registers a task, <code>wg.Done()</code> marks it complete (via defer), and <code>wg.Wait()</code> blocks until all tasks finish.",
		fromOtherLang:
			"Coming from Python: goroutines are not threads — they're multiplexed by the Go runtime and far cheaper. Unlike asyncio, there's no async/await syntax; concurrency is the default. Coming from JS: goroutines can run truly in parallel on multiple CPU cores, unlike the JS event loop. Coming from Java: no <code>new Thread()</code>, no thread pool management — just <code>go func()</code>.",
		commonMistakes: [
			{
				title: "Launching goroutines and not waiting",
				body: "If main() returns, all goroutines are killed instantly. Always use <code>sync.WaitGroup</code> or a channel to wait for goroutines to finish before the program exits.",
			},
			{
				title: "Closing over a loop variable",
				body: `In older Go (<1.22), <code>for _, v := range items { go func() { use(v) }() }</code> captures the variable <em>reference</em> not the value — all goroutines may see the last value. Fix: pass as argument: <code>go func(v T) { use(v) }(v)</code>.`,
			},
			{
				title: "Goroutine leaks",
				body: "A goroutine blocked on a channel that nobody writes to will leak forever. Always ensure goroutines have a way to exit — use <code>context.Context</code> for cancellation.",
			},
		],
		relatedSlugs: ["channels", "sync-waitgroup", "context", "select"],
	},
	{
		slug: "channels",
		name: "Channels",
		tagline: "Typed pipes for communicating between goroutines safely.",
		summary:
			"Channels are Go's way of sharing data between goroutines without shared memory or locks. A channel is a typed conduit — you send values in, receive them out. The Go proverb: <em>don't communicate by sharing memory; share memory by communicating.</em>",
		mentalModel:
			"A channel is a conveyor belt between goroutines. One goroutine puts items on the belt, another picks them off. An unbuffered channel means the sender waits until a receiver is ready — they synchronize. A buffered channel has capacity, so the sender can keep going until the buffer is full.",
		codeExample: `package main

import "fmt"

func generate(nums []int, out chan<- int) {
	for _, n := range nums {
		out <- n // send
	}
	close(out) // signal: no more values
}

func square(in <-chan int, out chan<- int) {
	for n := range in { // receive until closed
		out <- n * n
	}
	close(out)
}

func main() {
	nums := make(chan int)
	squares := make(chan int)

	go generate([]int{1, 2, 3, 4, 5}, nums)
	go square(nums, squares)

	for s := range squares {
		fmt.Println(s) // 1 4 9 16 25
	}
}`,
		codeExplanation:
			"Two goroutines form a pipeline. <code>generate</code> sends numbers, <code>square</code> receives them and sends results. <code>close(ch)</code> signals that no more values will be sent, enabling <code>range ch</code> to terminate naturally.",
		fromOtherLang:
			"Coming from Python: channels are like <code>queue.Queue</code> but built into the language and type-safe. Coming from JS: no direct equivalent — channels are a synchronization primitive that JS lacks. Coming from Java: similar to <code>BlockingQueue</code>, but with built-in language syntax.",
		commonMistakes: [
			{
				title: "Sending to a closed channel (panic)",
				body: "Sending to a closed channel panics. The rule: only the sender should close a channel, and only when they're certain no more sends will happen.",
			},
			{
				title: "Forgetting to close, causing deadlock",
				body: "A goroutine doing <code>for n := range ch</code> will block forever if <code>ch</code> is never closed. Always close channels when the sender is done.",
			},
			{
				title: "Using channels when a mutex is clearer",
				body: "Channels are best for passing ownership of data. For protecting shared state (a counter, a map), a <code>sync.Mutex</code> is often simpler and more readable.",
			},
		],
		relatedSlugs: ["goroutines", "select", "sync-waitgroup"],
	},
	{
		slug: "defer",
		name: "Defer",
		tagline:
			"Schedule cleanup to run when the function returns — no matter what.",
		summary:
			"A <code>defer</code> statement schedules a function call to run just before the surrounding function returns. Deferred calls run in LIFO order (last in, first out). They run even if the function panics, making them perfect for cleanup: closing files, releasing locks, stopping timers.",
		mentalModel:
			"Defer is like leaving a sticky note for your future self: 'when you're done here, do this.' You write the cleanup right next to the resource acquisition, which makes code far easier to audit. You can't forget to clean up if the cleanup is defined the moment you open something.",
		codeExample: `package main

import (
	"fmt"
	"os"
)

func readFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open: %w", err)
	}
	defer f.Close() // runs when readFile returns, no matter what

	buf := make([]byte, 100)
	n, err := f.Read(buf)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}

	return string(buf[:n]), nil
}

func main() {
	content, err := readFile("go.mod")
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println(content)
}`,
		codeExplanation:
			"<code>defer f.Close()</code> is written immediately after successfully opening the file. No matter how many early returns or errors follow, the file will be closed. Without defer you'd need <code>f.Close()</code> before every return.",
		fromOtherLang:
			"Coming from Python: defer is like a <code>finally</code> block or context manager (<code>with open(...)</code>), but scoped to the function, not a block. Coming from JS: similar to <code>try/finally</code>. Coming from C++: similar to RAII destructors — cleanup is tied to scope exit.",
		commonMistakes: [
			{
				title: "Defer in a loop",
				body: "Deferred calls run when the function returns, not when the loop iteration ends. Deferring <code>f.Close()</code> inside a loop that opens many files will hold all files open until the function exits. Move the work into a helper function instead.",
			},
			{
				title: "Ignoring deferred function's return value",
				body: "<code>defer f.Close()</code> ignores the error Close returns. In critical code, capture it: <code>defer func() { if err := f.Close(); err != nil { log.Println(err) } }()</code>",
			},
		],
		relatedSlugs: ["error-handling", "interfaces"],
	},
	{
		slug: "structs",
		name: "Structs",
		tagline:
			"Named collections of fields — Go's primary way to model data.",
		summary:
			"A struct is a composite type that groups together fields with names and types. Unlike classes in OOP languages, Go structs have no inheritance — behaviour is added through methods and composition. Structs are value types by default: assigning or passing a struct copies it.",
		mentalModel:
			"A struct is a form with labelled fields. When you assign a struct to another variable, you're filling out a new identical form — changes to one don't affect the other. To share a struct across functions and have mutations visible, pass a pointer to it.",
		codeExample: `package main

import "fmt"

type Address struct {
	Street string
	City   string
}

type User struct {
	Name    string
	Age     int
	Address // embedded — fields promoted
}

func (u *User) Greet() string {
	return fmt.Sprintf("Hi, I'm %s from %s", u.Name, u.City)
}

func main() {
	u := User{
		Name: "Alice",
		Age:  30,
		Address: Address{
			Street: "123 Main St",
			City:   "Baghdad",
		},
	}

	fmt.Println(u.Greet())
	fmt.Println(u.City) // promoted from Address
}`,
		codeExplanation:
			"Embedding <code>Address</code> inside <code>User</code> promotes its fields — you can write <code>u.City</code> instead of <code>u.Address.City</code>. Methods are defined separately on <code>*User</code> (pointer receiver) so mutations persist.",
		fromOtherLang:
			"Coming from Python: structs replace classes for data modeling. There's no <code>__init__</code> — you use struct literals. Coming from JS: structs are typed objects with a fixed shape, checked at compile time. Coming from Java/C#: no inheritance, use embedding and interfaces instead.",
		commonMistakes: [
			{
				title: "Copying large structs unintentionally",
				body: "Passing a large struct to a function copies the entire thing. For structs with many fields or mutable state, pass a pointer (<code>*MyStruct</code>) instead.",
			},
			{
				title: "Zero value confusion",
				body: 'Every field in a struct starts as its zero value: 0, "", false, nil. This is intentional and useful — but always consider whether a zero-value struct makes sense for your type.',
			},
		],
		relatedSlugs: ["interfaces", "json-decode", "pointers"],
	},
	{
		slug: "pointers",
		name: "Pointers",
		tagline:
			"A pointer holds the memory address of a value — enabling mutation and sharing.",
		summary:
			"Go uses pointers to avoid copying data and to allow functions to mutate their arguments. A pointer <code>*T</code> holds the memory address of a <code>T</code>. You dereference it with <code>*ptr</code> to read or write the value. The address-of operator <code>&amp;</code> gives you a pointer to an existing value.",
		mentalModel:
			"A value is a house. A pointer is the street address written on a piece of paper. If you hand someone a copy of your house (value), they can redecorate it without affecting yours. If you hand them the address (pointer), any changes they make are to your actual house.",
		codeExample: `package main

import "fmt"

type Counter struct {
	count int
}

// Value receiver — works on a copy
func (c Counter) ValueIncrement() {
	c.count++ // affects the copy only
}

// Pointer receiver — works on the original
func (c *Counter) Increment() {
	c.count++
}

func main() {
	c := Counter{}
	c.ValueIncrement()
	fmt.Println(c.count) // 0 — unchanged

	c.Increment()
	fmt.Println(c.count) // 1 — mutated
}`,
		codeExplanation:
			"<code>ValueIncrement</code> receives a copy of <code>Counter</code> — its change doesn't escape. <code>Increment</code> receives a pointer, so the mutation affects the original. This is the most common pointer vs value confusion in Go.",
		fromOtherLang:
			"Coming from Python/JS: these languages always pass objects by reference implicitly. In Go, you choose explicitly. Coming from Java: primitives are value types, objects are reference types. In Go, everything is a value — you opt into reference semantics with pointers. Coming from C/C++: same concept, but Go has no pointer arithmetic.",
		commonMistakes: [
			{
				title: "Nil pointer dereference",
				body: "Dereferencing a nil pointer panics. Before dereferencing, always check <code>if ptr != nil</code>. Return pointers from functions only when the zero value is meaningfully different from 'no result' — otherwise return a value and an error.",
			},
			{
				title: "Mixed pointer and value receivers on the same type",
				body: "If any method on a type uses a pointer receiver, all methods should use pointer receivers. Mixing causes subtle bugs with interface satisfaction and is a style violation.",
			},
		],
		relatedSlugs: ["structs", "interfaces"],
	},
	{
		slug: "context",
		name: "Context",
		tagline:
			"Carry cancellation signals and deadlines across API boundaries.",
		summary:
			"A <code>context.Context</code> carries a cancellation signal, an optional deadline, and optional key-value pairs. It threads through your call stack so that when an HTTP request is cancelled, every goroutine working on it can stop. Pass context as the first argument to any function that does I/O or spawns goroutines.",
		mentalModel:
			"Context is like a project cancellation memo that travels with every piece of work. If the client disconnects, the memo says 'stop everything'. Every worker checks the memo before starting the next unit of work. If the memo says cancel, they stop cleanly instead of continuing to do useless work.",
		codeExample: `package main

import (
	"context"
	"fmt"
	"time"
)

func doWork(ctx context.Context, name string) error {
	select {
	case <-time.After(2 * time.Second):
		fmt.Println(name, "finished")
		return nil
	case <-ctx.Done():
		fmt.Println(name, "cancelled:", ctx.Err())
		return ctx.Err()
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel() // always call cancel to free resources

	if err := doWork(ctx, "task-1"); err != nil {
		fmt.Println("Error:", err)
	}
}`,
		codeExplanation:
			"<code>context.WithTimeout</code> creates a context that auto-cancels after 1 second. <code>doWork</code> uses <code>select</code> to race between doing real work and the context being cancelled. <code>defer cancel()</code> ensures resources are freed even if we return early.",
		fromOtherLang:
			"Coming from Python: similar to <code>asyncio.CancelledError</code>, but explicit and threaded through function arguments. Coming from JS: similar to <code>AbortController</code> + <code>AbortSignal</code>. Coming from Java: similar to <code>ExecutorService.shutdownNow()</code> but much more composable.",
		commonMistakes: [
			{
				title: "Not calling cancel()",
				body: "<code>WithCancel</code>, <code>WithTimeout</code>, and <code>WithDeadline</code> all leak resources if <code>cancel()</code> is never called. Always <code>defer cancel()</code> immediately after creating the context.",
			},
			{
				title: "Storing context in a struct",
				body: "Don't store context in a struct and use it later. Context should flow through function parameters. Storing it detaches it from the request lifecycle it was meant to control.",
			},
			{
				title: "Using context.Background() everywhere",
				body: "<code>context.Background()</code> never cancels — it's for top-level use (main, tests, server startup). If you're inside an HTTP handler, use <code>r.Context()</code> so the work cancels when the client disconnects.",
			},
		],
		relatedSlugs: ["goroutines", "select", "http-handler"],
	},
	{
		slug: "slices",
		name: "Slices",
		tagline:
			"Dynamic arrays with a hidden header — length, capacity, and a pointer to an array.",
		summary:
			"A slice is a view into an underlying array. It has three parts: a pointer to the array, a length, and a capacity. This makes slices cheap to pass (no copying of elements) but creates subtle aliasing bugs if you're not aware of how they share memory.",
		mentalModel:
			"A slice is a window into a row of seats. The window has a start position, a width (length), and a maximum width it could expand to (capacity). Two slices can look at overlapping seats — mutating one changes what the other sees. <code>append</code> either expands the window or, if at capacity, moves everyone to a bigger row.",
		codeExample: `package main

import "fmt"

func main() {
	// Create a slice
	s := []int{1, 2, 3, 4, 5}
	fmt.Println(len(s), cap(s)) // 5 5

	// Slicing creates a view — shared memory!
	a := s[1:3] // [2 3]
	a[0] = 99
	fmt.Println(s) // [1 99 3 4 5] — s is affected!

	// append beyond capacity creates a new array
	b := append(s, 6, 7, 8)
	b[0] = 0
	fmt.Println(s[0]) // still 1 — b is now independent
	fmt.Println(b)    // [0 99 3 4 5 6 7 8]

	// Safe copy pattern
	c := make([]int, len(s))
	copy(c, s)
	c[0] = 999
	fmt.Println(s[0]) // 1 — unaffected
}`,
		codeExplanation:
			"Slicing with <code>s[1:3]</code> shares the underlying array — mutations in <code>a</code> appear in <code>s</code>. <code>append</code> returns a new slice; if it needed to grow, it allocated a new array and <code>s</code> and <code>b</code> no longer share memory. <code>copy</code> always produces a fully independent slice.",
		fromOtherLang:
			"Coming from Python: Go slices are like Python lists, but the aliasing behaviour is different — Python list slices are always copies. Coming from JS: similar to typed arrays, with the same aliasing via <code>subarray</code>. Coming from Java: closer to <code>ArrayList</code> but with explicit capacity and aliasing semantics.",
		commonMistakes: [
			{
				title: "Mutating a slice you think is independent",
				body: "After <code>b := a[1:3]</code>, modifying <code>b</code> modifies <code>a</code>. Use <code>copy</code> if you need an independent copy.",
			},
			{
				title: "nil slice vs empty slice",
				body: "A nil slice (<code>var s []int</code>) and an empty slice (<code>s := []int{}</code>) both have length 0, but only the nil slice is nil. Both work with <code>append</code> and <code>range</code> — but JSON encodes nil as <code>null</code> and empty as <code>[]</code>.",
			},
		],
		relatedSlugs: ["structs", "json-decode"],
	},
	{
		slug: "maps",
		name: "Maps",
		tagline:
			"Hash maps with simple syntax — but nil maps and concurrent access will panic.",
		summary:
			"Maps are Go's built-in hash map. They map keys to values, both of any comparable type. Two things will panic: writing to a nil map, and concurrent reads + writes without synchronisation. Maps are reference types — passing a map to a function passes a reference, not a copy.",
		mentalModel:
			"A map is a lookup table. The zero value of a map is nil — a table that doesn't exist yet. You must initialise it with <code>make</code> or a literal before writing to it. Reading a missing key never panics — it returns the zero value — but that can silently mask bugs.",
		codeExample: `package main

import "fmt"

func main() {
	// Always initialise before writing
	scores := make(map[string]int)
	scores["Alice"] = 95
	scores["Bob"] = 87

	// Comma-ok idiom to distinguish missing vs zero
	val, ok := scores["Charlie"]
	if !ok {
		fmt.Println("Charlie not found, val is:", val) // 0
	}

	// Iterate — order is randomised every run
	for name, score := range scores {
		fmt.Printf("%s: %d\n", name, score)
	}

	// Delete a key
	delete(scores, "Bob")
	fmt.Println(len(scores)) // 1
}`,
		codeExplanation:
			"The comma-ok pattern <code>val, ok := m[key]</code> tells you whether the key exists. Without it, a missing key and a key set to <code>0</code> look identical. Map iteration order is intentionally randomised — never rely on it.",
		fromOtherLang:
			"Coming from Python: Go maps are Python dicts, but the zero value is nil (not an empty dict). Coming from JS: equivalent to plain objects or <code>Map</code>, with typed keys. Coming from Java: equivalent to <code>HashMap</code>, but with simpler syntax.",
		commonMistakes: [
			{
				title: "Writing to a nil map (panic)",
				body: 'Declaring <code>var m map[string]int</code> gives you nil. <code>m["key"] = 1</code> panics. Always use <code>make(map[string]int)</code> or a map literal.',
			},
			{
				title: "Concurrent read + write (panic)",
				body: "Maps are not safe for concurrent use. If multiple goroutines access a map, protect it with <code>sync.RWMutex</code> or use <code>sync.Map</code>.",
			},
		],
		relatedSlugs: ["structs", "sync-waitgroup"],
	},
	{
		slug: "sync-waitgroup",
		name: "sync.WaitGroup",
		tagline:
			"Wait for a collection of goroutines to finish before proceeding.",
		summary:
			"A <code>sync.WaitGroup</code> is a counter. You increment it before launching each goroutine (<code>Add</code>), decrement it when each goroutine finishes (<code>Done</code>), and block until it reaches zero (<code>Wait</code>). It's the standard Go pattern for fan-out concurrency.",
		mentalModel:
			"Imagine handing out raffle tickets. Before each person goes off to do a task, you give them a ticket. When they return, they hand it back. You wait at the door until every ticket has been returned. <code>Add</code> = hand out ticket, <code>Done</code> = return ticket, <code>Wait</code> = watch the door.",
		codeExample: `package main

import (
	"fmt"
	"sync"
	"time"
)

func worker(id int, wg *sync.WaitGroup) {
	defer wg.Done() // always called, even on panic
	time.Sleep(time.Duration(id) * 100 * time.Millisecond)
	fmt.Printf("Worker %d done\n", id)
}

func main() {
	var wg sync.WaitGroup

	for i := 1; i <= 5; i++ {
		wg.Add(1)         // increment before launching
		go worker(i, &wg) // pass pointer — never copy a WaitGroup
	}

	wg.Wait()
	fmt.Println("All workers finished")
}`,
		codeExplanation:
			"<code>wg.Add(1)</code> is called before <code>go worker()</code> — never inside the goroutine. <code>defer wg.Done()</code> ensures Done is called even if the function panics. The WaitGroup is passed as a pointer — never copy it.",
		fromOtherLang:
			"Coming from Python: similar to <code>ThreadPoolExecutor</code> or <code>asyncio.gather()</code>. Coming from JS: similar to <code>Promise.all()</code>. Coming from Java: similar to <code>CountDownLatch</code>.",
		commonMistakes: [
			{
				title: "Calling Add inside the goroutine",
				body: "If you call <code>wg.Add(1)</code> inside the goroutine, the main goroutine might call <code>wg.Wait()</code> before the goroutine runs and adds itself — causing Wait to return immediately.",
			},
			{
				title: "Copying the WaitGroup",
				body: "Passing a WaitGroup by value creates a copy with a separate counter. Always pass <code>&wg</code>.",
			},
		],
		relatedSlugs: ["goroutines", "channels", "context"],
	},
	{
		slug: "select",
		name: "Select",
		tagline:
			"Wait on multiple channel operations simultaneously — take whichever is ready.",
		summary:
			"A <code>select</code> statement is like a switch for channels. It blocks until one of its cases can proceed, then executes that case. If multiple cases are ready simultaneously, one is chosen at random. A <code>default</code> case makes select non-blocking.",
		mentalModel:
			"Select is like a waiter watching multiple tables. Whichever table signals first ('ready to order', 'needs the bill', 'wants dessert') gets served. If nobody is ready and there's a default option, the waiter doesn't stand idle — they do the default instead.",
		codeExample: `package main

import (
	"fmt"
	"time"
)

func main() {
	ch1 := make(chan string)
	ch2 := make(chan string)

	go func() {
		time.Sleep(300 * time.Millisecond)
		ch1 <- "result from ch1"
	}()

	go func() {
		time.Sleep(100 * time.Millisecond)
		ch2 <- "result from ch2"
	}()

	// Wait for whichever arrives first
	for i := 0; i < 2; i++ {
		select {
		case msg := <-ch1:
			fmt.Println("ch1:", msg)
		case msg := <-ch2:
			fmt.Println("ch2:", msg)
		}
	}

	// Timeout pattern
	select {
	case msg := <-ch1:
		fmt.Println(msg)
	case <-time.After(500 * time.Millisecond):
		fmt.Println("timed out")
	}
}`,
		codeExplanation:
			"The first loop picks whichever channel is ready — ch2 arrives first since it sleeps less. The timeout pattern uses <code>time.After</code> which returns a channel that receives after a duration — a very common Go idiom for preventing indefinite blocking.",
		fromOtherLang:
			"Coming from Python: similar to <code>asyncio.wait(..., return_when=FIRST_COMPLETED)</code> but synchronous. Coming from JS: similar to <code>Promise.race()</code>. There's no direct equivalent in most languages.",
		commonMistakes: [
			{
				title: "Busy-looping with default",
				body: "A select with a <code>default</code> case and channel reads in a loop is a busy-wait spin loop — it consumes 100% CPU. Add a <code>time.Sleep</code> or restructure to block properly.",
			},
			{
				title: "Random case selection surprises",
				body: "When multiple channels are ready, Go picks one at random. Don't write code that assumes a priority order between channels.",
			},
		],
		relatedSlugs: ["channels", "goroutines", "context"],
	},
	{
		slug: "http-handler",
		name: "HTTP handlers",
		tagline:
			"The http.Handler interface — everything in Go's HTTP server is just this.",
		summary:
			"Go's entire HTTP server is built on one interface: <code>http.Handler</code>, which has a single method <code>ServeHTTP(ResponseWriter, *Request)</code>. Middleware is just a function that wraps one handler with another. This simplicity means the standard library is all you need for production-grade HTTP servers.",
		mentalModel:
			"Think of each HTTP handler as a function booth at a fair. The booth receives a request ticket and a response envelope. It reads the ticket, does work, and seals the envelope. Middleware is a booth that passes the envelope to another booth first — adding a stamp (auth check, log entry, rate limit) before or after.",
		codeExample: `package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

// Middleware: wraps any handler
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Hello, Go!")
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("/hello", withLogging(http.HandlerFunc(helloHandler)))
	log.Fatal(http.ListenAndServe(":8080", mux))
}`,
		codeExplanation:
			"<code>http.HandlerFunc</code> is an adapter that converts a function with the right signature into an <code>http.Handler</code>. Middleware wraps the inner handler — calling <code>next.ServeHTTP</code> in the middle. You can chain as many wrappers as you need: <code>withAuth(withLogging(handler))</code>.",
		fromOtherLang:
			"Coming from Express (Node): Go middleware is explicit function wrapping instead of <code>app.use()</code>. Coming from Django: no magic middleware stack — you compose explicitly. Coming from Spring: no annotations, no DI container — just functions and interfaces.",
		commonMistakes: [
			{
				title: "Writing to the response after calling next",
				body: "Once <code>next.ServeHTTP</code> is called, the response may already be written. Writing headers after that silently fails. Write headers and status codes before calling next if you need to intercept them.",
			},
			{
				title: "Not handling the method",
				body: "<code>http.NewServeMux</code> matches paths but not methods. <code>GET /users</code> and <code>POST /users</code> both hit the same handler. Check <code>r.Method</code> inside, or use a router library.",
			},
		],
		relatedSlugs: ["interfaces", "context", "error-handling"],
	},
	{
		slug: "json-decode",
		name: "JSON encoding/decoding",
		tagline:
			"Encode structs to JSON and decode JSON into typed structs using struct tags.",
		summary:
			'Go\'s <code>encoding/json</code> package serialises Go values to JSON and back. You map JSON field names to struct fields using struct tags like <code>json:"user_name"</code>. Unexported fields are always ignored. Two approaches: <code>json.Marshal/Unmarshal</code> for bytes, and <code>json.NewEncoder/NewDecoder</code> for streams.',
		mentalModel:
			"JSON decoding is like filling out a form from a dictionary. The dictionary has arbitrary keys; your form has fixed fields. Struct tags tell the decoder which dictionary key maps to which form field. Keys in the dictionary with no matching field are silently ignored.",
		codeExample: `package main

import (
	"encoding/json"
	"fmt"
	"log"
)

type User struct {
	ID        int    \`json:"id"\`
	Name      string \`json:"name"\`
	Email     string \`json:"email"\`
	Password  string \`json:"-"\`          // always omitted
	CreatedAt string \`json:"created_at,omitempty"\` // omit if empty
}

func main() {
	// Decode
	raw := \`{"id":1,"name":"Alice","email":"alice@example.com"}\`
	var u User
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%+v\n", u) // {ID:1 Name:Alice Email:alice@...}

	// Encode
	u.Password = "secret" // won't appear in output
	out, err := json.MarshalIndent(u, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(out))
}`,
		codeExplanation:
			'Struct tags control serialisation. <code>json:"-"</code> always excludes a field. <code>omitempty</code> excludes it when it\'s a zero value. Pass a pointer to <code>Unmarshal</code> (<code>&u</code>) — it needs to write to your struct. Use <code>json.NewDecoder(r.Body)</code> in HTTP handlers instead of reading the body into a byte slice first.',
		fromOtherLang:
			"Coming from Python: struct tags replace <code>@dataclass</code> field mappings or Pydantic validators. Coming from JS: no <code>JSON.parse</code> into an untyped object — decoding always produces a typed struct. Coming from Java: similar to Jackson annotations like <code>@JsonProperty</code>.",
		commonMistakes: [
			{
				title: "Unexported fields silently ignored",
				body: "Fields starting with a lowercase letter are unexported and always ignored by encoding/json — no error is given. If your JSON isn't serialising, check field names start with uppercase.",
			},
			{
				title: "Decoding into value vs pointer",
				body: "<code>json.Unmarshal(data, u)</code> silently does nothing useful. You must pass a pointer: <code>json.Unmarshal(data, &u)</code>.",
			},
		],
		relatedSlugs: ["structs", "error-handling", "http-handler"],
	},
	{
		slug: "packages",
		name: "Packages & modules",
		tagline: "Go's unit of code organisation — one directory, one package.",
		summary:
			"Every Go file belongs to a package, declared on the first line. A module is a collection of packages with a single version, defined by <code>go.mod</code>. Exported identifiers start with an uppercase letter; lowercase is package-private. Circular imports are forbidden.",
		mentalModel:
			"A package is a room in a building. Everything in the room can see everything else. Uppercase names are windows — visible from outside. Lowercase names are internal furniture — invisible from other rooms. The building's address is the module path in <code>go.mod</code>.",
		codeExample: `// go.mod
module github.com/you/myapp

go 1.22

// internal/user/user.go
package user

type User struct {
	ID   int
	Name string
}

// exported — uppercase
func New(id int, name string) *User {
	return &User{ID: id, Name: name}
}

// unexported — lowercase, package-private
func validate(u *User) bool {
	return u.Name != ""
}

// main.go
package main

import (
	"fmt"
	"github.com/you/myapp/internal/user"
)

func main() {
	u := user.New(1, "Alice")
	fmt.Println(u.Name)
	// user.validate(u) — compile error: unexported
}`,
		codeExplanation:
			"The module path in <code>go.mod</code> is the root of all import paths. <code>internal/</code> packages can only be imported by code within the same module. Uppercase = exported, lowercase = package-private — that's the entire visibility system.",
		fromOtherLang:
			"Coming from Python: packages are closer to Python modules, but there's no <code>__init__.py</code> and no relative imports. Coming from JS: similar to ES modules, but visibility is by name case rather than explicit export lists. Coming from Java: packages are directories, and visibility is uppercase/lowercase rather than <code>public/private</code>.",
		commonMistakes: [
			{
				title: "Circular imports",
				body: "Package A importing B which imports A is a compile error. The fix is usually to extract the shared type into a third package that both A and B import.",
			},
			{
				title: "Putting everything in main",
				body: "As projects grow, keeping all code in <code>package main</code> makes testing nearly impossible. Extract logic into sub-packages early — they're easier to test in isolation.",
			},
		],
		relatedSlugs: ["structs", "interfaces", "error-handling"],
	},
]

export function getConcept(slug: string): Concept | undefined {
	return concepts.find((c) => c.slug === slug)
}

export function getConceptsBySlug(slugs: string[]): Concept[] {
	return slugs
		.map((s) => concepts.find((c) => c.slug === s))
		.filter(Boolean) as Concept[]
}
