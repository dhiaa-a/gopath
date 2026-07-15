import { Concept } from "../../content"

export const gracefulShutdown: Concept = {
	slug: "graceful-shutdown",
	name: "Graceful shutdown",
	tagline: "Stop accepting, drain what is in flight, and bound the wait.",
	summary:
		"A graceful shutdown is three things in order: stop accepting new work, let the work already in flight finish, and give up after a deadline you chose. For an HTTP server that is <code>srv.Shutdown(ctx)</code>, which closes the listeners and waits for active connections to go idle, as against <code>srv.Close()</code>, which hangs up on them immediately. On a laptop the difference is one request you were making yourself. In production it is every request in flight, on every replica, every time you deploy.",
	mentalModel:
		"Closing time at a bar. Shutdown locks the front door and lets the people already inside finish their drinks. Close turns the lights off mid-sentence and puts everyone on the pavement. The grace period is how long you are willing to wait before you become Close, and it exists because your landlord has a deadline of their own: something above you is holding a SIGKILL, and blowing its timer does not get you more time, it takes everyone still inside with it.",
	retrievalPrompts: [
		"Your drain calls srv.Shutdown(ctx) with the context SIGTERM cancelled. It compiles and reads perfectly. Why is it a serious bug? || Shutdown obeys the context it is handed, and that one is already cancelled. It closes the listener, sees the context is done, and returns context.Canceled instantly having waited for nothing. Shutdown's job starts exactly where that context's job ended, so it needs its own, rooted at context.Background() with its own deadline.",
		"Serve returned http.ErrServerClosed. Did something go wrong? || No. Serve loops accepting connections until something stops it, so it has no success path and every way out is an error return. ErrServerClosed is the sentinel that means you stopped it on purpose, via Shutdown or Close. Match it with errors.Is and return nil. Treat it as a failure and every clean deploy logs a crash and exits non-zero, which costs you the credibility of your own alerting.",
		"Shutdown returned nil. Are your handlers finished? What about your WebSockets? || Your handlers are: Shutdown waits for active connections to become idle, which means it waits for ServeHTTP to return. It never cancels a request context; only closing the connection does that, which is Close's job. Hijacked connections are the exception the docs call out explicitly: Shutdown does not close or wait for them, so a WebSocket needs its own notification (Server.RegisterOnShutdown) and its own wait.",
	],
	codeExample: `package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(300 * time.Millisecond) // still in here when the stop lands
		fmt.Println("handler: finished")
		fmt.Fprintln(w, "finished anyway")
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	srv := &http.Server{Handler: mux}

	// Serve blocks and has no success return, so it runs on its own goroutine
	// and reports through a channel. Buffered by one: on the early-return path
	// nobody is left to receive, and an unbuffered send would leak it forever.
	served := make(chan error, 1)
	go func() { served <- srv.Serve(ln) }()

	done := make(chan string, 1)
	go func() {
		resp, err := http.Get("http://" + ln.Addr().String() + "/slow")
		if err != nil {
			done <- "client got an error: " + err.Error()
			return
		}
		resp.Body.Close()
		done <- "client got " + resp.Status
	}()
	time.Sleep(50 * time.Millisecond) // let the request get inside the handler

	// Shutdown needs its OWN context, rooted at Background. The signal that
	// told you to stop is already cancelled, and Shutdown obeys the context it
	// is handed: give it a cancelled one and it waits for nothing at all.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		fmt.Println("grace expired, hung up on live requests:", err)
	}
	fmt.Println("Shutdown: returned")
	fmt.Println(<-done)

	// ErrServerClosed is not a failure. It is Serve's only clean outcome.
	if err := <-served; errors.Is(err, http.ErrServerClosed) {
		fmt.Println("Serve: stopped on purpose")
	} else {
		fmt.Println("Serve: the listener actually broke:", err)
	}
}`,
	codeExplanation:
		"The order of the output is the whole lesson: <code>handler: finished</code>, then <code>Shutdown: returned</code>, then <code>client got 200 OK</code>, then <code>Serve: stopped on purpose</code>. The stop arrived while the request was still 250ms from done, and the client got its response anyway, because <code>Shutdown</code> waited for a connection it had already accepted to go idle. Three details around it are each a bug on their own. The context is built from <code>context.Background()</code> rather than from the one that told you to stop: hand <code>Shutdown</code> a cancelled context and it returns <code>context canceled</code> immediately, and the first two lines swap places because nothing waited for the handler at all. <code>served</code> is buffered by one so the <code>Serve</code> goroutine can always complete its send, even on the path where <code>Run</code> has already returned and nobody is receiving. And <code>ErrServerClosed</code> is matched with <code>errors.Is</code> instead of being treated as a failure, because it is the only clean thing <code>Serve</code> ever returns. In a real program the trigger is <code>signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)</code>; the shape below it is unchanged.",
	designRationale:
		"<code>Server.Shutdown</code> arrived in Go 1.8, which means people hand-rolled this for years, and most of the folklore about it dates from then. Two of the API's decisions look odd until you see what they are working around. First, <code>Serve</code> has no success return, because it is not meant to return at all: it loops until something breaks or somebody stops it, so both outcomes have to come back through the same <code>error</code> value. Go's answer is a sentinel, a package-level <code>var ErrServerClosed = errors.New(\"http: Server closed\")</code> matched with <code>errors.Is</code>, rather than a special-case <code>nil</code> or a second return value nobody would check. Second, <code>Shutdown</code> takes a context rather than a duration, which lets one parameter express \"wait 30 seconds\", \"wait until this parent operation is cancelled\", and, if you hand it a context that is already done, \"do not wait at all\". That last reading is not a special case the API guards against; it is the honest meaning of a cancelled context, which is exactly why the mistake is so easy to write and so hard to see in review. The one thing the design deliberately does not do is interrupt anything. <code>Shutdown</code> waits for handlers, it never cancels them, because the only way to cancel a request context is to close its connection, and closing connections is what <code>Close</code> is for.",
	commonMistakes: [
		{
			title: "Handing Shutdown the context that told you to stop",
			body: "It is already cancelled, and <code>Shutdown</code> honours the context it is given. It closes the listener, sees the context is done, and returns <code>context.Canceled</code> without waiting for a single request. The drain reads perfectly and does nothing. Build a fresh context from <code>context.Background()</code> with its own deadline.",
		},
		{
			title: "Treating ErrServerClosed as a failure",
			body: "<code>Serve</code> always returns a non-nil error, so <code>if err := srv.ListenAndServe(); err != nil { log.Fatal(err) }</code> logs a fatal on every clean shutdown. Every successful deploy then reports a crash, and within a month nobody reads those alerts, including the day one of them is real. Match with <code>errors.Is(err, http.ErrServerClosed)</code> and treat it as success.",
		},
		{
			title: "Shutdown(context.Background()) with no deadline",
			body: "The docs are literal about it: Shutdown waits indefinitely for connections to return to idle. One hung handler and your process never exits, so your supervisor's timer expires and SIGKILLs you, and you drain nothing at all. An unbounded wait is not a wait, it is a hang with better manners.",
		},
		{
			title: "A grace period longer than the supervisor's",
			body: "Kubernetes sends SIGTERM, waits <code>terminationGracePeriodSeconds</code> (30 by default), then SIGKILLs. A 60 second grace inside a 30 second budget means you are killed mid-drain and the careful shutdown you wrote never finishes. Your deadline has to fit inside the one above you, with room for the rest of your shutdown.",
		},
		{
			title: "Expecting Shutdown to cancel requests or handle WebSockets",
			body: "It waits for handlers, it does not interrupt them: a handler ignoring its own context runs to completion or past your grace. And the docs say Shutdown does not attempt to close or wait for hijacked connections, so WebSockets and upgraded protocols keep running unless you notify them yourself through <code>Server.RegisterOnShutdown</code> and wait for them separately.",
		},
	],
	relatedSlugs: ["context", "error-handling", "channels", "server-timeouts"],
}
