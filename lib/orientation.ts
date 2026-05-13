import { ContentBlock } from "./content"

export type OrientationPage = {
	slug: string
	order: number
	title: string
	tagline: string
	estimatedMinutes: number
	blocks: ContentBlock[]
	// Only ready-check uses these; left undefined elsewhere.
	retrievalPrompts?: string[]
	cta?: { href: string; label: string }
}

// Inline-link styling for concept and external links inside text blocks.
// Kept identical across all orientation pages so links read consistently.
const LINK = "text-go-cyan underline decoration-go-cyan/40 hover:no-underline"

export const orientationPages: OrientationPage[] = [
	{
		slug: "what-is-go",
		order: 1,
		title: "Is Go right for you right now?",
		tagline:
			"What Go is built for, what it isn't, and how to know if it's the right tool for the work you actually do.",
		estimatedMinutes: 4,
		blocks: [
			{
				type: "text",
				value: { en: "Go is a small, statically-typed language built by Google in 2009. It was designed for a specific kind of work — and that's the most important thing to know before you commit to learning it." },
			},
			{
				type: "text",
				value: { en: "Go's sweet spot is <strong>code that runs on a server</strong>. The language was built by engineers who needed reliable backend services, and that bias shows up on every page of the language spec." },
			},
			{
				type: "text",
				value: { en: "<strong>Where Go shines:</strong>" },
			},
			{
				type: "list",
				items: [
					{ en: "Backend services — HTTP APIs, gRPC, microservices. The standard library alone gets you a production-grade web server." },
					{ en: "CLIs and developer tools — Docker, Kubernetes, Terraform, Hugo, and most of the modern cloud-native ecosystem are written in Go." },
					{ en: "Concurrent systems — goroutines and channels make concurrency feel native, not bolted on." },
					{ en: "Deployment simplicity — Go compiles to a single static binary. No runtime, no interpreter, no dependency hell." },
					{ en: "Stable, long-lived codebases — the language barely changes. Code written in 2015 still compiles cleanly today." },
				],
			},
			{
				type: "text",
				value: { en: "<strong>Where Go is the wrong tool:</strong>" },
			},
			{
				type: "list",
				items: [
					{ en: "Mobile UI — there's no native UI toolkit. Use Swift, Kotlin, React Native, or Flutter." },
					{ en: "Data science and ML — the ecosystem is thin. Python's libraries dominate for a reason." },
					{ en: "Game engines and graphics-heavy desktop apps — Go's runtime and GC aren't optimized for frame-rate-sensitive work." },
					{ en: "Tiny one-off scripts — Bash, Python, or Node are faster to write for throwaway glue code." },
					{ en: "Frontend web — that's JavaScript and TypeScript's turf." },
				],
			},
			{
				type: "callout",
				variant: "info",
				value: { en: "If you're here for backend services, CLIs, or systems work — keep going. If your day job is mobile, ML, or frontend, you might find another language fits the work better." },
			},
		],
	},
	{
		slug: "reading-go",
		order: 2,
		title: "What Go code looks like",
		tagline:
			"A short annotated program — not a syntax tutorial. What to notice before you start writing it.",
		estimatedMinutes: 6,
		blocks: [
			{
				type: "text",
				value: { en: "Below is a complete Go program — a tiny HTTP server. Read it once. Don't worry about syntax you don't recognize yet; that comes later. Focus on the shape." },
			},
			{
				type: "code",
				filename: "main.go",
				value: `package main

import (
	"fmt"
	"log"
	"net/http"
)

type server struct {
	greeting string
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "stranger"
	}
	fmt.Fprintf(w, "%s, %s!\\n", s.greeting, name)
}

func main() {
	s := &server{greeting: "Hello"}
	mux := http.NewServeMux()
	mux.Handle("/", s)
	log.Println("listening on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}`,
			},
			{
				type: "text",
				value: { en: "Now look at what's worth noticing — not the mechanics, the choices the program makes." },
			},
			{
				type: "text",
				value: { en: `<strong>It's small.</strong> Twenty-five lines run a real HTTP server. No framework, no setup, no boilerplate. The whole web stack is in the standard library — <a href="/concepts/http-handler" class="${LINK}">net/http</a> ships with every Go install.` },
			},
			{
				type: "text",
				value: { en: `<strong>The server is a struct with a method.</strong> No class, no inheritance — just a <a href="/concepts/structs" class="${LINK}">struct</a> holding data and a method attached to it. That's how Go models "objects."` },
			},
			{
				type: "text",
				value: { en: `<strong>Nobody declares that <code>server</code> implements <code>http.Handler</code>.</strong> Because the type happens to have a <code>ServeHTTP</code> method with the right signature, Go considers the contract satisfied. This is <a href="/concepts/interfaces" class="${LINK}">interface satisfaction by implication</a> — one of Go's defining choices.` },
			},
			{
				type: "text",
				value: { en: `<strong>Errors travel as return values.</strong> Look at <code>if err := http.ListenAndServe(...)</code>. There's no try/catch in the language. Every fallible function returns an <code>error</code> alongside its result, and the caller decides what to do. That's <a href="/concepts/error-handling" class="${LINK}">error handling as values</a>, and you'll see this pattern on nearly every page.` },
			},
			{
				type: "text",
				value: { en: `<strong>The imports are explicit.</strong> Three lines, three packages — and Go won't compile if you import something you don't use. The compiler's strictness here pushes you toward small, intentional dependencies. See <a href="/concepts/packages" class="${LINK}">packages</a>.` },
			},
			{
				type: "text",
				value: { en: "Don't try to read this as code yet — you'll fight the syntax and miss the structure. Read it as architecture. After the syntax pages, the syntax becomes invisible, and these design choices are what you'll see." },
			},
		],
	},
	{
		slug: "surprises",
		order: 3,
		title: "Five things that will surprise you",
		tagline:
			"Design decisions that will trip you up if you're coming from another language.",
		estimatedMinutes: 7,
		blocks: [
			{
				type: "text",
				value: { en: "Five design decisions that catch most newcomers off guard. None are accidents — Go's authors chose each one deliberately, often in reaction to languages they had worked in before." },
			},
			{
				type: "text",
				value: { en: `<strong>1. No exceptions. Errors are values.</strong> Go has no <code>try</code>/<code>catch</code>/<code>throw</code>. Functions that can fail return an <code>error</code> alongside their result, and the caller checks it explicitly. This makes every failure path visible in the function signature — and yes, you will write <code>if err != nil</code> a lot. That verbosity is the point.<br/><em class="text-faint">If this is new, see: <a href="/concepts/error-handling" class="${LINK}">error handling</a>.</em>` },
			},
			{
				type: "text",
				value: { en: `<strong>2. No classes. No inheritance.</strong> Go has structs (data) and methods (behavior attached to a type), but nothing called a class. There's no <code>extends</code>. Shared behavior comes from embedding one type inside another, or from satisfying an interface. If you're coming from Java, C#, or Python, your first instinct will be to look for class hierarchies — there aren't any, and once that clicks the code gets simpler.<br/><em class="text-faint">If this is new, see: <a href="/concepts/structs" class="${LINK}">structs</a> and <a href="/concepts/interfaces" class="${LINK}">interfaces</a>.</em>` },
			},
			{
				type: "text",
				value: { en: `<strong>3. Capitalization controls visibility.</strong> If an identifier starts with an uppercase letter, it's exported (visible to other packages). Lowercase, it's private to its package. No <code>public</code>, <code>private</code>, or <code>export</code> keywords — just the first letter of the name. Renaming a field from <code>name</code> to <code>Name</code> changes its visibility across the whole codebase.<br/><em class="text-faint">If this is new, see: <a href="/concepts/packages" class="${LINK}">packages</a>.</em>` },
			},
			{
				type: "text",
				value: { en: `<strong>4. Every type has a zero value, and it's usable.</strong> An <code>int</code> starts at 0. A string starts at the empty string. A struct starts with every field at its own zero value. You rarely need constructors — declaring a variable gives you something safe to use immediately. This eliminates a whole category of "uninitialized state" bugs.<br/><em class="text-faint">If this is new, see: <a href="/concepts/structs" class="${LINK}">structs</a>.</em>` },
			},
			{
				type: "text",
				value: { en: `<strong>5. <code>gofmt</code> ends formatting debates.</strong> Go ships with an official formatter, and the community uses it without exception. Tabs vs spaces, brace placement, line length — all decided. Every Go codebase you read is formatted the same way, because the tool runs on save and nobody bikesheds about it.<br/><em class="text-faint">If this is new, you'll see <code>gofmt</code> in the setup page — just trust it and don't fight it.</em>` },
			},
			{
				type: "text",
				value: { en: "If any of these feel wrong to you right now, good. Sit with that discomfort. Go's design is opinionated on purpose, and the parts that feel uncomfortable at first are usually the parts you'll appreciate most later." },
			},
		],
	},
	{
		slug: "setup",
		order: 4,
		title: "Install Go and run your first program",
		tagline:
			"Get Go installed, write a 5-line program, run it. No project structure, no frameworks.",
		estimatedMinutes: 8,
		blocks: [
			{
				type: "text",
				value: { en: "This page takes you from zero to a running Go program. Three commands and a five-line file." },
			},
			{
				type: "text",
				value: { en: `<strong>1. Install Go.</strong> Download the installer for your OS from <a href="https://go.dev/dl" target="_blank" rel="noopener" class="${LINK}">go.dev/dl</a>. The site walks you through it — the steps differ enough between Windows, macOS, and Linux that linking is more honest than reproducing them here.` },
			},
			{
				type: "text",
				value: { en: "<strong>2. Verify the install.</strong> Open a terminal and run:" },
			},
			{
				type: "code",
				value: "go version",
			},
			{
				type: "text",
				value: { en: "You should see output like <code>go version go1.22.0 darwin/arm64</code>. The exact version doesn't matter — anything 1.20 or newer works for this site." },
			},
			{
				type: "callout",
				variant: "warning",
				value: { en: "If go isn't found, your PATH isn't set — see go.dev/doc/install for the steps specific to your OS." },
			},
			{
				type: "text",
				value: { en: "<strong>3. Create a module.</strong> Make a directory and initialize it:" },
			},
			{
				type: "code",
				value: `mkdir hello && cd hello
go mod init example/hello`,
			},
			{
				type: "text",
				value: { en: "This creates a <code>go.mod</code> file — Go's package manifest. The path <code>example/hello</code> is just a name; for real projects you'd use something like <code>github.com/you/project</code>." },
			},
			{
				type: "text",
				value: { en: "<strong>4. Write the program.</strong> Save the following as <code>main.go</code> in the same directory:" },
			},
			{
				type: "code",
				filename: "main.go",
				value: `package main

import "fmt"

func main() {
	fmt.Println("hello from Go")
}`,
			},
			{
				type: "text",
				value: { en: "<strong>5. Run it.</strong>" },
			},
			{
				type: "code",
				value: "go run .",
			},
			{
				type: "text",
				value: { en: "You should see <code>hello from Go</code>. That's the full loop — write code, run it, see output. Same loop you'll use for every project on this site." },
			},
		],
	},
	{
		slug: "learn-syntax",
		order: 5,
		title: "Where to learn Go syntax",
		tagline:
			"Two official resources, when to use each, and a checklist for when you're ready to leave.",
		estimatedMinutes: 4,
		blocks: [
			{
				type: "text",
				value: { en: "GoPath teaches you to build with Go, not to write Go from scratch. For the actual syntax — variables, loops, function declarations, struct definitions — use one of the two resources below and come back when you can read Go without squinting." },
			},
			{
				type: "text",
				value: { en: `<strong>1. Tour of Go</strong> — <a href="https://go.dev/tour" target="_blank" rel="noopener" class="${LINK}">go.dev/tour</a>` },
			},
			{
				type: "text",
				value: { en: "Interactive, runs in the browser, no setup required. Best if you've never written Go before, or if your last attempt was years ago. Work through it linearly — it's short, roughly two hours start to finish. Don't skip the exercises; that's where the patterns stick." },
			},
			{
				type: "text",
				value: { en: `<strong>2. Go by Example</strong> — <a href="https://gobyexample.com" target="_blank" rel="noopener" class="${LINK}">gobyexample.com</a>` },
			},
			{
				type: "text",
				value: { en: "Flat reference, one concept per page, copy-pasteable. Best if you've written Java, C#, Rust, Python, or similar, and just need to look up \"how does Go do X.\" Use it as a sidecar — keep a tab open while you work through the projects here." },
			},
			{
				type: "text",
				value: { en: "<strong>Before starting Tier 1, you should be able to:</strong>" },
			},
			{
				type: "list",
				items: [
					{ en: "Declare variables, write functions, and write a for loop without looking anything up." },
					{ en: "Define a struct and add a method to it." },
					{ en: "Read code that returns (value, error) and handle the error correctly." },
					{ en: "Define a simple interface and write a type that satisfies it." },
					{ en: "Initialize a slice and a map, and iterate over them with range." },
				],
			},
			{
				type: "callout",
				variant: "info",
				value: { en: "If you can't do all five from memory, go back to Tour of Go. The projects assume you can read Go before you start writing it; nothing on this site teaches syntax in the project body." },
			},
		],
	},
	{
		slug: "ready-check",
		order: 6,
		title: "Are you ready for Tier 1?",
		tagline:
			"Five retrieval prompts. If you can answer all of them without looking, you're ready.",
		estimatedMinutes: 5,
		blocks: [
			{
				type: "text",
				value: { en: "Five questions. Answer each one in your head — out loud is better — before flipping the card. If you can answer all five without looking anything up, you're ready for Tier 1." },
			},
			{
				type: "text",
				value: { en: `If you stall on more than one, go back to <a href="/orientation/learn-syntax" class="${LINK}">learn-syntax</a> and spend another hour with Tour of Go. The projects assume this baseline.` },
			},
		],
		retrievalPrompts: [
			"Without looking: what does `:=` do, and how is it different from `var x = ...`? || `:=` is short variable declaration — it declares a new variable and infers its type from the right-hand side. `var x = ...` does the same inference but is a full declaration usable at package scope (`:=` only works inside functions). In practice you'll use `:=` for nearly every local variable.",
			"If a function returns `(string, error)`, what's the idiomatic way to call it? || `s, err := fn()` immediately followed by `if err != nil { return ... }` (or some other handling). Always check the error before using the value — the value is only meaningful when err is nil. Ignoring the error with `_` is a code smell unless you're certain the error can't happen.",
			"Write the syntax for a method on a struct type Counter that increments a field. Why does the receiver type matter? || `func (c *Counter) Inc() { c.count++ }`. The `*Counter` pointer receiver matters because a value receiver would receive a copy — the increment would mutate the copy, and the caller's Counter would be unchanged. For any method that mutates state, use a pointer receiver.",
			"Write a tiny interface Greeter with one method `Greet() string`, then a type that satisfies it. How does the type declare satisfaction? || `type Greeter interface { Greet() string }`. Any type with a matching `Greet() string` method automatically satisfies it — there's no `implements` keyword. For example: `type Bot struct{}` and `func (b Bot) Greet() string { return \"hi\" }`. Bot is now a Greeter, no declaration needed.",
			"Initialize a slice of strings and a map from string to int, then write a for loop that iterates over the map. || Slice: `s := []string{\"a\", \"b\"}`. Map: `m := map[string]int{\"a\": 1}`. To iterate: `for k, v := range m { ... }`. Range works the same on slices but yields (index, value) instead. Map iteration order is randomized — never rely on it.",
		],
		cta: {
			href: "/projects/cli-renamer",
			label: "I'm ready — start Tier 1 →",
		},
	},
]

export function getOrientationPage(slug: string): OrientationPage | undefined {
	return orientationPages.find((p) => p.slug === slug)
}
