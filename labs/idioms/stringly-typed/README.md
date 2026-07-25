# stringly-typed

**Accent: Python.** This package works and its tests pass. It is also not
Go: it is a Python module transliterated into Go syntax. A status is a
`str`, validity is a membership test written out by hand, and the only
thing standing between `"shipped"` and `"shipepd"` is whoever reads the
diff.

The exact mistakes this exercise trains against:

1. Raw strings where a named type belongs: every signature takes and
   returns `string`, so any string in the program is a legal status.
2. The same literal repeated until a typo becomes a state. `"picking"`
   appears six times in 83 lines.
3. Validity rules scattered across call sites instead of one table. Six
   functions each hold their own copy of what the lifecycle allows.
4. String comparisons doing the work of the type system, at runtime, on
   every call, forever.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 6 issues now, must reach zero
```

Refactor `order.go` until both are true at once. The suite pins behavior
through the public surface (`Parse`, `IsValid`, `Advance`, `Cancel`,
`CanCancel`, `IsTerminal`, and the three sentinel errors), and it does it
without ever naming the type those functions take.

That last part is the whole trick, and it is worth understanding before
you start. Read the top of `order_test.go`: the expected values are
declared as **untyped** constants. An untyped Go constant has no fixed
type until a context demands one, so `pending` becomes a `string` when it
is passed to the starter and becomes whatever named type you introduce
when it is passed to your refactor. The same suite compiles against both
shapes. This is what lets you change every signature in the file in one
pass without touching a single test, and it is a technique worth stealing
for real migrations.

Do not expect deletion this time: the reference is longer than the
starter, by about half again. What shrinks is the number of places that
know the rules, from six down to one.

### A warning about the count

The number will not fall steadily, and the most likely thing you do first
will make it worse. Declare your constants before you have swapped the
literals over, which is the natural first move, and:

```
golangci-lint run    # 6 issues -> 12 issues
```

`goconst` still reports all five strings, only now the message changes to
"but such constant `pending` already exists", and `unused` adds one
finding per constant nobody references yet. Nothing went wrong. You are
halfway through one edit and the linter is describing the halfway state
honestly. The count comes back down the moment the call sites move.

There is a second effect underneath that one. `golangci-lint` reports
**one finding per line** by default, so when two linters object to the
same line you only ever see the first. Line 47 has two objections: the
`gocritic` finding you can see, and a `staticcheck` QF1003 finding queued
behind it that you never will, because the same edit clears both. A line
with no findings left is not the same as a line that was only ever wrong
once. Judge your progress by what is left in the file, not by the number.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including one smell the linter cannot see.
Read it after your run is green, or when you are stuck on what a finding
means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
