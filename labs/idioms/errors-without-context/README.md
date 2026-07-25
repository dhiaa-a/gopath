# errors-without-context

**Accent: any language.** This package works and its tests pass. It is also
not Go: it treats an error as a token to hand upward rather than a value to
build. A profile file names the services an environment runs, a secrets
file holds their base64 tokens, and when a lookup fails the caller is told
that a `strconv` call failed, somewhere, in one of two files, for one of
five reasons.

The exact mistakes this exercise trains against:

1. `if err != nil { return err }` as a reflex instead of a decision. Three
   layers relay the same error and none of them adds what only it knows:
   which file, which line, which service.
2. `err == CredentialNotFoundError`, which silently stops matching the
   moment anything upstream wraps the error.
3. `%v` where `%w` belongs. Context gets added and the chain is destroyed
   in the same call, so `errors.Is` and `errors.As` go blind downstream.
4. `errors.New(fmt.Sprintf(...))` instead of `fmt.Errorf`. The form is the
   small problem; the real one is that it throws away the sentinel it was
   just handed and replaces it with prose.
5. `XxxError` names with sentence-case, punctuated messages, instead of
   `ErrXxx` sentinels with lower-case text that composes.
6. Branching on `strings.Contains(err.Error(), "illegal base64")`, which
   makes this package's behavior depend on another package's wording.
7. An unchecked `err.(*fs.PathError)` where `errors.As` belongs: a panic
   nobody wrote, waiting for the first filesystem that returns a different
   error type.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 14 issues now, must reach zero
```

Refactor `credstore.go` until both are true at once. The suite drives the
package through `New`, `Lookup` and `Secret` only, and it never names a
sentinel, so every error value in the file is yours to rename, merge, or
delete. Four things it does pin, and they are the assignment:

- the happy path, including that a base64 token keeps its `=` padding;
- a refused lookup stays refused, across ten ways to fail;
- `errors.Is(err, fs.ErrNotExist)` still reaches the cause when the profile
  file is missing, which is true of the starter by accident and true of a
  correct refactor on purpose;
- a not-found error names the service that was not found.

Do not expect this one to get shorter. There is almost no ceremony to
delete. The work is standing at each error return and deciding what this
layer knows that its caller does not, then saying exactly that and nothing
more.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including two the linter cannot see. Read it
after your run is green, or when you are stuck on what a finding means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
