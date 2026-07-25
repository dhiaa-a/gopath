# interface-bloat

**Accent: Java and C#.** This package works and its tests pass. It is also
not Go: the store's API is declared the way a Java producer would declare
it, as one interface that lists everything the implementation can do, and
every consumer is written as plumbing over that interface.

The exact mistakes this exercise trains against:

1. One provider-side `Storage` interface with eight methods, a mirror of
   everything `MemStore` offers, owned by the producer instead of the
   consumers.
2. Consumer functions (`Archive`, `Summarize`, `Purge`) that each demand
   the full `Storage` while calling two or three of its methods, so every
   signature overstates its coupling and every fake owes eight methods.
3. Errors from store calls passed through naked (`return err`), because a
   function that sees itself as interface plumbing adds nothing on the
   way up.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 6 issues now, must reach zero
```

Refactor `docstore.go` until both are true at once. The suite pins
behavior through the public surface: `NewMemStore` and the `MemStore`
methods, `Document`, `StoreStats`, `ArchivePrefix`, the sentinel errors,
and the three consumers `Archive`, `Summarize`, `Purge`. `memstore.go` is
already idiomatic and stays as it is; what you reshape is what the
consumers ask for. The tests pass the concrete `*MemStore` (and a fake
built on it) at every call site, so they compile against any parameter
type those functions declare, as long as it only asks for methods the
store has.

Do not expect deletion this time: the reference is slightly longer than
the starter. What shrinks is what an implementation owes each consumer,
from eight methods to two or three.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including one smell the linter cannot see.
Read it after your run is green, or when you are stuck on what a finding
means.

To compare against the reference afterward: `go test -tags solution
./...` runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
