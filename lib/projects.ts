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
					ar: "يتم تحليل إدخال المستخدم إلى تكوين، مما يقود عملية إعادة تسمية ملفات حتمية مع معاينة اختيارية للتجربة الجافة.",
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
					ar: "لقد بنيت أداة سطر أوامر جاهزة للإنتاج مع فصل واضح بين مراحل التحليل والتكوين والتنفيذ.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Parse CLI flags",
					ar: "تحليل خيارات سطر الأوامر",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Capture user input at program start.",
							ar: "التقاط إدخال المستخدم عند بدء البرنامج.",
						},
						concept: {
							en: "CLI flags define a contract between the user and the program.",
							ar: "خيارات سطر الأوامر تحدد عقدًا بين المستخدم والبرنامج.",
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
				heading: { en: "Build configuration", ar: "بناء التكوين" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Convert raw inputs into a validated structure.",
							ar: "تحويل المدخلات الخام إلى هيكل مُتحقق.",
						},
						concept: {
							en: "Configuration centralizes all system inputs and validates them early.",
							ar: "التكوين يمركز جميع مدخلات النظام ويتحقق منها مبكرًا.",
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
				heading: {
					en: "Implement renaming logic",
					ar: "تنفيذ منطق إعادة التسمية",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Apply transformation rules to filenames.",
							ar: "تطبيق قواعد التحويل على أسماء الملفات.",
						},
						concept: {
							en: "Pure functions make transformation logic testable and predictable.",
							ar: "الدوال النقية تجعل منطق التحويل قابلًا للاختبار ومتوقعًا.",
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
				heading: {
					en: "Process files with dry-run support",
					ar: "معالجة الملفات مع دعم التجربة الجافة",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Walk directory and rename files.",
							ar: "اجتياز المجلد وإعادة تسمية الملفات.",
						},
						concept: {
							en: "Dry-run mode previews changes without side effects.",
							ar: "وضع التجربة الجافة يعاين التغييرات بدون تأثيرات جانبية.",
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
					ar: "طلبات HTTP تجلب بيانات JSON، التي يتم فك تشفيرها إلى هياكل محددة الأنواع لمعالجة آمنة.",
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
					ar: "لقد بنيت عميل API آمن النوع مع معالجة أخطاء مناسبة وتنظيف موارد.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Define response structs",
					ar: "تحديد هياكل الاستجابة",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Model the expected JSON structure.",
							ar: "نمذجة هيكل JSON المتوقع.",
						},
						concept: {
							en: "Struct tags map JSON fields to Go fields.",
							ar: "وسوم الهيكل تربط حقول JSON بحقول Go.",
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
				heading: { en: "Make HTTP request", ar: "إجراء طلب HTTP" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Fetch data from external API.",
							ar: "جلب بيانات من API خارجي.",
						},
						concept: {
							en: "HTTP clients must handle timeouts and clean up resources.",
							ar: "عملاء HTTP يجب أن يتعاملوا مع مهلات الاتصال وينظفوا الموارد.",
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
				heading: {
					en: "Format and display output",
					ar: "تنسيق وعرض المخرجات",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Present data to user.",
							ar: "عرض البيانات للمستخدم.",
						},
						concept: {
							en: "The Stringer interface provides custom string formatting.",
							ar: "واجهة Stringer توفر تنسيقًا مخصصًا للنصوص.",
						},
						implementation: `func main() {
    weather, err := fetchWeather(51.5074, -0.1278)
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println("London weather:", weather)
    
    // Or access fields directly
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
					ar: "يتم معالجة ملفات سجلات متعددة بشكل متزامن بواسطة عمال، مع تجميع النتائج عبر قنوات.",
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
					ar: "لقد نفذت خط أنابيب متزامن مع إدارة دورة حياة goroutines بشكل صحيح.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Define log entry structure",
					ar: "تحديد هيكل إدخال السجل",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Model parsed log data.",
							ar: "نمذجة بيانات السجل المحللة.",
						},
						concept: {
							en: "Strong types make data flow explicit.",
							ar: "الأنواع القوية تجعل تدفق البيانات واضحًا.",
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
				heading: {
					en: "Build file processor",
					ar: "بناء معالج الملفات",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Read and parse individual files.",
							ar: "قراءة وتحليل الملفات الفردية.",
						},
						concept: {
							en: "Buffered scanning prevents memory exhaustion.",
							ar: "المسح المخزن يمنع استنزاف الذاكرة.",
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
				heading: { en: "Create worker pool", ar: "إنشاء مجموعة عمال" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Process multiple files concurrently.",
							ar: "معالجة ملفات متعددة بشكل متزامن.",
						},
						concept: {
							en: "Workers pull tasks and push results through channels.",
							ar: "العمال يسحبون المهام ويدفعون النتائج عبر القنوات.",
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
    
    // Start workers
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go worker(tasks, results, errors, &wg)
    }
    
    // Queue tasks
    go func() {
        for _, path := range paths {
            tasks <- path
        }
        close(tasks)
    }()
    
    // Close results when done
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
				heading: { en: "Aggregate results", ar: "تجميع النتائج" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Generate summary statistics.",
							ar: "توليد إحصائيات ملخصة.",
						},
						concept: {
							en: "Channel range collects results until closure.",
							ar: "نطاق القناة يجمع النتائج حتى الإغلاق.",
						},
						implementation: `func aggregate(results <-chan LogEntry, errors <-chan error) {
    counts := make(map[string]int)
    var earliest, latest time.Time
    var errorList []error
    
    // Collect results and errors
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
    
    // Print summary
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
					ar: "طلبات HTTP تتدفق عبر سلسلة من middleware قبل الوصول إلى المعالج النهائي.",
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
					ar: "لقد بنيت خادم HTTP قابل للتركيب باستخدام المكتبة القياسية فقط.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Understand http.Handler",
					ar: "فهم http.Handler",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Learn the core HTTP interface.",
							ar: "تعلم واجهة HTTP الأساسية.",
						},
						concept: {
							en: "Everything in Go HTTP is built on the Handler interface.",
							ar: "كل شيء في HTTP في Go مبني على واجهة Handler.",
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
				heading: {
					en: "Implement logging middleware",
					ar: "تنفيذ middleware للتسجيل",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Log request details and timing.",
							ar: "تسجيل تفاصيل الطلب والتوقيت.",
						},
						concept: {
							en: "Middleware wraps handlers to add cross-cutting concerns.",
							ar: "Middleware يغلف المعالجات لإضافة اهتمامات مشتركة.",
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
				heading: {
					en: "Add auth middleware",
					ar: "إضافة middleware للمصادقة",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Authenticate requests and attach user context.",
							ar: "مصادقة الطلبات وإرفاق سياق المستخدم.",
						},
						concept: {
							en: "Context carries request-scoped values through middleware.",
							ar: "السياق يحمل القيم المرتبطة بالطلب عبر middleware.",
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
				heading: { en: "Chain middleware", ar: "ربط middleware" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Compose multiple middleware functions.",
							ar: "تركيب دوال middleware متعددة.",
						},
						concept: {
							en: "Middleware chaining builds the request processing pipeline.",
							ar: "سلسلة middleware تبني خط معالجة الطلب.",
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
    
    // Build middleware chain
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

// Test without real HTTP
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
					ar: "المهام تتدفق عبر قناة إلى مجموعة من العمال، مع جمع النتائج والأخطاء بشكل منفصل.",
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
					ar: "لقد بنيت مجموعة عمال جاهزة للإنتاج مع إدارة دورة حياة مناسبة.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Define job and result types",
					ar: "تحديد أنواع المهمة والنتيجة",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Create type-safe contracts.",
							ar: "إنشاء عقود آمنة النوع.",
						},
						concept: {
							en: "Clear types make the data flow explicit.",
							ar: "الأنواع الواضحة تجعل تدفق البيانات واضحًا.",
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
				heading: {
					en: "Create pool with workers",
					ar: "إنشاء مجموعة مع عمال",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Initialize worker goroutines.",
							ar: "تهيئة goroutines العمال.",
						},
						concept: {
							en: "Workers run concurrently, each processing jobs from a shared queue.",
							ar: "العمال يعملون بشكل متزامن، كل منهم يعالج المهام من طابور مشترك.",
						},
						implementation: `func NewPool(workers int, fn WorkerFunc) *Pool {
    p := &Pool{
        jobs:    make(chan Job, workers*2),
        results: make(chan Result, workers*2),
        done:    make(chan struct{}),
        workers: workers,
    }
    
    // Start workers
    p.wg.Add(workers)
    for i := 0; i < workers; i++ {
        go p.worker(fn)
    }
    
    // Close results when all workers finish
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
				heading: {
					en: "Add graceful shutdown",
					ar: "إضافة إيقاف تدريجي",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Handle cancellation and cleanup.",
							ar: "التعامل مع الإلغاء والتنظيف.",
						},
						concept: {
							en: "Context signals workers to stop accepting new work.",
							ar: "السياق يشير للعمال بالتوقف عن قبول عمل جديد.",
						},
						implementation: `func (p *Pool) StartWithContext(ctx context.Context) {
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

func (p *Pool) Stop() {
    close(p.jobs)
}

// Usage with signal handling
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
    
    // Submit jobs
    go func() {
        for i := 0; i < 100; i++ {
            pool.Submit(Job{ID: i, Payload: i})
        }
    }()
    
    // Collect results
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
					ar: "Protocol Buffers تحدد عقد الخدمة، ومنها يتم توليد كود الخادم والعميل.",
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
					ar: "لقد بنيت خدمة gRPC تعتمد على العقد أولاً مع دعم interceptors والتدفق.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Define protobuf schema",
					ar: "تحديد مخطط protobuf",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Create the API contract.",
							ar: "إنشاء عقد API.",
						},
						concept: {
							en: "Protobuf defines messages and services in a language-neutral way.",
							ar: "Protobuf يحدد الرسائل والخدمات بطريقة محايدة للغة.",
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
				heading: { en: "Implement server", ar: "تنفيذ الخادم" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Provide business logic.",
							ar: "توفير منطق الأعمال.",
						},
						concept: {
							en: "Generated interfaces ensure contract compliance.",
							ar: "الواجهات المُولدة تضمن الامتثال للعقد.",
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
				heading: { en: "Add interceptors", ar: "إضافة interceptors" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Add cross-cutting concerns.",
							ar: "إضافة اهتمامات مشتركة.",
						},
						concept: {
							en: "Interceptors are gRPC's middleware for unary and streaming calls.",
							ar: "Interceptors هي middleware في gRPC للاستدعاءات الأحادية والمتدفقة.",
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
    
    // Validate token and add claims to context
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
					ar: "معالجات HTTP تعتمد على واجهات المستودع، مع Postgres ينفذ طبقة الوصول للبيانات.",
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
					ar: "لقد بنيت REST API بهندسة نظيفة وفصل مناسب للاهتمامات.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Define repository interface",
					ar: "تحديد واجهة المستودع",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Abstract data access.",
							ar: "تجريد الوصول للبيانات.",
						},
						concept: {
							en: "Interfaces allow swapping implementations for testing.",
							ar: "الواجهات تسمح بتبديل التنفيذات للاختبار.",
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
				heading: {
					en: "Create database migrations",
					ar: "إنشاء ترحيلات قاعدة البيانات",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Version control schema changes.",
							ar: "التحكم في إصدارات تغييرات المخطط.",
						},
						concept: {
							en: "Migrations provide reproducible database setup.",
							ar: "الترحيلات توفر إعداد قاعدة بيانات قابل للتكرار.",
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
				heading: {
					en: "Implement Postgres repository",
					ar: "تنفيذ مستودع Postgres",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Provide concrete database access.",
							ar: "توفير وصول ملموس لقاعدة البيانات.",
						},
						concept: {
							en: "Repository implementations encapsulate all database queries.",
							ar: "تنفيذات المستودع تغلف جميع استعلامات قاعدة البيانات.",
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
				heading: { en: "Build HTTP handlers", ar: "بناء معالجات HTTP" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Handle HTTP requests.",
							ar: "معالجة طلبات HTTP.",
						},
						concept: {
							en: "Handlers depend on interfaces, not concrete implementations.",
							ar: "المعالجات تعتمد على واجهات، وليس على تنفيذات ملموسة.",
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

func (h *TaskHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
    limit := 100
    offset := 0
    
    tasks, err := h.repo.List(r.Context(), limit, offset)
    if err != nil {
        log.Printf("list error: %v", err)
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    
    json.NewEncoder(w).Encode(tasks)
}

func main() {
    repo, err := NewPostgresRepo("postgres://localhost:5432/tasks?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }
    defer repo.Close()
    
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
					ar: "نقاط نهاية التحليل تكشف مقاييس وقت التشغيل، التي يتم تحليلها لتحديد الاختناقات، ثم تحسينها مع مقاييس أداء تثبت التحسينات.",
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
					ar: "لقد بنيت مجموعة أدوات تحليل تمكن تحسين الأداء المعتمد على البيانات مع نتائج قابلة للقياس.",
				},
			},
		],

		steps: [
			{
				n: "01",
				heading: {
					en: "Add pprof to your service",
					ar: "إضافة pprof إلى خدمتك",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Expose runtime profiling endpoints.",
							ar: "كشف نقاط نهاية تحليل وقت التشغيل.",
						},
						concept: {
							en: "pprof provides built-in profiling through HTTP endpoints.",
							ar: "pprof يوفر تحليلًا مدمجًا عبر نقاط نهاية HTTP.",
						},
						implementation: `package main

import (
    "log"
    "net/http"
    _ "net/http/pprof" // registers /debug/pprof/ endpoints
)

func main() {
    // Your normal server
    mux := http.NewServeMux()
    mux.HandleFunc("/api/work", workHandler)

    // pprof endpoints are registered on DefaultServeMux
    // Run on a separate port — never expose to the internet without auth
    go func() {
        log.Println("pprof listening on :6060")
        log.Fatal(http.ListenAndServe(":6060", nil))
    }()

    log.Fatal(http.ListenAndServe(":8080", mux))
}

// Now you can profile:
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
							en: "Never expose pprof endpoints to the internet without authentication! They can reveal sensitive information about your service.",
							ar: "لا تكشف نقاط نهاية pprof للإنترنت أبدًا دون مصادقة! يمكنها كشف معلومات حساسة عن خدمتك.",
						},
					},
				],
			},
			{
				n: "02",
				heading: { en: "Write benchmarks", ar: "كتابة مقاييس أداء" },
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Measure performance with repeatable benchmarks.",
							ar: "قياس الأداء بمقاييس أداء قابلة للتكرار.",
						},
						concept: {
							en: "Benchmarks provide stable, reproducible performance measurements.",
							ar: "مقاييس الأداء توفر قياسات أداء مستقرة وقابلة للتكرار.",
						},
						implementation: `package processor

import (
    "testing"
)

// generateTestItem creates a realistic test payload
func generateTestItem() *Item {
    return &Item{
        ID:   "test-123",
        Data: make([]byte, 1024),
    }
}

// Basic benchmark
func BenchmarkProcessItem(b *testing.B) {
    item := generateTestItem()
    
    b.ResetTimer() // exclude setup time
    
    for i := 0; i < b.N; i++ {
        ProcessItem(item)
    }
}

// Parallel benchmark
func BenchmarkProcessItemParallel(b *testing.B) {
    item := generateTestItem()
    
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            ProcessItem(item)
        }
    })
}

// Sub-benchmarks for different input sizes
func BenchmarkProcessItemSizes(b *testing.B) {
    sizes := []int{10, 100, 1000, 10000}
    
    for _, size := range sizes {
        b.Run(fmt.Sprintf("size-%d", size), func(b *testing.B) {
            item := &Item{
                ID:   "test",
                Data: make([]byte, size),
            }
            
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                ProcessItem(item)
            }
        })
    }
}

// Run with:
// go test -bench=. -benchmem -count=5 | tee bench.txt
//
// Output:
// BenchmarkProcessItem-8          1234567    890 ns/op    128 B/op    3 allocs/op
// BenchmarkProcessItemParallel-8  3456789    345 ns/op    128 B/op    3 allocs/op
//
// Compare benchmarks:
// go get golang.org/x/perf/cmd/benchstat
// benchstat bench.txt`,
						filename: "processor_test.go",
					},
					{
						type: "text",
						value: {
							en: "The `-benchmem` flag is crucial — allocations often impact performance more than CPU time. Always run benchmarks multiple times (`-count=5`) for statistical significance.",
							ar: "علامة `-benchmem` حاسمة - التخصيصات غالبًا تؤثر على الأداء أكثر من وقت المعالج. شغل مقاييس الأداء دائمًا عدة مرات (`-count=5`) للدلالة الإحصائية.",
						},
					},
				],
			},
			{
				n: "03",
				heading: {
					en: "Find and fix allocation hotspots",
					ar: "ابحث عن نقاط التخصيص الساخنة وأصلحها",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Identify and eliminate unnecessary allocations.",
							ar: "تحديد وإزالة التخصيصات غير الضرورية.",
						},
						concept: {
							en: "Memory profiling reveals allocation patterns and optimization opportunities.",
							ar: "تحليل الذاكرة يكشف أنماط التخصيص وفرص التحسين.",
						},
						implementation: `package query

import (
    "strings"
    "sync"
)

// BAD: Allocates new strings.Builder each call
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

// GOOD: Pre-allocate with known capacity
func buildQueryGood(filters []string) string {
    if len(filters) == 0 {
        return "SELECT * FROM items"
    }
    
    // Estimate capacity to avoid reallocations
    // WHERE clause + filters + AND separators
    capacity := len("SELECT * FROM items WHERE ") + 
                len(filters[0]) + 
                (len(filters)-1)*len(" AND ")
    
    var sb strings.Builder
    sb.Grow(capacity)
    
    sb.WriteString("SELECT * FROM items WHERE ")
    sb.WriteString(strings.Join(filters, " AND "))
    
    return sb.String()
}

// BEST: Use sync.Pool for hot paths
var builderPool = sync.Pool{
    New: func() any { 
        return &strings.Builder{} 
    },
}

func buildQueryPooled(filters []string) string {
    if len(filters) == 0 {
        return "SELECT * FROM items"
    }
    
    sb := builderPool.Get().(*strings.Builder)
    defer builderPool.Put(sb)
    
    sb.Reset()
    
    // Estimate capacity
    capacity := len("SELECT * FROM items WHERE ") + 
                len(filters[0]) + 
                (len(filters)-1)*len(" AND ")
    sb.Grow(capacity)
    
    sb.WriteString("SELECT * FROM items WHERE ")
    sb.WriteString(strings.Join(filters, " AND "))
    
    return sb.String()
}

// Benchmark results:
// BenchmarkBuildQueryBad-8     500000   3124 ns/op   1536 B/op   8 allocs/op
// BenchmarkBuildQueryGood-8   2000000    845 ns/op    512 B/op   2 allocs/op
// BenchmarkBuildQueryPooled-8 3000000    456 ns/op    512 B/op   2 allocs/op`,
						filename: "query.go",
					},
					{
						type: "code",
						value: `# Profile memory allocations
go tool pprof -alloc_space http://localhost:6060/debug/pprof/heap

# In pprof interactive mode:
(pprof) top
(pprof) list buildQuery
(pprof) web

# Generate flamegraph
go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30

# Check for data races
go test -race ./...

# View runtime metrics
curl http://localhost:6060/debug/pprof/heap?debug=1`,
						filename: "analysis_commands.sh",
					},
				],
			},
			{
				n: "04",
				heading: {
					en: "Advanced profiling techniques",
					ar: "تقنيات تحليل متقدمة",
				},
				blocks: [
					{
						type: "structured",
						intent: {
							en: "Use advanced tools to deep-dive into performance.",
							ar: "استخدم أدوات متقدمة للغوص عميقًا في الأداء.",
						},
						concept: {
							en: "Combining multiple profiling techniques provides a complete performance picture.",
							ar: "دمج تقنيات تحليل متعددة يوفر صورة أداء كاملة.",
						},
						implementation: `package main

import (
    "log"
    "runtime"
    "runtime/debug"
    "time"
)

func monitorRuntime() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    var m runtime.MemStats
    
    for range ticker.C {
        runtime.ReadMemStats(&m)
        
        log.Printf("=== Runtime Stats ===")
        log.Printf("Goroutines: %d", runtime.NumGoroutine())
        log.Printf("Heap: %d MB", m.HeapAlloc/1024/1024)
        log.Printf("Stack: %d MB", m.StackInuse/1024/1024)
        log.Printf("GC Cycles: %d", m.NumGC)
        log.Printf("GC Pause: %v", time.Duration(m.PauseNs[(m.NumGC+255)%256]))
    }
}

// Trace execution
import _ "runtime/trace"

func traceExecution() {
    f, _ := os.Create("trace.out")
    defer f.Close()
    
    trace.Start(f)
    defer trace.Stop()
    
    // Your code here
}

// Use GODEBUG for additional insights
// GODEBUG=gctrace=1,schedtrace=1000 ./myapp
//
// Output:
// gc 1 @0.001s 2%: 0.010+1.2+0.020 ms clock, 0.080+0.33/1.0/0.77+0.16 ms cpu
// SCHED 0ms: gomaxprocs=8 idleprocs=6 threads=5 spinningthreads=1 idlethreads=0`,
						filename: "runtime_monitor.go",
					},
					{
						type: "list",
						items: [
							{
								en: "**CPU Profile**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30`",
								ar: "**تحليل المعالج**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30`",
							},
							{
								en: "**Memory Profile**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/heap`",
								ar: "**تحليل الذاكرة**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/heap`",
							},
							{
								en: "**Goroutine Profile**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/goroutine`",
								ar: "**تحليل Goroutines**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/goroutine`",
							},
							{
								en: "**Block Profile**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/block`",
								ar: "**تحليل الحظر**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/block`",
							},
							{
								en: "**Mutex Profile**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/mutex`",
								ar: "**تحليل Mutex**: `go tool pprof -http=:8081 http://localhost:6060/debug/pprof/mutex`",
							},
						],
					},
					{
						type: "callout",
						variant: "info",
						value: {
							en: "The `-http` flag opens an interactive web UI where you can explore flamegraphs, call graphs, and source views.",
							ar: "علامة `-http` تفتح واجهة ويب تفاعلية حيث يمكنك استكشاف رسومات اللهب ورسومات الاستدعاء وعروض المصدر.",
						},
					},
				],
			},
		],

		fromOtherLang: {
			en: "Coming from Python: profiling in Go is built into the standard library — no third-party profilers needed. `pprof` is as powerful as `cProfile` but with better visualization tools. Coming from Java: no JVM overhead, no JIT warmup to account for — Go benchmarks are stable and reproducible from the first run. The `-benchmem` flag is unique to Go and critical for understanding allocation patterns.",
			ar: "قادماً من Python: التحليل في Go مبني في المكتبة القياسية - لا حاجة لمحللات طرف ثالث. `pprof` بقوة `cProfile` ولكن مع أدوات تصور أفضل. قادماً من Java: لا overhead لـ JVM، لا إحماء JIT لحسابه - مقاييس أداء Go مستقرة وقابلة للتكرار من أول تشغيل. علامة `-benchmem` فريدة لـ Go وحاسمة لفهم أنماط التخصيص.",
		},
	},
]

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug)
}

export function getProjectsByTier(tier: 1 | 2 | 3): Project[] {
	return projects.filter((p) => p.tier === tier)
}
