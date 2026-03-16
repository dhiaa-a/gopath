export type Tag = string;

export type Step = {
  n: string;
  heading: string;
  body: string;
};

export type Project = {
  slug: string;
  tier: 1 | 2 | 3;
  tierLabel: string;
  code: string;
  name: string;
  tagline: string;
  what: string;
  learn: string[];
  fromOtherLang: string;
  steps: Step[];
  tags: Tag[];
  nextSlug?: string;
  nextName?: string;
  estimatedTime: string;
};

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
    what:
      "A command-line tool that renames files in a directory based on patterns — add a date prefix, replace spaces with underscores, strip certain strings. Supports a --dry-run flag so users can preview changes before committing.",
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
        body: "Run <code>go mod init github.com/you/renamer</code>. Create <code>main.go</code> and a <code>renamer/</code> package. Get familiar with the layout Go expects.",
      },
      {
        n: "02",
        heading: "Define your flags",
        body: "Use <code>flag.String</code> and <code>flag.Bool</code> to accept a directory path, a pattern, and a <code>--dry-run</code> flag. Parse them with <code>flag.Parse()</code>.",
      },
      {
        n: "03",
        heading: "List and filter files",
        body: "Use <code>os.ReadDir()</code> to list the directory. Filter files matching the pattern using <code>strings</code> or <code>regexp</code>.",
      },
      {
        n: "04",
        heading: "Build the rename logic",
        body: "Write a pure function <code>newName(old string) string</code> that applies your transformation. Test it in isolation before wiring it up.",
      },
      {
        n: "05",
        heading: "Apply or preview",
        body: "If <code>--dry-run</code>, print what would happen. Otherwise call <code>os.Rename()</code>. Handle errors explicitly — never swallow them.",
      },
      {
        n: "06",
        heading: "Add a summary",
        body: "Print how many files were renamed (or would be). Exit with a non-zero code if anything failed. This is how real CLI tools behave.",
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
    tagline: "Fetch, decode, and display data from a public API — the Go way.",
    estimatedTime: "2–3 hours",
    what:
      "A CLI tool that queries a public REST API (e.g. GitHub, Open-Meteo weather), decodes JSON into typed structs, handles errors gracefully, and prints formatted output. You'll learn how Go thinks about HTTP, types, and interfaces.",
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
        heading: "Choose your API",
        body: "Pick a public API that needs no auth — Open-Meteo (weather), REST Countries, or the GitHub public events API are great choices. Read the docs, understand the JSON shape.",
      },
      {
        n: "02",
        heading: "Define your structs",
        body: "Write Go structs that match the JSON fields you care about. Use <code>json:\"field_name\"</code> struct tags to map snake_case JSON keys to Go's CamelCase.",
      },
      {
        n: "03",
        heading: "Make the HTTP request",
        body: "Use <code>http.Get(url)</code>, check the status code, and defer <code>resp.Body.Close()</code>. This trio is the Go HTTP idiom — you'll write it hundreds of times.",
      },
      {
        n: "04",
        heading: "Decode the response",
        body: "Use <code>json.NewDecoder(resp.Body).Decode(&result)</code>. Handle the error. Inspect your struct — does it look right? Add a <code>String()</code> method to format it nicely.",
      },
      {
        n: "05",
        heading: "Handle failures gracefully",
        body: "What if the API is down? What if the JSON shape changes? Add proper error handling at every layer and return meaningful messages to the user.",
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
    what:
      "A tool that reads large log files (or multiple log files simultaneously), extracts structured data (timestamps, levels, messages), and outputs a summary — count per log level, error rate over time, slowest requests. The interesting part: you'll process chunks concurrently.",
    learn: [
      "Launching goroutines with <code>go func()</code>",
      "Sending and receiving on channels",
      "Coordinating goroutines with <code>sync.WaitGroup</code>",
      "Reading files efficiently with <code>bufio.Scanner</code>",
      "The fan-out pattern: one reader, many workers",
    ],
    fromOtherLang:
      "Coming from Python: goroutines are not threads and channels are not queues — they're a communication primitive. The mental model shift is: instead of sharing memory and locking it, you share data by passing it through channels. Coming from JS: Go has real parallelism, not an event loop. Your goroutines can truly run simultaneously on multiple cores.",
    steps: [
      {
        n: "01",
        heading: "Read a single file synchronously",
        body: "Start simple. Use <code>bufio.Scanner</code> to read line by line. Parse each line into a struct with timestamp, level, and message. Get this working before adding concurrency.",
      },
      {
        n: "02",
        heading: "Add a results channel",
        body: "Create a <code>chan LogEntry</code>. Move your parsing into a goroutine that sends entries to the channel. Your main function receives them. This is the foundation of Go concurrency.",
      },
      {
        n: "03",
        heading: "Fan out across multiple files",
        body: "Launch one goroutine per file. All goroutines send to the same results channel. Use a <code>sync.WaitGroup</code> to know when all goroutines are done, then close the channel.",
      },
      {
        n: "04",
        heading: "Aggregate the results",
        body: "Count entries by level, find the time range, calculate error rate. Build a summary struct and print it. Notice how clean the aggregation is when the heavy work is already done.",
      },
      {
        n: "05",
        heading: "Handle errors from goroutines",
        body: "Goroutines can't return errors to main. Add a separate <code>chan error</code> and collect errors after all workers finish. This is the standard Go pattern.",
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
    what:
      "An HTTP server using only <code>net/http</code>. You'll implement middleware as function wrappers (the Go way), add JWT auth, structured logging with <code>log/slog</code>, and per-IP rate limiting — all composable and testable.",
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
        heading: "Start with a bare server",
        body: "Write <code>http.ListenAndServe</code> with a single handler. Understand that everything in Go's HTTP server is just one interface: <code>ServeHTTP(w ResponseWriter, r *Request)</code>.",
      },
      {
        n: "02",
        heading: "Write your first middleware",
        body: "Create a logging middleware that wraps any handler, records method, path, status code, and duration, then calls the next handler.",
      },
      {
        n: "03",
        heading: "Add auth middleware",
        body: "Accept a Bearer token, validate it, store claims in <code>context</code>. Downstream handlers read from context — they never touch the raw header.",
      },
      {
        n: "04",
        heading: "Add rate limiting",
        body: "Use a <code>sync.Map</code> of token buckets keyed by IP. Middleware returns 429 if the bucket is empty. This teaches you Go's concurrency primitives in a real use case.",
      },
      {
        n: "05",
        heading: "Chain it all together",
        body: "Compose: <code>withRateLimit(withAuth(withLogging(apiHandler)))</code>. Write an integration test using <code>httptest.NewRecorder()</code> that fires real HTTP requests.",
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
    what:
      "A generic worker pool that accepts jobs from a queue and processes them with a fixed number of workers. You'll tackle the full suite of Go concurrency primitives: channels, <code>context</code> cancellation, <code>select</code>, <code>sync.WaitGroup</code>, and graceful shutdown.",
    learn: [
      "The worker pool pattern in Go",
      "<code>select</code> for multiplexing channels",
      "Context cancellation and propagation",
      "Preventing goroutine leaks",
      "Graceful shutdown on OS signals",
    ],
    fromOtherLang:
      "Coming from Python: this replaces <code>concurrent.futures.ThreadPoolExecutor</code> — but with channels instead of futures. Coming from Java: no <code>ExecutorService</code>, no thread pool classes — just goroutines and channels. The primitives are lower-level but the patterns are cleaner.",
    steps: [
      {
        n: "01",
        heading: "Define the job and result types",
        body: "Start with concrete types: <code>type Job struct</code> and <code>type Result struct</code>. Make the worker function signature clear before building anything else.",
      },
      {
        n: "02",
        heading: "Build a single worker",
        body: "Write a function that receives from a jobs channel in a loop, processes each job, and sends results to a results channel. It exits when the jobs channel is closed.",
      },
      {
        n: "03",
        heading: "Launch N workers",
        body: "Launch N workers in a loop. Use a <code>sync.WaitGroup</code> to track when all workers are done. Close the results channel after the WaitGroup finishes.",
      },
      {
        n: "04",
        heading: "Add context cancellation",
        body: "Pass a <code>context.Context</code> into each worker. Use <code>select</code> to either process a job or react to <code>ctx.Done()</code>. This is how real services handle shutdown.",
      },
      {
        n: "05",
        heading: "Handle OS signals",
        body: "Use <code>signal.NotifyContext</code> to cancel the context on SIGINT/SIGTERM. Workers will drain current jobs and exit cleanly. No goroutine leaks.",
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
    what:
      "A multi-command CLI (like git or kubectl) built with cobra for commands and viper for config file support. You'll learn Go project layout at scale, how to write table-driven tests, and how to structure a CLI that real users can configure.",
    learn: [
      "Multi-command CLI structure with cobra",
      "Config files and env vars with viper",
      "Go project layout for larger projects",
      "Table-driven tests — the Go testing idiom",
      "Building and distributing a Go binary",
    ],
    fromOtherLang:
      "Coming from Python: cobra is Click, viper is python-dotenv + configparser combined. The big difference: your CLI compiles to a single static binary with no dependencies — users just download and run it. Coming from Node: no package.json at runtime, no node_modules to ship.",
    steps: [
      {
        n: "01",
        heading: "Scaffold with cobra-cli",
        body: "Install cobra-cli and run <code>cobra-cli init</code>. Understand the generated structure: <code>cmd/root.go</code>, <code>cmd/subcommand.go</code>. This is the standard layout for Go CLI tools.",
      },
      {
        n: "02",
        heading: "Add subcommands",
        body: "Create two subcommands. Each has its own flags. Understand how cobra wires flags to commands and how persistent flags (on root) propagate to all subcommands.",
      },
      {
        n: "03",
        heading: "Add config file support",
        body: "Wire viper to read from <code>~/.config/yourtool/config.yaml</code>, environment variables (with a prefix), and CLI flags — in that precedence order. This is the standard Go config pattern.",
      },
      {
        n: "04",
        heading: "Write table-driven tests",
        body: "Test each command's logic. Use a slice of test cases: <code>[]struct{ input ...; want ... }</code>. Loop over them with <code>t.Run()</code>. This pattern appears in virtually every Go codebase.",
      },
      {
        n: "05",
        heading: "Build and cross-compile",
        body: "Run <code>go build</code>. Then cross-compile for other platforms: <code>GOOS=darwin GOARCH=arm64 go build</code>. Ship a binary that works everywhere with no install step.",
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
    what:
      "A gRPC service (e.g. a user service or a currency converter) defined in protobuf, compiled to Go, and implemented with real business logic. You'll cover unary calls, streaming, interceptors (gRPC's middleware), and a basic test client.",
    learn: [
      "Protobuf schema design",
      "Generating Go code with <code>protoc</code>",
      "Implementing gRPC server and client in Go",
      "Interceptors for auth and logging",
      "Streaming RPCs — server-side and bidirectional",
    ],
    fromOtherLang:
      "Coming from REST: gRPC uses a contract-first approach — you define the API in a <code>.proto</code> file and generate the client and server code. No more hand-rolling JSON serialization. Coming from GraphQL: protobuf is more rigid but much faster and type-safe end-to-end.",
    steps: [
      {
        n: "01",
        heading: "Install protoc and write your schema",
        body: "Install <code>protoc</code> and the Go plugin. Write a <code>.proto</code> file with your service definition, message types, and RPCs. This is your API contract.",
      },
      {
        n: "02",
        heading: "Generate the Go code",
        body: "Run <code>protoc</code> to generate <code>.pb.go</code> and <code>_grpc.pb.go</code> files. Understand what was generated — you'll implement the server interface.",
      },
      {
        n: "03",
        heading: "Implement the server",
        body: "Create a struct that implements your generated service interface. Write the business logic. Register it with a <code>grpc.Server</code> and start listening.",
      },
      {
        n: "04",
        heading: "Write a client",
        body: "Write a Go client that dials your server and calls each RPC. Test it end-to-end. This is the moment where contract-first design pays off — the client and server types match exactly.",
      },
      {
        n: "05",
        heading: "Add interceptors",
        body: "Add a logging interceptor and an auth interceptor (check metadata for a token). Chain them. This is gRPC's equivalent of HTTP middleware.",
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
    what:
      "A real REST API (e.g. a task manager or a bookmarks service) backed by PostgreSQL. You'll use <code>pgx</code> for the Postgres driver, <code>golang-migrate</code> for schema migrations, and implement the repository pattern to keep database logic out of your handlers.",
    learn: [
      "Connecting to Postgres with <code>pgx</code>",
      "Running schema migrations with <code>golang-migrate</code>",
      "The repository pattern — separating DB from business logic",
      "Transactions and rollback in Go",
      "Integration tests with a real database",
    ],
    fromOtherLang:
      "Coming from Python/Django: no ORM magic here — you write SQL directly. This feels tedious at first but gives you complete control and predictable query performance. Coming from Node/Prisma: same idea — Go favors explicit SQL over generated queries. <code>sqlc</code> is the closest Go equivalent to Prisma if you want type-safe queries from SQL.",
    steps: [
      {
        n: "01",
        heading: "Set up Postgres and connect",
        body: "Run Postgres in Docker. Use <code>pgx/v5</code> to open a connection pool. Write a health check that pings the database. Handle connection errors.",
      },
      {
        n: "02",
        heading: "Write migrations",
        body: "Create <code>000001_create_tasks.up.sql</code> and <code>down.sql</code>. Run them with golang-migrate. This is the professional way to manage schema — always version your migrations.",
      },
      {
        n: "03",
        heading: "Implement the repository",
        body: "Create a <code>TaskRepository</code> interface with <code>Create</code>, <code>GetByID</code>, <code>List</code>, <code>Update</code>, <code>Delete</code>. Implement it with real SQL. The interface makes it mockable for tests.",
      },
      {
        n: "04",
        heading: "Wire the HTTP handlers",
        body: "Inject the repository into your HTTP handlers. Handlers parse the request, call the repo, and write the response. No business logic in handlers — that's the rule.",
      },
      {
        n: "05",
        heading: "Add integration tests",
        body: "Spin up a test database with <code>testcontainers-go</code>. Run your migrations. Test the full stack — HTTP request → handler → repo → real DB → response.",
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
    what:
      "A CLI tool that profiles a Go HTTP service using <code>net/http/pprof</code>, generates flamegraphs, and identifies performance bottlenecks. You'll also write benchmarks, use the race detector, and learn how to read Go runtime metrics.",
    learn: [
      "Profiling with <code>pprof</code> — CPU, memory, goroutine",
      "Writing benchmarks with <code>testing.B</code>",
      "Reading and interpreting flamegraphs",
      "The Go race detector",
      "Runtime metrics: GC, goroutine count, heap",
    ],
    fromOtherLang:
      "Coming from Python: profiling in Go is built into the standard library — no third-party profilers needed. The tooling (<code>go tool pprof</code>) is powerful and the output is precise. Coming from Java: no JVM overhead, no JIT warmup to account for — Go benchmarks are stable and reproducible.",
    steps: [
      {
        n: "01",
        heading: "Add pprof to a service",
        body: "Import <code>_ \"net/http/pprof\"</code> in your server. This registers profiling endpoints. Start your server and visit <code>/debug/pprof/</code> to see what's available.",
      },
      {
        n: "02",
        heading: "Generate a CPU profile",
        body: "Run <code>go tool pprof</code> against your running server. Generate load with a benchmarking tool. Capture a 30-second CPU profile and explore it interactively.",
      },
      {
        n: "03",
        heading: "Read the flamegraph",
        body: "Export the flamegraph SVG. Identify the widest bars — those are your hot paths. Find one that's unexpectedly slow. This is where the real learning happens.",
      },
      {
        n: "04",
        heading: "Write benchmarks",
        body: "Write <code>func BenchmarkMyFunc(b *testing.B)</code>. Run with <code>go test -bench=. -benchmem</code>. Understand allocations — often more important than CPU time.",
      },
      {
        n: "05",
        heading: "Fix something and measure it",
        body: "Pick one hotspot. Fix it. Re-run the benchmark. Show the before/after numbers. This is the discipline of performance engineering — measure first, optimize second.",
      },
    ],
    tags: ["pprof", "runtime", "benchmarks", "tracing"],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getProjectsByTier(tier: 1 | 2 | 3): Project[] {
  return projects.filter((p) => p.tier === tier);
}
