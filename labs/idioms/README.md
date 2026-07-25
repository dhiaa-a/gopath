# Idiom track: accent removal

Every exercise in this directory is working Go with a green test suite, and
every one of them is foreign: Java transliterated into Go, Python
transliterated into Go, C transliterated into Go. The refactor is the
lesson. You are done with an exercise when, from its directory, both of
these are true at once:

```
go test ./...        # green when you arrive, must stay green
golangci-lint run    # red when you arrive, must reach zero
```

The suite pins behavior through a small stable API, so everything behind
that surface is yours to rename, collapse, and delete. The linter pins
idiom. Between the two of them there is exactly one way out: Go that works
and reads like Go.

Each exercise directory has:

- `README.md` — the accent, and the exact mistakes the exercise trains
  against.
- a starter file (build tag `!solution`) — what you refactor.
- `solution.go` (build tag `solution`) — the reference. Do not open it
  until you are green; `go test -tags solution ./...` runs the same suite
  against it, and `golangci-lint run --build-tags solution` shows it clean.
- `REVIEW.md` — the same refactor, walked smell by smell with the
  reasoning a senior Go reviewer would give. Read it after your run is
  green, or when you are stuck on what a finding means. Every REVIEW also
  names at least one smell the linter cannot see, because the linter is a
  floor, not a ceiling.

None of this gates anything on the learning path. It is strengthening: the
best time for each exercise is suggested on the site's
[idiom track page](https://gopath.dev/idioms), and "suggested" is the whole
of it.

## The linter

One strict config is shared by every exercise: [.golangci.yml](.golangci.yml)
in this directory. It is deliberately exception-free and every linter in it
is commented with the habit it catches. golangci-lint discovers it
automatically when you run from inside an exercise directory.

You need **golangci-lint v2** (the config is a v2 config; v1 cannot parse
it). Pin the version instead of tracking latest, exactly as you would on a
team:

```
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
```

or any other install method from the
[golangci-lint docs](https://golangci-lint.run/docs/welcome/install/) at
v2.12.2 or newer within v2. The track is tested against v2.12.2; a newer
v2 minor may add checks and surface a finding or two the exercise READMEs
do not mention, which is a normal Tuesday on a real team too.

## Why a linter, and not a reviewer

Because the linter is the reviewer you actually get. Real Go teams encode
their taste in exactly this file format and enforce it in CI; learning to
read a golangci-lint finding, decide what it is really asking for, and
refactor without breaking tests IS the production skill. The REVIEW.md
files exist for everything the linter cannot say: why the idiom is the
idiom, at the level of the language's design.

## check.sh (maintainers / CI)

`./check.sh` runs every exercise both ways: the starter must build, vet
clean, pass the suite, and be lint-RED with each registered accent linter
actually firing; the reference (`-tags solution`) must build, vet clean,
pass the same suite, and be lint-clean. A starter that stops tripping its
linters is as red as a reference that stops passing tests, because an
accent that no longer reproduces teaches nothing. Unregistered exercise
directories fail by construction. `labs/check.sh` invokes this harness on
every full run.
