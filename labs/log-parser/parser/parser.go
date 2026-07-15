//go:build !solution

package parser

// ParseLine parses one log line in the format documented in entry.go and
// reports whether it matched. It never returns an error: in a large log
// file a malformed line is data to skip, not a reason to stop, and a bool
// is cheaper to check per line than allocating an error.
//
// This stub compiles and rejects everything. The suite in parser_test.go
// shows exactly what is left; read it first, then run:
//
//	go test -v ./...
//
// The three rejection cases already pass against this stub. The five
// parsing cases are your work.
func ParseLine(line string) (LogEntry, bool) {
	// TODO: split the line into timestamp, level, message. Mind the split
	// count: the message may itself contain spaces.
	// TODO: parse the timestamp with time.Parse(time.RFC3339, ...).
	// TODO: return the filled LogEntry and true.
	return LogEntry{}, false
}
