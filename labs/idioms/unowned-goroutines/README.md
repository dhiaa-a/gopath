# unowned-goroutines

**Accent: executor languages.** This package works and its tests pass. It
is also not Go: it treats `go` like `executor.submit()`, fires work into
the void, and waits by guessing.

The exact mistakes this exercise trains against:

1. `go enrichInto(...)` discards the error the function returns. The `go`
   statement is the only caller, so nothing can ever hear that error.
2. `time.Sleep(250 * time.Millisecond)` standing in for completion: a
   fixed timer instead of knowing the work is done.
3. Nothing owns the goroutines: no WaitGroup, no channel, no way for
   `ProcessAll` to learn that its own work finished.
4. A decorative error return: `ProcessAll` promises an error in its
   signature and hardcodes `nil`, so per-item failures vanish silently.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 2 issues now, must reach zero
```

Refactor `enrich.go` until both are true at once. The suite pins behavior
through the public surface (`ProcessAll`, `Item`, `Result`) and asserts on
returned state, never on timing. The signature stays
`ProcessAll(items []Item) ([]Result, error)` in every variant; what
changes is who owns the goroutines and where their errors go. Two lint
issues sounds small, but both point at the same missing structure, and
closing them means building it. Expect the fix to add a few lines rather
than delete them: ownership costs tokens and pays in truth.

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
