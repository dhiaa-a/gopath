// Job and Result are the pinned data types of the pool contract. The test
// suite compiles against them, so their shape is fixed; everything else about
// the pool's insides is your call.
package pool

// Job is one unit of work. IDs are chosen by the caller; the suite uses them
// to prove every accepted job comes back exactly once.
type Job struct {
	ID      int
	Payload any
}

// Result is the outcome of one Job. By convention exactly one of Output and
// Err is meaningful, so callers handle successes and failures from a single
// channel instead of selecting over two.
type Result struct {
	JobID  int
	Output any
	Err    error
}

// GenericJob and GenericResult are Job and Result with the two `any` fields
// replaced by type parameters. They are pinned by the suite in the same way.
//
// The names are a lab artifact: both pools live in one package so you can read
// them side by side, and `Job` was taken. A real package ships one of these,
// and it is called Job.
type GenericJob[In any] struct {
	ID      int
	Payload In
}

// GenericResult is the outcome of one GenericJob. Err stays a plain error:
// "it failed" is not a domain-specific type and parameterizing it would buy
// nothing.
type GenericResult[Out any] struct {
	JobID  int
	Output Out
	Err    error
}
