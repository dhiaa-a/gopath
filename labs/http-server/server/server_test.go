// Black-box suite for the server package: it imports the package and calls
// only the exported API, the way main would. How you structure the inside
// is your call.
//
// Two of these tests talk raw TCP instead of using net/http's client,
// because the behaviour under test is what the server does to a client
// that never finishes: an http.Client would not let you be that rude.
package server_test

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"gopath.dev/labs/http-server/server"
)

// serveTimeouts starts a server built by New on a loopback port and returns
// its address. It calls Serve directly rather than Run, so the deadline
// tests below say nothing about whether your shutdown works.
func serveTimeouts(t *testing.T, h http.Handler, to server.Timeouts) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	srv := server.New(h, to)
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })
	return ln.Addr().String()
}

// closed reports whether the peer hung up on us within the window. It
// distinguishes the two outcomes that matter: our own read deadline firing
// means the connection is still open and the server has no opinion about
// how long we may hold it, while any other error means the server closed
// it, which is the whole point.
func closed(t *testing.T, conn net.Conn, within time.Duration) bool {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(within)); err != nil {
		t.Fatalf("SetReadDeadline: %v", err)
	}
	_, err := conn.Read(make([]byte, 1))
	if err == nil {
		t.Fatal("the server sent us a byte we never asked for")
	}
	if ne, ok := err.(net.Error); ok && ne.Timeout() {
		return false
	}
	return true
}

// TestDefaultTimeoutsAreAllSet pins the fact the zero value of http.Server
// gets wrong. Every timeout field on it defaults to zero, and zero means no
// deadline: a connection with nothing to say holds a goroutine and a file
// descriptor until one of the two processes dies.
func TestDefaultTimeoutsAreAllSet(t *testing.T) {
	d := server.DefaultTimeouts()

	for _, f := range []struct {
		name string
		got  time.Duration
	}{
		{"ReadHeader", d.ReadHeader},
		{"Read", d.Read},
		{"Write", d.Write},
		{"Idle", d.Idle},
	} {
		if f.got <= 0 {
			t.Errorf("DefaultTimeouts().%s = %v: every deadline must be positive, because zero is not a default, it is no deadline", f.name, f.got)
		}
	}

	// During the header phase the connection's read deadline is
	// ReadHeaderTimeout alone; ReadTimeout is not applied until the headers
	// are in. So a ReadHeader looser than Read does not get clamped by
	// Read, it quietly overrides it, and Read stops being the bound you
	// think you set.
	if d.ReadHeader > d.Read {
		t.Errorf("DefaultTimeouts(): ReadHeader (%v) is looser than Read (%v): a client can then hold the connection for ReadHeader while sending nothing, and Read never gets a say", d.ReadHeader, d.Read)
	}
}

// TestNewAppliesEveryTimeout pins the mapping from Timeouts to the
// http.Server fields, which do not share its names. Four distinct values,
// so a line that wires the same field twice shows up as a mismatch instead
// of passing by luck.
func TestNewAppliesEveryTimeout(t *testing.T) {
	want := server.Timeouts{
		ReadHeader: 1 * time.Second,
		Read:       2 * time.Second,
		Write:      3 * time.Second,
		Idle:       4 * time.Second,
	}
	srv := server.New(http.NotFoundHandler(), want)

	if srv.Handler == nil {
		t.Fatal("srv.Handler is nil: New must serve the handler it was given")
	}
	for _, f := range []struct {
		field string
		got   time.Duration
		want  time.Duration
	}{
		{"ReadHeaderTimeout", srv.ReadHeaderTimeout, want.ReadHeader},
		{"ReadTimeout", srv.ReadTimeout, want.Read},
		{"WriteTimeout", srv.WriteTimeout, want.Write},
		{"IdleTimeout", srv.IdleTimeout, want.Idle},
	} {
		if f.got != f.want {
			t.Errorf("srv.%s = %v, want %v: a field you leave unset has no deadline", f.field, f.got, f.want)
		}
	}
}

// TestReadHeaderTimeoutHangsUpOnASilentClient is one connection of a
// Slowloris: a real, completed TCP handshake that never sends a request.
// It costs the client nothing to open ten thousand more. The only thing
// standing between that and your file descriptor table is a deadline.
//
// The three-second window is not measuring the 150ms timeout. It is asking
// whether any deadline exists at all, which is the question the zero value
// of http.Server answers with "no".
func TestReadHeaderTimeoutHangsUpOnASilentClient(t *testing.T) {
	addr := serveTimeouts(t, http.NotFoundHandler(), server.Timeouts{
		ReadHeader: 150 * time.Millisecond,
		Read:       400 * time.Millisecond,
		Write:      10 * time.Second,
		Idle:       10 * time.Second,
	})

	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Say nothing. Wait to be hung up on.
	if !closed(t, conn, 3*time.Second) {
		t.Fatal("after 3s the connection was still open and we had not sent a single byte: set a deadline on the header phase, the zero value of http.Server has none and will hold this connection as long as we like")
	}
}

// TestIdleTimeoutClosesAQuietKeepAliveConnection covers the half of the
// connection's life that ReadHeaderTimeout does not: HTTP/1.1 keeps the
// connection open after a response, which is the right default, but it
// means a client that goes quiet after one legitimate request holds a
// descriptor exactly like a silent one does.
func TestIdleTimeoutClosesAQuietKeepAliveConnection(t *testing.T) {
	addr := serveTimeouts(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "ok")
	}), server.Timeouts{
		ReadHeader: 10 * time.Second,
		Read:       10 * time.Second,
		Write:      10 * time.Second,
		Idle:       150 * time.Millisecond,
	})

	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// One complete, well-behaved request. HTTP/1.1 keeps the connection
	// alive afterwards unless somebody says otherwise.
	if _, err := fmt.Fprint(conn, "GET / HTTP/1.1\r\nHost: example\r\n\r\n"); err != nil {
		t.Fatalf("writing the request: %v", err)
	}
	br := bufio.NewReader(conn)
	resp, err := http.ReadResponse(br, nil)
	if err != nil {
		t.Fatalf("reading the response: %v", err)
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if resp.Close {
		t.Fatal("the server closed the connection after the response; this test needs a kept-alive one")
	}

	// Now go quiet, the way a client that has wandered off does.
	if !closed(t, conn, 3*time.Second) {
		t.Fatal("after 3s the idle connection was still open: set a deadline on the gap between requests, or a client that made one request in 1998 is still costing you a descriptor")
	}
}

// waitUntilServing gives Run a moment to get the listener up before the
// test leans on it, and fails readably if it never does.
//
// The probe client has a timeout on purpose, and the reason is worth your
// attention: net.Listen has already put a listening socket in the kernel,
// so a client's connection completes its handshake and waits in the accept
// queue whether or not anybody ever calls Accept. A Run that returns
// without serving is therefore not "connection refused", it is a
// connection that hangs, and the default http.Client would wait on it
// forever. Deadlines are this project's subject for a reason.
func waitUntilServing(t *testing.T, url string) {
	t.Helper()
	probe := &http.Client{Timeout: 250 * time.Millisecond}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := probe.Get(url + "ping")
		if err == nil {
			resp.Body.Close()
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("the server never answered a request in three seconds: Run must serve ln, and keep serving it until ctx is cancelled")
}

// TestRunWaitsForInFlightRequests is the difference between a process that
// stops and a process that finishes. One request is inside a handler when
// the stop arrives. It must still get its response.
//
// Shutdown closes the listener, closes idle connections, and then waits for
// the active ones to go idle. Close does not wait: it hangs up on live
// connections immediately, and the client gets an EOF instead of an answer.
// That is the entire difference, and it is one identifier.
func TestRunWaitsForInFlightRequests(t *testing.T) {
	started := make(chan struct{})
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ping" {
			return
		}
		close(started)
		// Stands in for the database query a real handler is waiting on.
		time.Sleep(300 * time.Millisecond)
		io.WriteString(w, "finished")
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	srv := server.New(h, server.DefaultTimeouts())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ran := make(chan error, 1)
	go func() { ran <- server.Run(ctx, srv, ln, 5*time.Second) }()

	url := "http://" + ln.Addr().String() + "/"
	waitUntilServing(t, url)

	type result struct {
		body string
		err  error
	}
	res := make(chan result, 1)
	go func() {
		client := &http.Client{Timeout: 4 * time.Second}
		resp, err := client.Get(url + "work")
		if err != nil {
			res <- result{err: err}
			return
		}
		defer resp.Body.Close()
		b, err := io.ReadAll(resp.Body)
		res <- result{body: string(b), err: err}
	}()

	<-started // the request is inside the handler right now
	cancel()  // ...and now the process is asked to stop

	var got result
	select {
	case got = <-res:
	case <-time.After(6 * time.Second):
		t.Fatal("the in-flight request never got a response at all")
	}
	if got.err != nil {
		t.Fatalf("the request that was in flight when the stop arrived failed: %v\nShutdown waits for handlers to return. Close hangs up on them.", got.err)
	}
	if got.body != "finished" {
		t.Fatalf("in-flight response body = %q, want %q: the handler must run to completion", got.body, "finished")
	}

	select {
	case err := <-ran:
		if err != nil {
			t.Fatalf("Run = %v, want nil: every in-flight request finished, so this was a clean stop. Serve always returns a non-nil error; after a clean shutdown it is the sentinel http.ErrServerClosed, and reporting that as a failure makes every successful deploy look like a crash", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run never returned after ctx was cancelled: it must stop serving when it is told to")
	}
}
