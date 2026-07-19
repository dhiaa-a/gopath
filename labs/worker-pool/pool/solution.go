//go:build solution

// Reference implementation. Do not read this until your own run is green;
// it exists so the repo's CI can prove the suite passes against a real pool.
package pool

import (
	"errors"
	"sync"
)

var errStopped = errors.New("pool: stopped")

// Pool runs a fixed set of workers over a buffered jobs channel.
//
// The ownership rules are the whole design:
//
//   - Submit is the only sender on jobs. Stop is the only closer, and the
//     RWMutex guarantees no send is in flight when close happens: Submit
//     sends while holding the read lock, Stop closes while holding the
//     write lock. That mutual exclusion, not luck, is what makes the
//     "send on closed channel" panic impossible.
//   - Workers are the only senders on results. The pool closes results only
//     after wg.Wait says every worker has exited, so a consumer ranging
//     over Results terminates naturally.
//   - once makes Stop idempotent, and because Once.Do blocks every caller
//     until the first call's function returns, every Stop caller blocks
//     until shutdown actually finished.
//
// Note what is absent: no context. Stop here is graceful (accepted jobs
// always finish), and graceful shutdown falls out of channel close
// semantics alone. If you also wanted a hard abort that abandons queued
// jobs, that is where a ctx.Done() case in the worker's send and receive
// would earn its place.
type Pool struct {
	jobs    chan Job
	results chan Result
	wg      sync.WaitGroup

	mu      sync.RWMutex
	stopped bool

	once sync.Once
}

// New creates the pool and starts its workers.
func New(workers, buffer int, fn func(Job) Result) *Pool {
	p := &Pool{
		jobs:    make(chan Job, buffer),
		results: make(chan Result, buffer),
	}
	p.wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer p.wg.Done()
			// range ends when Stop closes jobs and the queue is drained,
			// so every accepted job is processed exactly once.
			for j := range p.jobs {
				p.results <- fn(j)
			}
		}()
	}
	return p
}

// Submit hands one job to the pool, blocking for buffer space. It returns a
// non-nil error once Stop has been called.
func (p *Pool) Submit(j Job) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.stopped {
		return errStopped
	}
	// The send happens under the read lock: Stop cannot take the write lock
	// and close jobs while we are mid-send. Blocking here while the buffer
	// is full is fine; the workers are alive until jobs closes, so the send
	// always completes.
	p.jobs <- j
	return nil
}

// Results returns the channel results are delivered on. The pool closes it
// after Stop, once every worker has exited.
func (p *Pool) Results() <-chan Result {
	return p.results
}

// Stop shuts the pool down: no new jobs, queued jobs finish, workers exit,
// results channel closes. It blocks until that is done and is idempotent.
func (p *Pool) Stop() {
	p.once.Do(func() {
		p.mu.Lock()
		p.stopped = true
		close(p.jobs)
		p.mu.Unlock()
		// Workers drain the remaining queue and exit. This wait only
		// terminates if someone keeps receiving from Results; the README
		// spells out that caller obligation.
		p.wg.Wait()
		close(p.results)
	})
}
