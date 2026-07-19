# Lab: config-watcher

This lab grades the two pieces of the reloader that hold still long enough to
be graded.

**The debounce** (step 02). One save produces a burst of file system events;
`Debounce` collapses the burst into a single reload and stops cleanly when its
context is cancelled. The suite proves a burst of any length fires exactly
once, and that a reload armed just before shutdown never lands after it.

**The store** (steps 04 through 08). The same contract built twice: `Store`
keeps the current `*Config` in a `sync/atomic.Value`, `MutexStore` guards a
plain field with a `sync.RWMutex`. One correctness suite proves both honor
that contract under concurrent readers, the two benchmarks from the assessment
measure both under parallel load, and a gate test enforces the claim the whole
design rests on: the atomic version is strictly faster.

What stays in your project repo is everything that needs a file system or a
dependency: fsnotify, the config file format, `loadFromFile`, the HTTP
handler. A benchmark suite is the wrong home for those. Note that `Debounce`
takes a plain `<-chan struct{}` rather than an fsnotify channel for exactly
this reason, and that is not a lab convenience: a debounce that names its
event source cannot be tested without producing real file system events.
Factoring the timer logic away from its trigger is what makes it checkable
here in milliseconds, and it is how you would write it anyway.

What the lab pins is the API the rest of the program depends on:

```go
type Config struct{ Port int; LogLevel string }

Debounce(ctx, events <-chan struct{}, window time.Duration, fire func())

NewStore(initial *Config) *Store            // atomic.Value inside
(*Store) Load() *Config                     // hot path: one atomic pointer read
(*Store) store(c *Config)                   // called by reload(), rare

NewMutexStore(initial *Config) *MutexStore  // sync.RWMutex inside
(*MutexStore) Load() *Config
(*MutexStore) store(c *Config)
```

## Where your code goes

`config/debounce.go` and `config/store.go` are yours. The stubs compile and
return zero values, so `go test ./...` starts out failing with test failures,
not build errors. Port your step 02, 04, and 06 implementations into them, or
build them here and copy them back.

## Run it

From this directory:

```
go test ./...                            # correctness: debounce and both stores
go test -run TestDebounce ./...          # step 02 only
go test -run 'TestLoad|TestStore' ./...  # the store contract only
go test -bench . -benchmem ./...         # tests plus both Load benchmarks
go test -tags gate -run TestGate ./...   # the gate: atomic must beat mutex
```

For the numbers the assessment asks you to record, take five samples:

```
go test -bench . -benchmem -count=5 ./...
```

If you have a C toolchain (the race detector needs cgo), run the suite under
`-race` as well; both implementations must stay clean:

```
go test -race ./...
```

## What done looks like

- `go test ./...` green: the debounce collapses a burst and stops on cancel,
  and both stores honor the same contract under concurrent readers.
- Both benchmarks complete with `0 allocs/op`, and `BenchmarkAtomicLoad` is
  clearly faster. Expect roughly 1 to 2 ns/op for atomic and 10 to 50 ns/op
  for the mutex, with the gap widening as core count grows.
- `go test -tags gate -run TestGate ./...` passes. The gate compares the two
  in the same process, so it holds on any machine: no absolute thresholds.

Why the gap exists: `atomic.Value.Load` reads a pointer without writing any
shared memory, so every core keeps the cache line in the shared state.
`RLock` and `RUnlock` each perform an atomic read-modify-write on the mutex
word, so parallel readers keep stealing that line from each other's caches.
More cores, more stealing, wider gap.

## The reference and the benchmarks

`config/solution.go` and `config/debounce_solution.go` hold the reference
implementations behind the `solution` build tag; CI runs the suite against
them to prove the lab is passable. Do not open them until your run is green.

The benchmarks in `config/bench_test.go` ship complete rather than stubbed.
Step 04 teaches you to write benchmarks, and these are written exactly the
way the step teaches (setup, `b.ResetTimer`, `b.RunParallel`). Read them
before you run them; then write your own in your project repo and check the
numbers agree.
