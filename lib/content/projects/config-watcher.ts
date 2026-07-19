import { Project } from "../../content"

export const configWatcher: Project = {
	slug: "config-watcher",
	name: "Live config reloader",
	tagline:
		"Watch a config file for changes and reload without restarting the process.",
	code: "CFG",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "9–11 hours",
	tags: ["select", "atomic", "time", "goroutines", "benchmarks"],
	lab: {
		path: "labs/config-watcher",
		command: "go test ./...",
		summary: {
			en: "Grades the debounce from step 02 and both stores from steps 04 and 06 against one suite, benchmarks atomic.Value against sync.RWMutex under parallel load, and gates on the atomic version being strictly faster.",
		},
	},
	mentalModels: [
		"select as a channel multiplexer",
		"debounce with time.AfterFunc",
		"immutable snapshots, swapped rather than mutated",
		"atomic swap for lock-free reads",
		"benchmark-driven design decisions",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Every long-running service has a config, and every config eventually has to change. The cheap answer is to restart the process, which is fine until the process is holding connections, a cache, or a leader election. The alternative is to change the config underneath the running program, and the moment you try, you are holding a shared value that one goroutine writes and every other goroutine reads. That is the actual subject of this project. The file watching is the excuse.",
			},
		},
		{
			type: "text",
			value: {
				en: "A watcher goroutine receives file system events. Rapid successive events (editors write in bursts) are collapsed by a debounce timer. When quiet for 200ms, the file is parsed into a brand new Config, and only a successful parse replaces the stored one. HTTP handlers call Load(): one pointer read, no lock, never blocked by a reload.",
			},
		},
		{
			type: "code",
			value: `fsnotify event → select → debounce timer → reload() → atomic.Value.Store
                                              ↑ ctx.Done() exits the loop`,
		},
		{
			type: "text",
			value: {
				en: "Two rules hold the whole design up, and both are one sentence long. A Config is never mutated after it is stored. A reload that fails changes nothing. Steps 03 and 05 are those two sentences; the rest of the project is machinery around them.",
			},
		},
	],
	architecture: [
		{
			type: "code",
			value: `main.go            signal.NotifyContext, wire it up, wait for the watcher
config/
 ├── config.go     Config struct, loadFromFile(path) (*Config, error)
 ├── debounce.go   Debounce(ctx, events, window, fire)
 ├── store.go      Store{atomic.Value}, Load() *Config, store(*Config)
 ├── watcher.go    Watch(ctx, path, store, notify) via fsnotify
 └── server.go     GET /config handler, calls Load() per request`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Multiplex the event loop with select" },
			uses: ["select", "goroutines", "context"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A watcher is a loop that waits. Write it the obvious way, waiting on the event channel, and that single choice decides the rest of the program: fsnotify reports its failures on a second channel you are not reading, and there is no way to tell the loop to stop, because a goroutine parked on a receive is not checking anything else. Shutdown becomes kill the process. select is what turns one blocking receive into a loop that can hear all three things.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "select waits on several channels at once. It blocks until one case is ready, runs exactly that case, and if several are ready it picks one at random. The randomness is deliberate: a fixed order would let a busy channel starve a quiet one, so there is no case priority in Go and no way to ask for it. Underneath, the runtime puts the goroutine on the wait queue of every channel in the select, and the first send or close wakes it and removes it from the others. That is the whole reason select exists: it is the only way one goroutine waits on more than one thing.",
					},
					pattern: `// wait on whichever channel fires first
select {
case event := <-watcher.Events:
    handle(event)
case err := <-watcher.Errors:
    log.Println("watcher error:", err) // report and keep going
case <-ctx.Done():
    return // clean shutdown
}`,
					example: {
						en: "A health checker selects over a ticker (fires every 30s to ping a service), an error channel (fires when a ping fails beyond threshold), and ctx.Done() (fires on SIGINT). The loop body runs only one case per iteration: exactly whichever arrived first.",
					},
					task: {
						en: "Write the watcher goroutine. Select over watcher.Events, watcher.Errors (log and continue, do not return), and ctx.Done() (return). Use github.com/fsnotify/fsnotify. For now just log the events; the debounce comes next. In main, build the context with signal.NotifyContext(context.Background(), os.Interrupt) so Ctrl-C cancels it, and do not let main return until the watcher goroutine has actually finished: start it with a done channel, close that channel when Watch returns, and receive from it after ctx.Done().",
					},
					hints: [
						{
							label: "why Errors is a separate channel",
							value: "fsnotify cannot return an error from a channel receive, so it gives you two channels and lets you decide. Most watcher errors are per-event and survivable (a file vanished mid-notify), which is why the case logs and continues rather than returning. A loop that returns on the first error stops watching forever because of one bad event.",
						},
						{
							label: "signal.NotifyContext",
							value: "Returns a ctx that cancels on the named signals, plus a stop func to release the handler. It is the two-line version of the signal.Notify boilerplate, and it means shutdown reaches your goroutine through the same ctx.Done() case as any other cancellation. defer stop().",
						},
						{
							label: "why wait for the goroutine",
							value: "Cancelling a context asks a goroutine to stop. It does not wait for it. If main returns immediately after cancelling, the process exits and you never find out whether your loop was capable of stopping at all. The done channel is what makes the next break-it visible instead of theoretical.",
						},
					],
				},
				{
					type: "verify",
					where: "your project repo",
					command: `# terminal 1
go run .

# terminal 2
touch config.json

# back in terminal 1, once the events appear:
# press Ctrl-C`,
					expect: {
						en: "Terminal 1 logs at least one event line from a single touch, and usually two or three. That is not a bug in your loop, it is the problem step 02 exists to solve. Ctrl-C then exits within milliseconds. If it hangs instead, the select is not reaching ctx.Done(), and the next block is about why.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Replace the whole select with for event := range watcher.Events { handle(event) }, dropping the Errors and ctx.Done() cases. Run it again and press Ctrl-C once.",
					},
					observe: {
						en: "Ctrl-C does nothing visible. The context is cancelled, your shutdown path is waiting on the done channel, and the process just sits there. It takes a second Ctrl-C to kill it.",
					},
					why: {
						en: "for x := range ch compiles to a blocking receive in a loop. A goroutine blocked on a receive is parked: the runtime takes it off the run queue and puts it on that channel's wait queue, and only a send on that channel or a close of it will ever move it back. Cancelling a context closes a different channel, the one ctx.Done() returns, and nobody is on its wait queue. The goroutine is not slow to notice the cancellation. It cannot notice. It is not running, and it will not run again until fsnotify sends an event, which is why touching the file once makes the process finally exit and is the detail that turns this into a bug that only bites in production, where nothing touches the file for hours. select is the only construct that puts one goroutine on several wait queues at once, which is why every Go loop that must be stoppable is built on it.",
					},
				},
			],
			retrievalPrompt:
				"Your watcher goroutine is blocked in for e := range watcher.Events. You cancel its context. When does it notice? || Never, or rather not until the next event happens to arrive on that one channel. A goroutine blocked on a receive is parked on that channel's wait queue, and only a send or a close there can wake it. Cancelling a context closes a different channel that nobody is waiting on. select is what puts the goroutine on several wait queues at once.",
		},
		{
			n: "02",
			heading: { en: "Collapse the burst with a debounce" },
			uses: ["select", "channels"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Save the file in your editor and count the events from step 01. You will not get one. Depending on the editor you get three, five, or a dozen: a truncate, one or more writes, a chmod, often a rename as the editor swaps a temp file into place. Reload on each and you parse the same file five times to reach the same answer. That is the boring half. The interesting half is that some of those events fire while the editor is still writing, so you are parsing a file that is genuinely, temporarily, invalid.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A debounce turns a burst into one event by refusing to act until things go quiet. Keep one timer. Every event stops the pending timer and starts a fresh one, so the clock restarts on each event and only a full window of silence lets the callback run. time.AfterFunc is the whole implementation: it registers a timer with the runtime and runs your function when the deadline arrives. Note where it runs it: on its own goroutine, not on the loop's. Your callback is concurrent with the loop that scheduled it, which is the first reason store(*Config) has to be safe for concurrent use rather than merely correct.",
					},
					pattern: `var timer *time.Timer

for {
    select {
    case <-ctx.Done():
        if timer != nil {
            timer.Stop() // do not let a reload land after shutdown
        }
        return
    case <-events:
        if timer != nil {
            timer.Stop() // cancel the previous deadline
        }
        // restart the clock; only silence lets this run
        timer = time.AfterFunc(200*time.Millisecond, fire)
    }
}`,
					example: {
						en: "A search-as-you-type box debounces keystrokes: each keypress stops the previous timer and starts a fresh 300ms one. The API call fires only after the user pauses typing, not on every keystroke.",
					},
					task: {
						en: "Implement Debounce(ctx, events <-chan struct{}, window time.Duration, fire func()) in labs/config-watcher/config/debounce.go. Every event restarts the window; a burst of any length produces exactly one fire; ctx cancellation returns and leaves no pending timer able to fire afterwards. Then wire it into your watcher: forward Write and Create events into the events channel, and pass a closure that calls reload(path, store, notify) as fire.",
					},
					hints: [
						{
							label: "why Debounce does not take an fsnotify channel",
							value: "It takes a plain <-chan struct{} so it can be tested in milliseconds without producing real file system events. That is not a lab convenience: a debounce that names its trigger can only be tested by triggering it. Separating the timer logic from its event source is what makes it checkable, and it is how you would write it anyway.",
						},
						{
							label: "Stop returns a bool",
							value: "It reports false if the timer had already fired, meaning a reload is already running on another goroutine. Harmless here, because that reload reads the file as it is now and the next event arms a fresh timer regardless. It would matter if fire were expensive or unsafe to overlap with itself.",
						},
						{
							label: "non-blocking notify",
							value: "select { case notify <- struct{}{}: default: }. If nobody is listening, skip it. A reload must never block because a subscriber went away.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command: "go test -run TestDebounce ./...",
					expect: {
						en: "Both debounce tests pass in about a second. Until Debounce does something, TestDebounceCollapsesBurst fails with \"debounce never fired: once the burst goes quiet for a full window, the timer must run fire\". The tests assert counts, never wall-clock precision, so they hold on a loaded machine.",
					},
					labPath: "labs/config-watcher/config/debounce_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the timer.Stop() from the event case, keeping the one in the shutdown path, so every event just assigns a fresh timer over the old variable. Rerun the test.",
					},
					observe: {
						en: 'TestDebounceCollapsesBurst fails with "debounce fired more than once for a single burst: each event must stop the pending timer before starting a new one". Five events produced five reloads.',
					},
					why: {
						en: "time.AfterFunc does not hand you a slot you can overwrite. It registers a timer with the runtime and returns a *Timer that refers to that registration. Assigning a new *Timer to your variable drops your reference and does nothing to the registration: the runtime still holds it, so it is not garbage either, and when its deadline arrives it runs fire on a fresh goroutine exactly as scheduled. Five events with no Stop means five live registrations, and you get five reloads a few milliseconds apart, in the order the events arrived. Stop is the only thing that takes a timer back out of the runtime's timer heap. This is the same shape as the leak in a select loop that calls time.After on every iteration: the timer you stopped caring about is not the same as the timer that stopped existing.",
					},
				},
			],
			retrievalPrompt:
				"You debounce by writing timer = time.AfterFunc(window, fire) on every event, with no Stop. What happens? || One fire per event, which is exactly what you were trying to prevent. Assigning over the variable drops your reference to the old timer but does not cancel it: the runtime's timer heap still holds the registration and still runs fire on schedule. Only timer.Stop() removes it.",
		},
		{
			n: "03",
			heading: { en: "Refuse to install a config that did not parse" },
			uses: ["error-handling", "json-decode"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Two things guarantee you will parse a broken file. People make typos, and your debounce window can expire while an editor is still mid-write. A reload that installs whatever it just parsed turns both into an outage: a trailing comma at 2am takes down a service that was running perfectly with a config it already had in memory. The config you are serving is good. The file on disk is a proposal, and a proposal has to be accepted before it replaces anything.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "Parse into a brand new value, and let the store call be the commit point: the single line where the new config becomes the live one, reached only when everything before it succeeded. Go hands you (*Config, error) precisely so you can make that decision. When err is non-nil the other return value is meaningless, and here it is nil, which is worse than meaningless because storing it succeeds. The failure path is one log line and a return, and the running config is untouched because you never touched it.",
					},
					pattern: `func reload(path string, store *Store, notify chan<- struct{}) {
    cfg, err := loadFromFile(path) // a NEW *Config, or nil
    if err != nil {
        // the running config is still good: keep serving it
        log.Printf("config reload failed, keeping previous: %v", err)
        return
    }
    store.store(cfg) // the commit point: nothing before here is visible

    select {
    case notify <- struct{}{}:
    default:
    }
}`,
					example: {
						en: "nginx -t is the same idea with the decision handed to the operator: nginx parses the new config into a fresh structure and reports what is wrong, and a reload that fails validation leaves the running workers on the old config rather than dropping traffic.",
					},
					task: {
						en: "Write loadFromFile(path string) (*Config, error): read the file, json.Unmarshal it into a fresh Config, and wrap any error with the path using %w. Then write reload as above. A parse failure must log once and return without calling store. Prove to yourself that the running config survives before you move on.",
					},
					hints: [
						{
							label: "validate here too, not just parse",
							value: 'Valid JSON is not a valid config. {"port": 0} parses fine and is useless. This is the same boundary check the CLI project made against its flags: the difference is that this boundary is crossed again on every reload, so the check has to live in loadFromFile rather than in main.',
						},
						{
							label: "a missing file is not a permanent failure",
							value: "Editors that write via a temp file and rename can leave the path briefly absent. Log it and keep watching; the rename that follows fires another event and the next reload succeeds. Exiting on one failed read is how a watcher dies on a file that is fine two milliseconds later.",
						},
					],
				},
				{
					type: "verify",
					where: "your project repo",
					command: `go run . &
curl -s localhost:8080/config          # the good config

printf 'this is not json' > config.json
curl -s localhost:8080/config          # must be identical

printf '{"port":8080,"log_level":"debug"}' > config.json
curl -s localhost:8080/config          # now it changes`,
					expect: {
						en: "The second curl returns byte for byte what the first one did, and the log has exactly one \"config reload failed, keeping previous\" line naming the parse error. The third shows log_level debug. A broken file became a log line instead of an outage, which is the entire feature.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Move store.store(cfg) above the error check so it runs unconditionally, then write garbage into config.json again and curl /config.",
					},
					observe: {
						en: 'curl reports "Empty reply from server", not a 500. Your log has "http: panic serving 127.0.0.1:NNNNN: runtime error: invalid memory address or nil pointer dereference" and a stack trace. Every request fails the same way until you fix the file. The process itself stays up.',
					},
					why: {
						en: "loadFromFile returned (nil, err), so you stored a nil *Config. Notice what did not happen: no panic at the store. atomic.Value rejects an untyped nil, but a typed nil pointer is a perfectly good *Config value, so the store succeeds silently and Load dutifully returns nil to every handler. The failure surfaces later, on a different goroutine, on the read path, which is why the stack trace points at your handler and not at the bug. net/http recovers panics per connection: it logs, then closes the connection without writing a response, which is why curl sees an empty reply rather than a 500 and why the process survives to fail again on the next request. The error check is not there to be tidy. It is the difference between a reload that failed and a service that returns nothing.",
					},
				},
			],
			retrievalPrompt:
				"A reload parses a broken file and stores the result without checking the error. atomic.Value does not panic. Why not, and where does it go wrong? || Because loadFromFile returned a nil *Config, and a typed nil pointer is a legitimate value to store; only an untyped nil is rejected. So the store succeeds and Load returns nil to every reader. It fails on the read path, in a handler, on another goroutine, far from the line that caused it.",
		},
		{
			n: "04",
			heading: { en: "Hold the config in an atomic.Value" },
			uses: ["pointers"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Count the traffic on each side of this value. Every HTTP request reads the config, so reads happen thousands of times a second. Writes happen when a human edits a file, so call it twice a day. The obvious tool is a mutex, and a mutex makes every one of those thousands of reads pay a coordination cost for a write that almost never comes. atomic.Value is the tool for exactly this shape: replace the whole value at once, and let readers take it for the price of reading a pointer.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "sync/atomic.Value holds one value and swaps it atomically. Load is a pointer read, with no lock word touched and nothing for readers to contend over, so a reload can never block a request. Two rules come with it, both enforced at runtime rather than by the compiler. Always store the same concrete type: store a Config once and a *Config later and the second store panics. And store a pointer, not the struct, because the swap is only atomic for one word. Load returns any, so you type-assert it back, and that assertion is why the value must exist before the first Load.",
					},
					pattern: `type Store struct {
    v atomic.Value
}

// The constructor stores, so Load can never run against an empty Value.
func NewStore(initial *Config) *Store {
    s := &Store{}
    s.v.Store(initial)
    return s
}

// The hot path: one atomic pointer read, one type assertion.
func (s *Store) Load() *Config {
    return s.v.Load().(*Config)
}

// Called by reload(), roughly never.
func (s *Store) store(c *Config) {
    s.v.Store(c)
}`,
					example: {
						en: "A feature flag service stores *FlagSet atomically. Thousands of concurrent handlers call Load on every request with no lock. When flags change once a minute, a background goroutine stores the new pointer: one write, and not one reader waits for it.",
					},
					task: {
						en: "Implement Store, NewStore, Load, and store in labs/config-watcher/config/store.go. Then wire it into your program: build the first Config at startup and pass it to NewStore before you start the watcher, and add a GET /config handler that calls Load and writes the port and log level as plain text.",
					},
					hints: [
						{
							label: "why store is lowercase",
							value: "Only reload has any business replacing the config. Exporting a setter invites a handler to write config on a request, which is the shape this design exists to prevent. Load is exported, store is not: readers are everyone, writers are one goroutine you can name.",
						},
						{
							label: "the type assertion is the contract",
							value: "s.v.Load().(*Config) panics if anything else was ever stored. That looks fragile and is actually the point: the panic is immediate, on the first Load, at the line that broke the rule. A silently wrong type would be a bug you find in a month.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command: "go test -run '(TestLoad|TestStore|TestConcurrent)/atomic' ./...",
					expect: {
						en: "The three atomic subtests pass and nothing else runs. The filter is deliberate: the suite is a table over both stores, MutexStore does not exist until step 06, and its subtests would fail right now if you let them run. That is progress, not breakage. Drop the /atomic once you have both.",
					},
					labPath: "labs/config-watcher/config/store_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the s.v.Store(initial) line from NewStore, so it returns &Store{} and nothing else. Rerun the same command.",
					},
					observe: {
						en: "A panic, not a failed assertion: \"interface conversion: interface {} is nil, not *config.Config\", pointing at the type assertion inside Load.",
					},
					why: {
						en: "The zero value of an atomic.Value holds a nil interface, and a nil interface has no dynamic type at all. A type assertion asks what type is in there, gets nothing, and panics. This is a place where Go's design chose the loud failure: the alternative, .(*Config) quietly yielding a nil *Config, would hand every reader a nil pointer to dereference somewhere else entirely, which is precisely the confusing failure you just produced by hand in step 03. Storing in the constructor is not defensive habit. It is the only way to make Load's assertion an invariant instead of a hope, and it is why NewStore takes the initial config as a parameter rather than offering a Store you fill in later.",
					},
				},
			],
			retrievalPrompt:
				"Why must NewStore store the initial config, rather than leaving the atomic.Value empty for the first reload to fill? || Because an empty atomic.Value holds a nil interface, and Load's .(*Config) assertion panics on it: a nil interface has no dynamic type. Storing in the constructor makes the assertion an invariant, so no Load can ever run before a config exists.",
		},
		{
			n: "05",
			heading: { en: "Never mutate what you have already stored" },
			uses: ["pointers", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The swap is atomic. The thing it points at is not. Nothing in Go stops you writing cfg := store.Load(); cfg.Port = 9090, and the compiler will not say a word, and it will look right in testing on your laptop. This is the one rule the design rests on, and it is the one rule nothing in the language enforces for you.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "Treat a stored Config as frozen the instant it goes in. Readers hold a snapshot that stays valid for as long as they hold it; a reload builds a new Config and swaps the pointer, and the old one keeps serving whoever was mid-request. Nobody coordinates, because there is nothing to coordinate: one word changes, and every reader sees either the old pointer or the new one, never a mixture. The moment anything writes through a stored pointer, that guarantee is gone and you have a data race that no amount of atomic on the pointer can fix.",
					},
					pattern: `// Right: build a new one, swap the pointer.
cfg, err := loadFromFile(path)
if err != nil {
    return
}
store.store(cfg)

// Wrong: the same three fields, written into a config
// that eight goroutines are reading right now.
cur := store.Load()
cur.Port = newPort
cur.LogLevel = newLevel`,
					example: {
						en: "This is copy-on-write, the same bargain the kernel makes when it forks a process: readers share one immutable page until somebody needs a change, and the change produces a new page rather than editing the shared one. Cheap reads, and the cost lands on the writer, who is rare.",
					},
					task: {
						en: "Read your reload and your handler and prove nothing writes to a Config after it has been stored. Then confirm the suite agrees: TestStoreReplacesConfig checks that a replace leaves the previous config untouched, and TestConcurrentLoadStore hammers Load from eight goroutines while the writer replaces the config a thousand times.",
					},
					hints: [
						{
							label: "how the suite detects a torn read",
							value: 'Every snapshot has Port n and LogLevel "vn", derived from the same n. A reader that ever sees Port and LogLevel disagreeing is holding a config nobody ever built. That is the only way to catch this without a race detector, and it is why the two fields are correlated on purpose.',
						},
						{
							label: "if you truly need to change one field",
							value: "Copy the struct, change the copy, store the copy: c := *store.Load(); c.Port = p; store.store(&c). One allocation on a path that runs twice a day, and the rule survives.",
						},
						{
							label: "do not defend by copying on read",
							value: "Returning a copy from Load looks safe and fails TestLoadReturnsInitialConfig, which compares addresses: the failure prints two configs that look identical and differ only in %p. Load returns the stored pointer. Readers do not need protecting from a value nobody writes to.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command:
						"go test -run '(TestStore|TestConcurrent)/atomic' ./...\n\n# and, if you have a C toolchain (see the break-it):\ngo test -race -run '(TestStore|TestConcurrent)/atomic' ./...",
					expect: {
						en: "Both pass, and stay passing under -race if you can run it. Passing here is not the interesting part, because correct code and code that has not been caught yet look identical. The break-it is the part that teaches.",
					},
					labPath: "labs/config-watcher/config/store_test.go",
					note: {
						en: "-race needs cgo. A stock Windows Go install with no C compiler answers \"go: -race requires cgo; enable cgo by setting CGO_ENABLED=1\". On Linux or macOS it works out of the box. If you cannot run it, the failures below still appear without it: this suite is built to catch the bug either way.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Make store mutate instead of swap: cur := s.v.Load().(*Config); cur.Port = c.Port; cur.LogLevel = c.LogLevel. Rerun the command above, first without -race, then with it if you can.",
					},
					observe: {
						en: 'Two failures without -race. TestStoreReplacesConfig says "store mutated the previous config in place". TestConcurrentLoadStore says something like: torn read: Port=856 but LogLevel="v858". Read that line twice. A goroutine observed a config with the port from the 856th write and the log level from the 858th, a config that no code ever constructed. Under -race you additionally get WARNING: DATA RACE, naming the write in store and the read in the test, with both goroutine stacks.',
					},
					why: {
						en: "A Config is at least three words on a 64-bit machine: an int, and a string that is a pointer plus a length. Writing it is three stores. No instruction writes a whole Config at once, which is exactly why the design swaps a one-word pointer instead of assigning a struct. Mutating in place puts those three stores in the middle of eight goroutines reading the same three words, and the torn read is the visible result: a reader landing between two of them sees a value that never existed. The invisible half is worse. With no synchronizing operation between the write and the read there is no happens-before relationship, and the memory model then promises nothing at all about when the reader sees the new value: not late, not eventually, never. The compiler is free to hoist the read out of a loop into a register, and the CPU is free to answer it from a core-local store buffer. It worked on my laptop is not evidence here, it is the absence of a schedule that exposed it. What the atomic swap buys is precisely that relationship: a Store happens-before the Load that observes it, so every write that built that Config, all of which happened before the Store, is visible to the reader that gets the pointer. That guarantee covers everything reachable from the pointer, and it holds only while nothing writes to the Config afterwards. Break the one rule and you have kept the atomic and lost the reason it worked.",
					},
				},
			],
			retrievalPrompt:
				"atomic.Value.Store is atomic, so why is cfg := store.Load(); cfg.Port = 9090 a data race? || Because only the pointer swap is atomic, not the struct it points to. That line writes fields other goroutines are reading right now, with no happens-before relationship between the write and those reads: readers can see a torn config, or never see the change at all. A reload builds a new Config and swaps; it never writes into one that is already stored.",
		},
		{
			n: "06",
			heading: { en: "Build the RWMutex version you are competing with" },
			uses: ["defer"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been told atomic.Value is faster on this path, and so far that is all it is: something you were told. sync.RWMutex is the tool most engineers would reach for here, it is correct, and for most shared state it is the right default. Build it properly, give it the same API, and make it compete. If it wins, the rest of this project owes you an explanation.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "sync.RWMutex allows any number of concurrent readers or exactly one writer. RLock is not a free pass, though: it is a write to the mutex's own state, because the mutex has to count its readers somewhere so that a waiting writer knows when they are gone. Two readers on two cores taking RLock are both writing to the same word. That is the whole story of step 07, and it is why the comparison is worth building rather than assuming.",
					},
					pattern: `type MutexStore struct {
    mu  sync.RWMutex
    cfg *Config
}

func (s *MutexStore) Load() *Config {
    s.mu.RLock()
    cfg := s.cfg
    s.mu.RUnlock()
    return cfg
}

func (s *MutexStore) store(c *Config) {
    s.mu.Lock()
    s.cfg = c
    s.mu.Unlock()
}`,
					example: {
						en: "A connection pool guards its idle list with an RWMutex: many goroutines check the list, one goroutine adds a connection. That is a good fit, because the critical section does real work. Here the critical section is copying one pointer, so the lock costs more than the thing it protects.",
					},
					task: {
						en: "Implement MutexStore, NewMutexStore, Load, and store in labs/config-watcher/config/store.go, with the same contract as Store. Then drop the /atomic filter and run the whole suite: one table, both implementations, same assertions.",
					},
					hints: [
						{
							label: "no defer on this Load, deliberately",
							value: "defer s.mu.RUnlock() is the correct habit and the right answer almost everywhere: it survives an early return and a panic. This critical section is two instructions and it is the path you are about to benchmark, so the reference unlocks explicitly to keep the measurement about the lock. Use defer when the body has more than one exit or can panic. Not before you have a reason.",
						},
						{
							label: "why the suite is a table over both stores",
							value: "Two implementations, one contract, so the assertions are written once and run twice. This is also the first thing table-driven tests actually buy you beyond compactness: it is now impossible for the two stores to be held to different standards, because there is only one set of standards.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command: "go test ./...",
					expect: {
						en: "Green, the whole thing: both debounce tests and all three store tests across both implementations. This is the first point where the lab has nothing left to tell you about correctness, and it is the point where the interesting question starts, because both stores now pass every test and only one of them belongs on the hot path.",
					},
					labPath: "labs/config-watcher/config/store_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In MutexStore.Load, swap RLock and RUnlock for the exclusive Lock and Unlock. Run go test ./... again. Then run go test -bench MutexLoad -run '^$' -count=3 ./... and compare against the same command before the change.",
					},
					observe: {
						en: "Every test still passes. The gate in step 08 still passes. Nothing in the suite so much as blinks. The benchmark moves from roughly 45 ns/op to roughly 61 on an 8-thread laptop, and that is the only place the change is visible at all.",
					},
					why: {
						en: "Lock is strictly stronger than RLock: it excludes everybody instead of just writers, so it can never produce a wrong answer, only a slower one. That is why no correctness test can catch this, and why no correctness test ever will. You have written a bug whose entire symptom is a number. Readers that were running concurrently now run one at a time, and the cost is invisible on one core, invisible under a serial test, and roughly 35% on eight. This is the honest argument for benchmarks, and it is narrower than people usually claim: not that fast code matters, but that an entire class of mistake is undetectable by the tools you have been using so far. You cannot review this into visibility either. RLock and Lock differ by one character.",
					},
				},
			],
			retrievalPrompt:
				"You replace RLock with Lock on a read path. Which test catches it? || None, and none can. Lock is strictly stronger than RLock, so the code stays correct and only gets slower: concurrent readers now serialize. Correctness suites are blind to it by construction, which is what benchmarks are actually for.",
		},
		{
			n: "07",
			heading: { en: "Measure both under parallel load" },
			uses: ["benchmarks"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Two implementations, one contract, and an opinion about which is faster. The opinion is worth nothing, and the interesting part is not that the benchmark settles it: it is that the benchmark you write first, the obvious loop, says the two are much closer than they are, and would talk you out of the right design.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A benchmark is BenchmarkXxx(b *testing.B). The framework raises b.N until the run is long enough to be stable, then reports total time over iterations. Two things make the number mean anything. b.ResetTimer after setup, so you measure the operation and not the construction. And b.RunParallel, which spreads the loop across GOMAXPROCS goroutines: with contention, that is not a variation on the serial benchmark, it is the only version that measures the thing you care about.",
					},
					pattern: `func BenchmarkAtomicLoad(b *testing.B) {
    s := NewStore(&Config{Port: 8080, LogLevel: "info"}) // setup
    b.ResetTimer()                                       // measure from here

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            _ = s.Load()
        }
    })
}

// go test -bench . -benchmem -count=5 ./...`,
					example: {
						en: "The Go team benchmarked sync.Map against map plus RWMutex with RunParallel across read-heavy and write-heavy workloads. That comparison, not intuition, is what produced the documented guidance on which to reach for and when.",
					},
					task: {
						en: "Read labs/config-watcher/config/bench_test.go, which ships written the way this step teaches, then run it and record both numbers. Then write the same two benchmarks yourself in your own repo against your own stores and check that your numbers agree with the lab's. Numbers you did not produce are somebody else's numbers.",
					},
					hints: [
						{
							label: "what -benchmem is really pinning",
							value: "Not speed: the invariant that Load never allocates. A read path that allocates once per request hands the garbage collector work proportional to your traffic, which is how a service gets slower the more it succeeds.",
						},
						{
							label: "read RunParallel's ns/op carefully",
							value: "It is wall time divided by total iterations, so eight cores doing independent work drive it below the single-core cost. That is why atomic reads 1.9 ns/op on one core and 0.55 on eight: the work divided. Any number that goes up when you add cores is telling you the cores are fighting.",
						},
						{
							label: "what _ = s.Load() does not measure",
							value: "The result is discarded, so the compiler can drop work nothing observes. The atomic read survives because it is a synchronizing operation, and RLock survives because it is a real function call doing a real write. A struct copy in between would not survive, which is why a Load that returns a defensive copy still benchmarks at 0 allocs/op and why the alloc counter cannot catch it. TestLoadReturnsInitialConfig catches it, by comparing addresses.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command:
						"go test -bench . -benchmem -run '^$' ./...\n\n# then watch what each store does as cores are added:\ngo test -bench Load -run '^$' -cpu=1,8 ./...",
					expect: {
						en: "On an 8-thread i5 laptop: BenchmarkAtomicLoad about 0.55 ns/op, BenchmarkMutexLoad about 46 ns/op, both at 0 allocs/op. Your absolute numbers will differ; the ratio is the result. The second command is the one to sit with. Atomic goes from about 1.9 ns/op on one core to about 0.55 on eight, because the work divided. The mutex goes from about 15 to about 47: you gave it eight times the cores and it got three times slower per operation. The gap is roughly 8x on one core and roughly 80x on eight.",
					},
					labPath: "labs/config-watcher/config/bench_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Replace b.RunParallel with the obvious serial loop, for i := 0; i < b.N; i++ { _ = s.Load() }, in both benchmarks, and rerun.",
					},
					observe: {
						en: "Atomic about 1.3 ns/op, mutex about 15.7. The mutex is still slower, but by about 12x rather than 80x. Same machine, same code, same contract, and a benchmark that makes the mutex look like a reasonable choice.",
					},
					why: {
						en: "The two numbers are measuring two different costs, and only one of them is the reason for this design. The 12x is instruction cost: RLock and RUnlock are atomic read-modify-write operations on the mutex word, roughly 14ns of work that atomic.Value.Load, a plain pointer read, simply does not do. Real, but not decisive. The other 68x is cache coherence, and it only exists when cores compete. RLock has to write, because the mutex counts its readers, and a write requires that core to take exclusive ownership of the cache line holding that word, which means invalidating that line in every other core's cache. Eight cores taking RLock on one mutex are eight cores ripping one 64-byte line back and forth, and every RLock is a cache miss caused by another core's RLock. Load never writes: every core keeps the line in a shared state and reads it locally, so nothing needs to be invalidated and there is no traffic to generate. That is the asymmetry the serial benchmark structurally cannot show you, because it is a property of cores contending and there is only one core. It is also why the atomic version gets faster with more cores while the mutex gets slower: one scales, the other anti-scales, and no amount of measuring on one core will tell you which one you are holding.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "benchmark",
						title: "atomic.Value vs RWMutex under parallel load",
						description:
							"The real suite lives in labs/config-watcher. Port your two stores into config/store.go and run go test -bench . -benchmem -count=5 ./... there: BenchmarkAtomicLoad and BenchmarkMutexLoad (config/bench_test.go) must complete with 0 allocs/op. Then run the gate, go test -tags gate -run TestGate ./..., which reruns both benchmarks in one process and fails unless the atomic version is strictly faster.",
						labPath: "labs/config-watcher/config",
						desiredMetrics:
							"BenchmarkAtomicLoad:  < 5 ns/op,   0 allocs/op\nBenchmarkMutexLoad:  10–50 ns/op,  0 allocs/op",
						metricsAchievable:
							"On an M1 Mac with GOMAXPROCS=8: atomic ~1.2 ns/op, RWMutex ~22 ns/op. The gap widens with more goroutines because atomic has zero contention; every RLock still touches the mutex's memory, invalidating cache lines shared across cores. An Intel mobile CPU such as the i5-1135G7 lands the RWMutex Load closer to 45 to 50 ns/op; that is a correct result, not a broken one, and the relative gate still passes because it compares the two stores in the same process.",
						hints: [
							{
								label: "why RunParallel",
								value: "Not because a serial benchmark shows no difference: it shows about 12x (roughly 1.3 ns/op against 15.7), which is the uncontended cost of two atomic read-modify-writes on the mutex word. RunParallel does not reveal the gap, it widens it to about 80x, because only then are cores fighting over the cache line that RLock writes to. The serial number is real and it is the wrong number to design against.",
							},
							{
								label: "benchstat",
								value: "go install golang.org/x/perf/cmd/benchstat@latest fails on Go 1.22: x/perf now requires Go 1.25 or newer and the module refuses to build. Pin a commit from before that bump: go install golang.org/x/perf/cmd/benchstat@400946f43c82. Then: go test -bench=. -benchmem -count=10 -run '^$' ./... > bench.txt and benchstat bench.txt. Use -count=10, not 5: benchstat needs at least 6 samples for a confidence interval and prints ± ∞ below that, which is it telling you the run proved nothing about variance.",
							},
							{
								label: "on ratios, not absolutes",
								value: "Record ns/op on your machine and expect it to disagree with everyone else's; the ordering and the rough ratio are the result, which is exactly why the gate compares the two stores in one process instead of checking a threshold.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"A serial benchmark says the mutex store is 12x slower than the atomic one. RunParallel says 80x. Which is right, and what is the difference made of? || Both are right and they measure different costs. The 12x is the uncontended instruction cost of the atomic read-modify-writes in RLock and RUnlock. The rest is cache coherence: RLock writes to the mutex word, so parallel readers keep invalidating each other's copy of that cache line, while an atomic Load only reads and every core can hold the line at once. Only the parallel number reflects the production shape.",
		},
		{
			n: "08",
			heading: { en: "Make the claim survive the machine it runs on" },
			uses: ["benchmarks"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have numbers from one laptop, taken once, probably while a browser was open. That is an anecdote. The design decision this project rests on deserves a check that fails when it stops being true, and that means deciding what is actually being claimed: not 0.55 ns/op, which is about your CPU, but atomic beats the mutex here, which is about the code.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A performance gate that hardcodes a threshold is a test that fails on a slower machine and passes on a faster one, telling you about hardware you already have. Assert the relationship instead. Run both benchmarks in the same process, on the same machine, in the same conditions, and require the ordering to hold: an absolute number is a property of a laptop, a ratio is a property of the design. testing.Benchmark runs a benchmark function from inside a test and hands back the result, which is what makes the comparison possible.",
					},
					pattern: `func TestGateAtomicFasterThanMutex(t *testing.T) {
    // Refuse to measure code that does not work yet.
    if NewStore(&Config{Port: 1}).Load() == nil {
        t.Fatal("Load is still a stub; make go test ./... green first")
    }

    atomicRes := testing.Benchmark(BenchmarkAtomicLoad)
    mutexRes := testing.Benchmark(BenchmarkMutexLoad)

    if nsPerOp(atomicRes) >= nsPerOp(mutexRes) {
        t.Fatalf("gate failed: atomic (%.2f) is not faster than mutex (%.2f)",
            nsPerOp(atomicRes), nsPerOp(mutexRes))
    }
}`,
					example: {
						en: "Go's own performance work runs on benchstat comparing two commits on one machine, never a threshold in CI. Same reason: the question is always did this change make it worse, not is this machine fast.",
					},
					task: {
						en: "Read labs/config-watcher/config/gate_test.go, run it, and read the two numbers it logs. Then look at the guard on the first line and work out what it is protecting against before you read the break-it below.",
					},
					hints: [
						{
							label: "why the gate is behind a build tag",
							value: "It takes seconds and it measures, so it has no business in the go test ./... you run every thirty seconds. -tags gate keeps the fast suite fast and lets the slow check be deliberate. Benchmarks in the default test path get skipped by everyone within a week.",
						},
						{
							label: "the gate is not a benchmark harness",
							value: "It asserts one relationship. Recording numbers, comparing runs, and spotting a 3% regression is benchstat's job, and it is a different job with different tools.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/config-watcher",
					command: "go test -tags gate -run TestGate -v ./...",
					expect: {
						en: "PASS, plus two logged lines close to: BenchmarkAtomicLoad 0.61 ns/op, 0 allocs/op over 1000000000 iterations, and BenchmarkMutexLoad 45.20 ns/op, 0 allocs/op over 26666844 iterations. Note the iteration counts as well as the times: the framework ran the atomic store forty times more often to spend the same wall clock on it.",
					},
					labPath: "labs/config-watcher/config/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Comment out the body of Load so it returns nil again, the way the stub shipped, and run the gate.",
					},
					observe: {
						en: '"Load is still a stub; make go test ./... green before running the gate". The gate refuses to measure, and never reaches the benchmarks at all.',
					},
					why: {
						en: "Delete that guard and think about what the gate would report. A Load that returns nil immediately is the fastest Load anyone will ever write: it does nothing, so it measures near zero, so it beats the mutex by a wider margin than your real implementation ever will, and the gate passes and certifies a store that cannot hold a config. A benchmark measures whatever you hand it, including nothing at all, and it has no way to notice the difference, because correctness is not a thing it looks at. Every optimisation has a limit case where the code stops doing the work, and performance numbers are structurally blind to it: they get better, right up to the point where they are meaningless. This is the counterweight to step 06. A benchmark catches the bug a test cannot see, and a test catches the bug a benchmark cannot see. The order matters too, which is why the guard is a t.Fatal on the first line: green suite first, then measure. Numbers from broken code are not slightly wrong, they are unrelated to the question.",
					},
				},
			],
			retrievalPrompt:
				"Why does a benchmark gate check that Load works before it measures anything? || Because the fastest possible implementation is one that does no work. A stub returning nil benchmarks near zero and would beat the mutex by a wider margin than the real code, so the gate would pass on a store that cannot hold a config. Benchmarks measure whatever you give them and cannot tell whether it is correct, so correctness has to be established first.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built an event loop that can be told to stop, a debounce that turns a burst into one reload, a reload that refuses to install a config that did not parse, and the same store twice: once behind atomic.Value and once behind sync.RWMutex. Then you made the two compete and let the measurement decide, which is the first time on this site that a design choice was settled by evidence rather than by being told.",
			},
		},
		{
			type: "text",
			value: {
				en: "The rule worth carrying out of here is the smallest one: a stored Config is frozen, and a reload swaps a pointer rather than writing through one. That single sentence is what makes a lock-free read path correct, and everything else, the atomic, the benchmarks, the gate, is downstream of it. Break it and the atomic buys you nothing, which is what the torn read in step 05 was showing you: Port from one config, LogLevel from another, a value nobody ever built.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-its taught the other half. A loop that cannot hear a cancellation hangs forever and looks fine on a machine where somebody keeps touching the file. A missing timer.Stop fires five reloads and no test you would have thought to write catches it. RLock swapped for Lock passes every test in the suite and only a benchmark notices. A stub outruns every correct implementation on the planet. Tests and benchmarks are blind to different things, in opposite directions, and that is why this project ships both.",
			},
		},
	],
}
