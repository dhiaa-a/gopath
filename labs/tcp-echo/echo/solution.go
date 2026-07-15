//go:build solution

// Reference implementation. Do not open this file until your run is green.
package echo

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

const idleTimeout = 30 * time.Second

// Server counts every goroutine it spawns in one WaitGroup: the accept
// loop holds an entry, and each connection holds an entry. Shutdown closes
// the listener and waits for the count to reach zero, so "Shutdown
// returned" means "nothing is running".
type Server struct {
	ln net.Listener
	wg sync.WaitGroup
}

func (s *Server) Listen(addr string) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	s.ln = ln
	s.wg.Add(1)
	go s.acceptLoop()
	return nil
}

// acceptLoop blocks in Accept until a connection arrives or Shutdown
// closes the listener. Closing the listener is the shutdown signal: Accept
// returns net.ErrClosed and the loop exits. Any other error ends the loop
// too, because Accept on a broken listener does not heal; a production
// server would tell the two cases apart with errors.Is(err, net.ErrClosed)
// and log the real failures.
func (s *Server) acceptLoop() {
	defer s.wg.Done()
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		s.wg.Add(1)
		go func() {
			defer s.wg.Done()
			s.handleConn(conn)
		}()
	}
}

func (s *Server) Addr() net.Addr {
	if s.ln == nil {
		return nil
	}
	return s.ln.Addr()
}

func (s *Server) Shutdown() {
	if s.ln != nil {
		_ = s.ln.Close()
	}
	s.wg.Wait()
}

// handleConn owns conn for its whole life. The deferred Close covers every
// exit path: quit, client EOF, deadline expiry, write error.
func (s *Server) handleConn(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(idleTimeout))
	sc := bufio.NewScanner(conn)
	for sc.Scan() {
		line := sc.Text()
		if line == "quit" {
			return
		}
		if _, err := fmt.Fprintln(conn, strings.ToUpper(line)); err != nil {
			return
		}
		// Deadlines are absolute, not rolling: push the deadline
		// forward after every line or an active client times out 30
		// seconds after connecting.
		_ = conn.SetDeadline(time.Now().Add(idleTimeout))
	}
	// Scan returned false: client closed, deadline expired, or a read
	// error. sc.Err() could tell them apart; an echo server does not
	// need to care, it just lets the deferred Close run.
}
