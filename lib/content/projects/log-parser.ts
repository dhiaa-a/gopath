import { Project } from "../../content"

export const logParser: Project = {
	slug: "log-parser",
	name: "Concurrent log parser",
	tagline:
		"Parse large log files fast with goroutines, channels, and a worker pool.",
	code: "LOG",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "9–11 hours",
	tags: ["goroutines", "channels", "sync", "bufio", "testing"],
	lab: {
		path: "labs/log-parser",
		command: "go test -v ./...",
		summary: {
			en: "Your first graded suite: a table-driven test file written to be read, which grades your ParseLine across nine named subtests, plus a second suite that grades the worker pool you build on top of it.",
		},
	},
	mentalModels: [
		"fan-out with a worker pool",
		"channel ownership: senders close",
		"buffered scanning for memory efficiency",
		"table-driven tests",
		"order-independent reduction",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "This is the first project on GoPath where a test suite decides whether you are done, and the first where more than one thing happens at a time. Those two facts are related. Concurrency does not make code harder to write, it makes code harder to be sure about: the version that works on your four small files and the version that corrupts a counter under load are the same length and look equally reasonable. From here on you need something other than your own judgment to tell them apart. That is what the suite is for, and it is why you read it before you write anything.",
			},
		},
		{
			type: "text",
			value: {
				en: "The shape: a list of file paths goes into a tasks channel. N workers each take a path, scan that file line by line, parse each line, and stream the entries they get into a results channel. One goroutine watches the WaitGroup and closes results when every worker has finished. The main goroutine ranges over results and reduces the whole stream to one Summary.",
			},
		},
		{
			type: "code",
			value: `paths → tasks chan → [worker×N] → results chan → reduce → Summary
                   ↑ closed by its sender    ↑ closed once wg hits 0`,
		},
	],
	architecture: [
		{
			type: "text",
			value: {
				en: "The lab is two packages, written in this order. parser is pure: one line of text in, one typed entry out, no I/O, no concurrency, and it is where the graded table-driven suite lives. pipeline is everything that touches a disk or starts a goroutine. The split is not decoration: parser is exhaustively testable precisely because it does nothing, and pipeline is the only place a race or a deadlock can live, which is a short list of files to stare at when something hangs.",
			},
		},
		{
			type: "code",
			value: `labs/log-parser/
 ├── parser/                       pure. no I/O, no goroutines.
 │    ├── entry.go                 LogEntry: the pinned type
 │    ├── parser.go                ParseLine  ← you write this
 │    ├── parser_test.go           the table-driven suite. read it first.
 │    └── solution.go              reference, behind -tags solution
 ├── pipeline/                     files and goroutines live here.
 │    ├── summary.go               Summary: the pinned type
 │    ├── pipeline.go              ProcessFile, Run  ← you write these
 │    ├── pipeline_test.go         the suite for the pool
 │    └── solution.go              reference, behind -tags solution
 ├── cmd/logparse/main.go          a finished command. nothing to fill in.
 └── testdata/*.log                four small log files`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Read the suite that grades you" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "Two projects of self-checks, and now a file decides whether you are done. The instinct is to skip it and start typing, then discover the spec one failing subtest at a time. Do not. The suite is the only complete statement of what ParseLine has to do, it was written to be read, and reading it costs fifteen minutes against an afternoon of guessing. There is a second reason, which matters more: this is where you learn how Go tests are written, and you learn it from a real one rather than from a description of one.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A table-driven test writes the checking logic once and lists the scenarios as data. Each row is a struct literal with a name, an input, and the expected output; one loop ranges the rows and calls t.Run(tc.name, ...), which makes each row a separate named subtest that passes or fails on its own. Adding coverage costs one line, not one copy-pasted function, and go test -v prints every case by name so a failure tells you which scenario broke rather than which function did. This is the default shape of a Go test, not an advanced technique: the standard library's own suites are written this way.",
					},
					pattern: `func TestParseRecord(t *testing.T) {
    cases := []struct {
        name  string   // subtest name: shown by -v, usable with -run
        input string
        want  Record
        ok    bool
    }{
        {"valid",         "alice 30", Record{Name: "alice", Age: 30}, true},
        {"missing field", "alice",    Record{},                       false},
        {"empty",         "",         Record{},                       false},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got, ok := parseRecord(tc.input)
            if ok != tc.ok {
                t.Fatalf("parseRecord(%q) ok: got %v, want %v", tc.input, ok, tc.ok)
            }
            if ok && got != tc.want {
                t.Errorf("got %+v, want %+v", got, tc.want)
            }
        })
    }
}`,
					example: {
						en: "The standard library tests net/url.Parse with a table of 60+ rows covering schemes, hosts, paths, query strings, fragments, and edge cases like missing slashes and duplicate keys. Every one is a single struct literal. That is why nobody hesitates to add a row when a bug turns up.",
					},
					task: {
						en: "Open labs/log-parser/parser/parser_test.go and read it top to bottom. It is over-commented on purpose, and every moving part is explained where it first appears: the anonymous struct type declared inline with the slice, t.Run and named subtests, the got/want vocabulary and the order it goes in, when t.Fatalf is right and when t.Errorf is, and why the time.Time field is compared with Equal while the strings get ==. Then run the suite and match every FAIL to the row that produced it.",
					},
					hints: [
						{
							label: "why the struct is anonymous",
							value: "The table's element type is declared inline rather than named at package level because it exists for this one test. Naming it advertises reuse that never comes, and the next person then has to check whether anything else depends on it.",
						},
						{
							label: "t.Fatalf vs t.Errorf",
							value: "Fatalf stops this subtest; the other rows still run. It is right when continuing would produce noise: if ok came back wrong, checking the fields underneath just buries the real failure. Errorf records and continues, which is right when the checks are independent: a wrong Level should not hide a wrong Message.",
						},
						{
							label: "subtest names in -run",
							value: "go test swaps spaces for underscores. The row named \"only two fields\" is rerun with go test -run 'TestParseLine/only_two_fields' -v ./parser.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command: "go test -v ./parser",
					expect: {
						en: "Nine named subtests. Six fail, three pass. The three that pass on a stub that does nothing are malformed_timestamp, only_two_fields and empty_string, and that asymmetry is worth a second of thought before you move on: a suite can only observe behavior, and a function that rejects everything already behaves correctly on bad input. The six parsing rows are the work.",
					},
					labPath: "labs/log-parser/parser/parser_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "At the bottom of parser_test.go, replace the three field-by-field comparisons with the single obvious one: if got != tc.want { t.Errorf(\"got %+v, want %+v\", got, tc.want) }. Run it against the reference implementation, which is known to be correct, so that anything that fails is the suite's fault and not yours: go test -tags solution -v ./parser",
					},
					observe: {
						en: "Eight rows pass. timestamp_with_half_hour_offset fails, against an implementation that is definitely right. Read its failure message: got {Timestamp:2024-01-15 10:30:00 +0530 +0530 Level:WARN Message:clock skew 40ms}, want {Timestamp:2024-01-15 10:30:00 +0530 +0530 Level:WARN Message:clock skew 40ms}. The two sides are printed identically. The row directly above it, whole_hour_offset, passes.",
					},
					why: {
						en: "LogEntry is a comparable struct, so == compiles and looks correct. But == on a time.Time compares all of its unexported fields, and one of them is a *Location pointer. Whether two Parses of the same offset hand you the same pointer is an implementation detail of the time package, and it is not consistent: time.FixedZone keeps a cache of unnamed whole-hour zones, so +02:00 gets the same pointer twice and compares equal, while +05:30 is not a whole hour, misses that cache, allocates a fresh Location on every call, and compares unequal despite naming the identical instant. That is why got and want print the same: the difference is in a field %+v does not show you. There is a third path, which is the punchline: if the offset happens to match the zone your machine is set to, Parse reuses Local and == passes again, so the same suite and the same correct code can go green in Bangalore and red in CI. None of this is worth memorising, and that is the point. The time package's documentation settles it in one line: \"In general, prefer t.Equal(u) to t == u, since t == u also compares Location and the monotonic clock reading.\"",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "unit",
						title: "ParseLine test suite",
						description:
							"From labs/log-parser, run go test -v ./parser . The shipped table-driven suite grades your ParseLine: the five contract subtests below plus four edge cases (interior spaces kept in the message, a whole-hour RFC3339 zone offset, a half-hour offset, and a single-word message).",
						labPath: "labs/log-parser/parser/parser_test.go",
						testCases: [
							{
								description: "Valid INFO line",
								input: "2024-01-15T10:30:00Z INFO user logged in",
								expected: 'ok=true, Level="INFO", Message="user logged in"',
							},
							{
								description: "Valid WARN line",
								input: "2024-01-15T10:31:00Z WARN disk at 90%",
								expected: 'ok=true, Level="WARN"',
							},
							{
								description: "Malformed timestamp",
								input: "not-a-date ERROR something failed",
								expected: "ok=false",
							},
							{
								description: "Only two fields",
								input: "2024-01-15T10:30:00Z INFO",
								expected: "ok=false",
							},
							{
								description: "Empty string",
								input: "",
								expected: "ok=false",
							},
						],
						desiredOutput: `--- PASS: TestParseLine (0.00s)
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
ok      gopath.dev/labs/log-parser/parser`,
					},
				},
			],
			retrievalPrompt:
				"Two struct values print identically under %+v, and == says they differ. What is in there that you cannot see? || A pointer. time.Time carries a *Location, and == compares it along with the instant, but %+v prints the zone's name rather than its address. Two Locations describing the same offset are equal in every way you can see and unequal to ==. Compare instants with Equal.",
		},
		{
			n: "02",
			heading: { en: "Make the six parsing rows pass" },
			uses: ["error-handling", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A real log file has a million lines and three of them are junk, written by a process that was killed halfway through a write. Return an error for each bad line and you allocate an error, wrap it, hand it up, and decide what to do about it, a million times over, in order to end up ignoring three. The (value, bool) return is not a shortcut around error handling. It is the correct shape for a question whose failure is expected and boring: a bad line here is data to skip, not an exception worth a heap allocation.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The comma-ok idiom: return a typed zero value and false rather than an error, when the caller's only reasonable response to failure is to move on. You already know it from map lookups (v, ok := m[k]) and type assertions; it is the same shape. Reserve error for things the caller might actually act on. The function stays pure, which is what lets a table of nine rows test it exhaustively in under a millisecond.",
					},
					pattern: `func parseRecord(line string) (Record, bool) {
    // SplitN, not Split: n caps the number of pieces, so the
    // last one keeps the rest of the line, separators and all.
    parts := strings.SplitN(line, " ", 3)
    if len(parts) < 3 {
        return Record{}, false
    }
    t, err := time.Parse(time.RFC3339, parts[0])
    if err != nil {
        return Record{}, false
    }
    return Record{Timestamp: t, Level: parts[1], Msg: parts[2]}, true
}`,
					example: {
						en: "A CSV importer splits each row, checks the field count against the header, converts the numeric columns with strconv.Atoi, and returns (Row, false) for anything malformed rather than aborting an import of 400,000 rows because one of them has a stray comma.",
					},
					task: {
						en: 'Write ParseLine(line string) (LogEntry, bool) in labs/log-parser/parser/parser.go. The format is "2024-01-15T10:30:00Z INFO message here": an RFC3339 timestamp, a level, and a message that may contain spaces. Parse the timestamp with time.Parse(time.RFC3339, ...). Return false, never an error, for anything that does not match. It must be exported: the suite is a black-box test in package parser_test and can only reach what you export.',
					},
					hints: [
						{
							label: "time.RFC3339, not a hand-rolled layout",
							value: 'The constant handles Z and numeric offsets like +05:30 alike. A layout string you write yourself ending in a literal "Z" parses the first fixture and fails the fourth.',
						},
						{
							label: "the zero LogEntry",
							value: "return LogEntry{}, false gives the caller a usable zero value rather than a partially filled struct. Half-parsed data that looks parsed is worse than no data.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command: "go test -v ./parser",
					expect: {
						en: "All nine subtests green, and ok gopath.dev/labs/log-parser/parser. This is the assessment for this project: when it is green, ParseLine is done.",
					},
					labPath: "labs/log-parser/parser/parser.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Swap SplitN for the function that looks equivalent: parts := strings.Split(line, " "). Rerun go test -v ./parser.',
					},
					observe: {
						en: 'Five rows fail, all with the same shape of message: Message: got "disk", want "disk  almost  full". Every message has been truncated to its first word. The len(parts) < 3 guard did not catch any of it.',
					},
					why: {
						en: 'Split returns every field between every separator: for "2024-01-15T10:32:00Z ERROR disk  almost  full" it returns seven elements, including two empty strings, because the double spaces have nothing between them. So len(parts) is 7, the guard sees 7 >= 3 and waves it through, and parts[2] is "disk", one word, with the rest of the message sitting in parts[3:] where nothing will ever look at it. SplitN(line, " ", 3) stops splitting once it has two separators and hands you the remainder of the line intact as parts[2], interior spaces and all. The guard is worth a second look too: it was written to catch short lines, and against Split it silently stops catching anything, because a line can now produce more pieces than you asked for. A bounds check that can never fire is not a safety net, it is decoration.',
					},
				},
			],
			retrievalPrompt:
				'strings.Split and strings.SplitN with n=3 on "a b c d". What comes back, and which one does a log parser want? || Split gives ["a" "b" "c" "d"], four pieces. SplitN gives ["a" "b" "c d"], three, with the tail kept whole. A parser whose last field is free text wants SplitN: the message is whatever is left after the separators you care about, and it is allowed to contain the separator.',
		},
		{
			n: "03",
			heading: { en: "Scan a file you cannot fit in memory" },
			uses: ["defer", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "os.ReadFile on a 2GB log costs you 2GB of resident memory before you have parsed a single line, and the machine that has to do this is usually the one already under pressure, at 3am, because something is wrong. Log files are the canonical case for streaming: you need one line at a time, you never need the line you just finished, and the file is arbitrarily large. Read it as a stream and memory stays flat no matter what you point it at.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "bufio.Scanner wraps an io.Reader and turns it into a Scan()/Text() loop, reading a bufferful at a time and handing you one line per iteration. Memory stays constant. The part everyone forgets is the last line: Scan() returns false both when the file ended cleanly and when the read failed, and the loop cannot tell those apart. scanner.Err() is the only thing that can, and it returns nil for a clean EOF.",
					},
					pattern: `f, err := os.Open(path)
if err != nil {
    return 0, fmt.Errorf("open %s: %w", path, err)
}
defer f.Close()

scanner := bufio.NewScanner(f)
for scanner.Scan() {
    process(scanner.Text())
}
// Scan() returned false. Clean EOF, or failure? Only Err() knows.
if err := scanner.Err(); err != nil {
    return 0, fmt.Errorf("scan %s: %w", path, err)
}
return 0, nil`,
					example: {
						en: "A log rotator scans a multi-gigabyte nginx access log to count 5xx responses in a few MB of RSS: the same file that would OOM the process if it were handed to os.ReadFile.",
					},
					task: {
						en: "Write ProcessFile(path string, out chan<- parser.LogEntry) (skipped int, err error) in labs/log-parser/pipeline/pipeline.go. Open the file, defer closing it, scan it line by line, and call parser.ParseLine on each. Send entries that parse into out; count the ones that do not into skipped. Check scanner.Err() after the loop and wrap it with the path. The error return is for problems with the file, not with its contents.",
					},
					hints: [
						{
							label: "why skipped is returned, not logged",
							value: 'The task says count them, not print them. A library that logs is a library that has decided where your output goes, and the caller who wanted to aggregate the number across 400 files, or stay silent, now has to fight you. Return the count and let the caller choose. This is why the signature has an int in it.',
						},
						{
							label: "out is a send-only channel",
							value: "chan<- parser.LogEntry in the signature means this function can send and cannot receive or close. The compiler enforces it. That is worth doing on every channel parameter you write: the direction is documentation the compiler checks, and it makes the ownership rules in the next steps mechanical rather than a matter of discipline.",
						},
						{
							label: "%w again",
							value: "The suite calls errors.Is(err, fs.ErrNotExist) on a missing file. That only works if the original error is still underneath, which means %w, not %v. Flatten it to a string and the caller can no longer tell a missing file from a permissions problem.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command: "go test -v -run TestProcessFile ./pipeline",
					expect: {
						en: "Six green subtests across the four fixture files, plus the missing-file and long-line cases. The numbers are hand-countable: open labs/log-parser/testdata and you can see the undated line in api.log, the blank line in worker.log, and the two-field line in auth.log that the suite expects you to skip.",
					},
					labPath: "labs/log-parser/pipeline/pipeline_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the scanner.Err() check and return skipped, nil straight after the loop. Rerun go test -v -run TestProcessFile ./pipeline.",
					},
					observe: {
						en: "TestProcessFileStopsOnLongLine fails: got <nil>, want an error matching bufio.ErrTooLong. Every other case still passes. Your function read one line of a three-line file and reported success.",
					},
					why: {
						en: "bufio.Scanner allocates a buffer that grows up to bufio.MaxScanTokenSize, which is 65536 bytes. A line longer than that cannot be returned as a token, so Scan() gives up, returns false, and stores bufio.ErrTooLong where only Err() can see it. Your loop sees the same false it sees at the end of every healthy file. That is the whole trap: the failure signal and the success signal are the same value, and the error is out of band by design, because checking an error on every one of a million iterations would be absurd. So the cost of skipping one call at the end of the loop is that a 70KB line, one embedded stack trace or one JSON blob logged by a service having a bad day, silently truncates the file at that point. You do not get a crash. You get a summary computed from the first third of the data, no indication that anything went wrong, and a number you will put in a report.",
					},
				},
			],
			retrievalPrompt:
				"scanner.Scan() just returned false. Did the file end, or did the scan break? || You cannot tell, and that is the point: Scan() returns false for both. scanner.Err() is the only thing that distinguishes them, and it returns nil for a clean EOF. Skip it and a file that blew the 64KB token limit halfway through is indistinguishable from a file you read to the end.",
		},
		{
			n: "04",
			heading: { en: "Fan the files out across workers" },
			uses: ["goroutines", "channels", "sync-waitgroup"],
			blocks: [
				{
					type: "text",
					value: {
						en: "One file at a time means one core busy and one read outstanding, while the other seven cores idle and the disk waits for you to ask it for the next thing. Four hundred files is four hundred sequential round trips. The fix is not to make ProcessFile faster, it is to have several of them in flight at once, which is the first thing in this track that Go is actually famous for.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A worker pool is N goroutines ranging over one shared channel. Range on a channel blocks until a value arrives and ends when the channel is closed, so closing tasks is how you tell every worker at once that there is no more work, without counting anything or signalling anyone individually. A sync.WaitGroup counts the workers that are still running: Add before you start each one, Done as each returns, Wait blocks until the count hits zero. Whoever needs to know that every worker has finished asks the WaitGroup, because no individual worker knows.",
					},
					pattern: `// tasks holds every path, so these sends never block and no
// dispatcher goroutine is needed. Only works because the list is
// known and bounded; a stream of unknown length needs the send
// loop moved into its own goroutine.
tasks := make(chan string, len(paths))
for _, p := range paths {
    tasks <- p
}
close(tasks) // by the only sender, before any worker can still send

results := make(chan parser.LogEntry, 128)

var wg sync.WaitGroup
for i := 0; i < workers; i++ {
    wg.Add(1) // before the go statement, never inside it
    go func() {
        defer wg.Done()
        for path := range tasks { // blocks; ends at close(tasks)
            ProcessFile(path, results)
        }
    }()
}

go func() { wg.Wait(); close(results) }()

for entry := range results {
    // reduce
}`,
					example: {
						en: "A thumbnail generator pushes 5,000 image paths into tasks and runs 8 workers. Peak memory is roughly 8 images, not 5,000, because the channel holds paths and only the in-flight work holds pixels. The pool size, not the job count, sets the ceiling.",
					},
					task: {
						en: "Write Run(paths []string, workers int) (Summary, error) in labs/log-parser/pipeline/pipeline.go. Build the tasks channel and fill it, close it, start workers goroutines that range over it calling ProcessFile, track them with a WaitGroup, close results once they are all done, and range over results in main to build the Summary: Total, ByLevel counts, Earliest and Latest. Leave the error and skipped plumbing for step 07; getting entries out and counted is enough for now.",
					},
					hints: [
						{
							label: "wg.Add(1) goes outside the go statement",
							value: "Put it inside and you have a race against Wait: the goroutine may not have run yet when Wait checks the counter, sees zero, and returns immediately. Add on the goroutine that is doing the starting, Done on the goroutine that is doing the work.",
						},
						{
							label: "why buffer tasks to len(paths)",
							value: "So the send loop cannot block and you do not need a dispatcher goroutine to run it. This is a legitimate simplification only because you know how many paths there are before you start. Buffer it to 10 with 400 paths and the eleventh send blocks until a worker takes one, which is fine if the sends are in their own goroutine and a deadlock if they are not.",
						},
						{
							label: "results is buffered for throughput, not correctness",
							value: "128 is a guess and nothing depends on it. The collector drains results continuously, so the buffer only stops workers stalling on a slow reducer. Set it to 0 and the code is still correct, just chattier with the scheduler. Contrast that with the reports channel in step 07, whose buffer is load-bearing.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command:
						"go test -v -run '^TestRun$' ./pipeline\n\n# and watch it work on the real fixtures:\ngo run ./cmd/logparse -workers 8 testdata",
					expect: {
						en: "TestRun passes, and the command prints: parsed: 23, skipped: 0 (skipped is step 07's job), the four levels counted, and earliest: 2024-01-15T03:30:00Z. Look at that earliest for a moment. Grep testdata for 03:30:00 and you will not find it: the oldest entry is 2024-01-15T09:00:00+05:30 in auth.log, and it is only the oldest if you compare instants instead of the text of the timestamps. Sort those strings and 08:59:12Z sorts first, confidently, and wrongly.",
					},
					labPath: "labs/log-parser/cmd/logparse/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete close(tasks). Then run the command, not the test: go run ./cmd/logparse -workers 4 testdata",
					},
					observe: {
						en: "It does not hang. It dies instantly with fatal error: all goroutines are asleep - deadlock!, and prints every goroutine with the line it is stuck on: main.main at Run's range over results, the four workers parked on range tasks, and the closer parked in wg.Wait(). Now run the same break under go test -timeout 10s ./pipeline and watch it hang for the full ten seconds instead before dumping the same stacks.",
					},
					why: {
						en: "Range over a channel ends at close, and nothing else. No close means four workers block forever on a channel that will never receive another value, so the WaitGroup never reaches zero, so close(results) never runs, so main blocks forever on its own range. One missing line, three separate goroutines stuck for three different reasons, which is what makes the dump the most useful output in this lab: read it and the causal chain is right there in the [chan receive] and [semacquire] labels. The difference between the two runs is worth understanding too. Go's runtime can declare a deadlock only when every goroutine is blocked and nothing could still wake one up; then it gives up and dumps. Under go test that second condition never holds, because the test binary arms a timer for -timeout, and a pending timer is something that might yet make progress, so the runtime waits for it instead. Same bug, same stacks, and the test harness is the thing standing between you and seeing it immediately. Same bug, same stacks, and the test harness is the thing that stops you seeing it immediately. That is why -timeout is the flag to reach for the moment a test stops finishing.",
					},
				},
			],
			retrievalPrompt:
				"Four workers are ranging over a tasks channel. You send every path and return without closing it. What happens, and to whom? || The workers block forever on the range, so the WaitGroup never hits zero, so nobody closes results, so the collector blocks forever too. Closing a channel is not cleanup, it is the message that says there will be no more values, and range is waiting for exactly that message.",
		},
		{
			n: "05",
			heading: { en: "One channel, one closer" },
			uses: ["channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Closing a channel is the one channel operation that panics rather than blocks, and it panics in a goroutine that is not the one that made the mistake, at a moment that depends on scheduling. Which means it is the one thing in a pool you decide by rule rather than by taste, before you need it, because the day you get it wrong is the day it works on your machine ten times and takes down a job on the eleventh.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The rule: a channel is closed by its sender, exactly once, and never while another sender could still be sending. When there is one sender, that sender closes. When there are N senders, no single one of them knows whether it is the last, so none of them may close: something that can see all of them has to do it, and that something is the WaitGroup. That is the entire reason the closer goroutine exists. It is not a trick, it is the smallest piece of code that knows a fact none of the workers know.",
					},
					pattern: `// tasks: one sender (this goroutine), so this goroutine closes it.
for _, p := range paths {
    tasks <- p
}
close(tasks)

// results: N senders, so no worker may close it. wg.Wait() is the
// only thing that knows they have all finished, so the goroutine
// that calls it does the closing, once.
go func() {
    wg.Wait()
    close(results)
}()

// Never this:
//   go func() {
//       defer wg.Done()
//       defer close(results)  // worker 2 panics when it finishes
//       ...
//   }()`,
					example: {
						en: "This is why Go's own sync.WaitGroup documentation shows Wait in a goroutine whose only job is to close the channel the workers write to. The pattern is in the standard library's docs because there is no cheaper way to know that N senders are done.",
					},
					task: {
						en: "Look at your Run and answer two questions in order: which goroutine closes results, and could any worker still be sending when it does. If close(results) appears anywhere inside a worker, move it out into a single closer goroutine that runs wg.Wait() first. If it is already there, you got it right the first time and this step costs you nothing but the check.",
					},
					hints: [
						{
							label: "you cannot close a receive-only channel",
							value: "close(c) where c is <-chan T does not compile. This is not a technicality: it is why declaring channel parameters with a direction is worth the keystrokes. A worker that takes tasks <-chan string is a worker that cannot close tasks by accident, checked at compile time rather than at 3am.",
						},
						{
							label: "closing is not required",
							value: "You close a channel to say no more values are coming, which matters only if someone is ranging over it or checking the second return of a receive. An unclosed channel with no references is garbage collected like anything else. Close for the signal, never as cleanup.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command: "go test -v -run TestRunWithMoreWorkersThanFiles ./pipeline",
					expect: {
						en: "Green. This test exists specifically to catch what the break-it below does: it runs 32 workers over 4 files, 50 times, so most workers find the tasks channel already empty and exit immediately. That is the interleaving that turns a close in the wrong place from a rare crash into a reliable one.",
					},
					labPath: "labs/log-parser/pipeline/pipeline_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Add defer close(results) next to the defer wg.Done() inside each worker. It reads perfectly: each worker closes up after itself. Rerun go test -run '^TestRun' ./pipeline.",
					},
					observe: {
						en: "panic: close of closed channel, and often a second panic underneath it: panic: send on closed channel. Which one you get, and which worker dies, changes between runs.",
					},
					why: {
						en: "close is not idempotent and the language makes that deliberate. Closing an already-closed channel panics, and sending on a closed channel panics, because both mean a program has lost track of who owns what, and the runtime would rather stop than let you keep going with a channel whose state nobody agrees on. With eight workers and four files, four workers find tasks empty and return immediately: the first one closes results, the second one panics on a channel that was open a microsecond ago. The second panic is worse and it is the one to sit with: send on closed channel means a worker was midway through delivering real entries when a different worker decided everything was finished. Nothing about that failure is in the worker that closed. The rule exists because ownership cannot be inferred locally, and each worker's view (\"I am done\") is true and irrelevant.",
					},
				},
			],
			retrievalPrompt:
				"Eight workers send on results. Which one closes it? || None. No worker knows whether it is the last, and being wrong is a panic, not a mistake you get to notice. The WaitGroup knows, so the goroutine that calls wg.Wait() closes it, once. One sender closes its own channel; N senders means something above all of them does.",
		},
		{
			n: "06",
			heading: { en: "Reduce in one goroutine" },
			uses: ["maps", "channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You now have eight goroutines producing entries and one loop counting them, and the loop looks like the bottleneck. It is not, and the instinct to parallelize it is how the first genuinely nasty bug in a Go program usually arrives: not a crash, not a hang, but a counter that is quietly a bit low, on some runs, on some machines.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "The Summary is built by exactly one goroutine: the one ranging over results. That single-ownership rule is what makes the map and the running min/max safe without a single mutex, because nothing is shared. It also constrains the Summary's design, which is the deeper point here: every field is an order-independent reduction, a count, a minimum, a maximum. Entries arrive in whatever order eight workers happen to finish, which changes on every run, so any field whose value depended on arrival order would be a different number every time you ran the program. Fields like \"the first ERROR seen\" are not order-independent, and they cannot be computed this way at all.",
					},
					pattern: `// One goroutine owns the summary. No mutex, because nothing is shared.
summary := Summary{ByLevel: make(map[string]int)}
for entry := range results {
    summary.Total++
    summary.ByLevel[entry.Level]++ // count: order-independent
    if summary.Earliest.IsZero() || entry.Timestamp.Before(summary.Earliest) {
        summary.Earliest = entry.Timestamp // min: order-independent
    }
    if summary.Latest.IsZero() || entry.Timestamp.After(summary.Latest) {
        summary.Latest = entry.Timestamp // max: order-independent
    }
}`,
					example: {
						en: "MapReduce is this and nothing more: map in parallel, reduce with an operation whose answer does not depend on the order it sees things. The constraint on the reducer is the whole design, and it is why sum and max are the textbook examples and \"the third one\" never is.",
					},
					task: {
						en: "You wrote this loop in step 04 and it already passes TestRun, so this step is not more typing, it is the check on three things that loop quietly depends on. One: ByLevel is made before the loop and not inside it. Two: the timestamps are compared with Before and After, not as formatted strings. Three: IsZero seeds the first entry rather than a nil check. Then confirm the constraint the whole design rests on, which no test can see and the break-it below is about: nothing outside this loop touches summary.",
					},
					hints: [
						{
							label: "the zero Summary has a nil map",
							value: "Summary{} leaves ByLevel nil. Reading a nil map is legal and returns the zero value, which is why it will not fail your first quick test. Writing to one panics with assignment to entry in nil map. make it before the loop.",
						},
						{
							label: "IsZero, not a nil check",
							value: "time.Time is a struct, not a pointer, so it is never nil. The zero value is January 1, year 1, which would win every Before comparison you ever ran against it. t.IsZero() is how you ask whether it has been set.",
						},
						{
							label: "why not compare timestamp strings",
							value: 'It looks like it works, because RFC3339 in a fixed zone sorts lexically. testdata/auth.log has a +05:30 line specifically to break that: as text it sorts after 08:59:12Z, as an instant it is half an hour earlier. Before and After compare instants.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command:
						"go test -v -run TestRunSameAnswerRegardlessOfWorkers ./pipeline",
					expect: {
						en: "Five green subtests: workers=1, 2, 3, 8 and 64, all producing the identical Summary. That is the property worth more than any of the individual numbers. A pool that returns a different answer with 64 workers than with 1 is not fast, it is wrong, and the difference between those two conclusions is this test.",
					},
					labPath: "labs/log-parser/pipeline/pipeline_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Parallelize the collector, the way you would if you believed it were the bottleneck: wrap the loop body in go func() { ... }(), and add a second WaitGroup around the whole loop so Run still waits for the counting to finish before it returns. Then run the whole suite a few times: go test -count=5 ./pipeline",
					},
					observe: {
						en: "fatal error: concurrent map writes, and the process is gone. Not a failed test, not a panic you could recover: a runtime abort. Run it as a single test instead of the suite and it is far less reliable, roughly one run in three. Sit with that gap before reading on.",
					},
					why: {
						en: "Go's maps are not safe for concurrent use, and the runtime keeps a flag on each map that says a write is in progress. When a second goroutine starts a write and finds that flag set, it throws. This is not the race detector. It is a cheap best-effort check built into the map implementation, it only covers maps, and it only fires when two writes actually overlap in real time, which is why 23 entries across a few microseconds catch it one run in three while the full suite, which calls Run 58 times, catches it almost always. The gap is the lesson. summary.Total++ is racing too, on every one of those runs, and nothing throws for it: it is three instructions with no guard rail, so you get a total that is silently short by however many increments got lost, and a green test. That is the failure mode you are actually being protected from by keeping one owner, and the runtime cannot see it. The tool that can is -race, which instruments every memory access and reports the exact two lines rather than waiting for a coincidence. It needs cgo, so it is free on Linux and macOS and needs a gcc toolchain on Windows. The pool is fine without it. The reducer is where the sharing is, and one goroutine owning it is cheaper than any lock you could put there.",
					},
				},
			],
			retrievalPrompt:
				"Why is every field of Summary a count, a min, or a max, and never \"the first ERROR we saw\"? || Because eight workers deliver entries in whatever order they finish, and that order changes run to run. Counts, minima and maxima give the same answer whatever order they see, so the reduction is safe to feed from a pool. Anything that depends on arrival order would return a different answer every run, and no amount of locking would fix it: the problem is the question, not the concurrency.",
		},
		{
			n: "07",
			heading: { en: "Report what you could not read" },
			uses: ["error-handling", "channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "One of the four hundred files is a broken symlink. The obvious move, the one you have used in every project so far, is to return the error immediately and stop. Do that here and you strand seven workers mid-send on a channel nobody is draining any more, and Run never returns at all. Errors from inside a pool cannot be handled the way errors outside one are, and this is the step where that stops being an abstract warning.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "Every worker needs to report two things per file that only exist once the file is finished: how many lines it skipped and whether it failed. Entries stream, so they get a stream. These do not, so they get their own channel, buffered to exactly the number of reports that can ever be sent. That buffer is the load-bearing part: with room for every report, a worker can post and exit without a receiver, which is what lets the collector drain results to completion first and read the reports afterwards, in sequence, instead of selecting over two channels at once. Sizing a buffer to a known bound is the difference between a design that is obviously correct and one that needs a proof.",
					},
					pattern: `type fileReport struct {
    path    string
    skipped int
    err     error
}

// Buffered to the exact number of sends that can ever happen, so no
// worker can block here, so wg.Wait() is guaranteed to be reached.
reports := make(chan fileReport, len(paths))

// in the worker:
for path := range tasks {
    skipped, err := ProcessFile(path, results)
    reports <- fileReport{path: path, skipped: skipped, err: err}
}

// after the results loop has drained: every worker has finished, so
// every report is already sitting in the buffer.
var firstErr error
for r := range reports {
    summary.Skipped += r.skipped
    if r.err != nil && firstErr == nil {
        firstErr = r.err
    }
}
return summary, firstErr`,
					example: {
						en: "errgroup, which you meet in Tier 2, is this idea with the ergonomics filed down: it keeps the first non-nil error and lets the rest of the group finish rather than abandoning goroutines mid-flight. The reason it does not simply return on the first error is the reason you are not doing it here.",
					},
					task: {
						en: "Add the reports channel and wire the skipped counts and errors through it. Run returns the Summary it managed to build alongside the first error it hit: a file that will not open is a fact to report, not a reason to throw away the twenty-three entries you parsed from the other files. Then get the whole suite green.",
					},
					hints: [
						{
							label: "close both, in the closer",
							value: "wg.Wait(); close(results); close(reports). Same goroutine, same reason as step 05: N senders, so neither channel may be closed by a worker.",
						},
						{
							label: "why the summary comes back with the error",
							value: "The suite checks this: TestRunReportsUnreadableFile asserts the error matches fs.ErrNotExist and that the summary is still complete for the four files that were readable. Returning Summary{} with the error would be throwing away work you have already done because something unrelated went wrong.",
						},
						{
							label: "errors.Is has to keep working",
							value: "The wrap you did in ProcessFile with %w has to survive the trip through the channel and back out of Run. It does, because you are carrying the error value itself and not a string. This is the payoff for not having used %v three steps ago.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/log-parser",
					command:
						"go test -v ./...\ngo run ./cmd/logparse -workers 8 testdata",
					expect: {
						en: "Both suites green: nine named subtests in parser, and the pipeline suite including TestRunReportsUnreadableFile. The command now reports parsed: 23 and skipped: 3. The project is done when this is green: it is machine-checkable, on your machine, with no judgment call left in it.",
					},
					labPath: "labs/log-parser/pipeline/pipeline_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Size the reports buffer like a throughput knob instead of a bound: reports := make(chan fileReport, 1). Then run go run ./cmd/logparse -workers 4 testdata",
					},
					observe: {
						en: "fatal error: all goroutines are asleep - deadlock! again, but read the labels in this dump rather than assuming it is the same bug. One goroutine is [chan receive], parked in Run's range over results. The others are [chan send], parked on the reports send. Last time everyone was receiving. This time the pool is jammed against itself.",
					},
					why: {
						en: "Worker one posts its report and the buffer takes it. Worker two posts and blocks, because the only receiver for reports is the collector, and the collector is upstream draining results and will not reach the reports loop until results is closed. results is closed by wg.Wait(), and the WaitGroup is waiting for workers two, three and four, who are blocked on the send. Each goroutine is waiting for something another one will do after it stops waiting. The buffer was not a performance tweak, it was the proof that this cycle cannot form: with room for every report, the send is unconditionally non-blocking, so wg.Wait() is unconditionally reachable. That is the general shape of a channel deadlock, and it is worth learning to read from the dump rather than from the code, because in a real program it is never four goroutines and one file. [chan send] and [chan receive] on the same channel in the same dump means you have found a cycle; the question is only which link you were wrong about.",
					},
				},
			],
			retrievalPrompt:
				"The reports channel is buffered to len(paths). Is that a tuning knob or a correctness requirement? || Correctness. Exactly len(paths) reports can ever be sent, so a buffer that size makes the send unconditionally non-blocking, which is what guarantees every worker reaches its return and the WaitGroup reaches zero. Shrink it and the workers block on a channel whose only receiver is downstream of the close they are blocking, which is a deadlock. Contrast the results buffer, which is genuinely just a knob.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built a concurrent pipeline from parts: a pure parser tested exhaustively by a table, a streaming file reader that stays flat on a file of any size, a worker pool with one owner per channel, and a reduction defined so that the answer cannot depend on the order eight goroutines happen to finish in. The ownership rule (one sender closes, N senders means the WaitGroup decides) is the rule you apply in every concurrent project from here.",
			},
		},
		{
			type: "text",
			value: {
				en: "The table-driven suite is the durable thing you take from this project. It is how Go is tested, in the standard library and in every codebase you will join, and you learned it by reading a real one closely enough to break it on purpose. That is also the point of the row that fails under ==, printing two identical structs side by side: the suite you are handed is not scripture, it is code, and the reason it was written that way is legible if you look.",
			},
		},
		{
			type: "text",
			value: {
				en: "Four of the break-its in this project were deadlocks, panics, or a runtime abort, and none of them were syntax you could have caught by reading. A missing close, a close in the wrong goroutine, a buffer sized by feel, a counter with two writers: each one compiles, each one passes a casual run, and each one is diagnosed from the same goroutine dump you now know how to read. Concurrency in Go is not hard to write. It is hard to be sure about, which is why this is the project where the tests started.",
			},
		},
	],
}
