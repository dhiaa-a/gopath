// This test file is the lesson. GoPath introduces table-driven tests here,
// at Tier 1 Project 3, and the honest way to learn the pattern is to read
// one real suite slowly and then make it pass. Read top to bottom; every
// moving part is commented where it first appears.
//
// The package is parser_test, not parser. The _test suffix on the package
// name makes this an external test package: it must import parser like any
// other caller and can see only what parser exports. Black-box by
// construction. How you implement ParseLine is invisible from here, which
// means it is entirely your call.
package parser_test

import (
	"testing"
	"time"

	"gopath.dev/labs/log-parser/parser"
)

// ts turns an RFC3339 literal into a time.Time for the expected values in
// the table. A fixture that does not parse is a bug in the test itself, so
// it panics rather than limping along; there is no *testing.T to fail with
// here, because ts runs while the table is being built.
func ts(s string) time.Time {
	parsed, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic("test fixture is not RFC3339: " + s)
	}
	return parsed
}

// TestParseLine is one test function that runs many cases. That is the
// whole trick of a table-driven test: the checking logic is written once,
// at the bottom, and each scenario is one more row in a slice. Adding
// coverage costs one struct literal, not one copy-pasted function.
func TestParseLine(t *testing.T) {
	// The table. The element type is an anonymous struct, declared inline
	// with the slice, because it exists for this test and nothing else;
	// naming it at package level would advertise reuse that never happens.
	cases := []struct {
		name string          // subtest name: shown by go test -v, usable with -run
		line string          // the single argument handed to ParseLine
		want parser.LogEntry // expected entry; checked only when ok is true
		ok   bool            // expected second return: did the line parse?
	}{
		// The first five rows are the project's assessment contract.
		{
			name: "valid INFO line",
			line: "2024-01-15T10:30:00Z INFO user logged in",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:30:00Z"),
				Level:     "INFO",
				Message:   "user logged in",
			},
			ok: true,
		},
		{
			name: "valid WARN line",
			line: "2024-01-15T10:31:00Z WARN disk at 90%",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:31:00Z"),
				Level:     "WARN",
				Message:   "disk at 90%",
			},
			ok: true,
		},
		{
			// The first field must be a real RFC3339 timestamp. time.Parse
			// rejects this one, and ParseLine must turn that rejection into
			// ok=false, not an error: across a million-line file, bad lines
			// are data to skip, not exceptions. Note there is no want field
			// in this row; the zero LogEntry is exactly what we expect, and
			// Go fills in omitted struct fields with zero values.
			name: "malformed timestamp",
			line: "not-a-date ERROR something failed",
			ok:   false,
		},
		{
			// A timestamp and a level but no message. Three fields is the
			// format; two is malformed, even when both fields are valid.
			name: "only two fields",
			line: "2024-01-15T10:30:00Z INFO",
			ok:   false,
		},
		{
			// The degenerate input every parser meets eventually. Blank
			// lines at the end of real log files are why this row exists.
			name: "empty string",
			line: "",
			ok:   false,
		},

		// Three more rows that pin behavior the first five cannot see.
		{
			// Only the first two spaces separate fields; the message keeps
			// every space after that, doubles included.
			// strings.SplitN(line, " ", 3) gives exactly this behavior; a
			// plain strings.Split would shred the message.
			name: "message keeps interior spaces",
			line: "2024-01-15T10:32:00Z ERROR disk  almost  full",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:32:00Z"),
				Level:     "ERROR",
				Message:   "disk  almost  full",
			},
			ok: true,
		},
		{
			// RFC3339 is not only Z. Numeric offsets like +02:00 are part
			// of the format, and time.Parse(time.RFC3339, ...) accepts
			// them; a hand-rolled layout string ending in a literal Z
			// would fail this row.
			name: "timestamp with whole hour offset",
			line: "2024-01-15T10:30:00+02:00 INFO deploy started",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:30:00+02:00"),
				Level:     "INFO",
				Message:   "deploy started",
			},
			ok: true,
		},
		{
			// Half-hour offsets are real: +05:30 is all of India. This row
			// looks like a duplicate of the one above and is not. It is the
			// row that forces the comparison at the bottom of this file to
			// be written with Equal instead of ==, and the comment down
			// there explains why. Delete this row and the suite would still
			// pass against a correct parser, still pass against a naive
			// == comparison, and quietly stop testing the thing it exists
			// to test.
			name: "timestamp with half hour offset",
			line: "2024-01-15T10:30:00+05:30 WARN clock skew 40ms",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:30:00+05:30"),
				Level:     "WARN",
				Message:   "clock skew 40ms",
			},
			ok: true,
		},
		{
			// The smallest valid line: three fields, one-word message.
			// This row sits on the exact boundary that "only two fields"
			// rejects, so together they pin where valid ends and
			// malformed begins.
			name: "single word message",
			line: "2024-01-15T10:33:00Z DEBUG heartbeat",
			want: parser.LogEntry{
				Timestamp: ts("2024-01-15T10:33:00Z"),
				Level:     "DEBUG",
				Message:   "heartbeat",
			},
			ok: true,
		},
	}

	// One loop, one t.Run per row. t.Run starts a named subtest: each row
	// passes or fails on its own, go test -v lists every name, and one
	// case can be rerun alone while you iterate:
	//
	//	go test -run 'TestParseLine/only_two_fields' -v ./...
	//
	// (go test swaps the spaces in a subtest name for underscores.)
	//
	// Since Go 1.22, tc is a fresh variable on every iteration, so the
	// closure below captures it safely. Older code needed a `tc := tc`
	// line here; you will still meet that line in the wild.
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// got and want are Go's conventional test vocabulary, and the
			// order in messages is always got first, want second. The
			// convention is what makes failure output readable at 2am.
			got, ok := parser.ParseLine(tc.line)

			// t.Fatalf stops this subtest only; the other rows still run.
			// Failing fast is right here because when ok is wrong, got is
			// noise: checking its fields would bury the real failure
			// under misleading follow-on failures.
			if ok != tc.ok {
				t.Fatalf("ParseLine(%q) ok: got %v, want %v", tc.line, ok, tc.ok)
			}
			if !tc.ok {
				return // rejected, and rejection was expected: done
			}

			// Field by field beats got != tc.want here for one concrete
			// reason: time.Time. LogEntry is a comparable struct, so ==
			// compiles and looks right, but == on a time.Time compares its
			// unexported fields, and one of them is a *Location.
			//
			// Whether two Parses of the same offset produce the same
			// *Location is an implementation detail of the time package,
			// and it is not consistent. time.FixedZone keeps a cache of
			// unnamed whole-hour zones, so the +02:00 row gets the same
			// pointer twice and passes ==. +05:30 is not a whole hour,
			// misses that cache, allocates a fresh Location per call, and
			// so fails == against a completely correct ParseLine. (A third
			// path: when the offset matches the zone your machine is set
			// to, Parse reuses Local and == passes again. Same code, same
			// input, different answer depending on where the laptop is.)
			//
			// None of that is worth memorising, which is rather the point.
			// The time package's own documentation settles it in one line:
			// "In general, prefer t.Equal(u) to t == u, since t == u also
			// compares Location and the monotonic clock reading."
			// Instants take Equal; the string fields take plain ==.
			if !got.Timestamp.Equal(tc.want.Timestamp) {
				t.Errorf("Timestamp: got %v, want %v", got.Timestamp, tc.want.Timestamp)
			}
			// t.Errorf, not t.Fatalf, from here on: a wrong Level should
			// not hide a wrong Message. Record both, keep going.
			if got.Level != tc.want.Level {
				t.Errorf("Level: got %q, want %q", got.Level, tc.want.Level)
			}
			if got.Message != tc.want.Message {
				t.Errorf("Message: got %q, want %q", got.Message, tc.want.Message)
			}
		})
	}
}
