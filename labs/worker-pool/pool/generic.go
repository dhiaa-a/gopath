//go:build !solution

// The generic pool: step 08. This file is yours, the same way pool.go is.
//
// Do not start here. GenericPool is Pool with the two `any` fields replaced by
// type parameters, and it is worth nothing to you until Pool is green: the
// point of the step is the comparison, and you cannot compare against a pool
// you have not written yet.
//
// The concurrency does not change. Copy your Pool across, replace Job with
// GenericJob[In] and Result with GenericResult[Out], and let the compiler walk
// you through the rest. If you find yourself redesigning the shutdown while you
// are in here, stop: that is a sign you are changing two things at once.
//
// What the suite enforces, on top of everything Pool already owed you:
//
//   - The same contract, generically. generic_test.go instantiates the pool at
//     three different type pairs and reruns the delivery and shutdown checks.
//   - No per-job boxing. The gate measures allocations per job and requires
//     GenericPool to be flat zero while Pool is not.
package pool

// GenericPool runs a fixed set of workers over a buffered jobs channel,
// carrying In values in and Out values out.
type GenericPool[In, Out any] struct {
	// Your fields here.
}

// NewGeneric creates the pool and starts its workers.
func NewGeneric[In, Out any](workers, buffer int, fn func(GenericJob[In]) GenericResult[Out]) *GenericPool[In, Out] {
	return &GenericPool[In, Out]{}
}

// Submit hands one job to the pool, blocking for buffer space. It returns a
// non-nil error once Stop has been called.
func (p *GenericPool[In, Out]) Submit(j GenericJob[In]) error {
	return nil
}

// Results returns the channel results are delivered on. The pool closes it
// after Stop, once every worker has exited.
func (p *GenericPool[In, Out]) Results() <-chan GenericResult[Out] {
	return nil
}

// Stop shuts the pool down: no new jobs, queued jobs finish, workers exit,
// results channel closes. It blocks until that is done and is idempotent.
func (p *GenericPool[In, Out]) Stop() {}
