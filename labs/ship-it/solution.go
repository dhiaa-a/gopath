//go:build solution

// Reference implementation of the process contract. Compiled only with
// -tags solution. Do not read it until your own binary drains cleanly.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gopath.dev/labs/ship-it/ship"
)

var version = "dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "ship-it:", err)
		os.Exit(1)
	}
}

func run() error {
	// Logs go to stdout as JSON because that is what a log collector reads.
	// Nothing in a container writes to a file: the filesystem goes away with
	// the container, and something else owns rotation, shipping, and
	// retention now.
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Everything the process needs from the outside, read once, before
	// anything is listening.
	cfg, err := ship.LoadConfig(os.Getenv)
	if err != nil {
		return err
	}

	// SIGTERM is what Kubernetes, systemd, and `docker stop` send.
	// os.Interrupt is Ctrl-C. NotifyContext turns the first one that arrives
	// into a cancelled context, which is the only shutdown vocabulary the rest
	// of the program needs to know.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Bind here rather than inside Run: "port already in use" is a startup
	// failure, and a startup failure belongs in the exit code.
	ln, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}

	log.Info("starting",
		"version", version,
		"addr", ln.Addr().String(),
		"drain_delay", cfg.DrainDelay.String(),
		"shutdown_timeout", cfg.ShutdownTimeout.String(),
	)

	if err := ship.New(cfg, warmup).Run(ctx, ln); err != nil {
		return err
	}
	log.Info("stopped cleanly", "version", version)
	return nil
}

// warmup stands in for the dependency wiring a real service does before it is
// worth sending traffic to.
func warmup(ctx context.Context) error {
	select {
	case <-time.After(2 * time.Second):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
