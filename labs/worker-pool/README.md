# Lab: worker pool

Grades the Tier 2 worker pool project. You implement one package, `pool/`,
against a pinned API; a black-box suite checks the concurrency contract and a
gate benchmark checks throughput.

## The contract

The suite compiles against exactly this surface (`Job` and `Result` are
pinned in `pool/types.go`; your code goes in `pool/pool.go`):

```go
New(workers, buffer int, fn func(Job) Result) *Pool
(*Pool).Submit(j Job) error
(*Pool).Results() <-chan Result
(*Pool).Stop()
```

What the tests enforce, guarantee by guarantee:

- `New` starts `workers` goroutines reading from a jobs channel with
  capacity `buffer`.
- `Submit` blocks when the buffer is full and every worker is busy. That is
  backpressure doing its job, not a bug. Once `Stop` has been called it
  returns a non-nil error instead, and it never panics, even when it races
  `Stop` from another goroutine.
- Every job `Submit` accepted is processed by `fn` exactly once, and the
  `Result` fn returned is delivered on `Results()` unaltered. Error results
  are results: a failing job produces a `Result` with `Err` set, it does not
  vanish.
- `Stop` closes the intake, waits for the workers to drain the queue and
  exit, then closes the results channel. It blocks until all of that is done
  and is safe to call from several goroutines at once. Keep a receiver
  draining `Results()` while stopping, or your workers have nowhere to put
  the last results and `Stop` can never return.

Who closes which channel is the whole exercise. One rule prevents every
"send on closed channel" panic: a channel is closed by its only sender,
exactly once, and never while another goroutine can still be sending on it.

## Run it

From this directory:

```
go test -race ./...
```

Failing tests name the guarantee you broke. Every wait in the suite has a 5
second deadline, so a leaked or blocked goroutine shows up as a named
failure, not a hung run. The race detector needs cgo: on Windows without a
gcc toolchain, drop `-race` (the suite still checks delivery and shutdown,
the detector just cannot watch for data races).

Then measure:

```
go test -bench . -benchmem ./...
```

`BenchmarkPool` sweeps the jobs buffer across 0, 10, 100, 1000 with 8
workers and a no-op worker fn, reporting jobs/s. Unbuffered means every
Submit is a synchronous handshake with a worker, two scheduler wakeups per
job; a buffer lets Submit run ahead of the workers and amortizes that cost.

Finally, the gate. No `-race` here: the detector instruments every channel
operation and would measure itself, not your pool.

```
go test -tags gate -run TestGate ./...
```

`TestGateThroughput` requires more than 500,000 jobs/s with 8 workers and
buffer 100. The reference clears the floor with room to spare; if you are
under it, look for a lock held across the channel send, per-job allocations,
or an unbuffered results channel.

That 500,000 is a deliberate absolute floor, not the baseline-versus-optimized
relative comparison the Tier 3 gates use. Throughput in jobs/s is
machine-relative, but the reference clears this floor by a wide margin (several
million jobs/s on an ordinary laptop), so the headroom absorbs a slow machine
rather than pinning the gate to a brittle ns/op threshold that only holds on
the machine that set it.

## Done means

- `go test -race ./...` green (plain `go test ./...` on Windows without gcc).
- `go test -tags gate -run TestGate ./...` green.

The reference implementation is `pool/solution.go`, sealed behind the
`solution` build tag so `go test` always grades your code. Do not open it
until your run is green.
