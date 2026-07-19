# Lab: log-parser

The two labs before this one handed you a self-check. This one hands you a
real `go test` suite, the first graded suite on GoPath, and it is written in
the style you will use for the rest of the track: table-driven.

Two packages, in the order you should write them:

```
parser/     ParseLine: one line in, one typed entry out. Pure, no I/O.
pipeline/   ProcessFile and Run: many files in, one Summary out, concurrently.
cmd/logparse  a finished command that runs your pipeline. Nothing to fill in.
testdata/   four small log files. Read them; every number below is countable.
```

`pipeline` calls `parser.ParseLine`, so get `parser` green first. A wrong
ParseLine shows up as failures in both suites and only one of them is
telling you something new.

## Read the test file first

`parser/parser_test.go` is the lesson. It is one table-driven test,
`TestParseLine`, deliberately over-commented: the table of anonymous structs,
`t.Run` and named subtests, the got/want vocabulary, when `t.Fatalf` is right
and when `t.Errorf` is, and why the `time.Time` field needs `Equal` where the
string fields get `==`. Read it top to bottom before you write any code.
Every table-driven test you meet after this, on GoPath or in a real codebase,
is that file with different rows.

`pipeline/pipeline_test.go` is the same pattern used normally, without the
running commentary. That is what the rest of the track looks like.

## What this lab checks

**`parser/parser.go`** holds one exported function:

```go
func ParseLine(line string) (LogEntry, bool)
```

It parses lines of the form

```
2024-01-15T10:30:00Z INFO message here
```

an RFC3339 timestamp, a level, and a message that may itself contain spaces.
Anything malformed comes back as `(LogEntry{}, false)`, never as an error: in
a million-line log file a bad line is data to skip, not an exception worth an
allocation. The `LogEntry` type is fixed in `parser/entry.go`; the function
body is yours.

**`pipeline/pipeline.go`** holds two exported functions:

```go
func ProcessFile(path string, out chan<- parser.LogEntry) (skipped int, err error)
func Run(paths []string, workers int) (Summary, error)
```

`ProcessFile` scans one file and streams entries out; it must not read the
file into memory. `Run` fans the paths out across `workers` goroutines and
reduces everything they parse into one `Summary` (pinned in
`pipeline/summary.go`). The suite checks the property that matters: the
Summary is identical for 1 worker and for 64. How you build the pool inside
`Run` is your call, and the suite cannot see it.

Both suites are black-box. They live in `parser_test` / `pipeline_test`,
import the package under test, and call only exported names.

## Run it

From this directory:

```
go test -v ./...
```

Use `-v`. Without it a green run prints one `ok` line; with it, every row of
every table reports as a named subtest, which is the point of the pattern. To
rerun a single case while you iterate:

```
go test -run 'TestParseLine/malformed_timestamp' -v ./parser
```

A fresh checkout fails 6 of the 9 subtests in `parser`. The three rejection
cases pass immediately, and that asymmetry is worth a second of thought: the
suite can only observe behavior, and a stub that rejects everything already
behaves correctly on bad input. The six parsing cases are your work.

And run the command, which needs nothing from you but does need your
pipeline:

```
go run ./cmd/logparse -workers 8 testdata
```

Against the stub it reports `parsed: 0`. Finished, it reports this:

```
4 file(s), 8 worker(s), 625µs
parsed:  23
skipped: 3
  DEBUG  3
  ERROR  4
  INFO   12
  WARN   4
earliest: 2024-01-15T03:30:00Z
latest:   2024-01-15T09:59:59Z
```

Note `earliest`. No line in `testdata/` contains the string `03:30:00Z`. The
oldest entry is `2024-01-15T09:00:00+05:30` in `auth.log`, and it is oldest
only if you compare instants instead of the text of the timestamps.

## What done looks like

```
--- PASS: TestParseLine (0.00s)
    --- PASS: TestParseLine/valid_INFO_line (0.00s)
    --- PASS: TestParseLine/valid_WARN_line (0.00s)
    --- PASS: TestParseLine/malformed_timestamp (0.00s)
    --- PASS: TestParseLine/only_two_fields (0.00s)
    --- PASS: TestParseLine/empty_string (0.00s)
    --- PASS: TestParseLine/message_keeps_interior_spaces (0.00s)
    --- PASS: TestParseLine/timestamp_with_whole_hour_offset (0.00s)
    --- PASS: TestParseLine/timestamp_with_half_hour_offset (0.00s)
    --- PASS: TestParseLine/single_word_message (0.00s)
PASS
ok      gopath.dev/labs/log-parser/parser
```

All nine subtests named and green, and `ok` for `pipeline` alongside it.

## A note on the concurrency

The pipeline suite has no deadlines in it. If your `Run` deadlocks, the run
hangs until `go test` gives up after ten minutes and dumps every goroutine
with its stack. That dump is the most useful output in this lab: it names the
line each goroutine is stuck on and what it is stuck waiting for. Do not wait
ten minutes for it:

```
go test -timeout 10s ./pipeline
```

`-race` is worth running if your platform has it. The detector needs cgo: it
works out of the box on Linux and macOS, and on Windows it needs a gcc
toolchain. Without it the suite still checks delivery and shutdown, and the
runtime still catches concurrent map writes on its own most of the time, but
"most of the time" is exactly the problem `-race` exists to solve.

## The solution build tag

`parser/solution.go` and `pipeline/solution.go` hold the reference
implementations behind the `solution` build tag. A plain `go test` never
compiles them, so the suites always grade your files; the repo's checks run
`go test -tags solution ./...` to prove the suites pass against a real
implementation. Do not open them until your run is green.
