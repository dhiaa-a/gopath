# Capstone: linkd

The last thing you build. A link shortener with API-key auth, per-key rate
limiting, durable storage, and metrics, specified in [SPEC.md](SPEC.md) and
graded by a suite that never reads your source.

```
go run ./suite -target ./mine     conformance, 34 checks
go run ./slo   -target ./mine     four service level objectives
```

There are no steps here, no starter functions, and no hints. Every other lab in
this repo hands you a skeleton. This one hands you a spec and a way to find out.

## Layout

| Path | What it is |
| --- | --- |
| `SPEC.md` | the brief. Everything in it is checked |
| `starter/` | an empty target, so `-target ./starter` fails honestly |
| `reference/` | one correct implementation, used to check the checker |
| `suite/` | the conformance suite |
| `slo/` | the load harness |
| `seed/` | the seeded-bug prover |
| `internal/harness/` | builds a target, runs it, talks HTTP to it |
| `internal/conform/` | the checks themselves |

## What `check.sh` proves

```
./check.sh                 all three stages, about 100 seconds
SKIP_GATES=1 ./check.sh    skip the load run
```

**Conformance.** The reference passes all 34 checks.

**Seeded bugs.** Eleven deliberate bugs go into a copy of the reference, one at
a time, and each must be caught by the checks it names. This is the stage that
makes the other two mean anything. A suite that has only ever been run against
correct code has not been tested, it has been agreed with.

The prover keeps three failure modes apart, because they mean different things:

| | |
| --- | --- |
| `stale` | the code the seed patches has moved, so the bug was never introduced |
| `broken` | the patched code does not compile, so nothing was proven |
| `missed` | the bug went in, it built, and the suite passed anyway |

Only `missed` is a hole in the suite. The first two are bugs in the seed table,
and treating either as a pass is how a harness rots into decoration.

**Objectives.** The reference meets its own SLOs. If it could not, the numbers
would be aspirations rather than thresholds.

## The seeded bugs

Ten of the eleven come from the failure labs at [`../failures`](../failures), so
a submission that trips one has somewhere to go and read.

| Seed | Class | Caught by |
| --- | --- | --- |
| `data-race` | data-race | `concurrency/mixed-load-stays-up` |
| `goroutine-leak` | goroutine-leak | `concurrency/no-goroutine-leak` |
| `time-after-leak` | time-after-leak | `concurrency/no-goroutine-leak` |
| `nil-map-write` | nil-map-write | `create/generated-code-shape` |
| `json-silent-zero` | json-silent-zero | `create/expires-in-honoured`, `redirect/expired-410` |
| `typed-nil` | typed-nil | `delete/removes-link` |
| `deadlock` | deadlock | `metrics/counters` |
| `bytes-vs-runes` | bytes-vs-runes | `create/alias-length-counts-runes` |
| `append-sharing` | append-sharing | `list/only-owner-links` |
| `no-write-through` | (this spec) | `durability/writes-survive-kill` |
| `shared-rate-bucket` | (this spec) | `ratelimit/buckets-are-per-token` |

`go run ./seed -list` prints what each one breaks and why.

## What a black-box suite cannot see

Six of the fifteen failure classes have no seed here, and the reason is worth
more than the seeds that do.

**Lost updates are not observable from outside.** The first version of the
`data-race` seed removed the lock from click counting and fired 250 concurrent
redirects at one link. The suite passed, every time. Two hundred and fifty
increments spread across milliseconds of HTTP overhead essentially never land in
the same two-nanosecond window, so no count was ever lost. The seed that
survived instead writes the store's map with no lock held, which the Go runtime
detects and kills the process for: a much louder symptom, and the one an
unsynchronised service actually dies of.

That is the lesson. The suite cannot see a race. It can only see the wrong
numbers a race eventually produces, and it is entirely possible to have the race
and never see the numbers. This is why `-race` exists, why the failure labs
exist, and why passing this suite is evidence rather than proof.

The rest, briefly:

- **`ctx-ignored`** needs a request slow enough to abandon halfway. Every route
  here is fast on purpose, so there is no window to cancel in.
- **`defer-in-loop`** leaks file descriptors, and nothing in the spec reports
  descriptor counts. Adding one just to catch this would be a metric that
  exists for the test rather than for the operator.
- **`loop-capture`** was largely fixed by the language: Go 1.22 gives each
  iteration its own copy of the loop variable.
- **`mutex-by-value`** is caught by `go vet` before a suite ever runs, which is
  the right place to catch it.
- **`slice-aliasing`** and **`wg-add-after-wait`** need either internal state or
  a shutdown race that the process contract already covers.

## Notes from this machine

Two measurements the harness makes rather than assumes:

**Clock granularity.** The SLO run measures the smallest gap the monotonic clock
can report and prints it when it is coarse. On Windows it is around 525µs, so
latencies below that come back as exactly zero. The low percentiles are
quantised and only p99 carries weight. A p50 of `0s` is the instrument, not the
service.

**Interrupts.** `shutdown/drains-and-exits-zero` needs a signal Windows cannot
deliver to a child process, so it skips there and says so on the line where it
skipped. A silent skip reads exactly like a pass.

## Running the reference

```
go run ./reference -tokens tokens.json -data linkd.json -addr 127.0.0.1:0
```

Read it after you have finished yours, not before. It is one answer, and the
parts worth arguing with are the group commit in `store.go` and the decision to
count characters rather than bytes in `server.go`.
