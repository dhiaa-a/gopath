import { Project } from "./content"

export const projects: Project[] = [
	// ─────────────────────────────────────────────────────────────────────────
	// TIER 1 — FOUNDATIONS
	// Step type: "pattern" — show idiom skeleton + similar example + state task.
	// No assessment in P1/P2. Tests introduced in P3, benchmarks in P4.
	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "cli-renamer",
		name: "File renamer CLI",
		tagline: "Batch-rename files with patterns, flags, and dry-run mode.",
		code: "CLI",
		tier: 1,
		tierLabel: "FOUNDATIONS",
		estimatedTime: "2–3 hours",
		tags: ["os", "flag", "filepath", "error-handling"],
		mentalModels: [
			"input parsing boundary",
			"stateless transformation",
			"separation of config and execution",
			"explicit error propagation",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "A CLI reads flags from the user, validates them into a Config struct, walks a directory, applies a pure name transform to each file, then either prints a preview or executes the renames. Nothing is done until input is fully validated.",
				},
			},
			{
				type: "code",
				value: `os.Args → flag.Parse → *Config → os.ReadDir → transformName → rename / print`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `main.go
 ├── parseFlags() (*Config, error)
 ├── run(cfg *Config) error
 │    ├── os.ReadDir(cfg.Dir)
 │    ├── transformName(name, pattern string) string
 │    └── os.Rename / fmt.Println (dry-run)
 └── os.Exit(1) on any error`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Parse flags into a Config" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "The flag package registers named flags and writes their values into pointers. After flag.Parse() the pointers hold what the user typed. Go's convention is to validate all input at the boundary — early, explicitly, before any work begins — and return a descriptive error rather than panicking or silently using bad values.",
						},
						pattern: `// register → parse → validate
dir     := flag.String("dir", ".", "directory to scan")
verbose := flag.Bool("verbose", false, "print each rename")
flag.Parse()

if *dir == "" {
    return nil, fmt.Errorf("--dir is required")
}
info, err := os.Stat(*dir)
if err != nil {
    return nil, fmt.Errorf("invalid --dir: %w", err)
}
if !info.IsDir() {
    return nil, fmt.Errorf("%s is not a directory", *dir)
}`,
						example: {
							en: "An image compressor registers --input (path), --quality (int, 1–100), and --output. It validates that the input file exists, that quality is in range, and that the output directory is writable — all before touching any image data.",
						},
						task: {
							en: 'Define --dir (default "."), --pattern (required string), and --dry-run (bool). After flag.Parse, validate that --dir exists and is a directory using os.Stat. Collect all flag and validation errors into a single descriptive message. Return a *Config on success.',
						},
						hints: [
							{
								label: "os.Stat",
								value: "Returns (fs.FileInfo, error). Call .IsDir() on the FileInfo to distinguish files from directories.",
							},
							{
								label: "error wrapping",
								value: 'fmt.Errorf("invalid dir: %w", err) preserves the original error for callers that need to inspect it with errors.Is or errors.As.',
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Write a pure name transform" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "A pure function has no side effects and always returns the same output for the same input. Transformation logic should be pure: it takes a string in, returns a string out, never touches the filesystem. Pure functions are trivially testable — just call them with inputs and compare outputs.",
						},
						pattern: `// pure: input in, output out, no I/O
func slugify(s string) string {
    s = strings.TrimSpace(s)
    s = strings.ToLower(s)
    return strings.ReplaceAll(s, " ", "-")
}`,
						example: {
							en: "A URL shortener's slug generator takes a blog post title, strips leading/trailing whitespace, lowercases it, replaces spaces with hyphens, and removes non-alphanumeric characters — all without touching a database or filesystem.",
						},
						task: {
							en: 'Write transformName(name, pattern string) string. It must: replace spaces with underscores, convert the base name to lowercase, and prepend pattern + "_" when pattern is non-empty. The file extension must be preserved exactly as-is. "My File.TXT" with pattern "backup" → "backup_my_file.TXT".',
						},
						hints: [
							{
								label: "extension",
								value: "filepath.Ext(name) returns the extension including the dot. strings.TrimSuffix(name, ext) gives you the base.",
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "Walk the directory and apply renames" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "os.ReadDir returns a sorted []fs.DirEntry — no recursion. For each entry: skip directories, compute the new name, skip if unchanged, then either print (dry-run) or call os.Rename. Errors from Rename should be wrapped with context and returned immediately — do not silently continue past a failed rename.",
						},
						pattern: `entries, err := os.ReadDir(dir)
if err != nil {
    return fmt.Errorf("read %s: %w", dir, err)
}
for _, e := range entries {
    if e.IsDir() { continue }
    oldPath := filepath.Join(dir, e.Name())
    newPath := filepath.Join(dir, newName)
    if err := os.Rename(oldPath, newPath); err != nil {
        return fmt.Errorf("rename %s: %w", e.Name(), err)
    }
}`,
						example: {
							en: "A photo organiser reads a directory, skips subdirectories, constructs a date-prefixed name from EXIF metadata, and calls os.Rename only when the new name differs from the old one — skipping already-renamed files on reruns.",
						},
						task: {
							en: 'Implement run(*Config) error. Skip directories and files where transformName produces the same name. In dry-run mode print "[DRY RUN] old → new" without calling os.Rename. Return the first error encountered, wrapped with the filename.',
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You separated concerns into three explicit layers — parsing, transformation, execution — keeping the transform pure and the I/O isolated. This structure appears in every subsequent project. The pattern of validating at the boundary and propagating errors with context is Go's most important idiom.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "json-fetcher",
		name: "JSON API fetcher",
		tagline: "Fetch, decode, and display typed data from a live JSON API.",
		code: "JFT",
		tier: 1,
		tierLabel: "FOUNDATIONS",
		estimatedTime: "2–3 hours",
		tags: ["net/http", "encoding/json", "structs", "defer"],
		mentalModels: [
			"type-safe decoding at the boundary",
			"resource cleanup with defer",
			"struct tags as a contract",
			"explicit status code handling",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "An http.Client sends a GET request. The status code is checked before any decoding. The response body is decoded into a typed struct using json.Decoder. The body is always closed — even on error paths — using defer. The result is formatted and printed to stdout.",
				},
			},
			{
				type: "code",
				value: `flag → buildURL → http.Client.Get → check status → json.Decode → format → stdout`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `main.go
 ├── buildURL(city string) (string, error)
 ├── fetch(url string) (*WeatherResponse, error)
 │    ├── client.Get → defer body.Close()
 │    ├── check resp.StatusCode
 │    └── json.NewDecoder.Decode
 └── printResult(w *WeatherResponse)`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Model the API response with struct tags" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: 'encoding/json maps JSON keys to struct fields using struct tags. The field must be exported (start with an uppercase letter) or json silently ignores it. The tag controls the JSON key name, whether to omit the field when empty (omitempty), and whether to skip it entirely (json:"-"). Unexported fields are always ignored — no tag needed.',
						},
						pattern: `type Record struct {
    ID    int    \`json:"id"\`
    Name  string \`json:"full_name"\`
    Score float64 \`json:"score,omitempty"\`
    cache string  // unexported — never in JSON
}`,
						example: {
							en: 'A GitHub API client defines a Repository struct: json:"full_name" maps the API\'s snake_case key to a Go field, json:"stargazers_count" maps star count, and json:"-" on an internal etag field ensures it never appears in serialised output.',
						},
						task: {
							en: 'Look at the Open-Meteo API response with curl: curl "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.1&current=temperature_2m,wind_speed_10m". Define WeatherResponse with Latitude, Longitude float64 and a nested Current struct with Temperature (temperature_2m) and WindSpeed (wind_speed_10m). Tags must match the exact JSON keys the API returns.',
						},
						hints: [
							{
								label: "nested structs",
								value: "A nested JSON object maps to a nested Go struct. The outer struct holds a field of the inner type, tagged with the JSON key of the nested object.",
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Make an HTTP request with a timeout" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "The default http.Client has no timeout — it waits forever for slow or dead servers. Always set an explicit Timeout. The response Body is an io.ReadCloser: if you don't close it, the underlying TCP connection leaks and cannot be reused. Defer body.Close() immediately after a successful Get — before any other error check — so it always runs.",
						},
						pattern: `client := &http.Client{Timeout: 10 * time.Second}

resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("get: %w", err)
}
defer resp.Body.Close() // always runs, even if decode fails

if resp.StatusCode != http.StatusOK {
    return nil, fmt.Errorf("unexpected status: %s", resp.Status)
}`,
						example: {
							en: "A currency rate fetcher sets a 5-second timeout, defers body close, checks for HTTP 200, and only then decodes — so a 429 Too Many Requests returns a clear error rather than a confusing JSON decode failure.",
						},
						task: {
							en: "Write fetch(url string) (*WeatherResponse, error). Use &http.Client{Timeout: 10 * time.Second}. Defer body close immediately after checking the Get error. Check the status code before decoding. Return a wrapped, descriptive error at each failure point.",
						},
					},
				],
			},
			{
				n: "03",
				heading: { en: "Decode the response and format output" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "json.NewDecoder wraps an io.Reader and decodes directly from it — no need to buffer the entire body into a []byte first. Pass a pointer to your struct: Decode needs to write into it. A non-nil error from Decode means the JSON was malformed or didn't match the struct shape.",
						},
						pattern: `var result MyStruct
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
    return nil, fmt.Errorf("decode: %w", err)
}`,
						example: {
							en: "A Stripe webhook handler decodes the request body directly into an Event struct using json.NewDecoder(r.Body). It never calls io.ReadAll first — for large payloads this would buffer megabytes unnecessarily.",
						},
						task: {
							en: 'Complete fetch() with json.NewDecoder decoding. Then write printResult(*WeatherResponse) that prints temperature to one decimal place and wind speed rounded to the nearest integer. Add a --city flag accepting "london", "paris", or "baghdad" mapped to hardcoded lat/lon — the user should never type coordinates.',
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You learned the complete HTTP + JSON cycle: typed client, defer-based resource cleanup, status code checking before decoding, struct-tag contracts. Every API client you write from here follows this exact shape.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "log-parser",
		name: "Concurrent log parser",
		tagline:
			"Parse large log files fast with goroutines, channels, and a worker pool.",
		code: "LOG",
		tier: 1,
		tierLabel: "FOUNDATIONS",
		estimatedTime: "3–4 hours",
		tags: ["goroutines", "channels", "sync", "bufio", "testing"],
		mentalModels: [
			"fan-out with a worker pool",
			"channel ownership — senders close",
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
				type: "code",
				value: `log_parser.go
 ├── parseLine(line, file string, n int) (LogEntry, bool)
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
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "A pure parsing function takes a raw string and returns a typed value plus a bool — Go's idiom for optional results without allocating an error on every bad line. Because it touches no I/O it is trivial to test exhaustively.",
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
							en: 'Write parseLine(line, file string, lineNum int) (LogEntry, bool). The format is: "2024-01-15T10:30:00Z INFO message here". Parse the timestamp with time.Parse(time.RFC3339, ...). Return false — never an error — for any line that doesn\'t match. Store file and lineNum in the entry for debugging.',
						},
					},
				],
			},
			{
				n: "02",
				heading: { en: "Scan a file line by line" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "bufio.Scanner wraps an io.Reader and exposes a Scan() / Text() loop, reading one line at a time regardless of file size. Memory usage stays constant. After the loop always check scanner.Err() — it returns the first non-EOF error encountered during scanning.",
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
							en: "A log rotator scans a multi-gigabyte nginx access log line by line to count 5xx status codes without ever loading the file into memory — the same file that would OOM the process if read with os.ReadFile.",
						},
						task: {
							en: 'Write processFile(path string, out chan<- LogEntry) error. Open the file, scan line by line, call parseLine, and send successful entries into out. Count skipped lines and print a summary with log.Printf("skipped %d malformed lines in %s").',
						},
					},
				],
			},
			{
				n: "03",
				heading: { en: "Build the worker pool" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "Worker pool: N goroutines all range over the same tasks channel. Range blocks waiting for items and exits when the channel is closed. The dispatcher sends all work then closes tasks — signalling workers to stop. A WaitGroup counts active workers; when it hits zero, a separate goroutine closes results — signalling the collector to stop.",
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
				heading: { en: "Write table-driven tests for parseLine" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "Table-driven tests define a slice of cases — each with a name, inputs, and expected outputs — then range over them calling t.Run. Each case becomes a named subtest in the output: PASS/FAIL is reported per case, not for the whole function. Adding a new edge case is one new struct literal.",
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
							en: "The Go standard library tests net/url.Parse with a table of 60+ cases covering schemes, hosts, paths, query strings, fragments, and edge cases like missing slashes and duplicate keys. Each is a single row — adding coverage is trivial.",
						},
						task: {
							en: "Write TestParseLine covering: a valid INFO line, a valid WARN line, a malformed timestamp, a line with only two space-separated fields, and an empty string. Run go test ./... and confirm all five subtests pass. The output must show named subtests, not just PASS.",
						},
					},
					{
						type: "assessment",
						assessment: {
							kind: "unit",
							title: "parseLine test suite",
							description:
								"Run go test ./... — five named subtests must pass.",
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
							desiredOutput: `--- PASS: TestParseLine/valid_INFO_line
--- PASS: TestParseLine/valid_WARN_line
--- PASS: TestParseLine/malformed_timestamp
--- PASS: TestParseLine/only_two_fields
--- PASS: TestParseLine/empty_string
PASS`,
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You built a concurrent pipeline from scratch: pure parsing, buffered I/O, a fan-out worker pool with proper channel ownership, and your first test suite. The channel ownership rule — senders close, receivers range — is the rule you will apply in every concurrent project from here.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "config-watcher",
		name: "Live config reloader",
		tagline:
			"Watch a config file for changes and reload without restarting the process.",
		code: "CFG",
		tier: 1,
		tierLabel: "FOUNDATIONS",
		estimatedTime: "3–4 hours",
		tags: ["select", "atomic", "time", "goroutines", "benchmarks"],
		mentalModels: [
			"select as a channel multiplexer",
			"debounce with time.AfterFunc",
			"atomic swap for lock-free reads",
			"benchmark-driven design decisions",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "A watcher goroutine receives file system events. Rapid successive events (editors write in bursts) are collapsed by a debounce timer. When quiet for 200ms, the new config is parsed and stored atomically. HTTP handlers call Load() — one pointer dereference, no lock, never blocked by a reload.",
				},
			},
			{
				type: "code",
				value: `fsnotify event → select → debounce timer → reload() → atomic.Value.Store
                                              ↑ ctx.Done() exits the loop`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `config/
 ├── config.go       — Config struct, loadFromFile(path) (*Config, error)
 ├── store.go        — Store{atomic.Value}, Load() *Config, store(*Config)
 ├── watcher.go      — Watch(path string, store *Store, notify chan<- struct{})
 └── store_test.go   — unit tests + benchmarks`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Multiplex channels with select" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "select waits on multiple channels simultaneously. It blocks until one case is ready, then executes exactly that case. If multiple are ready simultaneously, one is chosen at random. It is Go's answer to 'wait for whichever event arrives first' — the foundation of every event loop.",
						},
						pattern: `// wait on whichever channel fires first
select {
case msg := <-ch1:
    handle(msg)
case err := <-errCh:
    log.Println("error:", err)
case <-time.After(5 * time.Second):
    fmt.Println("nothing arrived in 5s")
case <-ctx.Done():
    return ctx.Err() // clean shutdown
}`,
						example: {
							en: "A health checker selects over a ticker (fires every 30s to ping a service), an error channel (fires when a ping fails beyond threshold), and ctx.Done() (fires on SIGINT). The loop body runs only one case per iteration — exactly whichever arrived first.",
						},
						task: {
							en: "Write the core goroutine for your watcher. It should select over: watcher.Events (file system events), watcher.Errors (log and continue), and ctx.Done() (return to exit the goroutine). Use github.com/fsnotify/fsnotify for the watcher. For now just log events — debounce comes next.",
						},
					},
				],
			},
			{
				n: "02",
				heading: { en: "Debounce rapid file events" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "Most editors write a file in multiple syscall bursts — you may receive 10 events in 50ms for a single save. Without debouncing you reload config 10 times unnecessarily. time.AfterFunc fires a callback once after a delay. On each new event: stop the existing timer (if any) and create a new one. Only when no events arrive for the full window does the callback execute.",
						},
						pattern: `var timer *time.Timer

for event := range events {
    if timer != nil {
        timer.Stop()
    }
    // restart the clock on every event
    timer = time.AfterFunc(200*time.Millisecond, func() {
        doReload() // fires only after 200ms of silence
    })
}`,
						example: {
							en: "A search-as-you-type box debounces keystrokes: each keypress stops the previous timer and starts a fresh 300ms one. The API call fires only after the user pauses typing — not on every keystroke.",
						},
						task: {
							en: "Add debouncing to your event loop. When a Write or Create event arrives, stop any existing timer and start a new 200ms timer whose callback calls reload(path, store, notify). reload() must: call loadFromFile, log and return on error keeping the old config, call store.store() with the new config, and send a non-blocking signal on notify.",
						},
						hints: [
							{
								label: "non-blocking send",
								value: "select { case notify <- struct{}{}: default: } — if notify is full, skip. Subscribers that weren't listening miss this notification, which is fine.",
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "Store config with atomic.Value" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "sync/atomic.Value stores and loads a value atomically — one machine instruction, no mutex, no contention on the read path. The rule: always store the same concrete type, and store a pointer (*Config), never a value (Config). Load returns interface{} — type-assert it. This is the right tool when reads vastly outnumber writes and the entire value is replaced atomically.",
						},
						pattern: `var v atomic.Value

// writer — rare
v.Store(&Config{Port: 8080})

// reader — happens on every request, no lock
cfg := v.Load().(*Config)
fmt.Println(cfg.Port)`,
						example: {
							en: "A feature flag service stores *FlagSet atomically. Thousands of concurrent HTTP handlers call Load() on every request with no mutex. When flags update once per minute, a background goroutine calls Store with the new pointer — one atomic write, zero reader contention.",
						},
						task: {
							en: "Define type Store struct with an atomic.Value field. Expose Load() *Config and a private store(*Config). Initialize the store with the config read at startup before starting the watcher. Call store() from reload(). Add a GET /config handler that calls Load() and writes the current port and log level as plain text.",
						},
						hints: [
							{
								label: "first Store",
								value: "The first Load() panics if Store has never been called. Always initialise before starting goroutines that might call Load.",
							},
						],
					},
				],
			},
			{
				n: "04",
				heading: { en: "Benchmark atomic.Value vs sync.RWMutex" },
				blocks: [
					{
						type: "pattern",
						concept: {
							en: "A benchmark is named BenchmarkXxx, takes *testing.B, and runs the code b.N times. The framework adjusts b.N until the total time is stable. Call b.ResetTimer() after setup so setup cost is excluded. b.RunParallel spins up GOMAXPROCS goroutines — essential for seeing contention differences between atomic and mutex implementations.",
						},
						pattern: `func BenchmarkLoad(b *testing.B) {
    store := NewStore(&Config{Port: 8080}) // setup
    b.ResetTimer()                         // start measuring here

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            _ = store.Load() // the thing being measured
        }
    })
}

// Run: go test -bench=. -benchmem -count=5`,
						example: {
							en: "The Go team benchmarked sync.Map vs map+RWMutex for read-heavy and write-heavy workloads with RunParallel. The results — sync.Map wins at high read-to-write ratios, loses on write-heavy — drove the documentation guidance on when to use each.",
						},
						task: {
							en: "Write BenchmarkAtomicLoad (your Store) and BenchmarkMutexLoad (implement a MutexStore using sync.RWMutex with the same API). Run go test -bench=. -benchmem -count=5. Record the ns/op for both. The atomic version should be significantly faster under parallel load.",
						},
					},
					{
						type: "assessment",
						assessment: {
							kind: "benchmark",
							title: "atomic.Value vs RWMutex under parallel load",
							description:
								"Run go test -bench=. -benchmem -count=5. Both benchmarks must complete. The atomic version must be faster.",
							desiredMetrics:
								"BenchmarkAtomicLoad:  < 5 ns/op,   0 allocs/op\nBenchmarkMutexLoad:  10–40 ns/op,  0 allocs/op",
							metricsAchievable:
								"On an M1 Mac with GOMAXPROCS=8: atomic ~1.2 ns/op, RWMutex ~22 ns/op. The gap widens with more goroutines because atomic has zero contention — every RLock still touches the mutex's memory, invalidating cache lines shared across cores.",
							hints: [
								{
									label: "why RunParallel",
									value: "A serial benchmark (b.N loop, no RunParallel) shows similar results for both — there's no contention when only one goroutine runs. RunParallel reveals the difference.",
								},
								{
									label: "benchstat",
									value: "go install golang.org/x/perf/cmd/benchstat@latest. Run: go test -bench=. -count=5 > bench.txt then benchstat bench.txt for mean ± variance across runs.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You learned select (the channel multiplexer), debouncing (time.AfterFunc in a real pattern), and atomic.Value (lock-free reads). You wrote your first benchmark and proved with data which implementation is faster. These three — select, atomic, benchmarks — appear in every T2 and T3 project.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────
	// TIER 2 — SYSTEMS
	// Step type: "requirement" — what + why + stdlib/3rd-party hints.
	// Complex snippets only for non-obvious APIs.
	// Assessment required on every project.
	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "http-server",
		name: "HTTP server with middleware",
		tagline:
			"Build a composable HTTP server — auth, logging, rate limiting — from the stdlib alone.",
		code: "SRV",
		tier: 2,
		tierLabel: "SYSTEMS",
		estimatedTime: "4–5 hours",
		tags: ["net/http", "middleware", "context", "httptest", "interfaces"],
		mentalModels: [
			"handler composition over configuration",
			"context as request-scoped state",
			"interface-driven testability",
			"middleware ordering matters",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "Every request passes through a chain of middleware functions before reaching a route handler. Each middleware wraps the next one. The chain is assembled explicitly in main — not by a framework. You learned http.Client in T1; now you implement the server side of the same interface.",
				},
			},
			{
				type: "code",
				value: `request → LoggingMW → AuthMW → RateLimitMW → handler → response`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `middleware/
 ├── logging.go
 ├── auth.go
 └── ratelimit.go
handlers/
 ├── users.go
 └── posts.go
server.go   — Chain(), http.Server
server_test.go`,
			},
		],
		steps: [
			{
				n: "01",
				heading: {
					en: "The http.Handler interface and middleware type",
				},
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Define type Middleware func(http.Handler) http.Handler. Write Chain(h http.Handler, mws ...Middleware) http.Handler that applies middlewares in order. The first middleware in the list must be the outermost wrapper (first to run, last to return).",
						},
						why: {
							en: "http.Handler is the single interface powering Go's entire HTTP stack. A middleware is just a function that wraps one Handler in another — there is no magic, no reflection, no framework. Chain lets you compose them cleanly: Chain(mux, logging, auth) instead of logging(auth(mux)).",
						},
						stdlibHint:
							"net/http — http.Handler, http.HandlerFunc, http.ResponseWriter, *http.Request",
						complexSnippet: `// HandlerFunc converts a plain function into an http.Handler
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // pre-processing
    next.ServeHTTP(w, r)
    // post-processing (e.g. log elapsed time)
})`,
					},
				],
			},
			{
				n: "02",
				heading: { en: "Logging middleware with response capture" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write LoggingMiddleware that logs method, path, status code, response bytes, and duration for every request using log/slog.",
						},
						why: {
							en: "http.ResponseWriter does not expose the status code after it has been written — the interface has no StatusCode() method. The standard Go solution is a wrapper struct that embeds http.ResponseWriter and overrides WriteHeader to capture the code. You used an identical pattern in T1 when you wrapped bufio.Scanner to count lines.",
						},
						stdlibHint: "net/http, log/slog, time",
						hints: [
							{
								label: "response wrapper",
								value: "type responseWriter struct { http.ResponseWriter; status, size int }. Override WriteHeader to capture status. Override Write to accumulate size.",
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "Auth middleware with context" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write AuthMiddleware that reads a Bearer token from the Authorization header, validates it, and stores the user identity in the request context. Return 401 for missing or invalid tokens. Expose UserFromContext(ctx) (string, bool) for handlers.",
						},
						why: {
							en: "context.WithValue threads request-scoped values through the call stack without changing function signatures. The context key must be an unexported type — never a bare string or int — to prevent collisions between packages. You attached config values to a context in T1's config watcher; the pattern is identical here.",
						},
						stdlibHint: "context, net/http, strings",
						hints: [
							{
								label: "context key",
								value: 'type contextKey string — const userKey contextKey = "user". The unexported type means no other package can accidentally read or overwrite your key.',
							},
							{
								label: "r.WithContext",
								value: "Returns a new *http.Request with the updated context. Pass this to next.ServeHTTP, not the original r.",
							},
						],
					},
				],
			},
			{
				n: "04",
				heading: { en: "Token bucket rate limiter" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write RateLimitMiddleware with per-IP limiting: N requests per second. Requests beyond the limit receive 429. A background goroutine must evict stale IP entries periodically.",
						},
						why: {
							en: "Per-IP rate limiting requires a map keyed by IP protected by a mutex — concurrent requests from different IPs hit the map simultaneously. You built a mutex-protected map in the config watcher's MutexStore. The token bucket is the standard algorithm: each IP gets N tokens, one consumed per request, tokens refill at rate R/s. Stale entry eviction prevents unbounded memory growth.",
						},
						stdlibHint: "net, sync, time",
						thirdPartyHint:
							"golang.org/x/time/rate — ready-made token bucket Limiter, one per IP",
						hints: [
							{
								label: "IP from RemoteAddr",
								value: 'r.RemoteAddr is "ip:port". Use net.SplitHostPort to extract just the IP. Behind a proxy, check X-Forwarded-For.',
							},
						],
					},
				],
			},
			{
				n: "05",
				heading: { en: "Test with httptest" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write table-driven tests for each middleware using httptest.NewRecorder and httptest.NewRequest. Run with -race. No real TCP connections.",
						},
						why: {
							en: "httptest.NewRecorder is an http.ResponseWriter that captures status, headers, and body. httptest.NewRequest builds an *http.Request without a network round-trip. Calling ServeHTTP directly tests the middleware in isolation — no server needed. You wrote table-driven tests in T1; apply the same pattern here.",
						},
						stdlibHint: "net/http/httptest",
					},
					{
						type: "assessment",
						assessment: {
							kind: "integration",
							title: "Middleware test suite",
							description:
								"go test -race ./... must pass with zero data races.",
							testCases: [
								{
									description:
										"Auth: no Authorization header",
									expected: "HTTP 401",
								},
								{
									description: "Auth: invalid token",
									expected: "HTTP 401",
								},
								{
									description: "Auth: valid token",
									expected:
										"HTTP 200, user stored in context",
								},
								{
									description: "RateLimit: requests 1–N",
									expected: "HTTP 200",
								},
								{
									description: "RateLimit: request N+1",
									expected: "HTTP 429",
								},
								{
									description:
										"Logging: request returning 404",
									expected: 'slog output contains "404"',
								},
							],
							desiredOutput: "ok  \tyourmodule/middleware\nPASS",
							hints: [
								{
									label: "-race",
									value: "go test -race ./... runs the Go race detector. Any unsynchronised concurrent map access will be reported as a data race and fail the test.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You built composable middleware from one interface, applied the context-key pattern from T1, and tested everything without a real server. The rate limiter's mutex-protected map is the same pattern as MutexStore from the config watcher — you recognised it and applied it.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "worker-pool",
		name: "Worker pool",
		tagline:
			"Process thousands of jobs concurrently with bounded parallelism, cancellation, and no goroutine leaks.",
		code: "WRK",
		tier: 2,
		tierLabel: "SYSTEMS",
		estimatedTime: "4–5 hours",
		tags: ["goroutines", "channels", "context", "errgroup", "benchmarks"],
		mentalModels: [
			"bounded parallelism",
			"structured concurrency",
			"backpressure via channel buffer",
			"graceful shutdown with context",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "N workers range over a buffered jobs channel. Results and errors flow out on separate channels. A context cancels all workers cleanly. The pool must not leak goroutines — every goroutine started must eventually exit, proven by the race detector and goroutine leak checks.",
				},
			},
			{
				type: "code",
				value: `Submit(job) → jobs chan[buffer] → [worker×N] → results chan
                              ctx.Cancel() → all workers exit via select`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `pool/
 ├── pool.go           — Pool, New, Submit, Results, Stop
 ├── pool_test.go      — correctness + race tests
 └── pool_bench_test.go — throughput benchmarks`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Design the Pool API" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Define Job{ID int, Payload any} and Result{JobID int, Output any, Err error}. Expose New(workers int, fn func(Job) Result) *Pool, Submit(Job) error, Results() <-chan Result, and Stop(). Stop must block until all workers exit and be safe to call multiple times.",
						},
						why: {
							en: "Designing the API surface before implementation forces you to answer ownership questions: who closes which channel, who can safely call Stop. Answering these questions with sync.Once (Stop is idempotent) and the sender-closes rule (only the pool closes results) prevents the entire class of 'send on closed channel' panics.",
						},
						stdlibHint: "sync — sync.Once, sync.WaitGroup",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Workers with context cancellation" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Each worker must exit when the pool's context is cancelled. Every blocking operation — receiving a job, sending a result — needs a ctx.Done() escape hatch via select. A worker that blocks forever on either channel is a goroutine leak.",
						},
						why: {
							en: "You used ctx.Done() in the config watcher's event loop to exit cleanly. The pattern is identical here: select on the operation channel and ctx.Done(). The difference is that workers block on both receive (jobs) and send (results), so both need the escape hatch.",
						},
						stdlibHint: "context, select",
						hints: [
							{
								label: "select on send",
								value: "select { case results <- r: case <-ctx.Done(): return } — worker exits if context cancels while blocked on sending a result.",
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "Error collection without losing results" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "A Result that carries either Output or Err (not both simultaneously) lets callers handle them uniformly from one channel. Alternatively use errgroup to manage goroutine lifecycles and collect the first error. Choose one approach and justify it in a comment.",
						},
						why: {
							en: "Separate error and result channels force the caller to select over two channels simultaneously — workable, but verbose. A Result{Output, Err} union type with 'exactly one is set' convention is more composable. errgroup.WithContext is the stdlib-adjacent choice when you need the first error to cancel all workers automatically.",
						},
						thirdPartyHint:
							"golang.org/x/sync/errgroup — manages goroutines, cancels on first error",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Benchmark throughput and buffer sizes" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write a benchmark: submit 10,000 no-op jobs to 8 workers. Measure jobs/second with b.ReportMetric. Then vary the jobs channel buffer (0, 10, 100, 1000) as sub-benchmarks and plot the throughput difference.",
						},
						why: {
							en: "You already know how to write benchmarks from T1. Apply that knowledge here with b.ReportMetric for custom units. Buffer size is the primary tuning knob: an unbuffered channel forces Submit to block until a worker is free (maximum backpressure), a large buffer decouples submission from processing. Data from your benchmark, not intuition, drives the choice.",
						},
						stdlibHint:
							"testing — b.ReportMetric, b.Run for sub-benchmarks",
					},
					{
						type: "assessment",
						assessment: {
							kind: "metrics",
							title: "Worker pool throughput",
							description:
								"go test -race -bench=BenchmarkPool -benchmem -count=5. Achieve the target with 8 workers and buffer=100.",
							desiredMetrics:
								"> 500,000 jobs/sec with 8 workers\nSubmit p99 latency < 5 µs\n0 allocs/op in the worker receive-process-send path",
							metricsAchievable:
								"A no-op WorkerFunc with buffer=100 achieves ~1.1M jobs/sec on an M1 Mac. The bottleneck is channel scheduling overhead. Your actual WorkerFunc cost is on top of this — measure them separately.",
							hints: [
								{
									label: "b.ReportMetric",
									value: 'b.ReportMetric(float64(b.N)/elapsed.Seconds(), "jobs/s") adds a custom metric column to benchmark output.',
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "You built structured concurrency from scratch: bounded workers, context cancellation, backpressure, no leaks. The select-on-send pattern for cancellation is the same one you used in the config watcher. The benchmark methodology is from T1. You are reusing tools, not learning new ones.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "tcp-echo",
		name: "TCP echo server",
		tagline:
			"Handle concurrent TCP connections — the network plumbing under every Go service.",
		code: "TCP",
		tier: 2,
		tierLabel: "SYSTEMS",
		estimatedTime: "3–4 hours",
		tags: ["net", "io", "bufio", "goroutines", "integration-testing"],
		mentalModels: [
			"accept loop — one goroutine per connection",
			"net.Conn as io.Reader + io.Writer",
			"deadline-based idle timeout",
			"port :0 for test isolation",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "A net.Listener accepts connections in a loop. Each net.Conn is handed to a goroutine. The goroutine reads lines with bufio.Scanner, uppercases them, and writes back. A read deadline evicts idle connections. The server shuts down cleanly when the listener is closed.",
				},
			},
			{
				type: "code",
				value: `net.Listen(":addr") → accept loop → go handleConn(conn)
                                → bufio.Scanner → uppercase → conn.Write`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `server/
 ├── server.go       — Server, Listen(addr), Shutdown()
 ├── handler.go      — handleConn(conn net.Conn)
 └── server_test.go  — integration tests with net.Dial`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "The accept loop" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write Server with Listen(addr string) error and Shutdown(). Listen must accept connections in a loop and hand each to a goroutine. Shutdown closes the listener — causing Accept to return an error — and waits for all connection goroutines to finish with a WaitGroup.",
						},
						why: {
							en: "This is the accept loop pattern — the foundation of every network server. net.Listener.Accept blocks until a connection arrives or the listener is closed. Closing the listener is the shutdown signal; the error from Accept tells you which case occurred. The per-connection goroutine is the same fan-out pattern as the log parser worker pool, applied to connections instead of file paths.",
						},
						stdlibHint: "net — net.Listen, net.Listener, net.Conn",
						hints: [
							{
								label: "accept error on close",
								value: "When the listener is closed, Accept returns an error. Check a 'shutting down' flag or use errors.Is with net.ErrClosed before logging.",
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Handle connections with bufio and io" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: 'Implement handleConn(conn net.Conn). Read lines with bufio.Scanner, uppercase each with strings.ToUpper, write back with fmt.Fprintln. If the client sends "quit", close the connection cleanly. Set a 30-second idle deadline with conn.SetDeadline — reset it on each line received.',
						},
						why: {
							en: "net.Conn implements both io.Reader and io.Writer. bufio.Scanner wraps the Reader exactly as it wrapped os.File in the log parser — same API, different underlying type. conn.SetDeadline prevents a goroutine from blocking forever on an idle connection. You must reset the deadline after each successful read or the connection times out even for active clients.",
						},
						stdlibHint:
							"bufio, strings, fmt, net, time — bufio.NewScanner, conn.SetDeadline",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Integration test with net.Dial" },
				blocks: [
					{
						type: "requirement",
						what: {
							en: "Write integration tests that start a real server on :0 (OS assigns a free port), connect with net.Dial, send lines, and assert the response. The server must shut down cleanly after each test. Run 10 concurrent connections in one test.",
						},
						why: {
							en: "Unit tests with mocks cannot tell you if TCP framing, buffering, or connection lifecycle is correct. An integration test with a real socket proves the full path. Port :0 lets the OS pick a free port — no conflicts between parallel test runs. This is the integration testing approach you will apply in all T3 projects.",
						},
						stdlibHint:
							"net, testing, bufio — net.Dial, listener.Addr().String()",
					},
					{
						type: "assessment",
						assessment: {
							kind: "integration",
							title: "TCP server integration tests",
							description:
								"go test -race ./... must pass. Use goleak in TestMain to assert no goroutines leak after tests complete.",
							testCases: [
								{
									description: "Single echo",
									input: "hello",
									expected: "HELLO",
								},
								{
									description:
										"Multiple lines in one connection",
									input: "foo\\nbar\\nbaz",
									expected: "FOO\\nBAR\\nBAZ",
								},
								{
									description: "Quit command",
									input: "quit",
									expected: "connection closed by server",
								},
								{
									description: "10 concurrent connections",
									expected: "all 10 receive correct echo",
								},
							],
							desiredOutput:
								"--- PASS: TestEchoSingle\n--- PASS: TestEchoMultiLine\n--- PASS: TestQuit\n--- PASS: TestConcurrent\nPASS",
							hints: [
								{
									label: "goleak",
									value: "go.uber.org/goleak — add goleak.VerifyNone(t) in each test or goleak.VerifyTestMain(m) in TestMain.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "The accept loop, per-connection goroutines, bufio scanning, idle deadlines — these are the exact primitives gRPC and the database driver use internally. You now understand the layer underneath.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────
	// TIER 3 — PRODUCTION
	// Step type: "constraint" — what must be true + rationale.
	// Assessment is a hard deliverable. Project is not done without it.
	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "grpc-service",
		name: "gRPC microservice",
		tagline:
			"Contract-first API design: define a proto, generate Go code, ship a tested gRPC service.",
		code: "RPC",
		tier: 3,
		tierLabel: "PRODUCTION",
		estimatedTime: "5–7 hours",
		tags: ["grpc", "protobuf", "interceptors", "streaming", "bufconn"],
		mentalModels: [
			"contract-first design",
			"generated type safety",
			"interceptors as middleware",
			"in-memory transport for testing",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "A .proto file is the single source of truth. protoc generates server interfaces and client stubs. You implement the server interface, chain interceptors for logging and auth, and expose a server-streaming RPC. Tests use bufconn — an in-memory listener — for a real gRPC round-trip with no TCP overhead.",
				},
			},
			{
				type: "code",
				value: `service.proto → protoc → generated interface
      ↓ your implementation
interceptors: logging → auth → handler
tests: bufconn listener → generated client stub → your server`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `proto/user/v1/user.proto
gen/user/v1/              — generated, never edit
internal/
 ├── server/user.go       — implements UserServiceServer
 ├── interceptor/
 │    ├── logging.go
 │    └── auth.go
 └── server_test.go       — bufconn-based tests
cmd/server/main.go`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Define the protobuf schema" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "The proto file must define UserService with GetUser (unary), ListUsers (server-streaming), and CreateUser (unary). All fields must use snake_case. Field numbers 1–15 must be reserved for the most frequently sent fields. The go_package option must point to your module's gen path.",
						},
						rationale: {
							en: "The schema is the API contract. Changing a field number is a wire-breaking change — existing clients will misread the data. snake_case is the protobuf convention; the generated Go code converts to CamelCase automatically. Field numbers 1–15 use one byte on the wire; 16+ use two.",
						},
						hints: [
							{
								label: "streaming syntax",
								value: "rpc ListUsers(ListUsersRequest) returns (stream User); — the stream keyword generates a server-streaming RPC.",
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Implement the server interface" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Embed UnimplementedUserServiceServer. Return codes.NotFound for missing resources, codes.InvalidArgument for malformed input, codes.Internal for unexpected errors. Never return a raw Go error from a gRPC handler.",
						},
						rationale: {
							en: "Embedding UnimplementedUserServiceServer means adding new RPCs to the proto won't break your server — the embedded type provides a default Unimplemented response. gRPC status codes are part of the wire contract: clients branch on them. A raw Go error becomes codes.Unknown — clients cannot distinguish it from a bug.",
						},
						hints: [
							{
								label: "status errors",
								value: 'status.Errorf(codes.NotFound, "user %s not found", id) — import google.golang.org/grpc/status and google.golang.org/grpc/codes.',
							},
							{
								label: "streaming send",
								value: "Call stream.Send(&User{...}) in a loop. Return nil when done, an error to abort the stream.",
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "Chain logging and auth interceptors" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Implement two unary interceptors: one logs method, duration, and error code for every call; one validates a Bearer token from gRPC metadata and returns codes.Unauthenticated on failure. Chain with grpc.ChainUnaryInterceptor. Auth must run before logging sees the result.",
						},
						rationale: {
							en: "gRPC interceptors are the same wrapping pattern as the HTTP middleware you built in T2 — wrap one handler in another. gRPC metadata is the equivalent of HTTP headers. Auth before logging ensures unauthenticated requests are not logged as successful — the ordering matters for the same reason middleware ordering mattered in the HTTP server.",
						},
						hints: [
							{
								label: "metadata",
								value: "metadata.FromIncomingContext(ctx) — import google.golang.org/grpc/metadata.",
							},
						],
					},
				],
			},
			{
				n: "04",
				heading: { en: "Test with bufconn" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "All tests must use bufconn — no real TCP ports. Tests must cover: GetUser returning NotFound, GetUser returning a valid user, ListUsers streaming at least three items, CreateUser returning InvalidArgument on empty email, and the auth interceptor rejecting a missing token.",
						},
						rationale: {
							en: "bufconn creates an in-memory listener. A grpc.Dial with a custom dialer pointing at it gives you a real gRPC round-trip — client stub, interceptors, your handler, response — with zero network overhead and no port allocation. You used net.Dial for TCP integration tests in T2; bufconn is the gRPC equivalent.",
						},
					},
					{
						type: "assessment",
						assessment: {
							kind: "system",
							title: "gRPC service test suite",
							description:
								"go test -race ./... must pass. The streaming test must verify all items arrive in order.",
							testCases: [
								{
									description: "GetUser: unknown ID",
									expected: "codes.NotFound",
								},
								{
									description: "GetUser: known ID",
									expected: "correct User proto message",
								},
								{
									description:
										"ListUsers: server sends 3 users",
									expected: "3 messages received in order",
								},
								{
									description:
										"CreateUser: empty email field",
									expected: "codes.InvalidArgument",
								},
								{
									description: "Auth interceptor: no token",
									expected: "codes.Unauthenticated",
								},
							],
							desiredOutput: "PASS",
							hints: [
								{
									label: "bufconn import",
									value: "google.golang.org/grpc/test/bufconn",
								},
								{
									label: "recv loop",
									value: "Call stream.Recv() in a loop until it returns io.EOF — that signals the server is done sending.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "Contract-first design, generated types, interceptor chaining, in-memory test transport. Every pattern — middleware, context propagation, error codes, integration testing with a real transport — you already knew from T1 and T2. protobuf and gRPC were a new surface on familiar foundations.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "db-api",
		name: "Database-backed REST API",
		tagline:
			"CRUD REST API with Postgres, migrations, the repository pattern, and transaction safety.",
		code: "DB",
		tier: 3,
		tierLabel: "PRODUCTION",
		estimatedTime: "6–8 hours",
		tags: ["postgres", "pgx", "migrations", "repository", "testing"],
		mentalModels: [
			"repository interface as a boundary",
			"dependency injection through constructors",
			"transaction propagation via interface",
			"test doubles without a database",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "HTTP handlers receive a TaskRepository interface — not a *pgxpool.Pool. The Postgres implementation lives behind that interface. Tests inject a mock. Schema changes are versioned SQL migration files. Transactions are propagated through a WithTx method on the interface itself.",
				},
			},
			{
				type: "code",
				value: `handler(repo TaskRepository) → repo.Create / List / Update / Delete
                   ↑ PostgresRepo in production
                   ↑ MockRepo in tests`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `migrations/
 ├── 001_tasks.up.sql
 └── 001_tasks.down.sql
internal/
 ├── repository/
 │    ├── repository.go  — TaskRepository interface
 │    └── postgres.go    — PostgresRepo
 ├── api/
 │    ├── handlers.go
 │    └── handlers_test.go  — MockRepo
cmd/server/main.go`,
			},
		],
		steps: [
			{
				n: "01",
				heading: {
					en: "Define the repository interface and migrations",
				},
				blocks: [
					{
						type: "constraint",
						what: {
							en: "TaskRepository must expose Create, GetByID, List(limit, offset int), Update, Delete, and WithTx(ctx, func(TaskRepository) error) error. Schema changes must be in versioned up/down SQL files applied by golang-migrate, not in application startup code.",
						},
						rationale: {
							en: "The interface is defined by its consumer (handlers), not its implementation (Postgres). WithTx accepts a callback that receives a transaction-scoped repository — the callback never touches the transaction object, so it can be tested with a mock that calls the function directly without a transaction. SQL migration files version the schema independently of the application binary.",
						},
						hints: [
							{
								label: "golang-migrate",
								value: "github.com/golang-migrate/migrate/v4 — reads numbered .up.sql/.down.sql files, tracks applied versions in schema_migrations.",
							},
							{
								label: "WithTx pattern",
								value: "Begin a transaction, create a new PostgresRepo wrapping the tx, call fn with it, commit on success or rollback on error.",
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Implement the Postgres repository" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Use pgxpool with explicit MaxConns and MinConns. Every query must use $N parameterised placeholders. Wrap all database errors with context before returning. Detect unique constraint violations and return a typed sentinel error.",
						},
						rationale: {
							en: "pgxpool reuses connections — opening one per query would be 10–100× slower. Parameterised queries prevent SQL injection at the driver level. Error wrapping preserves the original pgx error for callers. Typed sentinel errors (ErrDuplicate) let handlers return 409 Conflict instead of 500 Internal Error for known failure modes.",
						},
						hints: [
							{
								label: "pgx",
								value: "github.com/jackc/pgx/v5 and github.com/jackc/pgx/v5/pgxpool",
							},
							{
								label: "unique constraint",
								value: 'var pgErr *pgconn.PgError; if errors.As(err, &pgErr) && pgErr.Code == "23505" { return ErrDuplicate }',
							},
						],
					},
				],
			},
			{
				n: "03",
				heading: { en: "HTTP handlers with dependency injection" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: 'Handlers must receive TaskRepository through a constructor, never as a global or package-level variable. Use Go 1.22 method-specific routing patterns. All error responses must be consistent JSON: {"error": "message"}. All success responses must set Content-Type: application/json.',
						},
						rationale: {
							en: 'Constructor injection makes the dependency explicit and swappable — the same principle as the interface itself. Global state makes tests order-dependent and race-prone. Method-specific patterns ("POST /tasks") eliminate the need for a third-party router. Consistent error shapes let clients handle errors uniformly without inspecting response bodies.',
						},
						hints: [
							{
								label: "Go 1.22 routing",
								value: 'mux.HandleFunc("POST /tasks", h.Create) — the HTTP method is part of the pattern string.',
							},
						],
					},
				],
			},
			{
				n: "04",
				heading: { en: "Test handlers and run an integration test" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Unit tests must use a MockTaskRepository — no real database. Cover every handler: success, not-found, invalid input, and duplicate. Additionally write one integration test against a real Postgres instance (testcontainers-go) exercising Create → GetByID → Update → Delete.",
						},
						rationale: {
							en: "The repository interface exists so tests never need a database. The mock lets you exercise every handler branch in milliseconds. The integration test proves the SQL is correct — mocks cannot do that. testcontainers-go spins up a real Postgres container and tears it down after — no manual setup.",
						},
					},
					{
						type: "assessment",
						assessment: {
							kind: "system",
							title: "Handler unit tests + integration lifecycle",
							description:
								"go test -race ./... must pass. The integration test must run against a real Postgres container.",
							testCases: [
								{
									description: "POST /tasks: valid body",
									expected: "HTTP 201, task JSON with id",
								},
								{
									description: "POST /tasks: empty title",
									expected:
										'HTTP 400, {"error":"title required"}',
								},
								{
									description: "GET /tasks/:id: exists",
									expected: "HTTP 200, task JSON",
								},
								{
									description: "GET /tasks/:id: not found",
									expected: "HTTP 404",
								},
								{
									description: "DELETE /tasks/:id",
									expected: "HTTP 204",
								},
								{
									description:
										"Integration: Create → Get → Update → Delete",
									expected: "final GET returns 404",
								},
							],
							desiredOutput: "PASS",
							hints: [
								{
									label: "testcontainers",
									value: "github.com/testcontainers/testcontainers-go — spins up a real Postgres container, runs migrations, tears down after test.",
								},
								{
									label: "mock pattern",
									value: "type MockRepo struct { CreateFn func(ctx, title) (*Task, error) }. In Create() call r.CreateFn(ctx, title). Tests set CreateFn to return whatever they need.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "Interface-driven data access, constructor injection, migration-versioned schema, typed error codes, unit tests with mocks, and an integration test with a real database. This is production Go architecture — layered, testable, and decoupled at every boundary.",
				},
			},
		],
	},

	// ─────────────────────────────────────────────────────────────────────────

	{
		slug: "observability",
		name: "Observability & performance",
		tagline:
			"Profile a real service, find the bottleneck, fix it, and prove the improvement.",
		code: "OBS",
		tier: 3,
		tierLabel: "PRODUCTION",
		estimatedTime: "4–6 hours",
		tags: ["pprof", "benchmarks", "runtime", "trace", "benchstat"],
		mentalModels: [
			"measure before optimising",
			"allocation is the primary cost",
			"flamegraph-driven investigation",
			"before/after proof with benchstat",
		],
		systemOverview: [
			{
				type: "text",
				value: {
					en: "You are given a deliberately slow HTTP service. Attach pprof, generate load, take CPU and heap profiles, identify the bottleneck from the flamegraph, write a baseline benchmark, implement the fix, and prove statistical improvement with benchstat. The project is not complete without the proof.",
				},
			},
			{
				type: "code",
				value: `slow service → pprof + load → flamegraph → bottleneck named
 → baseline benchmark → fix → re-benchmark → benchstat proof`,
			},
		],
		architecture: [
			{
				type: "code",
				value: `service/
 ├── main.go               — imports _ "net/http/pprof" on :6060
 ├── processor.go          — the slow function (provided)
 ├── processor_test.go     — correctness tests (must pass before and after)
 └── processor_bench_test.go  — BenchmarkBefore + BenchmarkAfter`,
			},
		],
		steps: [
			{
				n: "01",
				heading: { en: "Profile under real load" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Import net/http/pprof on a dedicated admin port (not the public port). Generate load with hey or ab (minimum 10,000 requests, 50 concurrent). Take a 30-second CPU profile. Open the flamegraph. Name the function that appears widest.",
						},
						rationale: {
							en: "pprof registers endpoints on the default ServeMux. Running it on a separate port keeps it off the public interface. The flamegraph's widest bar is the most expensive function — you cannot guess this correctly; the profile must name it. Minimum 10,000 requests ensures enough samples for a statistically representative profile.",
						},
						hints: [
							{
								label: "hey",
								value: "hey -n 10000 -c 50 http://localhost:8080/process",
							},
							{
								label: "flamegraph",
								value: "go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30",
							},
						],
					},
				],
			},
			{
				n: "02",
				heading: { en: "Baseline benchmark before any change" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Write BenchmarkBefore for the slow function using realistic input (same shape as production). Run with -benchmem -count=5. Save the output to before.txt. Do not change any code before recording the baseline.",
						},
						rationale: {
							en: "Without a baseline you cannot prove improvement — you can only claim it. The benchmark must use realistic input: a benchmark on 10-byte strings that proves nothing when production processes 10,000-byte strings. -count=5 gives benchstat enough runs to compute variance. Save before.txt before any code change.",
						},
					},
				],
			},
			{
				n: "03",
				heading: { en: "Implement and verify the fix" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Fix the bottleneck identified in the flamegraph. The fix must not change the observable output of the function. Run go test ./... — tests must pass before and after. Common patterns: sync.Pool for per-call allocations, pre-sized slices/maps, strings.Builder over concatenation, map lookup over O(n²) scan.",
						},
						rationale: {
							en: "The most common Go performance issue is unnecessary allocation. sync.Pool recycles objects, eliminating GC pressure. Pre-sizing with make([]T, 0, n) avoids growth copies. strings.Builder avoids the string immutability copies that make concatenation O(n²). A faster function that changes output is a bug, not an optimisation.",
						},
						hints: [
							{
								label: "escape analysis",
								value: "go build -gcflags='-m' ./... shows which values escape to the heap. Heap escapes cause GC pressure; stack values are free.",
							},
							{
								label: "sync.Pool",
								value: "var pool = sync.Pool{New: func() any { return new(MyStruct) }}. Get() retrieves or allocates; Put() returns. Always reset state before Put.",
							},
						],
					},
				],
			},
			{
				n: "04",
				heading: { en: "Prove the improvement with benchstat" },
				blocks: [
					{
						type: "constraint",
						what: {
							en: "Run the benchmark again with identical flags and -count=5. Save to after.txt. Run benchstat before.txt after.txt. The delta column must show a statistically significant improvement (p < 0.05). Write one paragraph explaining what you changed and why it reduced allocations or CPU time.",
						},
						rationale: {
							en: "A single benchmark run has high variance. benchstat computes mean, variance, and p-value across runs. p > 0.05 means the difference could be noise — you need more runs or a larger improvement. The written explanation is mandatory: if you cannot articulate why it is faster, you do not understand the fix and will not be able to apply it elsewhere.",
						},
					},
					{
						type: "assessment",
						assessment: {
							kind: "metrics",
							title: "Before/after benchstat proof",
							description:
								"Submit: the flamegraph screenshot naming the bottleneck, benchstat before.txt after.txt output, and a one-paragraph written explanation of the fix.",
							desiredMetrics:
								"≥ 40% reduction in ns/op\n≥ 50% reduction in allocs/op\nbenchstat p-value < 0.05",
							metricsAchievable:
								"The provided slow service has an intentional O(n²) string concatenation in its hot loop. Replacing it with strings.Builder reduces ns/op by ~70% and allocs/op by ~85% on n=1000 inputs. The fix is one function, approximately 12 lines.",
							hints: [
								{
									label: "benchstat",
									value: "go install golang.org/x/perf/cmd/benchstat@latest — then: benchstat before.txt after.txt",
								},
								{
									label: "correctness first",
									value: "go test ./... must pass after the fix. A faster function with wrong output is not a fix.",
								},
							],
						},
					},
				],
			},
		],
		recap: [
			{
				type: "text",
				value: {
					en: "The professional performance workflow: profile first, baseline second, fix third, prove with data. You used benchmarks from T1 and benchstat to make claims you can defend. The skill is not memorising optimisation techniques — it is knowing how to find which one matters and proving it worked.",
				},
			},
		],
	},
]

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug)
}

export function getProjectsByTier(tier: 1 | 2 | 3): Project[] {
	return projects.filter((p) => p.tier === tier)
}
