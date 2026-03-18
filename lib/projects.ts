export type Tag = string

export type Step = {
	n: string
	heading: string
	body: string
	code?: string
	filename?: string
}

export type Project = {
	slug: string
	tier: 1 | 2 | 3
	tierLabel: string
	code: string
	name: string
	tagline: string
	what: string
	learn: string[]
	fromOtherLang: string
	steps: Step[]
	tags: Tag[]
	nextSlug?: string
	nextName?: string
	estimatedTime: string
}

export const projects: Project[] = [
	// ── TIER 1 ──────────────────────────────────────────────────────────────
	{
		slug: "cli-renamer",
		tier: 1,
		tierLabel: "Tier 01 — Get Comfortable",
		code: "CLI",
		name: "File renamer CLI",
		tagline: "Batch-rename files with patterns, flags, and dry-run mode.",
		estimatedTime: "2–3 hours",
		what: "A command-line tool that renames files in a directory based on patterns — add a date prefix, replace spaces with underscores, strip certain strings. Supports a --dry-run flag so users can preview changes before committing.",
		learn: [
			"Go project layout and package structure",
			"Reading CLI flags with the <code>flag</code> package",
			"File system operations with <code>os</code> and <code>filepath</code>",
			"Error handling patterns — wrapping, logging, early return",
			"Writing a clean <code>main.go</code> that delegates to packages",
		],
		fromOtherLang:
			"Coming from Python: this replaces <code>argparse</code> + <code>os.rename()</code>. Go's <code>flag</code> package is more verbose but explicit — you'll see why that matters as projects grow. Coming from Node: forget callbacks and async — file I/O in Go is synchronous by default and far simpler.",
		steps: [
			{
				n: "01",
				heading: "Scaffold the project",
				body: "Run <code>go mod init github.com/you/renamer</code>. Create <code>main.go</code> and a <code>renamer/</code> package. This is the standard Go layout — a thin <code>main.go</code> that wires things together, and packages that hold real logic.",
				code: `// main.go
package main

import (
    "flag"
    "fmt"
    "os"

    "github.com/you/renamer/renamer"
)

func main() {
    dir    := flag.String("dir", ".", "directory to rename files in")
    dryRun := flag.Bool("dry-run", false, "preview changes without applying")
    flag.Parse()

    if err := renamer.Run(*dir, *dryRun); err != nil {
        fmt.Fprintf(os.Stderr, "error: %v\\n", err)
        os.Exit(1)
    }
}`,
				filename: "main.go",
			},
			{
				n: "02",
				heading: "Define your flags",
				body: "Use <code>flag.String</code> and <code>flag.Bool</code> to accept a directory path, a pattern, and a <code>--dry-run</code> flag. Parse them with <code>flag.Parse()</code>. Notice how Go's error handling works — explicit, never silent.",
				code: `// renamer/renamer.go
package renamer

import (
    "fmt"
    "os"
    "path/filepath"
    "strings"
)

func Run(dir string, dryRun bool) error {
    entries, err := os.ReadDir(dir)
    if err != nil {
        return fmt.Errorf("reading directory: %w", err)
    }

    renamed := 0
    for _, entry := range entries {
        if entry.IsDir() {
            continue
        }
        old := entry.Name()
        new := newName(old)
        if old == new {
            continue
        }
        if dryRun {
            fmt.Printf("would rename: %s -> %s\\n", old, new)
        } else {
            if err := os.Rename(
                filepath.Join(dir, old),
                filepath.Join(dir, new),
            ); err != nil {
                return fmt.Errorf("renaming %s: %w", old, err)
            }
            fmt.Printf("renamed: %s -> %s\\n", old, new)
        }
        renamed++
    }
    fmt.Printf("\\n%d file(s) %s\\n", renamed,
        map[bool]string{true: "would be renamed", false: "renamed"}[dryRun])
    return nil
}`,
				filename: "renamer/renamer.go",
			},
			{
				n: "03",
				heading: "Build the rename logic",
				body: "Write a pure function <code>newName(old string) string</code> that applies your transformation. Keeping it pure (no side effects) makes it trivially testable — call it with a string, get a string back.",
				code: `// newName applies your renaming rules.
// Pure function — easy to test in isolation.
func newName(name string) string {
    // Replace spaces with underscores
    name = strings.ReplaceAll(name, " ", "_")
    // Lowercase everything
    name = strings.ToLower(name)
    return name
}

// In your _test.go file:
func TestNewName(t *testing.T) {
    tests := []struct {
        input string
        want  string
    }{
        {"My File.txt", "my_file.txt"},
        {"already_good.go", "already_good.go"},
        {"LOUD FILE.PDF", "loud_file.pdf"},
    }
    for _, tt := range tests {
        got := newName(tt.input)
        if got != tt.want {
            t.Errorf("newName(%q) = %q, want %q", tt.input, got, tt.want)
        }
    }
}`,
				filename: "renamer/renamer_test.go",
			},
			{
				n: "04",
				heading: "Handle errors explicitly",
				body: "Go has no exceptions. Every error is a value you handle at the call site. The <code>%w</code> verb wraps errors so callers can inspect them with <code>errors.Is</code> and <code>errors.As</code>. Never silently discard an error.",
				code: `// Bad — silently swallows the error
os.Rename(old, new)

// Good — wrap with context, return to caller
if err := os.Rename(old, new); err != nil {
    return fmt.Errorf("renaming %s to %s: %w", old, new, err)
}

// Even better — non-zero exit code on failure
func main() {
    if err := renamer.Run(*dir, *dryRun); err != nil {
        fmt.Fprintf(os.Stderr, "error: %v\\n", err)
        os.Exit(1) // signals failure to the shell
    }
}`,
			},
		],
		tags: ["syntax", "os/flag", "error handling", "packages"],
		nextSlug: "api-client",
		nextName: "REST API client",
	},
	{
		slug: "api-client",
		tier: 1,
		tierLabel: "Tier 01 — Get Comfortable",
		code: "API",
		name: "REST API client",
		tagline:
			"Fetch, decode, and display data from a public API — the Go way.",
		estimatedTime: "2–3 hours",
		what: "A CLI tool that queries a public REST API (e.g. GitHub, Open-Meteo weather), decodes JSON into typed structs, handles errors gracefully, and prints formatted output. You'll learn how Go thinks about HTTP, types, and interfaces.",
		learn: [
			"Defining structs that map to JSON responses",
			"Using <code>encoding/json</code> to decode responses",
			"Go interfaces — implement <code>fmt.Stringer</code> for pretty output",
			"Error wrapping with <code>fmt.Errorf</code> and <code>%w</code>",
			"Using <code>net/http</code> without a framework",
		],
		fromOtherLang:
			"Coming from Python: there's no <code>requests.get().json()</code> shortcut — Go requires you to decode explicitly into a typed struct. This feels verbose at first but means your data has a known shape at compile time. Coming from TypeScript: Go's interfaces are implicit (satisfied by having the right methods), not declared.",
		steps: [
			{
				n: "01",
				heading: "Define your structs",
				body: 'Write Go structs that match the JSON fields you care about. Use <code>json:"field_name"</code> struct tags to map snake_case JSON keys to Go\'s CamelCase. You only need to declare the fields you actually use.',
				code:
					`// weather.go
package main

// Open-Meteo API response — only the fields we care about.
// JSON tags map Go's CamelCase to the API's snake_case.
type WeatherResponse struct {
    Latitude  float64 ` +
					"`" +
					`json:"latitude"` +
					"`" +
					`
    Longitude float64 ` +
					"`" +
					`json:"longitude"` +
					"`" +
					`
    Current   Current ` +
					"`" +
					`json:"current"` +
					"`" +
					`
}

type Current struct {
    Temperature float64 ` +
					"`" +
					`json:"temperature_2m"` +
					"`" +
					`
    WindSpeed   float64 ` +
					"`" +
					`json:"wind_speed_10m"` +
					"`" +
					`
    WeatherCode int     ` +
					"`" +
					`json:"weather_code"` +
					"`" +
					`
}

// String() makes WeatherResponse satisfy fmt.Stringer.
// fmt.Println will call this automatically.
func (w WeatherResponse) String() string {
    return fmt.Sprintf(
        "%.1f°C, wind %.0f km/h",
        w.Current.Temperature,
        w.Current.WindSpeed,
    )
}`,
				filename: "weather.go",
			},
			{
				n: "02",
				heading: "Make the HTTP request",
				body: "Use <code>http.Get(url)</code>, check the status code, and defer <code>resp.Body.Close()</code>. This trio appears in virtually every Go HTTP call. The <code>defer</code> guarantees cleanup even if the function panics.",
				code: `func fetchWeather(lat, lon float64) (*WeatherResponse, error) {
    url := fmt.Sprintf(
        "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,wind_speed_10m,weather_code",
        lat, lon,
    )

    resp, err := http.Get(url)
    if err != nil {
        return nil, fmt.Errorf("fetching weather: %w", err)
    }
    defer resp.Body.Close() // always close the body

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status: %s", resp.Status)
    }

    var result WeatherResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decoding response: %w", err)
    }
    return &result, nil
}`,
				filename: "weather.go",
			},
			{
				n: "03",
				heading: "Decode the response",
				body: "Use <code>json.NewDecoder(resp.Body).Decode(&result)</code>. The <code>&</code> passes a pointer — the decoder writes into your struct directly. Handle the error. If the JSON shape changes or a field is missing, you'll know immediately.",
				code: `func main() {
    // London coordinates
    weather, err := fetchWeather(51.5074, -0.1278)
    if err != nil {
        fmt.Fprintf(os.Stderr, "error: %v\\n", err)
        os.Exit(1)
    }

    // fmt.Stringer kicks in — calls weather.String()
    fmt.Println("London weather:", weather)

    // Or access fields directly
    fmt.Printf("Temperature: %.1f°C\\n", weather.Current.Temperature)
    fmt.Printf("Wind speed:  %.0f km/h\\n", weather.Current.WindSpeed)
}`,
				filename: "main.go",
			},
		],
		tags: ["structs", "interfaces", "JSON", "net/http"],
		nextSlug: "log-parser",
		nextName: "Concurrent log parser",
	},
	{
		slug: "log-parser",
		tier: 1,
		tierLabel: "Tier 01 — Get Comfortable",
		code: "LOG",
		name: "Concurrent log parser",
		tagline: "Parse large log files fast using goroutines and channels.",
		estimatedTime: "3–4 hours",
		what: "A tool that reads large log files (or multiple log files simultaneously), extracts structured data (timestamps, levels, messages), and outputs a summary — count per log level, error rate over time, slowest requests. The interesting part: you'll process chunks concurrently.",
		learn: [
			"Launching goroutines with <code>go func()</code>",
			"Sending and receiving on channels",
			"Coordinating goroutines with <code>sync.WaitGroup</code>",
			"Reading files efficiently with <code>bufio.Scanner</code>",
			"The fan-out pattern: one reader, many workers",
		],
		fromOtherLang:
			"Coming from Python: goroutines are not threads and channels are not queues — they're a communication primitive. The mental model shift: instead of sharing memory and locking it, you share data by passing it through channels. Coming from JS: Go has real parallelism. Your goroutines can truly run simultaneously on multiple cores.",
		steps: [
			{
				n: "01",
				heading: "Read a file synchronously first",
				body: "Start simple. Use <code>bufio.Scanner</code> to read line by line. Parse each line into a struct. Get this working before adding concurrency — a working synchronous version is the foundation.",
				code: `package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
    "time"
)

type LogEntry struct {
    Timestamp time.Time
    Level     string
    Message   string
}

func parseFile(path string) ([]LogEntry, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, fmt.Errorf("opening %s: %w", path, err)
    }
    defer f.Close()

    var entries []LogEntry
    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        line := scanner.Text()
        entry, ok := parseLine(line)
        if ok {
            entries = append(entries, entry)
        }
    }
    return entries, scanner.Err()
}

func parseLine(line string) (LogEntry, bool) {
    // Format: 2024-01-15T10:30:00Z INFO user logged in
    parts := strings.SplitN(line, " ", 3)
    if len(parts) < 3 {
        return LogEntry{}, false
    }
    t, err := time.Parse(time.RFC3339, parts[0])
    if err != nil {
        return LogEntry{}, false
    }
    return LogEntry{Timestamp: t, Level: parts[1], Message: parts[2]}, true
}`,
				filename: "parser.go",
			},
			{
				n: "02",
				heading: "Fan out across multiple files",
				body: "Launch one goroutine per file. All goroutines send to the same results channel. Use a <code>sync.WaitGroup</code> to know when all goroutines are done, then close the channel. This is the standard Go fan-out pattern.",
				code: `func parseFiles(paths []string) <-chan LogEntry {
    results := make(chan LogEntry, 1000) // buffered for throughput
    errors  := make(chan error, len(paths))

    var wg sync.WaitGroup
    for _, path := range paths {
        wg.Add(1)
        go func(p string) {
            defer wg.Done()
            entries, err := parseFile(p)
            if err != nil {
                errors <- err
                return
            }
            for _, e := range entries {
                results <- e
            }
        }(path) // pass path as argument to avoid closure capture bug
    }

    // Close results when all goroutines finish
    go func() {
        wg.Wait()
        close(results)
        close(errors)
    }()

    return results
}`,
				filename: "parser.go",
			},
			{
				n: "03",
				heading: "Aggregate the results",
				body: "Range over the channel to collect results. The loop ends automatically when the channel is closed. Build a summary — count by log level, find the time range, calculate error rate.",
				code: `func summarize(results <-chan LogEntry) {
    counts := make(map[string]int)
    var earliest, latest time.Time
    total := 0

    for entry := range results { // loop ends when channel closes
        counts[entry.Level]++
        total++
        if earliest.IsZero() || entry.Timestamp.Before(earliest) {
            earliest = entry.Timestamp
        }
        if entry.Timestamp.After(latest) {
            latest = entry.Timestamp
        }
    }

    fmt.Printf("Total entries: %d\\n", total)
    fmt.Printf("Time range:    %s — %s\\n", earliest.Format(time.RFC3339), latest.Format(time.RFC3339))
    fmt.Println("\\nBy level:")
    for level, count := range counts {
        pct := float64(count) / float64(total) * 100
        fmt.Printf("  %-8s %5d  (%.1f%%)\\n", level, count, pct)
    }
}`,
				filename: "main.go",
			},
		],
		tags: ["goroutines", "channels", "bufio", "sync"],
		nextSlug: "http-server",
		nextName: "HTTP server with middleware",
	},

	// ── TIER 2 ──────────────────────────────────────────────────────────────
	{
		slug: "http-server",
		tier: 2,
		tierLabel: "Tier 02 — Go Idioms",
		code: "SRV",
		name: "HTTP server with middleware",
		tagline:
			"Build a real HTTP server with auth, logging, and rate-limiting middleware — standard library only.",
		estimatedTime: "3–4 hours",
		what: "An HTTP server using only <code>net/http</code>. You'll implement middleware as function wrappers (the Go way), add JWT auth, structured logging with <code>log/slog</code>, and per-IP rate limiting — all composable and testable.",
		learn: [
			"How Go's <code>http.Handler</code> interface works",
			"Middleware as higher-order functions",
			"<code>context</code> for passing request-scoped values",
			"Structured logging with <code>log/slog</code>",
			"Table-driven tests for HTTP handlers",
		],
		fromOtherLang:
			"Coming from Node/Express: Go doesn't have middleware 'layers' — you wrap handlers. <code>withAuth(withLogging(myHandler))</code> is idiomatic Go. It feels different at first but is far easier to test. Coming from Django/Flask: there's no framework magic. You wire everything explicitly — which means you understand everything.",
		steps: [
			{
				n: "01",
				heading: "Understand http.Handler",
				body: "Everything in Go's HTTP server is one interface: <code>ServeHTTP(w, r)</code>. A middleware is just a function that takes a handler and returns a handler. Once this clicks, the whole pattern falls into place.",
				code: `// The entire net/http contract — one method.
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}

// http.HandlerFunc lets you use a plain function as a Handler.
// This is how most handlers are written in practice.
mux := http.NewServeMux()
mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("ok"))
})

// A middleware is a function: Handler -> Handler
type Middleware func(http.Handler) http.Handler`,
				filename: "server.go",
			},
			{
				n: "02",
				heading: "Write your first middleware",
				body: "A logging middleware wraps any handler, records the request, then calls the next handler. Notice it captures the status code by wrapping <code>ResponseWriter</code> — a common Go pattern.",
				code: `// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(status int) {
    rw.status = status
    rw.ResponseWriter.WriteHeader(status)
}

func withLogging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}

        next.ServeHTTP(rw, r) // call the next handler

        slog.Info("request",
            "method",   r.Method,
            "path",     r.URL.Path,
            "status",   rw.status,
            "duration", time.Since(start),
        )
    })
}`,
				filename: "middleware.go",
			},
			{
				n: "03",
				heading: "Add auth middleware",
				body: "Accept a Bearer token, validate it, and store the result in <code>context</code>. Downstream handlers read from context — they never touch the raw header. This is Go's way of passing request-scoped values.",
				code: `type contextKey string
const userKey contextKey = "user"

func withAuth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        if token == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        user, err := validateToken(token)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }

        // Store user in context — downstream handlers read it from here
        ctx := context.WithValue(r.Context(), userKey, user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Downstream handler reads from context — never from headers directly.
func apiHandler(w http.ResponseWriter, r *http.Request) {
    user := r.Context().Value(userKey).(string)
    fmt.Fprintf(w, "hello, %s", user)
}`,
				filename: "middleware.go",
			},
			{
				n: "04",
				heading: "Chain it all together",
				body: "Compose middlewares by wrapping handlers. The outermost middleware runs first. Write an integration test using <code>httptest</code> — no real server needed.",
				code: `func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/hello", apiHandler)

    // Wrap: rate limit -> auth -> logging -> handler
    // Reads inside-out: logging wraps handler, auth wraps that, etc.
    handler := withRateLimit(withAuth(withLogging(mux)))

    srv := &http.Server{Addr: ":8080", Handler: handler}
    log.Fatal(srv.ListenAndServe())
}

// Integration test — no real server needed
func TestAPIHandler(t *testing.T) {
    req := httptest.NewRequest("GET", "/api/hello", nil)
    req.Header.Set("Authorization", "Bearer valid-token")
    rec := httptest.NewRecorder()

    withAuth(http.HandlerFunc(apiHandler)).ServeHTTP(rec, req)

    if rec.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", rec.Code)
    }
}`,
				filename: "main.go",
			},
		],
		tags: ["net/http", "middleware", "interfaces", "context"],
		nextSlug: "worker-pool",
		nextName: "Worker pool / job queue",
	},
	{
		slug: "worker-pool",
		tier: 2,
		tierLabel: "Tier 02 — Go Idioms",
		code: "WRK",
		name: "Worker pool / job queue",
		tagline:
			"Process thousands of tasks concurrently without data races or goroutine leaks.",
		estimatedTime: "3–5 hours",
		what: "A generic worker pool that accepts jobs from a queue and processes them with a fixed number of workers. You'll tackle the full suite of Go concurrency primitives: channels, <code>context</code> cancellation, <code>select</code>, <code>sync.WaitGroup</code>, and graceful shutdown.",
		learn: [
			"The worker pool pattern in Go",
			"<code>select</code> for multiplexing channels",
			"Context cancellation and propagation",
			"Preventing goroutine leaks",
			"Graceful shutdown on OS signals",
		],
		fromOtherLang:
			"Coming from Python: this replaces <code>concurrent.futures.ThreadPoolExecutor</code> — but with channels instead of futures. Coming from Java: no <code>ExecutorService</code> — just goroutines and channels. The primitives are lower-level but the patterns are cleaner.",
		steps: [
			{
				n: "01",
				heading: "Define the job and result types",
				body: "Start concrete. Define <code>Job</code> and <code>Result</code> structs before writing any concurrency. Clear types make the worker function signature obvious — and that signature drives everything else.",
				code: `package pool

type Job struct {
    ID      int
    Payload string
}

type Result struct {
    JobID  int
    Output string
    Err    error
}

// WorkerFunc is the function each worker calls for each job.
// Your business logic goes here.
type WorkerFunc func(job Job) Result`,
				filename: "pool.go",
			},
			{
				n: "02",
				heading: "Build the worker pool",
				body: "Launch N workers in a loop. Each receives from the jobs channel and sends to results. Use <code>select</code> to also react to context cancellation — this is how you prevent goroutine leaks on shutdown.",
				code: `func NewPool(ctx context.Context, numWorkers int, fn WorkerFunc) (chan<- Job, <-chan Result) {
    jobs    := make(chan Job, numWorkers*2) // buffered
    results := make(chan Result, numWorkers*2)

    var wg sync.WaitGroup
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                select {
                case job, ok := <-jobs:
                    if !ok {
                        return // jobs channel closed — exit cleanly
                    }
                    results <- fn(job)
                case <-ctx.Done():
                    return // context cancelled — exit cleanly
                }
            }
        }()
    }

    // Close results when all workers finish
    go func() {
        wg.Wait()
        close(results)
    }()

    return jobs, results
}`,
				filename: "pool.go",
			},
			{
				n: "03",
				heading: "Handle OS signals for graceful shutdown",
				body: "Use <code>signal.NotifyContext</code> to cancel the context on SIGINT/SIGTERM. Workers will finish their current job and exit. Close the jobs channel to signal no more work is coming.",
				code: `func main() {
    // Context cancelled on Ctrl-C or SIGTERM
    ctx, stop := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    jobs, results := NewPool(ctx, 4, func(job Job) Result {
        // Simulate work
        time.Sleep(100 * time.Millisecond)
        return Result{JobID: job.ID, Output: "processed: " + job.Payload}
    })

    // Send jobs
    go func() {
        for i := 0; i < 100; i++ {
            jobs <- Job{ID: i, Payload: fmt.Sprintf("item-%d", i)}
        }
        close(jobs) // signal: no more jobs
    }()

    // Collect results
    for result := range results {
        if result.Err != nil {
            log.Printf("job %d failed: %v", result.JobID, result.Err)
            continue
        }
        fmt.Println(result.Output)
    }
}`,
				filename: "main.go",
			},
		],
		tags: ["sync.WaitGroup", "select", "context cancel", "patterns"],
		nextSlug: "cli-cobra",
		nextName: "CLI with config & tests",
	},
	{
		slug: "cli-cobra",
		tier: 2,
		tierLabel: "Tier 02 — Go Idioms",
		code: "CMD",
		name: "CLI tool with config & tests",
		tagline:
			"Build a production-ready CLI using cobra, viper for config, and a real test suite.",
		estimatedTime: "4–5 hours",
		what: "A multi-command CLI (like git or kubectl) built with cobra for commands and viper for config file support. You'll learn Go project layout at scale, how to write table-driven tests, and how to structure a CLI that real users can configure.",
		learn: [
			"Multi-command CLI structure with cobra",
			"Config files and env vars with viper",
			"Go project layout for larger projects",
			"Table-driven tests — the Go testing idiom",
			"Building and distributing a Go binary",
		],
		fromOtherLang:
			"Coming from Python: cobra is Click, viper is python-dotenv + configparser combined. The big difference: your CLI compiles to a single static binary. Coming from Node: no package.json at runtime, no node_modules to ship.",
		steps: [
			{
				n: "01",
				heading: "Scaffold with cobra",
				body: "Install cobra and set up the root command. Cobra's command structure mirrors git — a root command with subcommands, each with their own flags.",
				code: `// cmd/root.go
package cmd

import (
    "github.com/spf13/cobra"
    "github.com/spf13/viper"
)

var rootCmd = &cobra.Command{
    Use:   "mytool",
    Short: "A useful CLI tool",
    Long:  "A longer description of what mytool does.",
}

func Execute() error {
    return rootCmd.Execute()
}

func init() {
    cobra.OnInitialize(initConfig)
    rootCmd.PersistentFlags().String("config", "", "config file path")
    rootCmd.PersistentFlags().String("output", "text", "output format: text|json")
    viper.BindPFlag("output", rootCmd.PersistentFlags().Lookup("output"))
}

func initConfig() {
    viper.SetConfigName(".mytool")
    viper.SetConfigType("yaml")
    viper.AddConfigPath("$HOME")
    viper.SetEnvPrefix("MYTOOL")
    viper.AutomaticEnv()
    viper.ReadInConfig()
}`,
				filename: "cmd/root.go",
			},
			{
				n: "02",
				heading: "Add subcommands",
				body: "Each subcommand is a <code>*cobra.Command</code> added to the root. Persistent flags on the root propagate to all subcommands — perfect for things like <code>--output</code> or <code>--verbose</code>.",
				code: `// cmd/greet.go
package cmd

import (
    "fmt"
    "github.com/spf13/cobra"
    "github.com/spf13/viper"
)

var greetCmd = &cobra.Command{
    Use:   "greet [name]",
    Short: "Greet someone",
    Args:  cobra.ExactArgs(1),
    RunE: func(cmd *cobra.Command, args []string) error {
        name := args[0]
        loud, _ := cmd.Flags().GetBool("loud")

        greeting := fmt.Sprintf("Hello, %s!", name)
        if loud {
            greeting = strings.ToUpper(greeting)
        }

        switch viper.GetString("output") {
        case "json":
            fmt.Printf(\`{"greeting": "%s"}\n\`, greeting)
        default:
            fmt.Println(greeting)
        }
        return nil
    },
}

func init() {
    rootCmd.AddCommand(greetCmd)
    greetCmd.Flags().Bool("loud", false, "shout the greeting")
}`,
				filename: "cmd/greet.go",
			},
			{
				n: "03",
				heading: "Write table-driven tests",
				body: "Table-driven tests are the Go idiom — a slice of test cases, looped with <code>t.Run()</code>. They're readable, easy to extend, and produce clear failure messages. This pattern appears in virtually every Go codebase.",
				code: `// cmd/greet_test.go
package cmd

import (
    "bytes"
    "testing"
)

func TestGreetCommand(t *testing.T) {
    tests := []struct {
        name    string
        args    []string
        flags   []string
        want    string
        wantErr bool
    }{
        {
            name: "basic greeting",
            args: []string{"Alice"},
            want: "Hello, Alice!\\n",
        },
        {
            name:  "loud greeting",
            args:  []string{"Bob"},
            flags: []string{"--loud"},
            want:  "HELLO, BOB!\\n",
        },
        {
            name:    "no args fails",
            args:    []string{},
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            buf := &bytes.Buffer{}
            cmd := greetCmd
            cmd.SetOut(buf)
            cmd.SetArgs(append(tt.args, tt.flags...))

            err := cmd.Execute()
            if (err != nil) != tt.wantErr {
                t.Errorf("Execute() error = %v, wantErr %v", err, tt.wantErr)
            }
            if got := buf.String(); got != tt.want {
                t.Errorf("got %q, want %q", got, tt.want)
            }
        })
    }
}`,
				filename: "cmd/greet_test.go",
			},
		],
		tags: ["cobra", "testing", "viper", "project layout"],
		nextSlug: "grpc",
		nextName: "gRPC microservice",
	},

	// ── TIER 3 ──────────────────────────────────────────────────────────────
	{
		slug: "grpc",
		tier: 3,
		tierLabel: "Tier 03 — Production Grade",
		code: "RPC",
		name: "gRPC microservice",
		tagline:
			"Define a protobuf schema, generate Go code, and build a working gRPC service.",
		estimatedTime: "4–6 hours",
		what: "A gRPC service (e.g. a user service or a currency converter) defined in protobuf, compiled to Go, and implemented with real business logic. You'll cover unary calls, streaming, interceptors (gRPC's middleware), and a test client.",
		learn: [
			"Protobuf schema design",
			"Generating Go code with <code>protoc</code>",
			"Implementing gRPC server and client in Go",
			"Interceptors for auth and logging",
			"Streaming RPCs — server-side and bidirectional",
		],
		fromOtherLang:
			"Coming from REST: gRPC uses a contract-first approach — you define the API in a <code>.proto</code> file and generate client and server code. No more hand-rolling JSON serialization. Coming from GraphQL: protobuf is more rigid but much faster and type-safe end-to-end.",
		steps: [
			{
				n: "01",
				heading: "Write your proto schema",
				body: "The <code>.proto</code> file is your API contract. It defines messages (like structs) and services (like interfaces). Both client and server code are generated from this single source of truth.",
				code: `// proto/user/v1/user.proto
syntax = "proto3";

package user.v1;
option go_package = "github.com/you/app/gen/user/v1";

service UserService {
    rpc GetUser(GetUserRequest)       returns (GetUserResponse);
    rpc ListUsers(ListUsersRequest)   returns (stream User);
    rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
}

message User {
    string id         = 1;
    string email      = 2;
    string name       = 3;
    int64  created_at = 4;
}

message GetUserRequest  { string id    = 1; }
message GetUserResponse { User   user  = 1; }
message ListUsersRequest { int32 limit = 1; }
message CreateUserRequest {
    string email = 1;
    string name  = 2;
}
message CreateUserResponse { User user = 1; }`,
				filename: "proto/user/v1/user.proto",
			},
			{
				n: "02",
				heading: "Implement the server",
				body: "After running <code>protoc</code>, implement the generated interface. The compiler tells you exactly which methods you need — you can't forget one.",
				code: `// internal/userservice/service.go
package userservice

type Service struct {
    user.UnimplementedUserServiceServer // embed for forward compatibility
    db *sql.DB
}

func (s *Service) GetUser(ctx context.Context, req *user.GetUserRequest) (*user.GetUserResponse, error) {
    if req.Id == "" {
        return nil, status.Error(codes.InvalidArgument, "id is required")
    }
    u, err := s.db.GetUser(ctx, req.Id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, status.Errorf(codes.NotFound, "user %s not found", req.Id)
    }
    if err != nil {
        return nil, status.Errorf(codes.Internal, "fetching user: %v", err)
    }
    return &user.GetUserResponse{User: toProto(u)}, nil
}

// Server-side streaming — send users one by one
func (s *Service) ListUsers(req *user.ListUsersRequest, stream user.UserService_ListUsersServer) error {
    users, err := s.db.ListUsers(stream.Context(), int(req.Limit))
    if err != nil {
        return status.Errorf(codes.Internal, "listing users: %v", err)
    }
    for _, u := range users {
        if err := stream.Send(toProto(u)); err != nil {
            return err
        }
    }
    return nil
}`,
				filename: "internal/userservice/service.go",
			},
			{
				n: "03",
				heading: "Add interceptors",
				body: "Interceptors are gRPC's middleware. They wrap every RPC call — perfect for logging, auth, and tracing. Chain multiple interceptors with <code>grpc.ChainUnaryInterceptor</code>.",
				code: `func loggingInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
    start := time.Now()
    resp, err := handler(ctx, req)
    slog.Info("rpc",
        "method",   info.FullMethod,
        "duration", time.Since(start),
        "error",    err,
    )
    return resp, err
}

func authInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "missing metadata")
    }
    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing token")
    }
    return handler(ctx, req)
}

// Wire it up
srv := grpc.NewServer(
    grpc.ChainUnaryInterceptor(loggingInterceptor, authInterceptor),
)
user.RegisterUserServiceServer(srv, &userservice.Service{})`,
				filename: "cmd/server/main.go",
			},
		],
		tags: ["protobuf", "gRPC", "modules", "codegen"],
		nextSlug: "db-api",
		nextName: "Database-backed REST API",
	},
	{
		slug: "db-api",
		tier: 3,
		tierLabel: "Tier 03 — Production Grade",
		code: "DB",
		name: "Database-backed REST API",
		tagline:
			"Full CRUD REST API with Postgres, schema migrations, and the repository pattern.",
		estimatedTime: "5–7 hours",
		what: "A real REST API (e.g. a task manager or a bookmarks service) backed by PostgreSQL. You'll use <code>pgx</code> for the Postgres driver, <code>golang-migrate</code> for schema migrations, and implement the repository pattern to keep database logic out of your handlers.",
		learn: [
			"Connecting to Postgres with <code>pgx</code>",
			"Running schema migrations with <code>golang-migrate</code>",
			"The repository pattern — separating DB from business logic",
			"Transactions and rollback in Go",
			"Integration tests with a real database",
		],
		fromOtherLang:
			"Coming from Python/Django: no ORM magic — you write SQL directly. This feels tedious at first but gives you complete control and predictable performance. Coming from Node/Prisma: <code>sqlc</code> is the closest Go equivalent if you want type-safe queries from SQL.",
		steps: [
			{
				n: "01",
				heading: "Define the repository interface",
				body: "Define the interface first. This makes your business logic testable — you can swap the real DB for a mock. Handlers depend on the interface, not the implementation.",
				code: `// internal/task/repository.go
package task

import (
    "context"
    "time"
)

type Task struct {
    ID        string
    Title     string
    Done      bool
    CreatedAt time.Time
    UpdatedAt time.Time
}

// Repository is the interface handlers depend on.
// The real Postgres implementation satisfies it.
// A mock implementation can satisfy it in tests.
type Repository interface {
    Create(ctx context.Context, title string) (*Task, error)
    GetByID(ctx context.Context, id string) (*Task, error)
    List(ctx context.Context) ([]Task, error)
    Update(ctx context.Context, id string, done bool) (*Task, error)
    Delete(ctx context.Context, id string) error
}`,
				filename: "internal/task/repository.go",
			},
			{
				n: "02",
				heading: "Implement with Postgres",
				body: "The concrete implementation uses <code>pgx/v5</code>. Write raw SQL — you see exactly what hits the database. Use <code>pgx.NamedArgs</code> for readable queries and safe parameter binding.",
				code: `// internal/task/postgres.go
package task

type PostgresRepository struct {
    db *pgxpool.Pool
}

func (r *PostgresRepository) Create(ctx context.Context, title string) (*Task, error) {
    var t Task
    err := r.db.QueryRow(ctx, \`
        INSERT INTO tasks (title)
        VALUES (@title)
        RETURNING id, title, done, created_at, updated_at
    \`, pgx.NamedArgs{"title": title}).Scan(
        &t.ID, &t.Title, &t.Done, &t.CreatedAt, &t.UpdatedAt,
    )
    if err != nil {
        return nil, fmt.Errorf("creating task: %w", err)
    }
    return &t, nil
}

func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
    result, err := r.db.Exec(ctx, "DELETE FROM tasks WHERE id = $1", id)
    if err != nil {
        return fmt.Errorf("deleting task: %w", err)
    }
    if result.RowsAffected() == 0 {
        return ErrNotFound
    }
    return nil
}`,
				filename: "internal/task/postgres.go",
			},
			{
				n: "03",
				heading: "Wire handlers to the repository",
				body: "Handlers receive the repository via dependency injection. They parse the request, call the repo, handle errors, and write the response. No SQL in handlers — ever.",
				code: `// internal/api/handlers.go
type Handler struct {
    tasks task.Repository
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
    var body struct {
        Title string \`json:"title"\`
    }
    if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }
    if body.Title == "" {
        http.Error(w, "title is required", http.StatusBadRequest)
        return
    }

    t, err := h.tasks.Create(r.Context(), body.Title)
    if err != nil {
        slog.Error("creating task", "error", err)
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(t)
}`,
				filename: "internal/api/handlers.go",
			},
		],
		tags: ["sqlx", "pgx", "migrations", "repository pattern"],
		nextSlug: "observability",
		nextName: "Observability CLI tool",
	},
	{
		slug: "observability",
		tier: 3,
		tierLabel: "Tier 03 — Production Grade",
		code: "OBS",
		name: "Observability CLI tool",
		tagline:
			"Profile, trace, and benchmark a Go service — then make it measurably faster.",
		estimatedTime: "4–6 hours",
		what: "A CLI tool that profiles a Go HTTP service using <code>net/http/pprof</code>, generates flamegraphs, and identifies performance bottlenecks. You'll also write benchmarks, use the race detector, and learn how to read Go runtime metrics.",
		learn: [
			"Profiling with <code>pprof</code> — CPU, memory, goroutine",
			"Writing benchmarks with <code>testing.B</code>",
			"Reading and interpreting flamegraphs",
			"The Go race detector",
			"Runtime metrics: GC, goroutine count, heap",
		],
		fromOtherLang:
			"Coming from Python: profiling in Go is built into the standard library — no third-party profilers needed. Coming from Java: no JVM overhead, no JIT warmup to account for — Go benchmarks are stable and reproducible from the first run.",
		steps: [
			{
				n: "01",
				heading: "Add pprof to your service",
				body: "Import <code>net/http/pprof</code> with a blank identifier — this registers profiling endpoints as a side effect. Visit <code>/debug/pprof/</code> to see what's available. Never ship this to production without auth in front of it.",
				code: `import (
    "net/http"
    _ "net/http/pprof" // registers /debug/pprof/ endpoints
)

func main() {
    // Your normal server
    mux := http.NewServeMux()
    mux.HandleFunc("/api/work", workHandler)

    // pprof endpoints are registered on DefaultServeMux
    // Run on a separate port — never expose to the internet
    go func() {
        log.Println("pprof listening on :6060")
        log.Fatal(http.ListenAndServe(":6060", nil))
    }()

    log.Fatal(http.ListenAndServe(":8080", mux))
}

// Now you can profile:
// go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
// go tool pprof http://localhost:6060/debug/pprof/heap`,
				filename: "main.go",
			},
			{
				n: "02",
				heading: "Write benchmarks",
				body: "Benchmarks live in <code>_test.go</code> files and start with <code>Benchmark</code>. The <code>-benchmem</code> flag shows allocations — often more important than CPU time. Run before and after your optimization.",
				code: `// processor_test.go
func BenchmarkProcessItem(b *testing.B) {
    item := generateTestItem()

    b.ResetTimer() // don't count setup time
    for i := 0; i < b.N; i++ {
        ProcessItem(item) // the thing you're measuring
    }
}

func BenchmarkProcessItemParallel(b *testing.B) {
    item := generateTestItem()
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            ProcessItem(item)
        }
    })
}

// Run with:
// go test -bench=. -benchmem -count=5
//
// Output:
// BenchmarkProcessItem-8    1234567    890 ns/op    128 B/op    3 allocs/op
//
// After your fix:
// BenchmarkProcessItem-8    4567890    245 ns/op     32 B/op    1 allocs/op`,
				filename: "processor_test.go",
			},
			{
				n: "03",
				heading: "Find and fix an allocation hotspot",
				body: "Use <code>pprof</code>'s alloc profile to find where your program allocates memory. Often the fix is reusing a buffer or pre-allocating a slice. Measure before and after — always.",
				code: `// Before — allocates a new strings.Builder every call
func buildQuery(filters []string) string {
    var sb strings.Builder
    sb.WriteString("SELECT * FROM items WHERE ")
    for i, f := range filters {
        if i > 0 {
            sb.WriteString(" AND ")
        }
        sb.WriteString(f)
    }
    return sb.String()
}

// After — pre-allocate with known capacity
func buildQuery(filters []string) string {
    if len(filters) == 0 {
        return "SELECT * FROM items"
    }
    // strings.Join avoids intermediate allocations
    return "SELECT * FROM items WHERE " + strings.Join(filters, " AND ")
}

// Even better — use sync.Pool for heavy hot paths
var builderPool = sync.Pool{
    New: func() any { return &strings.Builder{} },
}

func buildQueryPooled(filters []string) string {
    sb := builderPool.Get().(*strings.Builder)
    sb.Reset()
    defer builderPool.Put(sb)
    // ... write to sb
    return sb.String()
}`,
				filename: "query.go",
			},
		],
		tags: ["pprof", "runtime", "benchmarks", "tracing"],
	},
]

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug)
}

export function getProjectsByTier(tier: 1 | 2 | 3): Project[] {
	return projects.filter((p) => p.tier === tier)
}
