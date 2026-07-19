import { Concept } from "../../content"

export const httpClient: Concept = {
	slug: "http-client",
	name: "The HTTP client",
	tagline:
		"http.DefaultClient has no timeout. Not a generous one: none. It is the most common way a Go service hangs.",
	summary:
		"<code>http.Get</code>, <code>http.Post</code> and <code>http.DefaultClient</code> all share one <code>&http.Client{}</code> whose <code>Timeout</code> is the zero value, and the field's own documentation says \"A Timeout of zero means no timeout.\" A dependency that accepts your connection and then goes quiet holds a goroutine until your process dies, and because a hang is not an error, nothing logs, nothing alerts and nothing retries. <code>Client.Timeout</code> is one line and covers the whole exchange. Two more things the API will not volunteer: a 500 is not an <code>error</code>, and closing <code>resp.Body</code> without draining it silently costs you the pooled connection.",
	mentalModel:
		"There are two objects here and conflating them is where the confusion starts. The <code>Client</code> is policy: how long am I willing to wait, do I follow redirects, which cookies. The <code>Transport</code> is machinery: connections, pooling, TLS, proxies. <code>Client.Timeout</code> is one clock over the entire exchange, dial through last byte of body; <code>Transport</code>'s timeouts are separate clocks on individual phases. Pooling lives entirely in the Transport, which is why a thousand Clients that share the default Transport share one pool, and why a single Client carrying a freshly constructed Transport shares nothing with anyone, including its own previous request.",
	retrievalPrompts: [
		"A dependency's box is up but wedged: it accepts connections and never replies. Your service calls it with http.Get. Your error rate stays at zero and your goroutine count climbs. Why? || http.Get uses http.DefaultClient, whose Timeout is 0, and 0 is not a default, it is no limit. Every call parks a goroutine forever, so there is nothing to log, error on or alert about: a hang is the absence of an event. Note this is strictly worse than the box being DOWN, which fails fast with connection refused. The fix is &http.Client{Timeout: n}, and http.Get can never have one.",
		"resp, err := c.Get(url); if err != nil { return err }; defer resp.Body.Close(). The server returns 500. What does your function return? || nil, plus whatever your decoder scraped off an error page. err is non-nil only when there was no reply at all: DNS, dial, timeout, protocol. A 500 is a reply, and from the client's point of view a successful one, so you must check resp.StatusCode yourself. The ordering above is also the reason the defer sits after the err check: on error the response is nil, so a defer placed one line earlier panics on exactly the failure it was meant to survive.",
		"You call an API 10 times through one shared Client, check resp.StatusCode, and close the body without reading it. The server logs 10 new TCP connections instead of 1. Why? || The Transport can only return a connection to the pool once the body has been read to EOF; a Close() on an unread body retires it instead. Measured: drain-then-close is 1 connection for 10 requests, close-only is 10. Closing is what stops the leak, draining is what buys the reuse, and you need both: io.Copy(io.Discard, resp.Body) before Close whenever you are ignoring a body.",
	],
	codeExample: `package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"time"
)

// connsFor runs 10 requests through ONE shared client against a fresh server
// and reports how many TCP connections the server had to accept.
func connsFor(drain bool) int64 {
	var conns int64
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "hi")
	}))
	srv.Config.ConnState = func(_ net.Conn, s http.ConnState) {
		if s == http.StateNew {
			atomic.AddInt64(&conns, 1)
		}
	}
	srv.Start()
	defer srv.Close()

	c := &http.Client{Timeout: time.Second}
	for i := 0; i < 10; i++ {
		resp, err := c.Get(srv.URL)
		if err != nil {
			panic(err)
		}
		if drain {
			io.Copy(io.Discard, resp.Body) // read to EOF: connection goes back to the pool
		}
		resp.Body.Close()
	}
	return atomic.LoadInt64(&conns)
}

func main() {
	// ACT 1: the hang.
	// A server that accepts the connection, reads the request, and never
	// answers. A machine that is DOWN gives you a fast connection error. A
	// machine that is alive, listening and wedged gives you nothing, forever.
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-block
	}))
	defer srv.Close()  // runs second: waits for the handler to return
	defer close(block) // runs first: releases the handler

	// http.Get uses http.DefaultClient, whose Timeout is the zero value.
	// Zero is not "a sensible default". Zero is no limit.
	fmt.Printf("http.DefaultClient.Timeout = %v\\n", http.DefaultClient.Timeout)

	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(srv.URL) // returns when the server answers: it won't
		if err == nil {
			resp.Body.Close()
		}
		done <- err
	}()

	// Client.Timeout covers the whole exchange: dial, TLS, request, response
	// headers AND reading the body. One line turns a hang into an error you
	// can retry, log and alert on.
	c := &http.Client{Timeout: 200 * time.Millisecond}
	start := time.Now()
	if _, err := c.Get(srv.URL); err != nil {
		fmt.Printf("Client{Timeout}: gave up after %v, Timeout()=%v\\n",
			time.Since(start).Round(50*time.Millisecond),
			err.(interface{ Timeout() bool }).Timeout())
	}

	select {
	case err := <-done:
		fmt.Printf("DefaultClient returned: %v\\n", err)
	case <-time.After(500 * time.Millisecond):
		fmt.Println("DefaultClient:   still blocked. It would be at 1h too.")
	}

	// ACT 2: a 500 is not an error.
	// err != nil means "no answer". It never means "unhappy answer".
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer bad.Close()

	resp, err := c.Get(bad.URL)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close() // the moment err == nil, this body is yours
	fmt.Printf("500 response:    err=%v status=%d\\n", err, resp.StatusCode)

	// ACT 3: closing the body is necessary and not sufficient.
	// The transport only returns a connection to the pool once it has seen it
	// read to EOF, so Close() on an unread body retires it instead.
	fmt.Printf("drain + close:   %2d connections for 10 requests\\n", connsFor(true))
	fmt.Printf("close only:      %2d connections for 10 requests\\n", connsFor(false))
}`,
	codeExplanation:
		"This prints:<br><br><code>http.DefaultClient.Timeout = 0s</code><br><code>Client{Timeout}: gave up after 200ms, Timeout()=true</code><br><code>DefaultClient:   still blocked. It would be at 1h too.</code><br><code>500 response:    err=&lt;nil&gt; status=500</code><br><code>drain + close:    1 connections for 10 requests</code><br><code>close only:      10 connections for 10 requests</code><br><br>Act 1 is two clients against one wedged server. The one with a timeout comes back in 200ms with an error whose <code>Timeout()</code> reports <code>true</code>, so you can retry it; the one without is still parked when the program decides to stop waiting, and the only reason this example terminates is that <code>close(block)</code> releases the handler on the way out. In a real service nothing plays that role. Act 2 is the line that surprises people: <code>err=&lt;nil&gt;</code> next to <code>status=500</code>. Every <code>if err != nil { return err }</code> that is not followed by a status check treats an error page as data. Act 3 is the one almost nobody knows: same client, same requests, the only difference is the <code>io.Copy(io.Discard, ...)</code>, and it is worth a factor of ten in connections, handshakes and ports. The docs state the rule outright: \"If the Body is not both read to EOF and closed, the Client's underlying RoundTripper ... may not be able to re-use a persistent TCP connection.\" Both halves, or you get neither. The timeout error text includes the ephemeral port, so that part of the line changes per run.",
	designRationale:
		"The zero timeout cannot be fixed, and the reason is the Go 1 compatibility promise. <code>net/http</code> shipped before <code>Client.Timeout</code> existed as a field, so programs were written against a client that waits forever, and some of them legitimately stream for hours. Giving <code>DefaultClient</code> a default now would break those silently and remotely, at a distance from any code anyone changed, which is the worst possible failure to introduce into an ecosystem. So the unsafe value is frozen, and the safe one is the one you opt into. <code>DefaultClient</code> itself exists so that <code>http.Get(url)</code> is a one-liner in a tutorial, and that convenience is the trap: it is package-level mutable state shared by your code and every library in your binary, so you cannot repair it locally either. Setting <code>http.DefaultClient.Timeout</code> changes the behaviour of dependencies that never consented and races with any goroutine already using it. The only correct move is to construct your own Client and never let <code>http.Get</code> into a service. One widespread claim deserves correcting: creating a Client per request does not destroy pooling. <code>Client.transport()</code> falls back to <code>http.DefaultTransport</code> when <code>Transport</code> is nil, so a fresh <code>&http.Client{Timeout: n}</code> every call still shares the one global pool, measured at 1 connection for 10 requests. What destroys pooling is a fresh <code>&http.Transport{}</code> per request, because the pool is the Transport: that measures 10 connections for 10 requests, plus an idle connection and reader goroutines per Transport that nothing ever reclaims. Clients are cheap. Transports are not.",
	commonMistakes: [
		{
			title: "Using http.Get or http.DefaultClient in a service",
			body: "No timeout at all, so a wedged dependency converts every request into a permanently parked goroutine. It does not show up as an error rate, a latency spike or a restart loop: it shows up as memory climbing and a service that stops doing work while insisting it is healthy. There is no argument for <code>http.Get</code> outside a script you will watch run.",
		},
		{
			title: "Fixing it with http.DefaultClient.Timeout = 30 * time.Second",
			body: "You just changed the HTTP behaviour of every library in the binary that also calls <code>http.Get</code>, none of which agreed to your number, and if you set it anywhere but <code>init</code> you raced every goroutine already reading it. Package-level mutable state is not a config file. Build your own Client and pass it down.",
		},
		{
			title: "defer resp.Body.Close() before checking err",
			body: "On error the response is nil, so the defer panics on precisely the failure path it exists to clean up. The docs are explicit: \"On error, any Response can be ignored.\" The check comes first, then the defer, and the ordering is not style: <code>err == nil</code> is exactly the condition under which a body exists to close.",
		},
		{
			title: "Closing the body without draining it",
			body: "Closing stops the leak but only a body read to EOF goes back in the pool, so status-check-and-close code pays a fresh TCP and TLS handshake every single call and burns ephemeral ports under load. Measured at 10 connections for 10 requests versus 1. <code>io.Copy(io.Discard, resp.Body)</code> before <code>Close</code> is the whole fix.",
		},
		{
			title: "Treating Client.Timeout as a per-request deadline for streams",
			body: "It covers \"connection time, any redirects, and reading the response body\", and the timer keeps running after <code>Get</code> returns, so it will \"interrupt reading of the Response.Body\". A 30 second Timeout means a 2GB download dies at 30 seconds regardless of throughput. For long transfers, bound the phases on the Transport and cancel with a context instead.",
		},
	],
	relatedSlugs: ["server-timeouts", "context", "io-reader-writer", "encoding-json", "error-handling"],
}
