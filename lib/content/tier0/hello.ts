import { Tier0Lesson } from "../../content"

export const hello: Tier0Lesson = {
	slug: "hello",
	order: 1,
	title: "Run your first Go program",
	tagline: "package main, func main, and why Go makes you compile.",
	estimatedMinutes: 10,
	intro: [
		{
			type: "text",
			value: {
				en: "In Python or JavaScript you type a line and run it. Go doesn't work that way: Go compiles your whole program to a native binary before anything executes. There is no interpreter and no virtual machine at runtime. That's why Go programs start instantly and ship as a single file, and it's why every Go program needs two things: a <code>package main</code> declaration and a <code>func main()</code> entry point. The compiler has to know where execution starts.",
			},
		},
		{
			type: "text",
			value: {
				en: "Here is the smallest useful Go program. Work inside the <code>hello</code> folder you created on the setup page; it already has the <code>go.mod</code> file the build commands below need. Type the program out yourself in a file called <code>main.go</code>. Typing, not pasting, is the point of every lesson in this track.",
			},
		},
	],
	program: `package main

import "fmt"

func main() {
	fmt.Println("hello from a compiled binary")
	fmt.Println(40 + 2)
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Three lines matter. <code>package main</code> says this file compiles to an executable, not a library. <code>import \"fmt\"</code> pulls in the standard library's formatting package; there is no global <code>print</code>, everything lives in a package. <code>func main()</code> is the entry point: when the binary starts, this function runs, and when it returns, the program exits.",
			},
		},
		{
			type: "text",
			value: {
				en: "Run it two ways from a terminal in the same directory:",
			},
		},
		{
			type: "code",
			value: `go run main.go     # compile to a temp location and run, one step
go build           # produce a binary, named from go.mod's module path
./hello            # run it: no Go installation needed on this machine`,
		},
		{
			type: "text",
			value: {
				en: "<code>go run</code> is for development. <code>go build</code> is the real product: a self-contained native executable you can copy to a server that has never heard of Go. That single-binary deploy is a large part of why Go took over infrastructure tooling.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "Now break it, deliberately. Delete both <code>fmt.Println</code> lines, leave the import, and run again. The compiler refuses: <em>\"fmt\" imported and not used</em>. An unused import is a compile error in Go, not a warning. The language enforces the cleanup other ecosystems leave to linters.",
			},
		},
	],
	retrievalPrompts: [
		"What do package main and func main() each do, and what happens when func main returns? || package main marks the file as compiling to an executable rather than a library. func main() is the entry point the binary starts in. When it returns, the process exits, taking any still-running background work with it.",
		"What is the difference between go run and go build? || go run compiles to a temporary location and executes immediately: a development loop. go build produces a self-contained native binary in the current directory that runs on machines without Go installed.",
		"You import a package and don't use it. What happens and why? || Compile error, not a warning. Go treats unused imports (and unused local variables) as errors so dead references never accumulate; the compiler enforces what linters only suggest elsewhere.",
	],
}
