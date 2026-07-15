//go:build !solution

package pipeline

import "gopath.dev/labs/log-parser/parser"

// ProcessFile reads one log file, sends every line that parses into out,
// and reports how many lines did not parse.
//
// It must not read the whole file into memory: these are log files, and the
// real ones do not fit. Scan it.
//
// The error return is for problems with the file, not with its contents. A
// malformed line is counted in skipped and the scan continues; a file that
// will not open, or will not read to the end, is an error.
//
// This stub compiles and does nothing. Run the suite to see what is left:
//
//	go test -v ./pipeline
func ProcessFile(path string, out chan<- parser.LogEntry) (skipped int, err error) {
	// TODO: os.Open the file, and defer closing it.
	// TODO: scan it line by line with bufio.Scanner.
	// TODO: for each line, call parser.ParseLine. Send the entry into out
	//       when it parses; count it in skipped when it does not.
	// TODO: after the loop, check scanner.Err(). Scan() returning false
	//       does not mean the file ended, only that it stopped.
	return 0, nil
}

// Run processes every path with a pool of workers goroutines and reduces
// everything they parse into one Summary.
//
// The answer must not depend on workers: Run(paths, 1) and Run(paths, 8)
// return the same Summary, and the suite checks that. If a file cannot be
// read, Run returns an error along with the summary of whatever else it
// managed to parse.
//
// This stub compiles and returns nothing. Note that the zero Summary has a
// nil ByLevel map, which is a real map you can read from and a panic if you
// write to it: making the map is your job, and the first suite failure will
// remind you.
func Run(paths []string, workers int) (Summary, error) {
	// TODO: make the tasks channel and fill it with paths, then close it.
	// TODO: start workers goroutines, each ranging over tasks and calling
	//       ProcessFile. Track them with a sync.WaitGroup.
	// TODO: close the results channel once, from one goroutine, after the
	//       WaitGroup says every sender is done.
	// TODO: range over results here and reduce them into a Summary.
	return Summary{}, nil
}
