//go:build !solution

// Command ship-it is the service the Tier 3 "Ship it" project deploys.
//
// This file is yours, and it is the process contract: what the environment
// gives us, what we listen on, what happens when the supervisor says stop, and
// what the exit code tells whatever started us. Nothing here is graded by the
// suite, because none of it is reachable from a test: a test cannot send this
// process a signal and watch it exit. You verify this file by running it.
//
//	go run . &
//	curl -i localhost:8080/readyz     # 503 for the first two seconds
//	curl -i localhost:8080/healthz    # 200 immediately
//	kill -TERM %1                     # or Ctrl-C in the foreground
//
// The reference is solution.go, behind the `solution` build tag.
package main

import (
	"context"
	"fmt"
	"os"
	"time"
)

// version is stamped in at link time, not read from the environment:
//
//	go build -ldflags "-X main.version=$(git rev-parse --short HEAD)" -o ship-it .
//
// Which build is running is a property of the binary, so it belongs in the
// binary. Read it from an env var and a copy-pasted deployment manifest can
// make the process lie about its own identity, which is a bad thing to
// discover while bisecting an incident.
var version = "dev"

func main() {
	// main does one job: turn an error into an exit code. Everything that can
	// fail lives in run, where a deferred call still runs. os.Exit does not
	// run deferred functions, which is why it appears here and nowhere else.
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "ship-it:", err)
		os.Exit(1)
	}
}

func run() error {
	// TODO step 01: read the whole configuration, once, before anything else
	// exists.
	//
	//	cfg, err := ship.LoadConfig(os.Getenv)
	//
	// A bad SHIP_* value has to stop the process here, with exit code 1 and
	// nothing listening. A crash loop is a loud, obvious, five-second failure.
	// A process that started with a silently defaulted timeout is a quiet one
	// you find out about during an incident.

	// TODO step 05: trap the signals an orchestrator actually sends.
	//
	//	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	//	defer stop()
	//
	// SIGTERM is what Kubernetes, systemd, and `docker stop` send. os.Interrupt
	// is Ctrl-C. Trap neither and the Go runtime's default handler kills the
	// process where it stands, mid-request, with no drain at all.

	// TODO: bind the listener here, not inside Run. "Port already in use" is a
	// startup failure that belongs in the exit code, not in a goroutine.
	//
	//	ln, err := net.Listen("tcp", cfg.Addr)

	// TODO: build the server and hand it the listener. Run blocks until ctx is
	// cancelled, then drains, and returns nil only if the drain was clean.
	//
	//	srv := ship.New(cfg, warmup)
	//	return srv.Run(ctx, ln)
	return nil
}

// warmup stands in for the dependency wiring a real service does before it is
// worth sending traffic to: opening the database pool, loading the routing
// table, reading a feature flag snapshot. /readyz stays 503 until it returns
// nil, so two seconds here is two seconds of visible, honest start-up.
func warmup(ctx context.Context) error {
	select {
	case <-time.After(2 * time.Second):
		return nil
	case <-ctx.Done():
		// Told to stop before we were ever ready. Do not report success.
		return ctx.Err()
	}
}
