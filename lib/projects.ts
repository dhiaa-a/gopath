import { Project } from "./content"

export const projects: Project[] = [
	// ── TIER 1 ──────────────────────────────────────────────────────────────
	{
		slug: "cli-renamer",
		name: "File renamer CLI",
		tagline: "Batch-rename files with patterns, flags, and dry-run mode.",
		code: "CLI",
		tier: 1,
		tierLabel: "FOUNDATIONS",

		estimatedTime: "2–3 hours",
		tags: ["cli", "filesystem", "flags", "error-handling"],

		mentalModels: [
			"input parsing boundary",
			"stateless processing",
			"separation of config and execution",
			"explicit error handling",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "User input is parsed into configuration, which drives a deterministic file renaming process with optional dry-run preview.",
				},
			},
			{
				type: "code",
				value: `CLI → flags → config → scan directory → transform names → preview/apply`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `main()
 ├── parseFlags()
 ├── validateInput()
 └── run()

run()
 ├── read directory
 ├── transform names
 └── dry-run/execute`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{
						en: "Must handle large directories without loading all files into memory",
					},
					{ en: "Must not modify files in dry-run mode" },
					{
						en: "Must produce deterministic renaming based on patterns",
					},
					{ en: "Must handle permission errors gracefully" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a production-ready CLI with clear separation between parsing, configuration, and execution phases.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Parse CLI flags" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Capture user input at program start." },
						concept: {
							en: "CLI flags define a contract between the user and the program.",
						},
						implementation: `package main

import (
    "flag"
    "fmt"
    "os"
)

func main() {
    dir := flag.String("dir", ".", "directory to scan")
    pattern := flag.String("pattern", "", "rename pattern")
    dryRun := flag.Bool("dry-run", false, "preview without applying")
    
    flag.Parse()
    
    if err := run(*dir, *pattern, *dryRun); err != nil {
        fmt.Fprintf(os.Stderr, "error: %v\\n", err)
        os.Exit(1)
    }
}`,
						filename: "main.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Build configuration" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Convert raw inputs into a validated structure.",
						},
						concept: {
							en: "Configuration centralizes all system inputs and validates them early.",
						},
						implementation: `type Config struct {
    Dir     string
    Pattern string
    DryRun  bool
}

func newConfig(dir, pattern string, dryRun bool) (*Config, error) {
    if dir == "" {
        return nil, fmt.Errorf("directory cannot be empty")
    }
    info, err := os.Stat(dir)
    if err != nil {
        return nil, fmt.Errorf("invalid directory: %w", err)
    }
    if !info.IsDir() {
        return nil, fmt.Errorf("path is not a directory: %s", dir)
    }
    return &Config{
        Dir:     dir,
        Pattern: pattern,
        DryRun:  dryRun,
    }, nil
}`,
						filename: "config.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Implement renaming logic" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Apply transformation rules to filenames.",
						},
						concept: {
							en: "Pure functions make transformation logic testable and predictable.",
						},
						implementation: `func transformName(name, pattern string) string {
    // Replace spaces with underscores
    name = strings.ReplaceAll(name, " ", "_")
    
    // Add pattern as prefix if specified
    if pattern != "" {
        name = pattern + "_" + name
    }
    
    // Convert to lowercase
    return strings.ToLower(name)
}

func TestTransformName(t *testing.T) {
    tests := []struct {
        name, pattern, want string
    }{
        {"My File.txt", "", "my_file.txt"},
        {"My File.txt", "backup", "backup_my_file.txt"},
        {"already_good.go", "prefix", "prefix_already_good.go"},
    }
    
    for _, tt := range tests {
        got := transformName(tt.name, tt.pattern)
        if got != tt.want {
            t.Errorf("transformName(%q, %q) = %q, want %q", 
                tt.name, tt.pattern, got, tt.want)
        }
    }
}`,
						filename: "renamer.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Process files with dry-run support" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Walk directory and rename files." },
						concept: {
							en: "Dry-run mode previews changes without side effects.",
						},
						implementation: `func (r *Renamer) Run() error {
    entries, err := os.ReadDir(r.config.Dir)
    if err != nil {
        return fmt.Errorf("reading directory: %w", err)
    }

    for _, entry := range entries {
        if entry.IsDir() {
            continue
        }
        
        oldName := entry.Name()
        newName := transformName(oldName, r.config.Pattern)
        
        if oldName == newName {
            continue
        }
        
        oldPath := filepath.Join(r.config.Dir, oldName)
        newPath := filepath.Join(r.config.Dir, newName)
        
        if r.config.DryRun {
            fmt.Printf("[DRY RUN] %s → %s\\n", oldName, newName)
            continue
        }
        
        if err := os.Rename(oldPath, newPath); err != nil {
            return fmt.Errorf("renaming %s: %w", oldName, err)
        }
        fmt.Printf("Renamed: %s → %s\\n", oldName, newName)
    }
    return nil
}`,
						filename: "renamer.go",
					},
				],
			},
		],
	},

	{
		slug: "api-client",
		name: "REST API client",
		tagline:
			"Fetch, decode, and display data from a public API — the Go way.",
		code: "API",
		tier: 1,
		tierLabel: "FOUNDATIONS",

		estimatedTime: "2–3 hours",
		tags: ["http", "json", "api", "structs"],

		mentalModels: [
			"external data boundary",
			"type-safe decoding",
			"error propagation",
			"resource cleanup",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "HTTP requests fetch JSON data, which is decoded into typed structs for safe processing.",
				},
			},
			{
				type: "code",
				value: `CLI → HTTP request → API → JSON response → decode → typed struct → output`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `main()
 ├── buildRequest()
 ├── executeHTTP()
 └── handleResponse()

handleResponse()
 ├── decodeJSON()
 └── formatOutput()`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must handle network timeouts" },
					{ en: "Must decode JSON safely" },
					{ en: "Must close response bodies" },
					{ en: "Must handle API errors gracefully" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a type-safe API client with proper error handling and resource cleanup.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define response structs" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Model the expected JSON structure." },
						concept: {
							en: "Struct tags map JSON fields to Go fields.",
						},
						implementation: `type WeatherResponse struct {
    Latitude  float64 \`json:"latitude"\`
    Longitude float64 \`json:"longitude"\`
    Current   Current \`json:"current"\`
}

type Current struct {
    Temperature float64 \`json:"temperature_2m"\`
    WindSpeed   float64 \`json:"wind_speed_10m"\`
    WeatherCode int     \`json:"weather_code"\`
}

func (w WeatherResponse) String() string {
    return fmt.Sprintf("%.1f°C, wind %.0f km/h", 
        w.Current.Temperature, 
        w.Current.WindSpeed)
}`,
						filename: "weather.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Make HTTP request" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Fetch data from external API." },
						concept: {
							en: "HTTP clients must handle timeouts and clean up resources.",
						},
						implementation: `func fetchWeather(lat, lon float64) (*WeatherResponse, error) {
    client := &http.Client{
        Timeout: 10 * time.Second,
    }
    
    url := fmt.Sprintf(
        "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,wind_speed_10m",
        lat, lon,
    )
    
    resp, err := client.Get(url)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("API error: %s", resp.Status)
    }
    
    var result WeatherResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode failed: %w", err)
    }
    
    return &result, nil
}`,
						filename: "client.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Format and display output" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Present data to user." },
						concept: {
							en: "The Stringer interface provides custom string formatting.",
						},
						implementation: `func main() {
    weather, err := fetchWeather(51.5074, -0.1278)
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println("London weather:", weather)
    fmt.Printf("Temperature: %.1f°C\\n", weather.Current.Temperature)
    fmt.Printf("Wind speed: %.0f km/h\\n", weather.Current.WindSpeed)
    fmt.Printf("Weather code: %d\\n", weather.Current.WeatherCode)
}`,
						filename: "main.go",
					},
				],
			},
		],
	},

	{
		slug: "log-parser",
		name: "Concurrent log parser",
		tagline: "Parse large log files fast using goroutines and channels.",
		code: "LOG",
		tier: 1,
		tierLabel: "FOUNDATIONS",

		estimatedTime: "3–4 hours",
		tags: ["concurrency", "goroutines", "channels", "filesystem"],

		mentalModels: [
			"fan-out concurrency",
			"channel-based communication",
			"bounded parallelism",
			"worker pools",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "Multiple log files are processed concurrently by workers, with results aggregated through channels.",
				},
			},
			{
				type: "code",
				value: `files → tasks channel → workers → results channel → aggregator → summary`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `main()
 ├── create channels
 ├── start workers
 └── collect results

worker()
 ├── read file
 ├── parse lines
 └── send results`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must handle files larger than memory" },
					{ en: "Must not leak goroutines" },
					{ en: "Must handle malformed log lines gracefully" },
					{ en: "Must preserve line order within each file" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You implemented a concurrent pipeline with proper goroutine lifecycle management.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define log entry structure" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Model parsed log data." },
						concept: {
							en: "Strong types make data flow explicit.",
						},
						implementation: `type LogEntry struct {
    Timestamp time.Time
    Level     string
    Message   string
    File      string
    Line      int
}

func parseLine(line string, file string, lineNum int) (LogEntry, bool) {
    // Format: 2024-01-15T10:30:00Z INFO user logged in
    parts := strings.SplitN(line, " ", 3)
    if len(parts) < 3 {
        return LogEntry{}, false
    }
    
    t, err := time.Parse(time.RFC3339, parts[0])
    if err != nil {
        return LogEntry{}, false
    }
    
    return LogEntry{
        Timestamp: t,
        Level:    parts[1],
        Message:  parts[2],
        File:     file,
        Line:     lineNum,
    }, true
}`,
						filename: "parser.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Build file processor" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Read and parse individual files." },
						concept: {
							en: "Buffered scanning prevents memory exhaustion.",
						},
						implementation: `func processFile(path string, results chan<- LogEntry) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()
    
    scanner := bufio.NewScanner(file)
    lineNum := 0
    
    for scanner.Scan() {
        lineNum++
        entry, ok := parseLine(scanner.Text(), path, lineNum)
        if ok {
            results <- entry
        }
    }
    
    return scanner.Err()
}`,
						filename: "processor.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Create worker pool" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Process multiple files concurrently." },
						concept: {
							en: "Workers pull tasks and push results through channels.",
						},
						implementation: `func worker(tasks <-chan string, results chan<- LogEntry, errors chan<- error, wg *sync.WaitGroup) {
    defer wg.Done()
    
    for path := range tasks {
        if err := processFile(path, results); err != nil {
            errors <- fmt.Errorf("processing %s: %w", path, err)
        }
    }
}

func processFiles(paths []string, numWorkers int) (<-chan LogEntry, <-chan error) {
    results := make(chan LogEntry, 1000)
    errors := make(chan error, len(paths))
    tasks := make(chan string, len(paths))
    
    var wg sync.WaitGroup
    
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go worker(tasks, results, errors, &wg)
    }
    
    go func() {
        for _, path := range paths {
            tasks <- path
        }
        close(tasks)
    }()
    
    go func() {
        wg.Wait()
        close(results)
        close(errors)
    }()
    
    return results, errors
}`,
						filename: "pool.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Aggregate results" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Generate summary statistics." },
						concept: {
							en: "Channel range collects results until closure.",
						},
						implementation: `func aggregate(results <-chan LogEntry, errors <-chan error) {
    counts := make(map[string]int)
    var earliest, latest time.Time
    var errorList []error
    
    for results != nil || errors != nil {
        select {
        case entry, ok := <-results:
            if !ok {
                results = nil
                continue
            }
            counts[entry.Level]++
            if earliest.IsZero() || entry.Timestamp.Before(earliest) {
                earliest = entry.Timestamp
            }
            if entry.Timestamp.After(latest) {
                latest = entry.Timestamp
            }
            
        case err, ok := <-errors:
            if !ok {
                errors = nil
                continue
            }
            errorList = append(errorList, err)
        }
    }
    
    total := 0
    for _, count := range counts {
        total += count
    }
    
    fmt.Printf("Total entries: %d\\n", total)
    fmt.Printf("Time range: %s — %s\\n", 
        earliest.Format(time.RFC3339), 
        latest.Format(time.RFC3339))
    
    if len(errorList) > 0 {
        fmt.Printf("\\nErrors (%d):\\n", len(errorList))
        for _, err := range errorList {
            fmt.Printf("  - %v\\n", err)
        }
    }
}`,
						filename: "aggregator.go",
					},
				],
			},
		],
	},

	// ── TIER 2 ──────────────────────────────────────────────────────────────
	{
		slug: "http-server",
		name: "HTTP server with middleware",
		tagline:
			"Build a real HTTP server with auth, logging, and rate-limiting middleware.",
		code: "SRV",
		tier: 2,
		tierLabel: "SYSTEMS",

		estimatedTime: "3–4 hours",
		tags: ["http", "middleware", "context", "testing"],

		mentalModels: [
			"handler composition",
			"request lifecycle",
			"middleware chaining",
			"context propagation",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "HTTP requests flow through a chain of middleware before reaching the final handler.",
				},
			},
			{
				type: "code",
				value: `request → logging → auth → rate-limit → handler → response`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `main()
 └── setupServer()

server
 ├── middleware chain
 └── route handlers

handler()
 ├── extract context
 ├── process
 └── write response`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must compose middleware without framework magic" },
					{ en: "Must propagate context through layers" },
					{ en: "Must handle panics gracefully" },
					{ en: "Must be testable without real HTTP" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a composable HTTP server using only the standard library.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Understand http.Handler" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Learn the core HTTP interface." },
						concept: {
							en: "Everything in Go HTTP is built on the Handler interface.",
						},
						implementation: `type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}

// HandlerFunc adapts a function to be a Handler
type HandlerFunc func(ResponseWriter, *Request)

func (f HandlerFunc) ServeHTTP(w ResponseWriter, r *Request) {
    f(w, r)
}

// Middleware pattern
type Middleware func(http.Handler) http.Handler`,
						filename: "handler.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Implement logging middleware" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Log request details and timing." },
						concept: {
							en: "Middleware wraps handlers to add cross-cutting concerns.",
						},
						implementation: `type responseWriter struct {
    http.ResponseWriter
    status int
    size   int
}

func (rw *responseWriter) WriteHeader(status int) {
    rw.status = status
    rw.ResponseWriter.WriteHeader(status)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
    size, err := rw.ResponseWriter.Write(b)
    rw.size += size
    return size, err
}

func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        rw := &responseWriter{
            ResponseWriter: w,
            status:        http.StatusOK,
        }
        
        next.ServeHTTP(rw, r)
        
        log.Printf(
            "%s %s %d %d %v",
            r.Method,
            r.URL.Path,
            rw.status,
            rw.size,
            time.Since(start),
        )
    })
}`,
						filename: "middleware.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Add auth middleware" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Authenticate requests and attach user context.",
						},
						concept: {
							en: "Context carries request-scoped values through middleware.",
						},
						implementation: `type contextKey string

const userKey contextKey = "user"

func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        token = strings.TrimPrefix(token, "Bearer ")
        
        if token == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        
        user, err := validateToken(token)
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }
        
        ctx := context.WithValue(r.Context(), userKey, user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func UserFromContext(ctx context.Context) (string, bool) {
    user, ok := ctx.Value(userKey).(string)
    return user, ok
}`,
						filename: "auth.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Chain middleware" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Compose multiple middleware functions.",
						},
						concept: {
							en: "Middleware chaining builds the request processing pipeline.",
						},
						implementation: `func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/users", usersHandler)
    mux.HandleFunc("/api/posts", postsHandler)
    
    handler := Chain(
        mux,
        LoggingMiddleware,
        AuthMiddleware,
        RateLimitMiddleware,
    )
    
    srv := &http.Server{
        Addr:         ":8080",
        Handler:      handler,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }
    
    log.Fatal(srv.ListenAndServe())
}

func TestAuthMiddleware(t *testing.T) {
    handler := AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user, ok := UserFromContext(r.Context())
        if !ok {
            t.Error("user not in context")
        }
        w.Write([]byte(user))
    }))
    
    req := httptest.NewRequest("GET", "/", nil)
    req.Header.Set("Authorization", "Bearer valid-token")
    rec := httptest.NewRecorder()
    
    handler.ServeHTTP(rec, req)
    
    if rec.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", rec.Code)
    }
}`,
						filename: "server.go",
					},
				],
			},
		],
	},

	{
		slug: "worker-pool",
		name: "Worker pool / job queue",
		tagline:
			"Process thousands of tasks concurrently without data races or goroutine leaks.",
		code: "WRK",
		tier: 2,
		tierLabel: "SYSTEMS",

		estimatedTime: "3–5 hours",
		tags: ["concurrency", "goroutines", "channels", "patterns"],

		mentalModels: [
			"bounded parallelism",
			"work distribution",
			"graceful shutdown",
			"error propagation",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "Tasks flow through a channel to a pool of workers, with results and errors collected separately.",
				},
			},
			{
				type: "code",
				value: `tasks → job queue → worker pool → results channel → collector`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `main()
 ├── create pool
 ├── submit tasks
 └── collect results

pool
 ├── worker goroutines
 ├── job queue
 └── result collector

worker
 ├── receive job
 ├── process
 └── send result`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{
						en: "Must bound concurrency to prevent resource exhaustion",
					},
					{ en: "Must handle context cancellation" },
					{ en: "Must not leak goroutines on shutdown" },
					{ en: "Must preserve job results with errors" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a production-ready worker pool with proper lifecycle management.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define job and result types" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Create type-safe contracts." },
						concept: {
							en: "Clear types make the data flow explicit.",
						},
						implementation: `type Job struct {
    ID      int
    Payload interface{}
}

type Result struct {
    JobID  int
    Output interface{}
    Err    error
}

type WorkerFunc func(Job) Result

type Pool struct {
    jobs    chan Job
    results chan Result
    done    chan struct{}
    workers int
    wg      sync.WaitGroup
}`,
						filename: "pool.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Create pool with workers" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Initialize worker goroutines." },
						concept: {
							en: "Workers run concurrently, each processing jobs from a shared queue.",
						},
						implementation: `func NewPool(workers int, fn WorkerFunc) *Pool {
    p := &Pool{
        jobs:    make(chan Job, workers*2),
        results: make(chan Result, workers*2),
        done:    make(chan struct{}),
        workers: workers,
    }
    
    p.wg.Add(workers)
    for i := 0; i < workers; i++ {
        go p.worker(fn)
    }
    
    go func() {
        p.wg.Wait()
        close(p.results)
        close(p.done)
    }()
    
    return p
}

func (p *Pool) worker(fn WorkerFunc) {
    defer p.wg.Done()
    
    for job := range p.jobs {
        result := fn(job)
        select {
        case p.results <- result:
        case <-p.done:
            return
        }
    }
}`,
						filename: "pool.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Add graceful shutdown" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Handle cancellation and cleanup." },
						concept: {
							en: "Context signals workers to stop accepting new work.",
						},
						implementation: `var ErrPoolStopped = errors.New("pool stopped")

func (p *Pool) StartWithContext(ctx context.Context) {
    go func() {
        <-ctx.Done()
        close(p.jobs)
    }()
}

func (p *Pool) Submit(job Job) error {
    select {
    case p.jobs <- job:
        return nil
    case <-p.done:
        return ErrPoolStopped
    }
}

func (p *Pool) Results() <-chan Result {
    return p.results
}

func main() {
    ctx, stop := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM)
    defer stop()
    
    pool := NewPool(4, func(job Job) Result {
        time.Sleep(100 * time.Millisecond)
        return Result{
            JobID:  job.ID,
            Output: fmt.Sprintf("processed: %v", job.Payload),
        }
    })
    
    pool.StartWithContext(ctx)
    
    go func() {
        for i := 0; i < 100; i++ {
            pool.Submit(Job{ID: i, Payload: i})
        }
    }()
    
    for result := range pool.Results() {
        if result.Err != nil {
            log.Printf("job %d failed: %v", result.JobID, result.Err)
            continue
        }
        fmt.Printf("Result: %v\\n", result.Output)
    }
}`,
						filename: "main.go",
					},
				],
			},
		],
	},

	{
		slug: "config-watcher",
		name: "Live config reloader",
		tagline:
			"Watch a config file for changes and reload your service without restarting.",
		code: "CFG",
		tier: 2,
		tierLabel: "SYSTEMS",

		estimatedTime: "3–4 hours",
		tags: ["sync", "goroutines", "select", "patterns"],

		mentalModels: [
			"shared state protection",
			"event-driven reload",
			"zero-downtime updates",
			"atomic swap",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "A watcher goroutine monitors a config file for changes and publishes new config values via a channel. Readers always see a consistent snapshot without locking on the hot path.",
				},
			},
			{
				type: "code",
				value: `file watcher → debounce → parse → atomic store → subscribers notified`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `Watcher
 ├── fsnotify loop
 ├── debounce timer
 └── broadcast update

ConfigStore
 ├── atomic.Value (snapshot)
 └── subscriber channels

Service
 ├── Load() — reads snapshot
 └── Subscribe() — receives updates`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must not block request handlers during reload" },
					{ en: "Must debounce rapid successive file writes" },
					{ en: "Must keep old config if new file is invalid" },
					{ en: "Must propagate reload to all active subscribers" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a zero-downtime config reloader using atomic values, select-based debouncing, and fan-out notification — patterns that appear in every long-running Go service.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define the config type and atomic store" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Create an immutable config snapshot and a thread-safe store.",
						},
						concept: {
							en: "sync/atomic.Value lets you swap an entire struct pointer atomically. Readers get a consistent snapshot without a mutex on the hot path — the read side is a single pointer load.",
						},
						implementation: `package config

import (
    "encoding/json"
    "os"
    "sync/atomic"
)

// Config is immutable once created — never mutate fields.
type Config struct {
    Port     int    \`json:"port"\`
    LogLevel string \`json:"log_level"\`
    DBConn   string \`json:"db_conn"\`
}

// Store holds the current config behind an atomic pointer.
type Store struct {
    val atomic.Value // always holds a *Config
}

func (s *Store) Load() *Config {
    return s.val.Load().(*Config)
}

func (s *Store) store(c *Config) {
    s.val.Store(c)
}

func loadFromFile(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    var c Config
    if err := json.Unmarshal(data, &c); err != nil {
        return nil, err
    }
    return &c, nil
}`,
						filename: "config/store.go",
					},
					{
						type: "callout",
						variant: "info",
						value: {
							en: "atomic.Value requires the concrete type stored to never change. Always store *Config, never Config — that's why Load() does a type assertion, not a type switch.",
						},
					},
				],
			},
			{
				n: "02",
				heading: { en: "Watch the file with debouncing" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "React to file changes without firing dozens of reloads on a single save.",
						},
						concept: {
							en: "Most editors write a file in multiple syscall bursts. A debounce timer (reset on each event, fired when quiet) collapses the burst into a single reload — a classic select + time.AfterFunc pattern.",
						},
						implementation: `package config

import (
    "log"
    "time"

    "github.com/fsnotify/fsnotify"
)

// Watcher watches path and calls reload whenever the file
// settles after a change. It never calls reload concurrently.
func Watch(path string, store *Store, notify chan<- struct{}) error {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    if err := watcher.Add(path); err != nil {
        watcher.Close()
        return err
    }

    go func() {
        defer watcher.Close()

        var debounce *time.Timer

        for {
            select {
            case event, ok := <-watcher.Events:
                if !ok {
                    return
                }
                if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
                    // Reset the debounce window.
                    if debounce != nil {
                        debounce.Stop()
                    }
                    debounce = time.AfterFunc(200*time.Millisecond, func() {
                        reload(path, store, notify)
                    })
                }

            case err, ok := <-watcher.Errors:
                if !ok {
                    return
                }
                log.Printf("config watcher error: %v", err)
            }
        }
    }()

    return nil
}

func reload(path string, store *Store, notify chan<- struct{}) {
    c, err := loadFromFile(path)
    if err != nil {
        log.Printf("config reload failed (keeping old config): %v", err)
        return
    }
    store.store(c)
    log.Printf("config reloaded from %s", path)

    // Non-blocking fan-out: skip subscribers that aren't listening.
    select {
    case notify <- struct{}{}:
    default:
    }
}`,
						filename: "config/watcher.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Wire into your service" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Start the watcher and consume reloads in an HTTP handler.",
						},
						concept: {
							en: "Handlers call store.Load() on every request — one pointer dereference, no lock. The background goroutine that processes the notify channel is the only place that acts on a reload event, keeping the logic in one place.",
						},
						implementation: `package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os/signal"
    "syscall"

    "yourmodule/config"
)

func main() {
    store := &config.Store{}

    // Load initial config.
    initial, err := config.LoadFromFile("config.json")
    if err != nil {
        log.Fatal(err)
    }
    store.Store(initial)

    // Start watcher.
    notify := make(chan struct{}, 1)
    if err := config.Watch("config.json", store, notify); err != nil {
        log.Fatal(err)
    }

    // React to reloads in the background.
    go func() {
        for range notify {
            cfg := store.Load()
            log.Printf("new log level: %s", cfg.LogLevel)
            // reconfigure logger, update connection pool limits, etc.
        }
    }()

    // HTTP handler always reads the latest config snapshot.
    mux := http.NewServeMux()
    mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
        cfg := store.Load()
        fmt.Fprintf(w, "port=%d log_level=%s\\n", cfg.Port, cfg.LogLevel)
    })

    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    srv := &http.Server{Addr: fmt.Sprintf(":%d", store.Load().Port), Handler: mux}
    go srv.ListenAndServe()

    <-ctx.Done()
    srv.Shutdown(context.Background())
}`,
						filename: "main.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Test the reload path" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Verify config reloads correctly without a real filesystem event.",
						},
						concept: {
							en: "Testing reload logic directly — by calling reload() rather than waiting for a file event — keeps tests fast and deterministic. The watcher is just plumbing; the real logic is in reload() and Store.",
						},
						implementation: `package config_test

import (
    "os"
    "testing"
    "time"

    "yourmodule/config"
)

func TestReloadUpdatesStore(t *testing.T) {
    // Write initial config.
    f, _ := os.CreateTemp("", "cfg*.json")
    f.WriteString(\`{"port":8080,"log_level":"info","db_conn":"postgres://localhost/dev"}\`)
    f.Close()
    defer os.Remove(f.Name())

    store := &config.Store{}
    initial, err := config.LoadFromFile(f.Name())
    if err != nil {
        t.Fatal(err)
    }
    store.Store(initial)

    if store.Load().LogLevel != "info" {
        t.Fatalf("want info, got %s", store.Load().LogLevel)
    }

    // Overwrite with new config.
    os.WriteFile(f.Name(), []byte(\`{"port":8080,"log_level":"debug","db_conn":"postgres://localhost/dev"}\`), 0644)

    notify := make(chan struct{}, 1)
    config.Watch(f.Name(), store, notify)

    // Touch the file to trigger the watcher.
    now := time.Now()
    os.Chtimes(f.Name(), now, now)

    select {
    case <-notify:
    case <-time.After(2 * time.Second):
        t.Fatal("timed out waiting for reload")
    }

    if store.Load().LogLevel != "debug" {
        t.Fatalf("want debug, got %s", store.Load().LogLevel)
    }
}`,
						filename: "config/watcher_test.go",
					},
				],
			},
		],
	},

	// ── TIER 3 ──────────────────────────────────────────────────────────────
	{
		slug: "grpc",
		name: "gRPC microservice",
		tagline:
			"Define a protobuf schema, generate Go code, and build a working gRPC service.",
		code: "RPC",
		tier: 3,
		tierLabel: "ADVANCED",

		estimatedTime: "4–6 hours",
		tags: ["grpc", "protobuf", "microservices", "codegen"],

		mentalModels: [
			"contract-first API design",
			"strongly-typed RPC",
			"streaming communication",
			"interceptor chains",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "Protocol Buffers define the service contract, from which server and client code is generated.",
				},
			},
			{
				type: "code",
				value: `proto file → protoc → generated code → server implementation → RPC calls`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `service.proto
 ├── messages
 └── service definition

server/
 ├── implementation
 ├── interceptors
 └── main()

client/
 ├── stub
 └── application`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must maintain backward compatibility" },
					{ en: "Must handle streaming correctly" },
					{ en: "Must propagate deadlines" },
					{ en: "Must handle errors with status codes" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a contract-first gRPC service with interceptors and streaming support.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define protobuf schema" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Create the API contract." },
						concept: {
							en: "Protobuf defines messages and services in a language-neutral way.",
						},
						implementation: `syntax = "proto3";

package user.v1;
option go_package = "github.com/you/app/gen/user/v1";

service UserService {
    rpc GetUser(GetUserRequest) returns (GetUserResponse);
    rpc ListUsers(ListUsersRequest) returns (stream User);
    rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
    rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
    rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
}

message User {
    string id = 1;
    string email = 2;
    string name = 3;
    int64 created_at = 4;
    int64 updated_at = 5;
}

message GetUserRequest {
    string id = 1;
}

message GetUserResponse {
    User user = 1;
}

message ListUsersRequest {
    int32 page_size = 1;
    string page_token = 2;
}

message CreateUserRequest {
    string email = 1;
    string name = 2;
}

message CreateUserResponse {
    User user = 1;
}`,
						filename: "proto/user/v1/user.proto",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Implement server" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Provide business logic." },
						concept: {
							en: "Generated interfaces ensure contract compliance.",
						},
						implementation: `type userService struct {
    user.UnimplementedUserServiceServer
    db *sql.DB
}

func (s *userService) GetUser(ctx context.Context, req *user.GetUserRequest) (*user.GetUserResponse, error) {
    if req.Id == "" {
        return nil, status.Error(codes.InvalidArgument, "id required")
    }
    
    var u User
    err := s.db.QueryRowContext(ctx,
        "SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1",
        req.Id,
    ).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &u.UpdatedAt)
    
    if err == sql.ErrNoRows {
        return nil, status.Errorf(codes.NotFound, "user %s not found", req.Id)
    }
    if err != nil {
        return nil, status.Errorf(codes.Internal, "query failed: %v", err)
    }
    
    return &user.GetUserResponse{
        User: &user.User{
            Id:        u.ID,
            Email:     u.Email,
            Name:      u.Name,
            CreatedAt: u.CreatedAt.Unix(),
            UpdatedAt: u.UpdatedAt.Unix(),
        },
    }, nil
}

func (s *userService) ListUsers(req *user.ListUsersRequest, stream user.UserService_ListUsersServer) error {
    rows, err := s.db.QueryContext(stream.Context(),
        "SELECT id, email, name FROM users LIMIT $1",
        req.PageSize,
    )
    if err != nil {
        return status.Errorf(codes.Internal, "query failed: %v", err)
    }
    defer rows.Close()
    
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Email, &u.Name); err != nil {
            return status.Errorf(codes.Internal, "scan failed: %v", err)
        }
        
        if err := stream.Send(&user.User{
            Id:    u.ID,
            Email: u.Email,
            Name:  u.Name,
        }); err != nil {
            return err
        }
    }
    
    return rows.Err()
}`,
						filename: "internal/server/user.go",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Add interceptors" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Add cross-cutting concerns." },
						concept: {
							en: "Interceptors are gRPC's middleware for unary and streaming calls.",
						},
						implementation: `func loggingInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    start := time.Now()
    resp, err := handler(ctx, req)
    
    slog.Info("gRPC call",
        "method", info.FullMethod,
        "duration", time.Since(start),
        "error", err,
    )
    
    return resp, err
}

func authInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "missing metadata")
    }
    
    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing token")
    }
    
    claims, err := validateToken(tokens[0])
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "invalid token")
    }
    
    ctx = context.WithValue(ctx, "claims", claims)
    return handler(ctx, req)
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatal(err)
    }
    
    s := grpc.NewServer(
        grpc.UnaryInterceptor(grpc.ChainUnaryInterceptor(
            loggingInterceptor,
            authInterceptor,
        )),
    )
    
    user.RegisterUserServiceServer(s, &userService{db: connectDB()})
    
    log.Println("gRPC server listening on :50051")
    if err := s.Serve(lis); err != nil {
        log.Fatal(err)
    }
}`,
						filename: "cmd/server/main.go",
					},
				],
			},
		],
	},

	{
		slug: "db-api",
		name: "Database-backed REST API",
		tagline:
			"Full CRUD REST API with Postgres, schema migrations, and the repository pattern.",
		code: "DB",
		tier: 3,
		tierLabel: "ADVANCED",

		estimatedTime: "5–7 hours",
		tags: ["postgres", "rest", "migrations", "repository-pattern"],

		mentalModels: [
			"repository abstraction",
			"dependency injection",
			"transaction management",
			"migration versioning",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "HTTP handlers depend on repository interfaces, with Postgres implementing the data access layer.",
				},
			},
			{
				type: "code",
				value: `HTTP → handlers → repository interface → Postgres implementation → database`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `migrations/
 ├── 001_init.up.sql
 └── 001_init.down.sql

internal/
 ├── repository/
 │   ├── interface.go
 │   └── postgres.go
 ├── models/
 └── api/
     └── handlers.go

cmd/
 └── server/
     └── main.go`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{ en: "Must use migration files for schema changes" },
					{ en: "Must support transactions" },
					{ en: "Must not leak database connections" },
					{ en: "Must be testable with database mocks" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a cleanly-architected REST API with proper separation of concerns.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Define repository interface" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Abstract data access." },
						concept: {
							en: "Interfaces allow swapping implementations for testing.",
						},
						implementation: `package repository

import (
    "context"
    "time"
)

type Task struct {
    ID        string    \`json:"id"\`
    Title     string    \`json:"title"\`
    Done      bool      \`json:"done"\`
    CreatedAt time.Time \`json:"created_at"\`
    UpdatedAt time.Time \`json:"updated_at"\`
}

type TaskRepository interface {
    Create(ctx context.Context, title string) (*Task, error)
    GetByID(ctx context.Context, id string) (*Task, error)
    List(ctx context.Context, limit, offset int) ([]Task, error)
    Update(ctx context.Context, id string, done bool) (*Task, error)
    Delete(ctx context.Context, id string) error
    
    // Transaction support
    WithTx(ctx context.Context, fn func(repo TaskRepository) error) error
}`,
						filename: "internal/repository/interface.go",
					},
				],
			},
			{
				n: "02",
				heading: { en: "Create database migrations" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Version control schema changes." },
						concept: {
							en: "Migrations provide reproducible database setup.",
						},
						implementation: `-- 001_create_tasks.up.sql
CREATE TABLE tasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT NOT NULL,
    done       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_done ON tasks(done);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- 001_create_tasks.down.sql
DROP TABLE tasks;

-- Run migrations
// migrate -database "postgres://localhost:5432/db?sslmode=disable" -path migrations up`,
						filename: "migrations/001_create_tasks.up.sql",
					},
				],
			},
			{
				n: "03",
				heading: { en: "Implement Postgres repository" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Provide concrete database access." },
						concept: {
							en: "Repository implementations encapsulate all database queries.",
						},
						implementation: `type postgresRepo struct {
    db *pgxpool.Pool
}

func NewPostgresRepo(connString string) (*postgresRepo, error) {
    config, err := pgxpool.ParseConfig(connString)
    if err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }
    
    config.MaxConns = 25
    config.MinConns = 5
    
    pool, err := pgxpool.NewWithConfig(context.Background(), config)
    if err != nil {
        return nil, fmt.Errorf("connect: %w", err)
    }
    
    return &postgresRepo{db: pool}, nil
}

func (r *postgresRepo) Create(ctx context.Context, title string) (*Task, error) {
    var t Task
    
    err := r.db.QueryRow(ctx, \`
        INSERT INTO tasks (title)
        VALUES ($1)
        RETURNING id, title, done, created_at, updated_at
    \`, title).Scan(
        &t.ID, &t.Title, &t.Done, &t.CreatedAt, &t.UpdatedAt,
    )
    
    if err != nil {
        return nil, fmt.Errorf("insert: %w", err)
    }
    
    return &t, nil
}

func (r *postgresRepo) WithTx(ctx context.Context, fn func(repo TaskRepository) error) error {
    tx, err := r.db.Begin(ctx)
    if err != nil {
        return err
    }
    
    defer tx.Rollback(ctx)
    
    txRepo := &postgresRepo{db: tx}
    if err := fn(txRepo); err != nil {
        return err
    }
    
    return tx.Commit(ctx)
}`,
						filename: "internal/repository/postgres.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Build HTTP handlers" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Handle HTTP requests." },
						concept: {
							en: "Handlers depend on interfaces, not concrete implementations.",
						},
						implementation: `type TaskHandler struct {
    repo repository.TaskRepository
}

func NewTaskHandler(repo repository.TaskRepository) *TaskHandler {
    return &TaskHandler{repo: repo}
}

func (h *TaskHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Title string \`json:"title"\`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }
    
    if req.Title == "" {
        http.Error(w, "title required", http.StatusBadRequest)
        return
    }
    
    task, err := h.repo.Create(r.Context(), req.Title)
    if err != nil {
        log.Printf("create error: %v", err)
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(task)
}

func main() {
    repo, err := NewPostgresRepo("postgres://localhost:5432/tasks?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }
    
    handler := NewTaskHandler(repo)
    
    mux := http.NewServeMux()
    mux.HandleFunc("POST /tasks", handler.CreateTask)
    mux.HandleFunc("GET /tasks", handler.ListTasks)
    
    log.Fatal(http.ListenAndServe(":8080", mux))
}`,
						filename: "internal/api/handlers.go",
					},
				],
			},
		],
	},

	{
		slug: "observability",
		name: "Observability CLI tool",
		tagline:
			"Profile, trace, and benchmark a Go service — then make it measurably faster.",
		code: "OBS",
		tier: 3,
		tierLabel: "ADVANCED",

		estimatedTime: "4–6 hours",
		tags: ["pprof", "runtime", "benchmarks", "tracing", "performance"],

		mentalModels: [
			"measurement-driven optimization",
			"allocation profiling",
			"benchmark stability",
			"runtime introspection",
		],

		systemOverview: [
			{
				type: "text",
				value: {
					en: "Profiling endpoints expose runtime metrics, which are analyzed to identify bottlenecks, then optimized with benchmarks proving improvements.",
				},
			},
			{
				type: "code",
				value: `service + pprof → profiling data → analysis → optimization → benchmarks → validation`,
			},
		],

		architecture: [
			{
				type: "code",
				value: `service/
 ├── main.go (with pprof)
 └── handlers/

benchmarks/
 ├── processor_test.go
 └── query_test.go

analysis/
 ├── cpu profiling
 ├── memory profiling
 └── flamegraphs`,
			},
		],

		constraints: [
			{
				type: "list",
				items: [
					{
						en: "Must not expose pprof endpoints in production without auth",
					},
					{
						en: "Must have statistically significant benchmark runs",
					},
					{ en: "Must measure both CPU time and allocations" },
					{ en: "Must profile realistic workloads" },
				],
			},
		],

		recap: [
			{
				type: "text",
				value: {
					en: "You built a profiling toolkit that enables data-driven performance optimization with measurable results.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: { en: "Add pprof to your service" },
				blocks: [
					{
						type: "structured",
						intent: { en: "Expose runtime profiling endpoints." },
						concept: {
							en: "pprof provides built-in profiling through HTTP endpoints.",
						},
						implementation: `package main

import (
    "log"
    "net/http"
    _ "net/http/pprof" // registers /debug/pprof/ endpoints
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/api/work", workHandler)

    // Run pprof on a separate port — never expose to the internet without auth.
    go func() {
        log.Println("pprof listening on :6060")
        log.Fatal(http.ListenAndServe(":6060", nil))
    }()

    log.Fatal(http.ListenAndServe(":8080", mux))
}

// CPU profile (30 seconds):
// go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
//
// Memory profile:
// go tool pprof http://localhost:6060/debug/pprof/heap
//
// Goroutine profile:
// go tool pprof http://localhost:6060/debug/pprof/goroutine
//
// Generate flamegraph:
// go tool pprof -http=:8081 ~/pprof/pprof.samples.cpu.001.pb.gz`,
						filename: "main.go",
					},
					{
						type: "callout",
						variant: "warning",
						value: {
							en: "Never expose pprof endpoints to the internet without authentication — they reveal memory contents and goroutine stacks.",
						},
					},
				],
			},
			{
				n: "02",
				heading: { en: "Write benchmarks" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Measure performance with repeatable benchmarks.",
						},
						concept: {
							en: "Benchmarks provide stable, reproducible performance measurements.",
						},
						implementation: `package processor

import (
    "testing"
)

func generateTestItem() *Item {
    return &Item{
        ID:   "test-123",
        Data: make([]byte, 1024),
    }
}

func BenchmarkProcessItem(b *testing.B) {
    item := generateTestItem()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        ProcessItem(item)
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

func BenchmarkProcessItemSizes(b *testing.B) {
    sizes := []int{10, 100, 1000, 10000}
    for _, size := range sizes {
        b.Run(fmt.Sprintf("size-%d", size), func(b *testing.B) {
            item := &Item{ID: "test", Data: make([]byte, size)}
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                ProcessItem(item)
            }
        })
    }
}

// Run: go test -bench=. -benchmem -count=5 | tee bench.txt
// Compare: benchstat bench.txt`,
						filename: "processor_test.go",
					},
					{
						type: "text",
						value: {
							en: "The -benchmem flag is crucial — allocations often impact performance more than CPU time. Always run benchmarks multiple times (-count=5) for statistical significance.",
						},
					},
				],
			},
			{
				n: "03",
				heading: { en: "Find and fix allocation hotspots" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Identify and eliminate unnecessary allocations.",
						},
						concept: {
							en: "Memory profiling reveals allocation patterns and optimization opportunities.",
						},
						implementation: `package query

import (
    "strings"
    "sync"
)

// BAD: allocates new Builder every call
func buildQueryBad(filters []string) string {
    var sb strings.Builder
    sb.WriteString("SELECT * FROM items")
    if len(filters) > 0 {
        sb.WriteString(" WHERE ")
        for i, f := range filters {
            if i > 0 {
                sb.WriteString(" AND ")
            }
            sb.WriteString(f)
        }
    }
    return sb.String()
}

// GOOD: pre-allocate with estimated capacity
func buildQueryGood(filters []string) string {
    if len(filters) == 0 {
        return "SELECT * FROM items"
    }
    var sb strings.Builder
    sb.Grow(len("SELECT * FROM items WHERE ") + len(strings.Join(filters, " AND ")))
    sb.WriteString("SELECT * FROM items WHERE ")
    sb.WriteString(strings.Join(filters, " AND "))
    return sb.String()
}

// BEST: pool the Builder for hot paths
var builderPool = sync.Pool{New: func() any { return &strings.Builder{} }}

func buildQueryPooled(filters []string) string {
    if len(filters) == 0 {
        return "SELECT * FROM items"
    }
    sb := builderPool.Get().(*strings.Builder)
    defer builderPool.Put(sb)
    sb.Reset()
    sb.Grow(len("SELECT * FROM items WHERE ") + len(strings.Join(filters, " AND ")))
    sb.WriteString("SELECT * FROM items WHERE ")
    sb.WriteString(strings.Join(filters, " AND "))
    return sb.String()
}

// BenchmarkBuildQueryBad-8     500000   3124 ns/op   1536 B/op   8 allocs/op
// BenchmarkBuildQueryGood-8   2000000    845 ns/op    512 B/op   2 allocs/op
// BenchmarkBuildQueryPooled-8 3000000    456 ns/op    512 B/op   2 allocs/op`,
						filename: "query.go",
					},
				],
			},
			{
				n: "04",
				heading: { en: "Advanced profiling techniques" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Use advanced tools to deep-dive into performance.",
						},
						concept: {
							en: "Combining multiple profiling techniques provides a complete performance picture.",
						},
						implementation: `package main

import (
    "log"
    "runtime"
    "time"
)

func monitorRuntime() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    var m runtime.MemStats
    for range ticker.C {
        runtime.ReadMemStats(&m)
        log.Printf("goroutines=%d heap=%dMB gc_cycles=%d gc_pause=%v",
            runtime.NumGoroutine(),
            m.HeapAlloc/1024/1024,
            m.NumGC,
            time.Duration(m.PauseNs[(m.NumGC+255)%256]),
        )
    }
}

// Execution trace:
// import "runtime/trace"
// f, _ := os.Create("trace.out")
// trace.Start(f); defer trace.Stop()
// go tool trace trace.out
//
// Runtime debug env vars:
// GODEBUG=gctrace=1,schedtrace=1000 ./myapp`,
						filename: "runtime_monitor.go",
					},
					{
						type: "list",
						items: [
							{
								en: "CPU Profile: go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30",
							},
							{
								en: "Memory Profile: go tool pprof -http=:8081 http://localhost:6060/debug/pprof/heap",
							},
							{
								en: "Goroutine Profile: go tool pprof -http=:8081 http://localhost:6060/debug/pprof/goroutine",
							},
							{
								en: "Block Profile: go tool pprof -http=:8081 http://localhost:6060/debug/pprof/block",
							},
							{
								en: "Mutex Profile: go tool pprof -http=:8081 http://localhost:6060/debug/pprof/mutex",
							},
						],
					},
					{
						type: "callout",
						variant: "info",
						value: {
							en: "The -http flag opens an interactive web UI where you can explore flamegraphs, call graphs, and source views.",
						},
					},
				],
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
