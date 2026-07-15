//go:build !solution

// Package pool implements a bounded worker pool: N workers ranging over a
// buffered jobs channel, results flowing out on one results channel.
//
// This file is yours. Replace the stubs until `go test -race ./...` is
// green, then run the gate: `go test -tags gate -run TestGate ./...`.
//
// The contract the suite enforces:
//
//   - New(workers, buffer, fn) starts exactly `workers` goroutines reading
//     from a jobs channel with capacity `buffer`.
//   - Submit blocks when the buffer is full and every worker is busy; that
//     is backpressure, not a bug. After Stop it returns a non-nil error.
//     It must never panic, even when it races Stop.
//   - Every job Submit accepted is processed by fn exactly once, and the
//     Result fn returned is delivered on Results() unaltered.
//   - Stop closes the intake, waits for the workers to drain the queue and
//     exit, then closes the results channel. It blocks until all of that is
//     done and is safe to call from several goroutines at once.
//
// Before you add fields, answer the ownership questions from step 01: a
// channel is closed by its only sender, exactly once. Submit is the only
// sender on jobs, so only the shutdown path may close it, and only once the
// two can no longer race (sync.Once makes Stop idempotent, but Once alone
// does not stop a concurrent Submit from sending on a closed channel).
// The workers are the only senders on results, so results closes only after
// every worker has exited (sync.WaitGroup knows when that is).
package pool

// Pool runs a fixed set of workers over a buffered jobs channel.
type Pool struct {
	// Your fields here.
}

// New creates the pool and starts its workers.
func New(workers, buffer int, fn func(Job) Result) *Pool {
	return &Pool{}
}

// Submit hands one job to the pool, blocking for buffer space. It returns a
// non-nil error once Stop has been called.
func (p *Pool) Submit(j Job) error {
	return nil
}

// Results returns the channel results are delivered on. The pool closes it
// after Stop, once every worker has exited.
func (p *Pool) Results() <-chan Result {
	return nil
}

// Stop shuts the pool down: no new jobs, queued jobs finish, workers exit,
// results channel closes. It blocks until that is done and is idempotent.
func (p *Pool) Stop() {}
