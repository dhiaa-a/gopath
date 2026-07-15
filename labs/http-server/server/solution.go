//go:build solution

// Package server: reference implementation. Compiled only with
// -tags solution; go test without the tag never sees this file. Do not
// read it until your own run is green.
package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Timeouts is the four deadlines http.Server understands.
type Timeouts struct {
	ReadHeader time.Duration
	Read       time.Duration
	Write      time.Duration
	Idle       time.Duration
}

// DefaultTimeouts is the set a public server should ship with.
//
// ReadHeader is tight because no honest client needs five seconds to send
// a request line and a dozen headers. Read and Write are loose enough for
// a real upload and a real response: Write bounds the handler, so anything
// tighter kills your own slow endpoints. Idle is the loosest of the four
// because a kept-alive connection costs one file descriptor and saves a
// handshake, which is a trade worth making for two minutes.
func DefaultTimeouts() Timeouts {
	return Timeouts{
		ReadHeader: 5 * time.Second,
		Read:       30 * time.Second,
		Write:      30 * time.Second,
		Idle:       120 * time.Second,
	}
}

// New returns an *http.Server serving h with every deadline in t applied.
func New(h http.Handler, t Timeouts) *http.Server {
	return &http.Server{
		Handler:           h,
		ReadHeaderTimeout: t.ReadHeader,
		ReadTimeout:       t.Read,
		WriteTimeout:      t.Write,
		IdleTimeout:       t.Idle,
	}
}

// Run serves ln until ctx is cancelled, then drains.
func Run(ctx context.Context, srv *http.Server, ln net.Listener, grace time.Duration) error {
	// Buffered so this goroutine can always finish, even on the error
	// path below where nobody is left to receive.
	served := make(chan error, 1)
	go func() {
		err := srv.Serve(ln)
		// Serve blocks until something stops it, so it has no success
		// return: it always hands back a non-nil error. ErrServerClosed is
		// the sentinel meaning "you closed me on purpose", which is the
		// opposite of a failure and must not be reported as one.
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		served <- err
	}()

	select {
	case err := <-served:
		// Serve gave up without being asked: the listener broke.
		return err
	case <-ctx.Done():
	}

	// A fresh context, not ctx. ctx is the one that just told us to stop,
	// so it is already cancelled: hand it to Shutdown and Shutdown honours
	// it immediately, waiting for nothing. Shutdown's job starts exactly
	// where ctx's job ended, so it gets a deadline of its own.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		// Shutdown waits; it does not interrupt. Out of grace, the only
		// way to stop waiting is to hang up on whatever is still running.
		srv.Close()
		return fmt.Errorf("in-flight requests did not finish inside %s: %w", grace, err)
	}
	// Shutdown returned nil, so every handler finished. Wait for Serve to
	// return too, so Run cannot outlive the server it started.
	return <-served
}
