//go:build !solution

// Package server puts the middleware chain onto a real http.Server: the
// four deadlines that decide how long a stranger may hold one of your
// connections, and the shutdown that lets the requests already in flight
// finish instead of dying with the process.
//
// This file is yours. The suite in server_test.go grades the exported API
// below. The bodies are stubs that compile, so a fresh clone fails tests,
// never builds.
package server

import (
	"context"
	"net"
	"net/http"
	"time"
)

// Timeouts is the four deadlines http.Server understands, named for what
// they bound rather than for the fields they end up in.
//
// Every one of these is zero in the zero value of http.Server, and zero
// does not mean "a sensible default". It means no deadline at all.
type Timeouts struct {
	// ReadHeader bounds how long a client may take to send its request
	// headers. Nothing legitimate is slow at this.
	ReadHeader time.Duration
	// Read bounds reading the entire request, headers and body together.
	Read time.Duration
	// Write bounds the response. It starts when the request headers have
	// been read, so it bounds your handler too, not just the write.
	Write time.Duration
	// Idle bounds how long a kept-alive connection may sit between
	// requests before the server hangs up on it.
	Idle time.Duration
}

// DefaultTimeouts is the set a server on a public network should ship
// with. Every field must be positive, and ReadHeader must not be looser
// than Read.
func DefaultTimeouts() Timeouts {
	// TODO: four positive durations. ReadHeader is the tightest: it is the
	// only one nothing legitimate needs. Read and Write have to be large
	// enough for the slowest honest request you intend to serve.
	return Timeouts{}
}

// New returns an *http.Server that serves h with every field of t applied.
//
// The http.Server field names are not the names above, and the mapping is
// the whole exercise: wiring three of the four is the usual bug, and the
// one you skip has no deadline at all.
func New(h http.Handler, t Timeouts) *http.Server {
	// TODO: apply all four.
	return &http.Server{Handler: h}
}

// Run serves ln until ctx is cancelled. Then it stops accepting new
// connections and gives the requests already in flight up to grace to
// finish, returning nil only when every one of them did. If grace runs
// out it hangs up on what is left and returns an error saying so.
func Run(ctx context.Context, srv *http.Server, ln net.Listener, grace time.Duration) error {
	// TODO: Serve in a goroutine, wait for ctx.Done(), then Shutdown with
	// a context of your own carrying the grace deadline.
	//
	// Two things will bite you here. Serve blocks forever and therefore
	// always returns a non-nil error; after a clean stop that error is the
	// sentinel http.ErrServerClosed, which is not a failure. And the
	// context that asked you to stop is already cancelled, so it is not
	// the one to hand to Shutdown.
	return nil
}
