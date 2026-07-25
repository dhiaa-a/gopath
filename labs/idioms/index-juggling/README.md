# index-juggling

**Accent: C.** This package works and its tests pass. It is also not Go: it
is a C translation unit transliterated into Go syntax. Every loop carries
its own index, every bound is arithmetic the author wrote out by hand, and
the builtins are treated as names that happen to be free.

The exact mistakes this exercise trains against:

1. `for i := 0; i < len(x); i++` where `range` belongs.
2. Locals named `len`, `min`, and `max` shadowing the builtins.
3. Type conversions the type system already performs.
4. Manual index bookkeeping the compiler would own under `range`.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 10 issues now, must reach zero
```

Refactor `frame.go` until both are true at once. The suite pins behavior
through the public surface (`Sum`, `Mean`, `Bounds`, `Histogram`,
`CountAbove`, `Smooth`) and asserts only on returned values, so it does not
care whether you walk bytes by index or by range. The reference is about
twenty lines shorter, and every line that went is bookkeeping.

### A warning about the count

The number will not fall steadily, and the first thing you fix is the
clearest example. `golangci-lint` reports **one finding per line** by
default, so when two linters object to the same line you only see one of
them. Lines 46 and 47 have two objections each: the dead `byte(0xFF)` seed
(`ineffassign`) and the local named `min` (`predeclared`). Fix the
`ineffassign` findings, which is a real fix, and:

```
golangci-lint run    # still 10 issues
```

`ineffassign` drops from 2 to 0 and `predeclared` climbs from 1 to 3,
because clearing the first finding uncovered the second one hiding behind
it. Nothing went wrong. `predeclared` was always right about those two
lines; you just could not see it yet. Findings also cap per repeated
message, so `intrange` shows 3 at a time out of more. Judge your progress
by what is left in the file, not by the number.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including one smell the linter cannot see. Read
it after your run is green, or when you are stuck on what a finding means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
