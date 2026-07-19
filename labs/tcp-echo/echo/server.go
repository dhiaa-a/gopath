//go:build !solution

// Package echo is the TCP echo server from the Tier 2 anchor project: an
// accept loop, one goroutine per connection, and a shutdown path that
// leaves nothing running.
//
// This file and handler.go are yours. The suite in echo_test.go dials your
// server over real TCP sockets and grades the exported API below; after the
// last test, goleak fails the run if any goroutine you started is still
// alive. The bodies are stubs that compile, so a fresh clone fails tests,
// never builds.
package echo

import "net"

// Server owns one net.Listener and every goroutine spawned to serve it.
// The zero value is ready to Listen. You need at least the listener and a
// sync.WaitGroup that counts the accept loop plus one per live connection:
// that count reaching zero is what makes Shutdown honest.
type Server struct {
	// Your fields here.
}

// Listen binds addr ("127.0.0.1:0" in the tests, so the OS assigns a free
// port), starts the accept loop in a background goroutine, and returns.
// The loop hands each accepted net.Conn to handleConn on its own
// goroutine. When Accept returns an error because Shutdown closed the
// listener, the loop must exit, not spin; errors.Is(err, net.ErrClosed)
// tells that case apart from a real failure.
func (s *Server) Listen(addr string) error {
	// TODO: net.Listen("tcp", addr), keep the listener, start the accept
	// loop in a goroutine, return nil.
	return nil
}

// Addr reports the address the listener is bound to. After
// Listen("127.0.0.1:0") this is how the tests learn which port the OS
// actually assigned.
func (s *Server) Addr() net.Addr {
	// TODO: return the listener's Addr.
	return nil
}

// Shutdown closes the listener, which makes the blocked Accept call return
// net.ErrClosed, then waits for the accept loop and every connection
// goroutine to exit. When Shutdown returns, nothing of this server may
// still be running; goleak checks exactly that after the suite.
func (s *Server) Shutdown() {
	// TODO: close the listener, then wait on the WaitGroup.
}
