# getters-and-factories

**Accent: Java.** This package works and its tests pass. It is also not Go:
it is a Java class hierarchy transliterated into Go syntax.

The exact mistakes this exercise trains against:

1. Getter/setter pairs (`GetTitle`, `SetCheckedOut`) instead of exported
   fields or real behavior.
2. An interface (`BookRecord`) that exists only to mirror its single
   concrete struct, held in place by a factory that returns it.
3. A factory type (`CatalogBookFactory`) where Go wants a function, plus
   the stuttering name.
4. Receivers named `this`, and receivers that mix pointer and value on the
   same type.
5. Error values named `XxxError` with sentence-case, punctuated messages,
   instead of `ErrXxx` sentinels with lower-case text.
6. Dead ceremony: state and helpers that nothing calls, kept because the
   "class" felt incomplete without them.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 12 issues now, must reach zero
```

Refactor `catalog.go` until both are true at once. The suite pins behavior
through the public surface (`NewCatalog`, `Add`, `Checkout`, `Return`,
`Author`, `Available`); everything else in the file is yours to rename,
collapse, or delete. Expect deletion: the reference is about a quarter
shorter than the starter.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including one smell the linter cannot see. Read
it after your run is green, or when you are stuck on what a finding means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
