# panic-as-control-flow

**Accent: Python.** This package works and its tests pass. It is also not
Go: it is raise/except transliterated into Go syntax.

The exact mistakes this exercise trains against:

1. panic as the error channel: six validation sites that throw
   (`panic("bad amount: " + raw)`) where Go returns a value.
2. The except block at the boundary: a deferred `recover()` in `Post`
   that converts every distinct failure into one flat string with
   `fmt.Errorf("ledger: %v", r)`, leaving nothing for `errors.Is` to
   match.
3. `else` after a branch that already returns, indenting the code that
   should read flat (Python's try/else shape).
4. `else` after `continue` inside the digit scan, the same shape one
   level down.
5. Contracts in prose: doc comments that say "panics if" where the
   signature should say `(T, error)`.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 6 issues now, must reach zero
```

(One wrinkle: golangci-lint caps repeats of an identical message at
three, and all six panic sites share one forbidigo message, so the first
run prints six issues out of nine findings. The list refills as you
drain it; zero means zero.)

Refactor `ledger.go` until both are true at once. The suite pins
behavior through the public surface (`NewLedger`, `Post`, `Balance`, and
the exported `Entry` fields); everything else in the file is yours to
reshape. Expect every internal signature to grow an error return, and
expect the deferred recover to disappear entirely. Do not expect the
file to shrink: the reference is slightly longer than the starter,
because six named errors replace six anonymous strings. Idiomatic Go
here is not shorter, it is legible about failure.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including the smells the linter cannot see.
Read it after your run is green, or when you are stuck on what a finding
means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
