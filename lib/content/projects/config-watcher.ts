import { Project } from "../../content"

export const configWatcher: Project = {
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
				en: "A watcher goroutine receives file system events. Rapid successive events (editors write in bursts) are collapsed by a debounce timer. When quiet for 200ms, the new config is parsed and stored atomically. HTTP handlers call Load(): one pointer dereference, no lock, never blocked by a reload.",
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
			uses: ["select","goroutines","context"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "select waits on multiple channels simultaneously. It blocks until one case is ready, then executes exactly that case. If multiple are ready simultaneously, one is chosen at random. It is Go's answer to 'wait for whichever event arrives first', the foundation of every event loop.",
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
						en: "A health checker selects over a ticker (fires every 30s to ping a service), an error channel (fires when a ping fails beyond threshold), and ctx.Done() (fires on SIGINT). The loop body runs only one case per iteration: exactly whichever arrived first.",
					},
					task: {
						en: "Write the core goroutine for your watcher. It should select over: watcher.Events (file system events), watcher.Errors (log and continue), and ctx.Done() (return to exit the goroutine). Use github.com/fsnotify/fsnotify for the watcher. For now just log events; debounce comes next.",
					},
				},
			],
		},
		{
			n: "02",
			heading: { en: "Debounce rapid file events" },
			uses: [],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "Most editors write a file in multiple syscall bursts; you may receive 10 events in 50ms for a single save. Without debouncing you reload config 10 times unnecessarily. time.AfterFunc fires a callback once after a delay. On each new event: stop the existing timer (if any) and create a new one. Only when no events arrive for the full window does the callback execute.",
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
						en: "A search-as-you-type box debounces keystrokes: each keypress stops the previous timer and starts a fresh 300ms one. The API call fires only after the user pauses typing, not on every keystroke.",
					},
					task: {
						en: "Add debouncing to your event loop. When a Write or Create event arrives, stop any existing timer and start a new 200ms timer whose callback calls reload(path, store, notify). reload() must: call loadFromFile, log and return on error keeping the old config, call store.store() with the new config, and send a non-blocking signal on notify.",
					},
					hints: [
						{
							label: "non-blocking send",
							value: "select { case notify <- struct{}{}: default: }. If notify is full, skip. Subscribers that weren't listening miss this notification, which is fine.",
						},
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "Store config with atomic.Value" },
			uses: [],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "sync/atomic.Value stores and loads a value atomically: one machine instruction, no mutex, no contention on the read path. The rule: always store the same concrete type, and store a pointer (*Config), never a value (Config). Load returns interface{}; type-assert it. This is the right tool when reads vastly outnumber writes and the entire value is replaced atomically.",
					},
					pattern: `var v atomic.Value

// writer — rare
v.Store(&Config{Port: 8080})

// reader — happens on every request, no lock
cfg := v.Load().(*Config)
fmt.Println(cfg.Port)`,
					example: {
						en: "A feature flag service stores *FlagSet atomically. Thousands of concurrent HTTP handlers call Load() on every request with no mutex. When flags update once per minute, a background goroutine calls Store with the new pointer: one atomic write, zero reader contention.",
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
			uses: [],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "A benchmark is named BenchmarkXxx, takes *testing.B, and runs the code b.N times. The framework adjusts b.N until the total time is stable. Call b.ResetTimer() after setup so setup cost is excluded. b.RunParallel spins up GOMAXPROCS goroutines: essential for seeing contention differences between atomic and mutex implementations.",
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
						en: "The Go team benchmarked sync.Map vs map+RWMutex for read-heavy and write-heavy workloads with RunParallel. The results (sync.Map wins at high read-to-write ratios, loses on write-heavy) drove the documentation guidance on when to use each.",
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
							"On an M1 Mac with GOMAXPROCS=8: atomic ~1.2 ns/op, RWMutex ~22 ns/op. The gap widens with more goroutines because atomic has zero contention; every RLock still touches the mutex's memory, invalidating cache lines shared across cores.",
						hints: [
							{
								label: "why RunParallel",
								value: "A serial benchmark (b.N loop, no RunParallel) shows similar results for both; there's no contention when only one goroutine runs. RunParallel reveals the difference.",
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
				en: "You learned select (the channel multiplexer), debouncing (time.AfterFunc in a real pattern), and atomic.Value (lock-free reads). You wrote your first benchmark and proved with data which implementation is faster. These three (select, atomic, benchmarks) appear in every T2 and T3 project.",
			},
		},
	],
}
