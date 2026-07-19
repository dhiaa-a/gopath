# GoPath Labs

Every GoPath project has an executable lab in this directory. A lab is a plain Go module: clone the repo, `cd` into the lab, and the standard toolchain does the rest. No accounts, no services, no grader in the cloud. The checks run on your machine, which is the point: you should be able to prove your own work.

```
labs/<project-slug>/
  go.mod        one self-contained module per lab
  README.md     what the lab checks and how to run it
  ...           starter code, tests or a check program, fixtures
```

## How a lab knows about your code vs the reference

Most labs keep your file and the reference solution in the same package, separated by build tags:

- Files you edit are tagged `//go:build !solution`.
- The reference lives in `solution.go` files tagged `//go:build solution`.
- The test suite is untagged and tests the package's exported API, so the same suite runs against your code by default and against the reference with `-tags solution`.

That means `go test ./...` always grades **your** implementation. Do not open the `solution.go` files until your run is green; they are there so the suite itself stays honest (the repo's CI proves every suite passes against a real implementation).

The two earliest labs (`cli-renamer`, `json-fetcher`) have no test suite at all, deliberately: at that point in Tier 1 you get a self-check, not an exam. They ship a `check/` program that runs your binary against fixtures and shows you what your program did next to what was expected. `starter/` is yours, `solution/` is the reference, and `go run ./check` looks at `starter/` unless you point it elsewhere.

## Conventions

- Module path: `gopath.dev/labs/<slug>`, Go 1.22.
- Starter code always compiles. Stubs return zero values; failing tests, not broken builds, tell you what is left.
- Suites are black-box: they test the binary or the exported API, never your internals. How you structure the inside is your call.
- Performance gates (Tier 3 and the worker pool) live in `gate_test.go` behind the `gate` build tag, with functions named `TestGate...`. Run them explicitly: `go test -tags gate -run TestGate ./...`. Gates prefer relative comparisons (your optimized version against the shipped baseline, measured in the same process) so they hold on any reasonable machine.
- Everything here is `gofmt`-clean and `go vet`-clean, and `check.sh` keeps it that way.

## Race detector

The concurrent suites (tcp-echo, http-server, worker-pool and up) are written to be run with `-race`, and their READMEs say so. The race detector needs cgo, which needs a C compiler: on Linux and macOS gcc/clang is already on PATH, and on Windows you need a gcc toolchain. The one we use and recommend is MSYS2's ucrt64 gcc: install [MSYS2](https://www.msys2.org), then `pacman -S mingw-w64-ucrt-x86_64-gcc`, which lands at `C:\msys64\ucrt64\bin\gcc.exe`.

You do **not** have to put that on your global PATH. `RACE=1 ./check.sh` (below) enables cgo for the run and probes the usual toolchain locations itself, so the whole race sweep works out of the box once the compiler is installed. If you want `go test -race` to work directly in a single lab dir, add `C:\msys64\ucrt64\bin` to PATH for that shell (`export PATH="/c/msys64/ucrt64/bin:$PATH"`) and set `CGO_ENABLED=1`.

The whole spine has been run clean under `-race` on `go1.22.1 windows/amd64` with this toolchain; the detector both fires (verified against a deliberate data race) and finds every module clean.

## check.sh (maintainers / CI)

`./check.sh` loops every lab module and runs, per module:

1. `gofmt -l` — must print nothing
2. `go build ./...` and `go vet ./...` — the starter skeleton must compile cleanly
3. `go build -tags solution ./...` and `go vet -tags solution ./...` where a reference exists
4. `go test -tags solution ./...` — every suite green against the reference
5. `go run ./check -target ./solution` for the self-check labs
6. Benchmarks compile and run once (`-bench . -benchtime 1x`)
7. Gate tests (`-tags "solution gate" -run '^TestGate'`), skippable with `SKIP_GATES=1`

`RACE=1 ./check.sh` adds `-race` to the test step on platforms that support it. Nothing in `labs/` may be committed while `check.sh` is red.
