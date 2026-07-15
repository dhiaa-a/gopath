# Lab: config-watcher

Steps 03 and 04 of the project have you build the same store twice: `Store`
keeps the current `*Config` in a `sync/atomic.Value`, `MutexStore` guards a
plain field with a `sync.RWMutex`. This lab grades that work. One correctness
suite proves both implementations honor the same contract under concurrent
readers, the two benchmarks from the assessment measure both under parallel
load, and a gate test enforces the claim the whole design rests on: the
atomic version is strictly faster.

The watcher itself (fsnotify, the select loop, the debounce timer, the HTTP
handler) stays in your project repo. It needs a third-party dependency and a
config file format, and a benchmark suite is the wrong home for both. What
the lab pins is the API the rest of the program depends on:

```go
type Config struct{ Port int; LogLevel string }

NewStore(initial *Config) *Store            // atomic.Value inside
(*Store) Load() *Config                     // hot path: one atomic pointer read
(*Store) store(c *Config)                   // called by reload(), rare

NewMutexStore(initial *Config) *MutexStore  // sync.RWMutex inside
(*MutexStore) Load() *Config
(*MutexStore) store(c *Config)
```

## Where your code goes

`config/store.go` is yours. The stubs compile and return zero values, so
`go test ./...` starts out failing with test failures, not build errors.
Port your step 03 and step 04 implementations into it, or build them here
and copy them back.

## Run it

From this directory:

```
go test ./...                            # correctness, both stores
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

- `go test ./...` green.
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

`config/solution.go` holds the reference implementations behind the
`solution` build tag; CI runs the suite against it to prove the lab is
passable. Do not open it until your run is green.

The benchmarks in `config/bench_test.go` ship complete rather than stubbed.
Step 04 teaches you to write benchmarks, and these are written exactly the
way the step teaches (setup, `b.ResetTimer`, `b.RunParallel`). Read them
before you run them; then write your own in your project repo and check the
numbers agree.
