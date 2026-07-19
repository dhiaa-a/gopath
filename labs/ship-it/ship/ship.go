// Package ship is the service the Tier 3 "Ship it" project deploys: one
// static binary, configured entirely from the environment, that an
// orchestrator can start, probe, and stop without dropping a request.
//
// The handlers are not the interesting part. Run is. It owns the process
// lifecycle, and the ordering it enforces is the whole lesson:
//
//  1. Serve before the dependencies are warm, so the probes can answer while
//     the process is still starting. A refused connection and a 503 mean very
//     different things to an orchestrator.
//  2. Answer /readyz with 503 the instant a stop is asked for.
//  3. Keep serving anyway, for DrainDelay, because whatever is routing
//     traffic to this process has not heard about step 2 yet.
//  4. Only then stop accepting, and wait for the work already in flight.
//
// This file holds the one type the suite pins. Everything you write is in
// server.go.
package ship

import "time"

// Config is the whole configuration of the process. Every field comes from
// the environment, is read exactly once at startup by LoadConfig, and never
// changes again while the process lives. There is no config file, no reload,
// and no way for a handler to ask the environment a question at request time.
//
// The type is pinned: the suite builds Config values directly, so keep the
// field names and types. How you parse and validate them is yours.
//
// The two budgets are related to each other and to the thing supervising you.
// Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds (30 by
// default), then sends SIGKILL. DrainDelay + ShutdownTimeout is your total
// budget and it has to fit inside that window with room to spare, or the
// grace period ends mid-drain and the kernel kills you holding live requests.
// The defaults below sum to 20s against a 30s grace period.
type Config struct {
	// Addr is the TCP address to listen on. SHIP_ADDR, default
	// "127.0.0.1:8080".
	//
	// Loopback is the default on purpose. In a container you set
	// SHIP_ADDR=:8080 so the process listens on every interface, and on your
	// laptop you do not, so nothing on the coffee shop wifi can reach it and
	// your firewall never asks. Same binary, two networks, one variable.
	Addr string

	// ShutdownTimeout bounds the wait for in-flight requests once the
	// listener has closed. SHIP_SHUTDOWN_TIMEOUT, default 15s. Must be
	// greater than zero: a zero budget does not mean "wait as long as it
	// takes", it means "hang up on everyone right now".
	ShutdownTimeout time.Duration

	// DrainDelay is how long the process keeps accepting and serving after it
	// has started answering /readyz with 503. SHIP_DRAIN_DELAY, default 5s.
	// May be zero, which is only correct when nothing is load balancing you.
	//
	// This is not politeness. SIGTERM and the removal of this process from
	// the load balancer's pool are concurrent events with no ordering between
	// them, so traffic keeps arriving after the signal lands. The delay is the
	// window you give the thing in front of you to notice.
	DrainDelay time.Duration

	// ReadHeaderTimeout bounds how long a connection may take to send its
	// request headers. SHIP_READ_HEADER_TIMEOUT, default 5s. Must be greater
	// than zero.
	//
	// http.Server's zero value has no timeouts of any kind. A client that
	// opens a connection and sends one header byte per minute holds a
	// goroutine and a file descriptor for as long as it likes, which is the
	// entire Slowloris technique, and it needs no bandwidth to do it.
	ReadHeaderTimeout time.Duration
}
