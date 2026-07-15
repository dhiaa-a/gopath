# Lab: log-parser

The two labs before this one handed you a self-check. This one hands you a
real `go test` suite, the first graded suite on GoPath, and it is written in
the style you will use for the rest of the track: table-driven.

## Read the test file first

`parser/parser_test.go` is the lesson. It is one table-driven test,
`TestParseLine`, deliberately over-commented: the table of anonymous structs,
`t.Run` and named subtests, the got/want vocabulary, when `t.Fatalf` is right
and when `t.Errorf` is, and why the `time.Time` field needs `Equal` where the
string fields get `==`. Read it top to bottom before you write any code.
Every table-driven test you meet after this, on GoPath or in a real codebase,
is that file with different rows.

## What this lab checks

One exported function in `parser/parser.go`:

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

The suite is black-box. It lives in package `parser_test`, imports the
`parser` package, and calls only `ParseLine`, so it cannot see or constrain
how you implement the inside.

## Run it

From this directory:

```
go test -v ./...
```

Use `-v`. Without it a green run prints one `ok` line; with it, every row of
the table reports as a named subtest, which is the point of the pattern. To
rerun a single case while you iterate:

```
go test -run 'TestParseLine/malformed_timestamp' -v ./...
```

A fresh checkout fails 5 of the 8 subtests. The three rejection cases pass
immediately, and that asymmetry is worth a second of thought: the suite can
only observe behavior, and a stub that rejects everything already behaves
correctly on bad input. The five parsing cases are your work.

## What done looks like

```
--- PASS: TestParseLine (0.00s)
    --- PASS: TestParseLine/valid_INFO_line (0.00s)
    --- PASS: TestParseLine/valid_WARN_line (0.00s)
    --- PASS: TestParseLine/malformed_timestamp (0.00s)
    --- PASS: TestParseLine/only_two_fields (0.00s)
    --- PASS: TestParseLine/empty_string (0.00s)
    --- PASS: TestParseLine/message_keeps_interior_spaces (0.00s)
    --- PASS: TestParseLine/timestamp_with_zone_offset (0.00s)
    --- PASS: TestParseLine/single_word_message (0.00s)
PASS
ok      gopath.dev/labs/log-parser/parser
```

All eight subtests named and green.

## The solution build tag

`parser/solution.go` holds the reference implementation behind the `solution`
build tag. A plain `go test` never compiles it, so the suite always grades
your file; the repo's checks run `go test -tags solution ./...` to prove the
suite passes against a real implementation. Do not open solution.go until
your run is green.
