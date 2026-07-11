import { Concept } from "../../content"

export const httpHandler: Concept = {
	slug: "http-handler",
	name: "HTTP handlers",
	tagline:
		"The http.Handler interface: everything in Go's HTTP server is just this.",
	summary:
		"Go's entire HTTP server is built on one interface: <code>http.Handler</code>, which has a single method <code>ServeHTTP(ResponseWriter, *Request)</code>. Middleware is just a function that wraps one handler with another. This simplicity means the standard library is all you need for production-grade HTTP servers.",
	mentalModel:
		"Think of each HTTP handler as a function booth at a fair. The booth receives a request ticket and a response envelope. It reads the ticket, does work, and seals the envelope. Middleware is a booth that passes the envelope to another booth first, adding a stamp (auth check, log entry, rate limit) before or after.",
	retrievalPrompts: [
		"Write the http.Handler interface from memory. How many methods, and what are their signatures? || type Handler interface { ServeHTTP(ResponseWriter, *Request) }: one method. ResponseWriter is also an interface. The entire HTTP ecosystem (middleware, routers, frameworks) is built on this single method.",
		"Write a middleware function that logs request duration. What type does it accept and return? || It accepts http.Handler (the next handler) and returns http.Handler. Inside: record start := time.Now(), call next.ServeHTTP(w, r), then log time.Since(start). Wrap the logic with http.HandlerFunc to convert the function to a Handler.",
		"You write response headers after calling next.ServeHTTP(w, r). What happens, and why? || The headers are silently ignored. Once ServeHTTP is called, the inner handler likely called w.WriteHeader or wrote the body; both flush the status line and headers. HTTP responses are streamed; you cannot unsend headers. Always set headers before calling next.",
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
		"<code>http.HandlerFunc</code> is an adapter that converts a function with the right signature into an <code>http.Handler</code>. Middleware wraps the inner handler by calling <code>next.ServeHTTP</code> in the middle. You can chain as many wrappers as you need: <code>withAuth(withLogging(handler))</code>.",
	designRationale:
		"Go's HTTP server is built on a single interface (<code>http.Handler</code> with one method) because a minimal abstraction lets middleware be plain function composition rather than a framework-specific mechanism. A function with the right signature becomes a handler via <code>http.HandlerFunc</code>; a handler that wraps another handler is middleware. There is no registration system, no annotation, no magic. The entire middleware stack is visible as nested function calls in <code>main</code>.",
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
}
