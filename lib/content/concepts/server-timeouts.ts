import { Concept } from "../../content"

export const serverTimeouts: Concept = {
	slug: "server-timeouts",
	name: "Server timeouts",
	tagline:
		"The zero value of http.Server has no deadlines at all, and two of the four fall back.",
	summary:
		"<code>&http.Server{Handler: mux}</code> has no timeouts. Not generous ones: none. A client can complete the handshake, send one byte of a header, and hold a goroutine and a file descriptor indefinitely. The four fields that fix it (<code>ReadHeaderTimeout</code>, <code>ReadTimeout</code>, <code>WriteTimeout</code>, <code>IdleTimeout</code>) answer four different questions and are not interchangeable, and two of them silently borrow another's value when you leave them out.",
	mentalModel:
		"A deadline is the only thing that ever ends a connection. Everything else about a request is under your control, but how long a stranger holds your socket is not, and the zero value's answer to that is \"forever\". Think of the four fields as four separate clocks on four separate phases: getting the headers in, getting the body in, getting the response out, and sitting idle between requests on a kept-alive connection. Setting one clock does not start the others, and a clock you did not set is either not running or has quietly been handed a number that was chosen to time something else.",
	retrievalPrompts: [
		"You set ReadTimeout and skipped ReadHeaderTimeout. Slow-header clients still get hung up on. Is that fine? || No. ReadHeaderTimeout falls back to ReadTimeout when it is zero, so the header phase is now bounded by the number you chose for an entire upload, typically tens of seconds. You get a hang-up eventually rather than promptly, and every silent connection costs you a goroutine and a descriptor for the length of your upload budget. The fallback hides the missing field, it does not replace it.",
		"WriteTimeout is 5 seconds. A legitimate request takes 6 seconds of handler work. What does the client see, and why? || The connection dies before the response ships, and the client cannot tell that apart from a crash. WriteTimeout's clock is reset when a new request's header is read, which means it starts before your handler does, so it bounds the handler and the write together rather than just the write. It is the one of the four you have to think about instead of copying: it must exceed your slowest honest response.",
		"You have set all four deadlines correctly. Which attack do they still not stop? || A body that is large rather than slow. None of the four bounds the size of a request body, only the time spent reading it, so a client on a fast link can stream you gigabytes well inside ReadTimeout. http.MaxBytesReader is the answer, per handler. The timeouts are the connection's clock, not its budget.",
	],
	codeExample: `package main

import (
	"fmt"
	"net"
	"net/http"
	"time"
)

func main() {
	// Four fields, four different questions. Every one you leave out is not
	// "a sensible default", it is no deadline at all, or a silent fallback to
	// a number that was chosen to answer a different question.
	srv := &http.Server{
		Handler:           http.NotFoundHandler(),
		ReadHeaderTimeout: 150 * time.Millisecond, // headers only: nothing honest is slow here
		ReadTimeout:       1 * time.Second,        // headers AND body: must fit your largest upload
		WriteTimeout:      1 * time.Second,        // clock starts before your handler: bounds the HANDLER
		IdleTimeout:       2 * time.Second,        // keep-alive, between requests
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	go srv.Serve(ln)
	defer srv.Close()

	// A client that completes the TCP handshake and then says nothing at all.
	// This is Slowloris. It costs the attacker one socket and no bandwidth.
	conn, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	start := time.Now()
	conn.Read(make([]byte, 1)) // blocks until the server gives up on us
	fmt.Printf("server hung up after %v\\n", time.Since(start).Round(50*time.Millisecond))
}`,
	codeExplanation:
		"This prints <code>server hung up after 150ms</code>, which is <code>ReadHeaderTimeout</code> doing its job against a client that connected and then said nothing. The interesting part is what happens when you delete a line. Remove <code>ReadHeaderTimeout</code> and it still hangs up, but after <code>1s</code>: net/http's <code>readHeaderTimeout()</code> returns <code>ReadTimeout</code> when the field is zero, so the header phase is now bounded by the number you picked for a whole upload. Remove <code>ReadTimeout</code> as well and the program never prints at all, because nothing is left to end the connection. That progression is the reason to set all four explicitly. Here the fallback is harmless because both numbers are small, but in a real config <code>ReadTimeout</code> is 30 seconds because a body needs it, so the same fallback hands every silent client a 30 second hold on a goroutine and a descriptor. <code>IdleTimeout</code> falls back the same way. A test that only checks behaviour cannot tell you which of the four you actually wired, because a fallback satisfies it: only asserting on the fields can.",
	designRationale:
		"The zero value being unbounded is not an oversight, it is Go's zero-value philosophy meeting a decision the standard library cannot make for you. A useful default would have to guess your slowest legitimate upload and your slowest legitimate handler, and a guess that is too low breaks correct programs in a way that looks like a network fault. So <code>http.Server</code> does what the rest of the language does and ships a zero value that is usable immediately, which for a server means it serves, and leaves the policy to you. The cost of that consistency is that the safe configuration is the one you have to opt into, and the unsafe one is what you get from the tutorial. The fallbacks exist for a related reason: <code>ReadTimeout</code> came first, and <code>ReadHeaderTimeout</code> and <code>IdleTimeout</code> were added later (in Go 1.8), so falling back to <code>ReadTimeout</code> was how existing programs kept their behaviour when the new fields appeared. That is good compatibility engineering and a bad mental model, because it means \"I set a timeout\" is an unreliable sentence: a field you never set can still be bounding traffic, at a value chosen for something else.",
	commonMistakes: [
		{
			title: "Using the zero value in production",
			body: "<code>&http.Server{Handler: mux}</code> and <code>http.ListenAndServe(addr, mux)</code> both have no deadlines whatsoever. That is Slowloris: no bandwidth, no botnet, and no vulnerability, just the defaults and a laptop opening ten thousand connections that each send one byte.",
		},
		{
			title: "Setting only ReadTimeout and assuming you are covered",
			body: "<code>ReadHeaderTimeout</code> and <code>IdleTimeout</code> both fall back to <code>ReadTimeout</code> when they are zero, so one value ends up bounding three different phases. It is by construction the wrong number for at least two of them, and everything still passes a behavioural test because the fallback does hang up eventually.",
		},
		{
			title: "Copying a small WriteTimeout from a blog post",
			body: "Its clock is reset when the request header is read, so it starts before your handler runs and bounds the handler, not just the write. Set it to 5 seconds and every legitimate 6 second request dies without a response. It has to exceed your slowest honest handler, which makes it the one number here you cannot copy from anyone.",
		},
		{
			title: "Setting ReadHeaderTimeout looser than ReadTimeout",
			body: "During the header phase the connection's read deadline is <code>ReadHeaderTimeout</code> alone; <code>ReadTimeout</code> is not applied until the headers are in. So a looser ReadHeader does not get clamped by Read, it overrides it, and a silent client holds the connection for the longer of the two while Read looks like a bound you have and do not.",
		},
		{
			title: "Thinking the four deadlines bound request size",
			body: "They bound time, not bytes. A fast client can stream gigabytes inside <code>ReadTimeout</code> and every deadline is respected. <code>http.MaxBytesReader</code> is the size bound, and it goes per handler because only the handler knows what a reasonable body is for that route.",
		},
	],
	relatedSlugs: ["graceful-shutdown", "http-handler", "structs", "context"],
}
