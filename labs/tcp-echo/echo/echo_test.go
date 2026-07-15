// Integration suite for the TCP echo server. It lives in package echo_test
// and talks to your Server the only way that proves anything about a
// network server: real sockets on 127.0.0.1, dialed with net.Dial, an
// OS-assigned port per test.
//
// Run it with the race detector on:
//
//	go test -race ./...
//
// TestMain runs goleak after the suite: if the accept loop or any
// connection goroutine is still alive once the tests finish, the run fails
// and prints the goroutine's stack. A Shutdown that does not wait is the
// bug that catches.
//
// Every dial, read, write, and shutdown in here carries a deadline, so a
// server that blocks forever fails in seconds with a named guarantee
// instead of hanging the run.
package echo_test

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"go.uber.org/goleak"

	"gopath.dev/labs/tcp-echo/echo"
)

// waitTimeout bounds every blocking step in the suite. The reference
// finishes each test in milliseconds; the margin is for loaded machines.
const waitTimeout = 5 * time.Second

func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}

// startServer boots a zero-value Server on 127.0.0.1:0 and registers a
// cleanup that shuts it down. Cleanups run in reverse order, so the
// conn.Close registered later by dial runs first: by the time Shutdown is
// called, no test client is holding a connection open.
func startServer(t *testing.T) *echo.Server {
	t.Helper()
	s := &echo.Server{}
	if err := s.Listen("127.0.0.1:0"); err != nil {
		t.Fatalf("Listen(127.0.0.1:0): %v", err)
	}
	if s.Addr() == nil {
		t.Fatal("Addr() returned nil after a successful Listen; keep the net.Listener and return its Addr()")
	}
	t.Cleanup(func() { shutdownOrFatal(t, s) })
	return s
}

// shutdownOrFatal fails the test if Shutdown does not return in time.
func shutdownOrFatal(t *testing.T, s *echo.Server) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		s.Shutdown()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(waitTimeout):
		t.Fatalf("Shutdown still blocked after %v; it must close the listener and return once the accept loop and every connection goroutine have exited", waitTimeout)
	}
}

// dial connects to s with a deadline on everything and closes the
// connection in cleanup, so a failing test never leaves a client behind
// for Shutdown to wait on.
func dial(t *testing.T, s *echo.Server) net.Conn {
	t.Helper()
	conn, err := net.DialTimeout("tcp", s.Addr().String(), waitTimeout)
	if err != nil {
		t.Fatalf("dial %s: %v; is the accept loop listening on the address Addr reports?", s.Addr(), err)
	}
	t.Cleanup(func() { conn.Close() })
	if err := conn.SetDeadline(time.Now().Add(waitTimeout)); err != nil {
		t.Fatalf("SetDeadline: %v", err)
	}
	return conn
}

// readLine reads one \n-terminated reply and strips the terminator (plus a
// stray \r, in case your server writes Windows line endings).
func readLine(t *testing.T, r *bufio.Reader, sent string) string {
	t.Helper()
	line, err := r.ReadString('\n')
	if err != nil {
		t.Fatalf("reading the echo for %q: %v; the server must write the uppercased line back, terminated by \\n", sent, err)
	}
	return strings.TrimRight(line, "\r\n")
}

// TestEchoSingle is the whole product in one exchange: one line in, the
// same line back uppercased.
func TestEchoSingle(t *testing.T) {
	s := startServer(t)
	conn := dial(t, s)
	r := bufio.NewReader(conn)

	if _, err := fmt.Fprintln(conn, "hello"); err != nil {
		t.Fatalf("writing %q: %v", "hello", err)
	}
	if got := readLine(t, r, "hello"); got != "HELLO" {
		t.Fatalf("echo for %q = %q, want %q", "hello", got, "HELLO")
	}
}

// TestEchoMultiLine sends three lines in a single Write. TCP is a byte
// stream, not a message stream: where lines end is decided by your
// scanner's framing, never by the boundaries of the client's writes.
func TestEchoMultiLine(t *testing.T) {
	s := startServer(t)
	conn := dial(t, s)
	r := bufio.NewReader(conn)

	if _, err := conn.Write([]byte("foo\nbar\nbaz\n")); err != nil {
		t.Fatalf("writing three lines in one call: %v", err)
	}
	for _, want := range []string{"FOO", "BAR", "BAZ"} {
		if got := readLine(t, r, strings.ToLower(want)); got != want {
			t.Fatalf("echo = %q, want %q; lines must come back uppercased, in order, one reply per line", got, want)
		}
	}
}

// TestQuit sends the quit command and expects the server, not the client,
// to close the connection: the next read returns EOF with zero extra
// bytes.
func TestQuit(t *testing.T) {
	s := startServer(t)
	conn := dial(t, s)

	if _, err := fmt.Fprintln(conn, "quit"); err != nil {
		t.Fatalf("writing %q: %v", "quit", err)
	}
	data, err := io.ReadAll(conn)
	if err != nil {
		t.Fatalf("read after %q: %v; the server must close the connection, which this client sees as a clean EOF", "quit", err)
	}
	if len(data) != 0 {
		t.Fatalf("server wrote %q after %q; quit is a command to hang up, not a line to echo", data, "quit")
	}
}

// TestConcurrent runs 10 clients at once, each on its own connection, each
// sending 5 lines. Interleaving across connections is free to vary;
// per-connection order and content are not. Under -race this is where a
// server sharing state between connection goroutines gets caught.
func TestConcurrent(t *testing.T) {
	s := startServer(t)

	const (
		clients        = 10
		linesPerClient = 5
	)
	addr := s.Addr().String()
	var wg sync.WaitGroup
	for c := 0; c < clients; c++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			conn, err := net.DialTimeout("tcp", addr, waitTimeout)
			if err != nil {
				t.Errorf("client %d: dial: %v", c, err)
				return
			}
			defer conn.Close()
			if err := conn.SetDeadline(time.Now().Add(waitTimeout)); err != nil {
				t.Errorf("client %d: SetDeadline: %v", c, err)
				return
			}
			r := bufio.NewReader(conn)
			for i := 0; i < linesPerClient; i++ {
				sent := fmt.Sprintf("client %d line %d", c, i)
				if _, err := fmt.Fprintln(conn, sent); err != nil {
					t.Errorf("client %d: write: %v", c, err)
					return
				}
				line, err := r.ReadString('\n')
				if err != nil {
					t.Errorf("client %d: reading the echo for %q: %v", c, sent, err)
					return
				}
				got, want := strings.TrimRight(line, "\r\n"), strings.ToUpper(sent)
				if got != want {
					t.Errorf("client %d: echo = %q, want %q; replies must never cross between connections", c, got, want)
					return
				}
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * waitTimeout):
		t.Fatal("concurrent clients still running after their deadlines; this points at a server blocked across connections")
	}
}

// TestShutdownWaitsForActiveConn is the test the other four cannot be: it
// holds a connection open across Shutdown. Each test above closes its client
// before Shutdown runs (t.Cleanup unwinds the dial's Close ahead of
// startServer's Shutdown), so a Server whose Shutdown only closes the
// listener passes all four, and goleak too: by the time goleak checks, the
// client is long gone and the connection goroutine has already returned on
// its own. Nothing there forces Shutdown to actually wait.
//
// This one keeps the client alive. It drives one line so the connection
// goroutine is parked in Scan, then calls Shutdown while that goroutine is
// still running and asserts Shutdown does not return until the client
// closes. A Shutdown that closes the listener but never waits on its
// connection goroutines returns immediately and fails the first assertion;
// the reference blocks until the client closes and passes.
func TestShutdownWaitsForActiveConn(t *testing.T) {
	s := &echo.Server{}
	if err := s.Listen("127.0.0.1:0"); err != nil {
		t.Fatalf("Listen(127.0.0.1:0): %v", err)
	}
	if s.Addr() == nil {
		t.Fatal("Addr() returned nil after a successful Listen; keep the net.Listener and return its Addr()")
	}

	// Shutdown must run exactly once no matter which branch this test takes.
	// Calling it twice would panic an implementation that signals shutdown by
	// closing a channel, and the cleanup below needs to tear the server down
	// on any early Fatalf so goleak stays clean.
	var once sync.Once
	shutdown := func() { once.Do(s.Shutdown) }

	conn, err := net.DialTimeout("tcp", s.Addr().String(), waitTimeout)
	if err != nil {
		shutdown()
		t.Fatalf("dial %s: %v; is the accept loop listening on the address Addr reports?", s.Addr(), err)
	}
	// Closing the client is what lets the connection goroutine exit; running
	// shutdown() here covers every Fatalf path below.
	t.Cleanup(func() {
		conn.Close()
		shutdown()
	})
	if err := conn.SetDeadline(time.Now().Add(waitTimeout)); err != nil {
		t.Fatalf("SetDeadline: %v", err)
	}

	// One round trip parks the server's handleConn goroutine in Scan on a
	// live connection. That parked goroutine is the one Shutdown has to wait
	// for.
	r := bufio.NewReader(conn)
	if _, err := fmt.Fprintln(conn, "hello"); err != nil {
		t.Fatalf("writing %q: %v", "hello", err)
	}
	if got := readLine(t, r, "hello"); got != "HELLO" {
		t.Fatalf("echo for %q = %q, want %q", "hello", got, "HELLO")
	}

	// Call Shutdown with the connection still open. A Shutdown that waits on
	// its goroutines blocks here; a Shutdown that only closes the listener
	// returns right away.
	returned := make(chan struct{})
	go func() {
		shutdown()
		close(returned)
	}()

	const grace = 200 * time.Millisecond
	select {
	case <-returned:
		t.Fatalf("Shutdown returned within %v while a connection was still open; it must wait for every connection goroutine to exit, not just close the listener", grace)
	case <-time.After(grace):
		// Correct so far: Shutdown is still blocked on the live connection.
	}

	// Release the connection. Now Scan sees EOF, the goroutine exits, and
	// that is the only thing that should let Shutdown return.
	conn.Close()
	select {
	case <-returned:
		// Correct: Shutdown unblocked once its last goroutine was gone.
	case <-time.After(waitTimeout):
		t.Fatalf("Shutdown still blocked %v after the client closed; once every connection goroutine has exited it must return", waitTimeout)
	}
}
