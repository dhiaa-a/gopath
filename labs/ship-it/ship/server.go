//go:build !solution

// This file is yours. The stubs compile and every one of them is wrong, so a
// fresh clone fails tests, never builds. Work until this is green:
//
//	go test ./...
//
// then run the gate, which is the exam:
//
//	go test -tags gate -run TestGate ./...
//
// The contract the suite enforces:
//
//   - LoadConfig(getenv) fills a Config from four SHIP_* variables, applies
//     the documented defaults for the ones that are unset, and returns an
//     error naming every variable it could not use, along with the value it
//     could not use. It calls getenv, never os.Getenv: that parameter is what
//     makes the config layer a function you can test with a map.
//
//   - Handler() serves three routes:
//     /healthz  always 200, from the moment the mux is serving, forever.
//     It must not consult warm, the readiness flag, or anything else.
//     /readyz   200 only while this process is worth traffic: warm has
//     returned nil and no shutdown has started. 503 otherwise.
//     /work     sleeps for the ?ms= query parameter (default 0, max 5000)
//     and returns 200. A non-integer, a negative, or anything over
//     the maximum is 400. It stands in for the upstream call a real
//     handler makes, and it is what the gate puts in flight.
//
//   - Run(ctx, ln) serves on ln, calls warm exactly once, flips readiness
//     when warm returns nil, and returns an error wrapping warm's error if it
//     does not. When ctx is cancelled it drains in the order at the top of
//     ship.go and returns nil if every in-flight request finished inside
//     ShutdownTimeout, an error if the deadline expired first. Run returning
//     is the signal that it is safe for the process to exit, so it must not
//     return while a request it accepted is still running.
//
// The reference is solution.go, behind the `solution` build tag. Do not open
// it until the gate is green.
package ship

import (
	"context"
	"net"
	"net/http"
)

// LoadConfig reads the configuration from getenv, which is os.Getenv in main
// and a map in the tests.
//
// Taking the lookup as a parameter instead of calling os.Getenv is not
// ceremony. os.Getenv reads process-global mutable state, so a test for this
// function would have to mutate the environment of the test binary and put it
// back. As a parameter it is a pure function of its input, and the suite
// passes it a map.
func LoadConfig(getenv func(string) string) (Config, error) {
	// TODO: start from the defaults documented on Config, override each one
	// that is set in the environment, and validate as you go.
	//
	// Collect the problems rather than returning at the first one: an
	// operator with two bad variables should learn about both now, not
	// discover the second one after redeploying to fix the first. errors.Join
	// takes a slice of errors and gives you one error whose message is all of
	// them.
	//
	// Name the variable and the value in every message. "invalid duration" is
	// useless in a crash loop log.
	return Config{}, nil
}

// Server is the running service. Its insides are yours: the suite only ever
// touches the three methods below, so how you hold your state is your call.
type Server struct {
	// TODO: the reference holds three things: the Config, the warm function,
	// and one flag saying whether this process is currently worth traffic.
	//
	// That flag is written by Run and read by every /readyz request, which
	// net/http serves on its own goroutine. Two goroutines, one of them
	// writing, is the definition of a data race. A bool will look like it
	// works and will be a race; sync/atomic's Bool is the whole fix and costs
	// nothing on the read path.
}

// New builds a Server from cfg. warm is the dependency check: Run calls it
// once, and /readyz stays 503 until it returns nil. It must not be nil; a
// service with nothing to wait for passes a function that returns nil
// immediately.
func New(cfg Config, warm func(context.Context) error) *Server {
	// TODO: keep what you need. New does no work and starts no goroutines:
	// nothing happens until Run.
	return &Server{}
}

// Handler returns the mux this server serves. It is exported so the suite can
// drive the routes through httptest without a listener, and so a real service
// could mount this under a parent mux.
func (s *Server) Handler() http.Handler {
	// TODO: register /healthz, /readyz and /work. Until you do, every route
	// on this mux is a 404, which is why the suite is red.
	return http.NewServeMux()
}

// Run serves on ln until ctx is cancelled, then drains and shuts down. It
// blocks. It returns nil when every request it accepted got its response.
//
// The order of the drain is the point of this whole project, and it is in the
// package doc at the top of ship.go. The two mistakes it exists to prevent:
// stopping the listener at the same moment you flip readiness (nothing routing
// to you has heard yet, so those requests are dropped), and handing the
// already-cancelled ctx to http.Server.Shutdown (it returns instantly with
// ctx.Err() and your process exits on top of live requests).
func (s *Server) Run(ctx context.Context, ln net.Listener) error {
	// TODO:
	//  1. Build the http.Server. Handler is s.Handler(), and
	//     ReadHeaderTimeout comes from the config: the zero value has none.
	//  2. Serve on ln from a goroutine, and start warm from another. The
	//     listener has to be live while warm runs, or the probes have nothing
	//     to talk to during start-up. http.ErrServerClosed is what Serve
	//     returns after a clean Shutdown; it is the success case, not an error
	//     to report.
	//  3. Wait for the first of: warm finished, Serve died, ctx cancelled.
	//  4. Drain. Readiness first, then the delay, then Shutdown with its own
	//     deadline, then Close if that deadline expires.
	return nil
}
