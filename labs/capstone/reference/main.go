// Command linkd is the reference implementation of the GoPath capstone. It is
// what the suite and the SLO harness are held against, and it is one answer to
// SPEC.md rather than the answer: nothing in the spec requires this package
// layout, this store format, or these types.
//
//	go run ./reference -tokens tokens.json -data /tmp/linkd.json -addr 127.0.0.1:0
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	shutdownGrace = 5 * time.Second
	flushEvery    = 500 * time.Millisecond
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "listen address; port 0 means any free port")
	data := flag.String("data", "linkd.json", "path to the durable store")
	tokensPath := flag.String("tokens", "", "path to the JSON token file (required)")
	rate := flag.Float64("rate", 100, "requests per second allowed per token")
	flag.Parse()

	if err := run(*addr, *data, *tokensPath, *rate); err != nil {
		fmt.Fprintf(os.Stderr, "linkd: %v\n", err)
		os.Exit(1)
	}
}

func run(addr, data, tokensPath string, rate float64) error {
	if tokensPath == "" {
		return errors.New("-tokens is required; refusing to start a server that authenticates nobody")
	}
	tokens, err := loadTokens(tokensPath)
	if err != nil {
		return err
	}
	if rate <= 0 {
		return fmt.Errorf("-rate must be positive, got %g", rate)
	}

	store, err := openStore(data)
	if err != nil {
		return err
	}

	srv := &server{
		store:   store,
		tokens:  tokens,
		limiter: newLimiter(rate),
		metrics: newMetrics(),
		now:     time.Now,
	}

	// Bind before announcing. Printing an address we have not got yet is how
	// a harness, or a container health check, ends up racing the listener.
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	flusherDone := make(chan struct{})
	go func() {
		defer close(flusherDone)
		store.runFlusher(ctx, flushEvery)
	}()

	httpSrv := &http.Server{
		Handler:           srv.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		err := httpSrv.Serve(ln)
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		serveErr <- err
	}()

	fmt.Printf("listening on %s\n", ln.Addr().String())

	select {
	case err := <-serveErr:
		if err != nil {
			return err
		}
	case <-ctx.Done():
	}

	// Stop accepting, let in-flight requests finish, then flush. The flusher
	// gets its final write in when ctx is cancelled; waiting for it here is
	// what makes "exited 0" mean "nothing was lost".
	shutCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	shutErr := httpSrv.Shutdown(shutCtx)

	stop()
	<-flusherDone
	if err := store.flush(); err != nil {
		return fmt.Errorf("final flush: %w", err)
	}
	if shutErr != nil {
		return fmt.Errorf("shutdown: %w", shutErr)
	}
	return nil
}

func loadTokens(path string) (map[string]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read tokens: %w", err)
	}
	var tokens map[string]string
	if err := json.Unmarshal(raw, &tokens); err != nil {
		return nil, fmt.Errorf("tokens file %s is not a JSON object of token to owner: %w", path, err)
	}
	if len(tokens) == 0 {
		return nil, fmt.Errorf("tokens file %s has no tokens", path)
	}
	for tok, owner := range tokens {
		if tok == "" || owner == "" {
			return nil, fmt.Errorf("tokens file %s has an empty token or owner", path)
		}
	}
	return tokens, nil
}

// logf writes to stderr. Stdout carries exactly one line, the address, because
// something upstream is parsing it.
func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "linkd: "+format+"\n", args...)
}
