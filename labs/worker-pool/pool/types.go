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
