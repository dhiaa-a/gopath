# Review: unowned-goroutines

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. Fire-and-forget habits come from languages where
something else owns your threads. In Java you hand work to an
`ExecutorService`: the pool owns the thread's lifecycle, `submit` hands
back a `Future` that holds the result, and an exception is caught and
stored until you ask for it. Python's `ThreadPoolExecutor` has the same
shape, and even a bare `threading.Thread` comes with `join()`. Those tools
teach a habit: starting work is enough, because a runtime adult supervises
it. Go deliberately ships no adult. A goroutine has no parent, no handle,
no return channel, and no exception handler; `go f()` is not async/await,
because there is nothing awaitable: when `f` returns, its result is
discarded on the spot. The runtime schedules goroutines; it never
supervises them. The `go` statement gives you exactly one guarantee, a
happens-before edge into the goroutine (everything written before `go` is
visible inside it), and no edge ever comes back out unless you build one.
You are the executor. The starter shipped without one.

## 1. The error nobody can hear

```go
go enrichInto(results, i, it)
```

The linter's line:

```
enrich.go:41:16: Error return value is not checked (errcheck)
```

`enrichInto` returns an error, and the `go` statement is its only caller.
A goroutine's return values have no destination by construction: there is
no future to store them, no caller frame waiting, so the error is popped
off a stack nobody reads and gone, silently. Not logged, not panicking,
not counted. In Java this exception would sit in the `Future` until
`get()` re-threw it; in Go the language does exactly what you wrote, which
is nothing.

Downstream of that discard sits mistake number four: `ProcessAll` still
returns `(..., error)`, its doc comment still promises an error for
malformed items, and the body hardcodes `nil`. The signature is a contract
the implementation quietly stopped honoring. Worth noticing: `unparam`
stayed silent about the always-nil return, because by default it does not
inspect exported functions (their callers may live outside the package).
`errcheck` carried this finding alone, and fixing the discard is what
forces the `nil` to become a real value again.

## 2. A race with a timer

```go
// The per-item work is tiny, so a quarter second is plenty of time
// for every goroutine to finish before we read the slice.
time.Sleep(250 * time.Millisecond)
```

The linter's line:

```
enrich.go:45:2: use of `time.Sleep` forbidden because "sleeping is not
synchronization; wait on the thing itself (WaitGroup, channel, context)"
(forbidigo)
```

Sleep-as-sync is a bet that the work finishes inside the timer, and the
bet loses on both sides. Too short, and the caller reads a half-filled
slice the day an item hits a slow path or the CI box is loaded. Too long,
and every caller pays the full timer for any amount of work: the
empty-input test in this suite spends a quarter second enriching nothing,
and the whole suite runs about 1.7s against the starter versus 0.2s
against the reference. Today the bet always wins, which is exactly what
makes it dangerous: the test is green today and flaky the day the work
grows. That is the accent.

The deeper problem is that sleeping buys no ordering at all. The Go memory
model orders events by synchronization edges, not by wall clock, and
`time.Sleep` creates no edge. The goroutines never race each other (each
writes only its own `results[i]`), but the write of `results[i]` and the
read after the sleep are unsynchronized, so the reader has no guarantee it
sees the writes, however long it slept. This is not theoretical: run
`go test -race ./...` on the starter and the detector fails the suite,
pointing at the write inside the goroutine and the read after the sleep.
The program computes right answers on every real schedule and is still
wrong by the model. A timer cannot create visibility; only synchronization
can.

## 3. Ownership is a counter with edges

The reference's core:

```go
var wg sync.WaitGroup
for i, it := range items {
	wg.Add(1)
	go func() {
		defer wg.Done()
		results[i], errs[i] = enrichItem(i, it)
	}()
}
wg.Wait()
```

`sync.WaitGroup` is the ownership primitive because Add/Done/Wait is a
counter with happens-before edges. `Add(1)` runs in the spawning
goroutine, before `go`: if the child did its own `Add`, `Wait` could
observe zero and return before the scheduler ever ran the child. `Done` is
deferred, so the counter falls even if the work panics someday. And each
`Done` establishes an edge to `Wait`'s return, so every write made before
`Done` is visible after `Wait`. Visibility is the thing the sleep could
not buy at any duration; the WaitGroup buys it exactly, and returns the
moment the work actually finishes, which is why the reference is also
eight times faster through the same suite.

One non-event worth a sentence: the closure captures `i` and `it`
directly. Since Go 1.22 loop variables are per-iteration, so there is no
`i := i` ceremony; leftover copies of that ceremony are what
`copyloopvar` flags.

## 4. Collecting errors without a lock

```go
errs := make([]error, len(items))
// in the goroutine:
results[i], errs[i] = enrichItem(i, it)
// after Wait:
if err := errors.Join(errs...); err != nil {
	return nil, fmt.Errorf("process %d items: %w", len(items), err)
}
```

Each goroutine already owns index `i` of the results slice; giving it
index `i` of an error slice extends the same ownership, so there is no
contention and nothing to lock. The alternative, a mutex-guarded
`append`, collects errors in completion order (nondeterministic), adds a
lock, and buys nothing at this scale. `errors.Join` drops the nils and
returns nil when every item succeeded, so the happy path costs one pass
over the slice. The final wrap adds context once, at the boundary, and
`%w` keeps `errors.Is(err, ErrNoSKU)` working through both the wrap and
the join. Mind the guard around the wrap: `fmt.Errorf("...: %w", err)`
with a nil `err` manufactures a non-nil error out of nothing, so join
first, wrap only if something is there.

## 5. The test the suite could not write

Look at what the suite asserts: results correct, order preserved, and
`err == nil` on the happy path. It never feeds `ProcessAll` a malformed item,
because it cannot: this track's contract is that the starter passes the
suite, and the starter returns nil unconditionally, so any test demanding
a real error would be red on day one. The error-propagation lesson was
carried by the linter instead: `errcheck` is what dragged the discarded
error into the open. When a behavior cannot be pinned by tests, a
mechanical gate elsewhere still can; that is worth remembering when you
design suites of your own.

To watch the reference do what the starter could not, seed a failure by
hand. Drop this in the exercise directory as `seed_test.go`:

```go
// seed_test.go: temporary, delete after running.
package enrich_test

import (
	"errors"
	"testing"

	enrich "gopath.dev/labs/idioms/unowned-goroutines"
)

func TestSeededFailure(t *testing.T) {
	_, err := enrich.ProcessAll([]enrich.Item{
		{Name: "no sku at all", Cents: 100},
		{SKU: "neg-1", Name: "priced below zero", Cents: -5},
	})
	if !errors.Is(err, enrich.ErrNoSKU) || !errors.Is(err, enrich.ErrNegativePrice) {
		t.Fatalf("err = %v, want both sentinels", err)
	}
}
```

```
go test -tags solution -run TestSeededFailure ./...   # reference: passes, both failures in one error
go test -run TestSeededFailure ./...                  # starter: fails, err is nil, always
```

Both sentinels surface in a single returned error, and `errors.Is` finds
each of them through two layers of structure. Delete the file when you are
done with it.

## The reference, structurally

`solution.go` keeps the starter's shape: same types, same sentinels, same
per-item helper. `ProcessAll` gained three pieces of structure: a
WaitGroup that owns the fan-out, an error slice that gives every goroutine
somewhere to put its failure, and one join-and-wrap at the boundary. It is
a dozen lines longer than the starter, and every added line is ownership.
Idiomatic Go is not always shorter; here the starter was short the way an
unpaid invoice is short.

## The smell the linter cannot see: unbounded fan-out

One goroutine per item is the right call at this exercise's scale and an
incident at ten million items. Goroutines are cheap, a few kilobytes of
stack to start, but ten million of them is gigabytes of stacks and a
scheduler drowning in runnables, all racing to hammer whatever sits
downstream. Nothing in this config counts goroutines, because no linter
can know your production cardinality; that judgment stays with you. The
fix at scale is a bounded pool: N workers pulling items off a channel, so
concurrency is a dial instead of a function of input size. The worker-pool
project (T2) builds exactly that. For now, know where the cliff is.

## What this trained

- `go f()` discards `f`'s results by construction: errors must be carried
  out of a goroutine explicitly, or they are gone silently.
- `time.Sleep` as synchronization: a bet with two losing sides, no
  happens-before edge, and a `-race` failure even while the suite is
  green.
- `sync.WaitGroup` as lifecycle ownership: Add before `go`, deferred
  Done, Wait as the visibility barrier.
- Per-index error collection plus `errors.Join`, wrapped once with `%w`
  so `errors.Is` still reaches the sentinels through the join.
- A suite gap covered by the linter: behavior the tests could not pin
  (the starter-green contract forbids it) still got enforced mechanically.
- Unbounded fan-out, the smell no linter counts; bounded worker pools are
  the next step.
