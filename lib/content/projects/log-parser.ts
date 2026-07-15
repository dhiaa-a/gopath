import { Project } from "../../content"

export const logParser: Project = {
	slug: "log-parser",
	name: "Concurrent log parser",
	tagline:
		"Parse large log files fast with goroutines, channels, and a worker pool.",
	code: "LOG",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "3–4 hours",
	tags: ["goroutines", "channels", "sync", "bufio", "testing"],
	lab: {
		path: "labs/log-parser",
		command: "go test -v ./...",
		summary: {
			en: "Your first graded suite: a table-driven test file written to be read, which then grades your ParseLine across eight named subtests.",
		},
	},
	mentalModels: [
		"fan-out with a worker pool",
		"channel ownership: senders close",
		"buffered scanning for memory efficiency",
		"table-driven tests",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "A dispatcher sends file paths into a tasks channel. N workers each range over tasks, parse each file line by line using bufio.Scanner, and send LogEntry values into a results channel. A WaitGroup tracks workers; when all finish a goroutine closes results. The main goroutine ranges over results and builds a summary.",
			},
		},
		{
			type: "code",
			value: `paths → tasks chan → [worker×N] → results chan → aggregate → summary
                   ↑ closed by dispatcher    ↑ closed when wg reaches 0`,
		},
	],
	architecture: [
		{
			type: "text",
			value: {
				en: "The tree below is the full program you assemble in your own project directory, not the lab's layout. The executable lab scaffolds and grades only ParseLine, which ships in a parser package (parser.go, alongside entry.go for the LogEntry type, the parser_test.go suite, and the reference solution.go); processFile (step 02) and the worker pool with its --workers flag (step 03) are patterns you apply in your own project, not files the lab provides.",
			},
		},
		{
			type: "code",
			value: `log_parser.go
 ├── ParseLine(line string) (LogEntry, bool)   // the lab grades this, in parser/parser.go
 ├── processFile(path string, out chan<- LogEntry) error
 ├── worker(tasks <-chan string, out chan<- LogEntry, errs chan<- error, wg *sync.WaitGroup)
 ├── dispatch(paths []string, tasks chan<- string)
 └── aggregate(results <-chan LogEntry) Summary
log_parser_test.go`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Parse a single log line" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "A pure parsing function takes a raw string and returns a typed value plus a bool: Go's idiom for optional results without allocating an error on every bad line. Because it touches no I/O it is trivial to test exhaustively.",
					},
					pattern: `func parseRecord(line string) (Record, bool) {
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
						en: "A CSV importer splits each row by comma, checks the field count matches the header, converts numeric columns with strconv.Atoi, and returns (Row, false) for any malformed row rather than aborting the entire import.",
					},
					task: {
						en: 'Write ParseLine(line string) (LogEntry, bool) in the lab\'s parser package (labs/log-parser/parser/parser.go). The format is: "2024-01-15T10:30:00Z INFO message here". Parse the timestamp with time.Parse(time.RFC3339, ...). Return false (never an error) for any line that doesn\'t match. Exported, because the lab\'s test suite lives outside the package and can only call what you export.',
					},
				},
			],
		},
		{
			n: "02",
			heading: { en: "Scan a file line by line" },
			uses: ["defer"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "bufio.Scanner wraps an io.Reader and exposes a Scan() / Text() loop, reading one line at a time regardless of file size. Memory usage stays constant. After the loop always check scanner.Err(); it returns the first non-EOF error encountered during scanning.",
					},
					pattern: `f, err := os.Open(path)
if err != nil { return err }
defer f.Close()

scanner := bufio.NewScanner(f)
for scanner.Scan() {
    process(scanner.Text())
}
return scanner.Err() // nil means clean EOF`,
					example: {
						en: "A log rotator scans a multi-gigabyte nginx access log line by line to count 5xx status codes without ever loading the file into memory: the same file that would OOM the process if read with os.ReadFile.",
					},
					task: {
						en: 'Write processFile(path string, out chan<- LogEntry) error. Open the file, scan line by line, call ParseLine, and send successful entries into out. Count skipped lines and print a summary with log.Printf("skipped %d malformed lines in %s").',
					},
				},
			],
		},
		{
			n: "03",
			heading: { en: "Build the worker pool" },
			uses: ["goroutines","channels","sync-waitgroup"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "Worker pool: N goroutines all range over the same tasks channel. Range blocks waiting for items and exits when the channel is closed. The dispatcher sends all work then closes tasks, signalling workers to stop. A WaitGroup counts active workers; when it hits zero, a separate goroutine closes results, signalling the collector to stop.",
					},
					pattern: `tasks   := make(chan string, len(paths))
results := make(chan Result, 200)
var wg sync.WaitGroup

for i := 0; i < numWorkers; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for task := range tasks { // blocks until item or close
            results <- process(task)
        }
    }()
}

go func() { // dispatcher
    for _, p := range paths { tasks <- p }
    close(tasks) // workers exit their range loop
}()

go func() { wg.Wait(); close(results) }() // closer`,
					example: {
						en: "An image thumbnail generator sends 5,000 image paths into tasks, 8 workers each resize one image at a time, and send (path, error) into results. main ranges over results to print progress. Total memory stays near 8× one image's size, not 5,000×.",
					},
					task: {
						en: "Wire everything: create tasks (buffered to len(paths)), results (buffered to 200), and errs channels. Start N workers (--workers flag, default 4). Dispatch in a goroutine, close tasks when done. Close results when wg reaches zero. Range over results in main to print: total entries, count per log level, earliest and latest timestamp.",
					},
					hints: [
						{
							label: "channel sizing",
							value: "Buffer tasks to len(paths) so the dispatcher never blocks. Buffer results to a few hundred so workers don't stall waiting for the collector.",
						},
					],
				},
			],
		},
		{
			n: "04",
			heading: { en: "Read the table-driven suite that grades ParseLine" },
			uses: [],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "Table-driven tests define a slice of cases (each with a name, inputs, and expected outputs) then range over them calling t.Run. Each case becomes a named subtest in the output: PASS/FAIL is reported per case, not for the whole function. Adding a new edge case is one new struct literal.",
					},
					pattern: `func TestParseRecord(t *testing.T) {
    cases := []struct {
        name  string
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
                t.Fatalf("ok: want %v got %v", tc.ok, ok)
            }
            if ok && got != tc.want {
                t.Errorf("want %+v got %+v", tc.want, got)
            }
        })
    }
}`,
					example: {
						en: "The Go standard library tests net/url.Parse with a table of 60+ cases covering schemes, hosts, paths, query strings, fragments, and edge cases like missing slashes and duplicate keys. Each is a single row; adding coverage is trivial.",
					},
					task: {
						en: "Open labs/log-parser/parser/parser_test.go and read it top to bottom; the comments walk through the table, the anonymous struct, t.Run, and got/want. It covers five contract cases (a valid INFO line, a valid WARN line, a malformed timestamp, a line with only two space-separated fields, an empty string) plus three edge cases. From labs/log-parser, run go test -v ./... until every named subtest passes. Then add one row of your own to the table and predict its outcome before you run again.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "unit",
						title: "ParseLine test suite",
						description:
							"From labs/log-parser, run go test -v ./... . The shipped table-driven suite grades your ParseLine: the five contract subtests below plus three edge cases (interior spaces kept in the message, an RFC3339 zone offset, a single-word message).",
						labPath: "labs/log-parser/parser/parser_test.go",
						testCases: [
							{
								description: "Valid INFO line",
								input: "2024-01-15T10:30:00Z INFO user logged in",
								expected:
									'ok=true, Level="INFO", Message="user logged in"',
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
    --- PASS: TestParseLine/timestamp_with_zone_offset (0.00s)
    --- PASS: TestParseLine/single_word_message (0.00s)
PASS
ok      gopath.dev/labs/log-parser/parser`,
					},
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built a concurrent pipeline from scratch: pure parsing, buffered I/O, a fan-out worker pool with proper channel ownership, and you read and passed your first table-driven test suite. The channel ownership rule (senders close, receivers range) is the rule you will apply in every concurrent project from here.",
			},
		},
	],
}
