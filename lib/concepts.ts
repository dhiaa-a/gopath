export type Concept = {
	slug: string
	name: string
	tagline: string
	summary: string
	mentalModel: string
	retrievalPrompts: string[]
	codeExample: string
	codeExplanation: string
	designRationale: string
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
		retrievalPrompts: [
			"Without looking at any code, write a function that opens a file and returns its contents as a string — including every place it can fail and what the caller receives.",
			"What is the difference between `fmt.Errorf(\"context: %v\", err)` and `fmt.Errorf(\"context: %w\", err)`? When does the distinction matter to the caller?",
			"A colleague proposes replacing all `if err != nil { return err }` blocks with `panic(err)` to reduce verbosity. What breaks in production?",
		],
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
		designRationale:
			"Go has no exceptions because exceptions hide control flow — a function can fail invisibly without that failure appearing anywhere in its signature. Errors are ordinary values so every failure path is visible in the type system: if a function can fail, its return type says so. This is deliberately verbose — the verbosity is the point, forcing every call site to declare what it does with failure rather than letting it propagate silently.",
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
		retrievalPrompts: [
			"Define an interface called `Stringer` that describes something that can format itself as a string. Now write two different types that satisfy it — without declaring anywhere that they implement the interface.",
			"A function accepts `io.Writer`. Name three types from the standard library that satisfy this interface, and explain why none of them import the `io` package to declare it.",
			"You define an interface and a struct in the same package. The struct has the method on a pointer receiver. Which of these satisfies the interface: `T` or `*T`? Why?",
		],
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
		designRationale:
			"Go interfaces are satisfied implicitly because the designers wanted to decouple the definition of an abstraction from the types that satisfy it — a type should not need to know about every interface it fits. This means a library can define an interface and any existing type with the right methods satisfies it without modification. The result is composition without inheritance: behaviour is shared through method sets, not class hierarchies.",
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
		retrievalPrompts: [
			"What happens to a goroutine if `main()` returns before the goroutine finishes? What is the correct way to wait for it?",
			"You launch 100 goroutines and each one appends a value to a shared slice. Describe what goes wrong and give two ways to fix it.",
			"A goroutine is blocked waiting to receive from a channel that nobody will ever write to. What is this called, and how do you prevent it?",
		],
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
		designRationale:
			"Go was designed for servers, and servers must handle many concurrent requests without allocating an OS thread per request. Goroutines are the answer: a scheduling abstraction so cheap — a few kilobytes of initial stack — that spawning one per request is the idiomatic approach. The runtime multiplexes goroutines onto OS threads automatically, so the programmer expresses concurrency naturally without managing thread pools. Concurrency is not a library added later; it is built into the language because the designers expected it to be used pervasively.",
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
		retrievalPrompts: [
			"Two goroutines share an unbuffered channel. Goroutine A sends, goroutine B receives. Which one blocks first, and what makes it unblock?",
			"When should you close a channel, and which goroutine should do it? What happens if you send to a channel after closing it?",
			"When is a channel the right tool for coordinating goroutines, and when is a mutex simpler? Give a concrete rule.",
		],
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
		designRationale:
			"Go adopted CSP (Communicating Sequential Processes) as its concurrency model because shared memory leads to data races that are difficult to reason about under concurrent access. Channels transfer ownership of a value from one goroutine to another, so only one goroutine holds the value at a time — eliminating the need for locks on the data itself. The language proverb captures the intent: don't communicate by sharing memory; share memory by communicating.",
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
		retrievalPrompts: [
			"Write `openAndRead(path string)` from memory. Where exactly do you place the `defer f.Close()` call, and why does position matter?",
			"A function has three deferred calls registered in order A, B, C. What order do they execute in, and why?",
			"You write `defer f.Close()` inside a loop that opens 100 files. When do the 100 Close calls actually happen? What is the correct fix?",
		],
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
		designRationale:
			"Go's designers wanted resource cleanup to be written at the same point as resource acquisition — not duplicated across every early-return path. Without defer, adding an error return means remembering to insert a cleanup call before it; missing one leaks the resource. Defer registers the cleanup immediately and guarantees it runs on function exit regardless of how the function returns. LIFO ordering ensures nested resources — open a file, then acquire a lock — are released in the correct reverse sequence.",
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
		retrievalPrompts: [
			"You pass a struct with a `Name string` field to a function that sets `Name = \"changed\"`. Back in the caller, what is the value of `Name`? When would your answer be different?",
			"What is the zero value of a struct with fields `Count int`, `Label string`, `Active bool`? Is this struct safe to use without initialization?",
			"Explain embedding in Go using `type Employee struct { Person }`. What does it give you, and how is it different from inheritance?",
		],
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
		designRationale:
			"Go chose composition over inheritance because class hierarchies create tight coupling that becomes expensive to refactor as requirements change. Structs have methods but no parent class — shared behaviour comes from embedding and interfaces, which can be changed independently. Structs are value types by default so passing them to functions is explicit about copying; you opt into reference semantics with a pointer. Zero values are a first-class design choice: every struct is usable immediately without a constructor, eliminating a whole category of uninitialized-state bugs.",
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
		retrievalPrompts: [
			"Write two methods on `Counter`: one with a value receiver that increments, one with a pointer receiver that increments. Call both from main. Which mutation persists and why?",
			"A function returns `*User`. Under what conditions should it return `nil`, and what must the caller do before using the returned pointer?",
			"All methods on `FileWriter` use pointer receivers. You accidentally define one method with a value receiver. What breaks, and where does the error appear?",
		],
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
		designRationale:
			"Go makes pointer semantics explicit because implicit reference passing hides whether a function can mutate its arguments — callers have no way to know without reading the implementation. Explicit pointers make mutation visible at the call site: <code>&x</code> signals 'this function may change x'. Go deliberately omits pointer arithmetic because a pointer's only legitimate uses are sharing a value across function boundaries and enabling mutation, not manual memory navigation.",
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
		retrievalPrompts: [
			"A context with a 3-second timeout is passed to a function that makes two sequential HTTP calls, each taking 2 seconds. What happens during the second call?",
			"Why is `context.Context` always the first parameter by convention? What does putting it first communicate to the reader?",
			"You store a context in a struct field and use it in a method called later. Why is this wrong, and what should you do instead?",
		],
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
		designRationale:
			"Go rejected thread-local storage and hidden ambient state because both make the flow of cancellation invisible — a cancelled request cannot propagate the signal to everything working on its behalf without explicit threading. Passing <code>context.Context</code> as the first argument makes deadlines and cancellation visible in the call graph and forces every function doing I/O to acknowledge them. The convention is enforced by idiom rather than the type system, which means any deviation is immediately visible during code review.",
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
		retrievalPrompts: [
			"After `b := a[1:4]`, you set `b[0] = 99`. Does `a` change? Why? Now you `append` five more elements to `b` beyond its capacity. Does `a` change now?",
			"A slice has length 3 and capacity 6. You append one element. What are the new length and capacity? You append four more. What happens?",
			"What is the practical difference between `var s []int` and `s := []int{}`? Give one situation where the difference matters.",
		],
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
		designRationale:
			"Go separated the concept of a view into data from ownership of data because copying large arrays on every function call would make Go unsuitable for systems programming. A slice — a three-field header of pointer, length, and capacity — is cheap to pass while leaving the underlying array in place. The aliasing behaviour is an explicit design trade-off: slices are deliberately lightweight descriptors, and understanding that two slices can share memory is part of the expected mental model.",
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
		retrievalPrompts: [
			"You declare `var m map[string]int` and then read `m[\"key\"]`. What do you get? Now you write `m[\"key\"] = 1`. What happens?",
			"How do you distinguish between a key that is missing and a key whose value is `0`? Write the idiom from memory.",
			"Two goroutines each read from the same map at the same time. Is this safe? What if one reads while the other writes?",
		],
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
		designRationale:
			"Maps are reference types in Go because the designers observed that maps are almost always shared rather than copied — making them value types would silently copy large data structures on every function call. The zero value is <code>nil</code> rather than an empty map to force explicit initialization: Go prefers deliberate intent over convenient defaults when the default leads to a panic. Map iteration order is randomised on purpose so programs cannot accidentally depend on insertion order, which would be a latent bug waiting for the runtime to change.",
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
		retrievalPrompts: [
			"You call `wg.Add(1)` inside the goroutine instead of before launching it. Describe the race condition this creates.",
			"Why must you always pass `&wg` to functions and never copy the WaitGroup by value? What breaks if you copy it?",
			"A WaitGroup's counter reaches zero and `Wait()` returns. Then you call `wg.Add(1)` again. Is this valid? What constraint must hold for it to work?",
		],
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
		designRationale:
			"WaitGroup lives in the <code>sync</code> package rather than being a language built-in because Go's designers believe concurrency primitives should be composable library types rather than special syntax. The counter-based API — Add, Done, Wait — is minimal by design: it does exactly one thing and nothing else. Requiring a pointer instead of a value receiver is an enforced constraint; copying a WaitGroup resets the counter in the copy, which the race detector will catch and report.",
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
		retrievalPrompts: [
			"Two channels are both ready at the exact moment a `select` statement executes. Which case runs, and why?",
			"Write a `select` that tries to receive from `ch` but gives up and returns an error if nothing arrives within 2 seconds.",
			"What does a `select` with a `default` case do when no channel is ready? When is this useful, and when is it a performance problem?",
		],
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
		designRationale:
			"Select is the language-level answer to 'wait for whichever channel event arrives first', modelled on the POSIX <code>select</code> syscall for file descriptors. Without it, waiting on multiple channels simultaneously would require nested goroutines and additional synchronisation — complexity that belongs in the language, not in application code. When multiple cases are ready simultaneously, Go picks one at random to prevent starvation and to ensure programs are correct under any arrival order rather than relying on a specific one.",
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
		retrievalPrompts: [
			"Write the `http.Handler` interface from memory. How many methods does it have, and what are their signatures?",
			"Write a middleware function that measures and logs the duration of every request. What type does it accept and what type does it return?",
			"You write response headers after calling `next.ServeHTTP(w, r)`. What happens, and why?",
		],
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
		designRationale:
			"Go's HTTP server is built on a single interface — <code>http.Handler</code> with one method — because a minimal abstraction lets middleware be plain function composition rather than a framework-specific mechanism. A function with the right signature becomes a handler via <code>http.HandlerFunc</code>; a handler that wraps another handler is middleware. There is no registration system, no annotation, no magic — the entire middleware stack is visible as nested function calls in <code>main</code>.",
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
		retrievalPrompts: [
			"A struct field is `name string` (lowercase). Will `json.Marshal` include it in the output? What must you change, and why?",
			"You call `json.Unmarshal(data, user)` where `user` is a `User` value, not a pointer. What happens to your struct?",
			"What is the difference between `json:\"field,omitempty\"` and `json:\"-\"`? Give a concrete case where you'd use each.",
		],
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
		designRationale:
			"Go's JSON package uses struct tags — backtick string metadata on field declarations — because they keep the mapping between Go fields and JSON keys visible at the declaration site without code generation. The designers chose runtime reflection over compile-time codegen to keep the user-facing API simple: one package, two functions, no schema files. Unexported fields are always silently ignored because the package respects Go's visibility rules — if a field is not exported, it is not part of the type's public contract.",
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
		retrievalPrompts: [
			"Package A imports package B, which imports package C, which imports package A. What does the compiler do, and what is the correct fix?",
			"What makes an identifier in Go visible to other packages? Is there a keyword for this?",
			"What does placing code under `internal/` enforce, and which tool enforces it — the programmer, the linter, or the compiler?",
		],
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
		designRationale:
			"Go's visibility rule — uppercase exported, lowercase package-private — was chosen because it makes access control obvious from the identifier name without any modifier keyword, and it is enforced by the compiler rather than convention. Circular imports are forbidden at compile time to keep build graphs acyclic: a cycle means two packages are logically one package, and the fix is to extract the shared type into a third. The <code>internal/</code> directory convention enforces package boundaries within a module without additional tooling — the compiler rejects imports that violate it.",
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
