import { Concept } from "../../content"

export const initLifecycle: Concept = {
	slug: "init-lifecycle",
	name: "init and the package lifecycle",
	tagline:
		"Package variables initialise in dependency order, not the order you wrote them, and init() runs before main can stop it.",
	summary:
		"Before <code>main</code> runs, Go has already executed a large program you did not write: every imported package, depth first, then every package-level variable in <b>dependency</b> order rather than textual order, then every <code>init()</code> function. You cannot call an <code>init</code>, cannot skip one, cannot pass it anything, and cannot recover from one failing. That is why the interesting question about <code>init</code> is almost never \"what order does it run in\" but \"why is this work happening at import time at all\".",
	mentalModel:
		"Think of package initialisation as a build system, not a script. You do not write the order, you declare the dependencies and the toolchain topologically sorts them: a variable is initialised after everything it references and before everything that references it, and the order you typed is only the tiebreak between variables that do not depend on each other. <code>init()</code> functions are the exception that proves it, because they take no arguments and return nothing, so the compiler cannot see what they depend on. Nothing can be sorted, so they run in a fixed clerical order: after all the package's variables, in the order the go command happens to hand your files to the compiler.",
	retrievalPrompts: [
		"A colleague renames a file from apple.go to helpers.go. No code changes, and a test starts failing. How is that possible? || The package had more than one init(), and inits run in the order the go command presents files to the compiler, which is lexical file name order. Renaming a file moved its init() later, so an init that used to run first now runs after another one, and something depended on that ordering. Note what this really means: lexical order is a property of the go command, not the language. The spec only encourages build systems to present files in file name order, and you can prove it by compiling with an explicit file list (go run zebra.go apple.go main.go) and watching inits run in the order you typed instead. Ordering between inits is not something to fix, it is something to stop depending on.",
		"You have var timeout = flag.Duration(\"timeout\", time.Second, \"...\") at package level and read *timeout inside another package-level var. It is always the default, even when the flag is passed. Why? || Package-level variables are initialised before main runs, and flag.Parse() is called inside main. At the moment your second variable is initialised, the flag has been registered but no command line has been parsed, so it still holds the default. The dependency sort cannot save you here: it correctly ordered your two variables relative to each other, but flag.Parse() is not a dependency it can see. Anything that depends on runtime input (flags, env, config files, network) cannot be a package-level variable. Read it in main and pass it down.",
		"You add _ \"net/http/pprof\" to get profiling, change nothing else, and your public API starts serving /debug/pprof/. Who registered it, and what did you just expose? || pprof's init() calls http.DefaultServeMux.Handle for its routes. You never named the package, but a blank import runs its init(), and that init writes to a global mux. If you serve http.DefaultServeMux on your public listener you have just published goroutine dumps, command line arguments, and a CPU profiler that any stranger can start. The fix is not to drop the blank import: it is to stop serving DefaultServeMux, and bind pprof to a separate internal-only listener with its own mux.",
	],
	codeExample: `package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	_ "net/http/pprof" // never named again: imported purely for its init()
)

var order []string

func note(name, val string) string {
	order = append(order, name)
	return val
}

// Textual order here is c, a, b. Initialisation order is not textual.
var c = note("c", "c<-"+a)
var a = note("a", "a<-"+b)
var b = note("b", "b")

func init() { order = append(order, "init#1") }
func init() { order = append(order, "init#2") }

func main() {
	order = append(order, "main")
	fmt.Println("declared: c, a, b")
	fmt.Println("ran:     ", order)
	fmt.Println("values:   a =", a, "| b =", b, "| c =", c)

	// Nothing below mentions pprof. Its init() already ran and wrote to a global.
	req := httptest.NewRequest("GET", "/debug/pprof/", nil)
	_, pattern := http.DefaultServeMux.Handler(req)
	fmt.Printf("DefaultServeMux route for /debug/pprof/: %q\\n", pattern)
}`,
	codeExplanation:
		"This prints <code>ran: [b a c init#1 init#2 main]</code> from source that declares <code>c</code>, <code>a</code>, <code>b</code> in that order. The sort is not cosmetic, it is load bearing: <code>c</code> references <code>a</code> which references <code>b</code>, so <code>b</code> must go first or <code>c</code> would be built from an empty string. The values prove it ran correctly rather than merely differently: <code>c = c&lt;-a&lt;-b</code>. Notice what got sorted and what did not. The variables were reordered by dependency; the two <code>init</code> functions ran in the order written, after every variable, because an <code>init</code> takes no arguments and returns nothing so there is no dependency edge to sort on. Then <code>main</code>. The last line is the part worth staring at: it prints <code>\"/debug/pprof/\"</code>, a route this program never registered. The blank import ran <code>pprof</code>'s <code>init()</code>, which called <code>http.DefaultServeMux.Handle</code>, and that is the entire mechanism. This is the same trick <code>database/sql</code> drivers use, and it is why <code>_ \"github.com/lib/pq\"</code> is enough to make <code>sql.Open(\"postgres\", ...)</code> work. It is also why a stray import can change what your server exposes.",
	designRationale:
		"Dependency ordering exists because the alternative is worse. C solves this by making you not have the problem: initialisers must be constants, and anything else is your job to call in the right order from <code>main</code>. Java solves it with static initialisers that run in textual order and deadlock in interesting ways under concurrent class loading. Go's choice is to let initialisers be arbitrary expressions and then topologically sort them, which means you can write <code>var defaultClient = newClient(defaultConfig)</code> above <code>defaultConfig</code> and it simply works. The cost is that initialisation order is now an emergent property of your references rather than something visible on the page, and it becomes a genuine puzzle the moment there is a cycle the compiler rejects (<code>initialization cycle</code>) or a dependency the compiler cannot see, like <code>flag.Parse</code>. <code>init()</code> itself is older than most of what would replace it. It exists for the registration pattern: <code>database/sql</code> drivers, <code>image</code> decoders, and <code>encoding/gob</code> types all need to announce themselves to a registry before anyone asks, and Go has no annotations, no reflection-based classpath scanning, and no dependency injection container. The blank import is the honest admission of that design: <code>_ \"package\"</code> is a line whose entire purpose is a side effect, which is why it needs its own syntax and why <code>goimports</code> will not remove it. Modern Go is quietly moving away from all of this. <code>init</code> is untestable (you cannot call it, you cannot skip it, and it runs before your test's <code>TestMain</code>), unorderable across packages, and invisible at the call site, so the current idiom is an exported <code>New</code> that returns a value and an error to a caller who decides what to do. Prefer that. The registry pattern earned <code>init</code>; your config loader has not.",
	commonMistakes: [
		{
			title: "Depending on init order across packages",
			body: "Within a package you get file name order. Across packages you get \"after everything I import, before anything that imports me\", and nothing more: two packages that do not import each other have no defined order relative to each other. Code that works because package <code>a</code>'s init happened to run before package <code>b</code>'s will break when an unrelated import is added, and the failure looks like a nil map or a missing registry entry rather than an ordering bug.",

		},
		{
			title: "Reading flags, env, or config into a package-level var",
			body: "Package variables are initialised before <code>main</code> starts, so <code>flag.Parse()</code> has not run and your value is the default forever. <code>os.Getenv</code> is worse, because it does work: it reads the environment at import time, which silently makes the value untestable (no test can set it before init runs) and breaks the moment someone imports your package from a tool that sets the environment later.",
		},
		{
			title: "Doing fallible work in init()",
			body: "<code>init</code> cannot return an error, so the only way to report failure is <code>panic</code> or <code>log.Fatal</code>, and both take down every program that imports you, including <code>go test</code> and any unrelated tool that pulled in your package for one helper. Opening a database or dialling a service in <code>init</code> means your package cannot be imported by anything that does not have that database. Return an error from a constructor and let the caller decide.",
		},
		{
			title: "Blank-importing net/http/pprof into a public server",
			body: "The blank import registers <code>/debug/pprof/</code> on <code>http.DefaultServeMux</code>. If your public listener serves <code>DefaultServeMux</code>, and the one-line <code>http.ListenAndServe(addr, nil)</code> does exactly that, you have exposed heap and goroutine dumps and a remotely startable CPU profiler. The import is not the bug, sharing the mux is. Give pprof its own mux on a loopback-only listener.",
		},
		{
			title: "Assuming variables initialise top to bottom",
			body: "They initialise in dependency order, and textual order is only the tiebreak among independents. This bites when a variable's initialiser calls a function with a side effect, because now the side effect's position is decided by a reference graph rather than by the page. If the order matters enough to reason about, the work does not belong in a variable initialiser.",
		},
	],
	relatedSlugs: ["packages", "modules", "http-handler", "pointers"],
}
