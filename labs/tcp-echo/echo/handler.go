//go:build !solution

package echo

import (
	"net"
	"time"
)

// idleTimeout is how long a connection may stay silent before the server
// hangs up. Without it, a client that vanishes without sending FIN (power
// cut, dropped wifi) parks its goroutine in a read forever, and Shutdown
// then waits on that goroutine forever too.
const idleTimeout = 30 * time.Second

// handleConn owns one connection for its whole life: read a line,
// uppercase it, write it back, repeat. bufio.Scanner does the framing;
// net.Conn is just an io.Reader plus an io.Writer, so the scanner loop is
// the same code you wrote over os.File in the log parser.
//
// The contract the suite enforces:
//
//   - every line echoes back uppercased, terminated by \n (fmt.Fprintln)
//   - the exact line "quit" closes the connection with no echo
//   - when the client disconnects, Scan returns false, the goroutine
//     exits, and Shutdown can finish
//
// Set the deadline with conn.SetDeadline(time.Now().Add(idleTimeout)) and
// push it forward after every line: a deadline is an absolute point in
// time, not a rolling window, so a deadline you never reset times out an
// active client 30 seconds after it connected.
func (s *Server) handleConn(conn net.Conn) {
	// TODO: defer conn.Close(), set the deadline, scan lines, uppercase,
	// Fprintln, handle "quit", reset the deadline per line.
}
