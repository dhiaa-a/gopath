//go:build solution

// Reference implementation of the generic pool. Do not read this until your
// own run is green.
package pool

import "sync"

// GenericPool is the same pool as Pool, with the two `any` fields replaced by
// type parameters. Compare it against Pool line by line: the concurrency is
// character-for-character identical. Nothing about the ownership rules, the
// RWMutex around the send, the Once, or the WaitGroup changes when the
// element type stops being an interface. That is the point of the exercise:
// the type parameters buy a call site and a channel layout, not a different
// program.
type GenericPool[In, Out any] struct {
	jobs    chan GenericJob[In]
	results chan GenericResult[Out]
	wg      sync.WaitGroup

	mu      sync.RWMutex
	stopped bool

	once sync.Once
}

// NewGeneric creates the pool and starts its workers.
func NewGeneric[In, Out any](workers, buffer int, fn func(GenericJob[In]) GenericResult[Out]) *GenericPool[In, Out] {
	p := &GenericPool[In, Out]{
		jobs:    make(chan GenericJob[In], buffer),
		results: make(chan GenericResult[Out], buffer),
	}
	p.wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func() {
			defer p.wg.Done()
			for j := range p.jobs {
				p.results <- fn(j)
			}
		}()
	}
	return p
}

// Submit hands one job to the pool, blocking for buffer space. It returns a
// non-nil error once Stop has been called.
func (p *GenericPool[In, Out]) Submit(j GenericJob[In]) error {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.stopped {
		return errStopped
	}
	p.jobs <- j
	return nil
}

// Results returns the channel results are delivered on. The pool closes it
// after Stop, once every worker has exited.
func (p *GenericPool[In, Out]) Results() <-chan GenericResult[Out] {
	return p.results
}

// Stop shuts the pool down: no new jobs, queued jobs finish, workers exit,
// results channel closes. It blocks until that is done and is idempotent.
func (p *GenericPool[In, Out]) Stop() {
	p.once.Do(func() {
		p.mu.Lock()
		p.stopped = true
		close(p.jobs)
		p.mu.Unlock()
		p.wg.Wait()
		close(p.results)
	})
}
