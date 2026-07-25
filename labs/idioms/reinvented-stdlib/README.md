# reinvented-stdlib

**Accent: C.** This package works and its tests pass. It is also not Go:
it is a bag of hand-rolled routines for jobs the Go standard library
already ships, documented, fuzzed, and optimized, one import away.

The exact mistakes this exercise trains against:

1. A prefix check followed by manual reslicing (`line[len(prefix):]`)
   where `strings.TrimPrefix` says the same thing in one call.
2. A membership loop over a slice that is `slices.Contains` spelled out
   by hand.
3. A width clamp built from an `if` where the `min` builtin does it.
4. A manual element-by-element copy loop that is `copy`.
5. `fmt.Sprintf("%d", n)` where `strconv.Itoa(n)` is the direct spelling,
   and a redaction mask grown with `+=` in a loop where `strings.Repeat`
   already exists.
6. Two rebuilds the linter has no pattern for and will never flag: a
   substring scan and a running maximum, both stdlib jobs. Finding them
   is part of the exercise.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 6 issues now, must reach zero
```

Refactor `logline.go` until both are true at once. The suite pins
behavior through the public surface (`TrimAgent`, `KnownSeverity`,
`HasMarker`, `Redact`, `Dedupe`, `Widest`, `Fit`, `Tail`); everything
behind those signatures is yours to rewrite. Zero issues is not the
finish line here: two of the rebuilds above are invisible to the linter,
and the reference deletes them anyway. Expect shrinkage: the reference is
about a quarter shorter than the starter, and every deleted line is a
loop the library already contained.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, finding by finding, including the two the linter cannot see.
Read it after your run is green, or when you are stuck on what a finding
means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
