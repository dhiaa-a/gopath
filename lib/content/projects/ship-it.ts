import { Project } from "../../content"

export const shipIt: Project = {
	slug: "ship-it",
	name: "Ship it",
	tagline:
		"One static binary that starts under a supervisor, tells it the truth, and stops without dropping a request.",
	code: "SHP",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "8–10 hours",
	tags: ["net/http", "os", "context", "time", "atomic", "integration-testing"],
	lab: {
		path: "labs/ship-it",
		command: "go test -tags gate -run TestGate ./...",
		summary: {
			en: "The gate puts 64 requests in flight, asks the process to stop while every one of them is still running, and counts how many never got a whole response. The budget is zero. It also measures the window between readiness saying 503 and the listener closing, and holds the shutdown to its own deadline.",
		},
	},
	mentalModels: [
		"the process is a citizen of a scheduler, not the owner of a machine",
		"readiness is a lie you tell on purpose",
		"shutdown is a protocol, not an event",
		"config is read once, at the boundary, or it is not config",
		"the artifact is one file",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Everything you have built on this site so far ran because you started it and stopped when you pressed Ctrl-C. Production is not that. Something else starts your process, decides whether it is worth traffic, routes requests to it, and eventually kills it, on a schedule you do not control, dozens of times a week, because that is what a deploy is. This project is about being a good citizen of that system, and almost none of it is about handlers.",
			},
		},
		{
			type: "text",
			value: {
				en: "The service itself is deliberately trivial: three routes, one of which sleeps. What is hard is the lifecycle around them. The process has to answer probes before its dependencies are ready, has to keep serving after it has been told to stop, and has to know the difference between a question about whether it is alive and a question about whether it should get traffic. Those are not the same question, and answering them with the same code is a documented way to take down a fleet.",
			},
		},
		{
			type: "code",
			value: `exec
 └─ LoadConfig(os.Getenv)          bad value → exit 1, nothing listening
     └─ net.Listen(cfg.Addr)       port in use → exit 1
         └─ Run(ctx, ln)
             ├─ Serve              /healthz 200 · /readyz 503
             ├─ warm()             /readyz 200        ← now worth traffic
             └─ SIGTERM
                 ├─ /readyz 503                       ← lie first
                 ├─ sleep DrainDelay                  ← still accepting
                 ├─ Shutdown(own deadline)            ← in-flight completes
                 └─ return nil                        → exit 0`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/ship-it/
 ├── main.go            - yours: signals, listener, exit code. The process contract.
 ├── solution.go        - the reference main (build tag solution)
 ├── ship/
 │   ├── ship.go        - the Config type, pinned: the suite builds these
 │   ├── server.go      - yours: LoadConfig, Handler, Run (build tag !solution)
 │   ├── solution.go    - the reference (build tag solution)
 │   ├── ship_test.go   - the suite: correctness. Read it, it is the contract.
 │   └── gate_test.go   - the gate: the numbers (build tag gate)
 └── deploy/
     ├── Dockerfile     - read and build it yourself; no check here runs Docker
     └── ci.example.yml - copy into your own repo as .github/workflows/ci.yml`,
		},
	],
	constraints: [
		{
			type: "list",
			items: [
				{
					en: "Zero dependencies. net/http, os/signal, context, and sync/atomic are the whole toolkit. Every framework that offers you graceful shutdown is wrapping the same forty lines you are about to write, and you should know what is under the wrapper before you buy one.",
				},
				{
					en: "CGO_ENABLED=0. The artifact is one file that depends on nothing, which is what makes the container a binary plus 2MB of CA certificates instead of a Linux distribution.",
				},
				{
					en: "No config file, no reload, no flags. Everything comes from the environment, is read exactly once, and never changes while the process lives. A handler that can ask the environment a question at request time is a handler whose behaviour depends on when you look.",
				},
				{
					en: "Nothing in the lab's checks runs Docker. You build the image yourself, because reading a Dockerfile is not the same as running one. The gate checks the Go program's shipping properties, which are the parts a container cannot fix for you.",
				},
				{
					en: "The gate is relative. Every number it enforces is compared against the budget the same Config asked for, so it holds on your laptop, on CI, and on a machine under load, without a single absolute millisecond in it.",
				},
			],
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Read the whole environment once, at the boundary" },
			uses: ["error-handling", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The failure this step prevents does not look like a failure. Someone sets SHIP_SHUTDOWN_TIMEOUT=15, meaning fifteen seconds, and time.ParseDuration rejects it because it has no unit. If you ignore that error and fall back to the default, the deploy succeeds, the pods go green, and the timeout is not what anybody thinks it is. Nobody finds out until the day it matters, which is the day of an incident, which is the worst possible day to learn that your config layer has opinions.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "LoadConfig(getenv func(string) string) (Config, error) fills a Config from four SHIP_* variables, applying the documented default for each one that is unset. It calls getenv, never os.Getenv. A value it cannot use is an error naming both the variable and the value, and it reports every bad variable in one error rather than returning at the first. Unset is not an error and is not zero: it means the default was right.",
					},
					rationale: {
						en: "Two decisions here, both load-bearing. Taking getenv as a parameter makes the config layer a pure function of its input: os.Getenv reads process-global mutable state, so testing it means mutating the environment of the test binary and putting it back, and the tests can no longer run in parallel. As a parameter, the suite hands it a map and the whole problem evaporates. Reporting every problem at once is the same instinct as the file renamer's boundary validation, one tier up: an operator with two bad variables should learn about both now, not discover the second one after the redeploy that fixed the first. errors.Join, added in Go 1.20, is exactly this: a slice of errors, one error out.",
					},
					hints: [
						{
							label: "the crash loop is the feature",
							value: "A process that exits 1 on a bad variable crash loops, which is loud, obvious, and visible in the first thirty seconds of a deploy. A process that started with a silently defaulted timeout is quiet, looks healthy, and is wrong. Fail fast is not machismo here, it is choosing which day you find out.",
						},
						{
							label: "the two budgets are related",
							value: "DrainDelay + ShutdownTimeout is your total stopping budget, and it has to fit inside the grace period of whatever supervises you. Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds (30 by default), then sends SIGKILL. The defaults here sum to 20s against that 30s, and that relationship is why they are the defaults.",
						},
						{
							label: "why loopback is the default Addr",
							value: 'The default is "127.0.0.1:8080", not ":8080". On your laptop, loopback means nothing on the coffee shop wifi can reach your half-finished service and your firewall never asks you a question. The container sets SHIP_ADDR=:8080 because inside a network namespace, loopback means reachable only from inside that container. Same binary, two networks, one variable: that is what env config is for.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command: "go test -run TestLoadConfig ./ship/",
					expect: {
						en: "Six cases green, including TestLoadConfigReportsEveryProblemAtOnce, which sets two bad variables and requires your error to name both. Note what the suite never does: it never touches the real environment. That is what the getenv parameter bought.",
					},
					labPath: "labs/ship-it/ship/ship_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'In LoadConfig, drop the error from time.ParseDuration and keep the default instead: d, _ := time.ParseDuration(raw); if d != 0 { ... }. Then run the binary with the mistake an operator actually makes: SHIP_SHUTDOWN_TIMEOUT=15 go run -tags solution .',
					},
					observe: {
						en: 'It starts. The log line says shutdown_timeout=15s, because the default is 15s, which is exactly what the operator meant. Everything looks right.',
					},
					why: {
						en: 'This is the most dangerous outcome available, because the default happened to agree with the intent. Set SHIP_SHUTDOWN_TIMEOUT=60 and it still says 15s, and now the process is silently ignoring you. The lesson is not that swallowed errors are untidy: it is that a config layer which falls back on parse failure has no way to distinguish "you did not set this" from "you set this and I could not read it", and those need opposite responses. The first is fine. The second must stop the process.',
					},
				},
			],
			retrievalPrompt:
				"LoadConfig takes getenv as a parameter instead of calling os.Getenv. What does that actually buy, beyond looking clean? || os.Getenv reads process-global mutable state, so a test would have to mutate the test binary's environment and restore it, and no two such tests could run in parallel. As a parameter, LoadConfig is a pure function of its input and the suite passes it a map. The same trick works for time.Now, os.Args, and anything else that reads the world.",
		},
		{
			n: "02",
			heading: { en: "/healthz must not know anything" },
			uses: ["http-handler"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Here is a real outage, and it has happened to enough companies to be a genre. The database gets slow. Every replica's health check queries the database, so every health check times out. The orchestrator concludes that every replica is wedged and restarts all of them, at once. Now every replica is cold, and all of them reconnect to the struggling database simultaneously, which finishes it. The restart did not fix anything, because nothing was broken except the thing the restart just made worse. The bug was one line: a liveness probe that asked a question about someone else.",
					},
				},
				{
					type: "constraint",
					what: {
						en: 'Handler() registers /healthz, and it answers 200 unconditionally from the moment the mux is serving. It must not consult warm, the readiness flag, the clock, or any dependency. Until you register it, every route on the mux is a 404, which is why the suite is red.',
					},
					rationale: {
						en: 'Liveness and readiness answer different questions and only one of them is about you. Liveness is "is this process wedged, should you kill it and start another one", and the only honest way to answer it is to depend on nothing that could be broken somewhere else, because the remedy is a restart and a restart cannot fix a database. Readiness is "should traffic come here right now", and the remedy is to route around you, which is exactly right when a dependency is down. Wire a dependency into liveness and you have told the orchestrator to apply the restart remedy to problems restarts cannot solve.',
					},
					hints: [
						{
							label: "what k8s does with each",
							value: "A failed livenessProbe restarts the container. A failed readinessProbe removes it from the Service endpoints and leaves it running. Same HTTP request, same 503, completely different blast radius. That asymmetry is the whole reason there are two probes.",
						},
						{
							label: "so what does liveness catch?",
							value: "Deadlock, mostly. A process where every goroutine is blocked on a mutex nobody will release cannot serve /healthz either, so the probe times out and the restart genuinely is the fix. That is a narrow set of problems, and it is supposed to be narrow.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"go test -run 'TestHealthzAnswersRegardlessOfReadiness|TestReadyzIsUnavailableBeforeWarm' ./ship/",
					expect: {
						en: "Both green. The Server in those tests has never been Run, so warm has not even been called: it is as un-ready as a process gets, and /healthz answers 200 anyway while /readyz answers 503. That gap between the two, on the same Server, in the same instant, is the entire point of this step.",
					},
					labPath: "labs/ship-it/ship/ship_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Make /healthz answer the readiness question too: give it the same body as /readyz, so it returns 503 when the ready flag is false.",
					},
					observe: {
						en: "TestHealthzAnswersRegardlessOfReadiness fails: /healthz on a server that is not ready = 503, want 200. Nothing else in the suite notices. The gate stays green.",
					},
					why: {
						en: "Look at how quiet that was. One assertion, in a suite of a dozen, and the service still works perfectly in every functional sense: it serves, it drains, it passes the exam. The damage from this bug is invisible until the day a dependency has a bad thirty seconds during your normal traffic, and then the orchestrator restarts every replica you have because they all correctly reported that something else was broken. This is why the test exists and why the assertion is worded the way it is: it is the only place in the codebase where the reason is not local.",
					},
				},
			],
			retrievalPrompt:
				"Your /healthz checks that the database connection is alive. Name the specific outage that creates. || The database blips, every replica's liveness probe fails at once, the orchestrator restarts the whole fleet, and every replica comes back cold and reconnects to the struggling database at the same moment. The restart cannot fix a database, so it just adds a thundering herd. Liveness means \"am I wedged\", and its remedy is a restart, so it must depend on nothing a restart cannot fix.",
		},
		{
			n: "03",
			heading: { en: "/readyz lies until the dependencies are wired" },
			uses: ["http-handler", "goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Your process is listening about three milliseconds after exec. Its connection pool is not. Its cache is not. Between those two moments there is a window where the port answers and the service cannot actually do anything, and if nothing describes that window to the outside world, the orchestrator does the reasonable thing and sends traffic into it.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "New(cfg, warm) takes the dependency check. Run calls warm exactly once and serves the listener while it runs, so the probes can answer during start-up. /readyz answers 503 until warm returns nil, then 200. If warm returns an error, Run stops the server and returns an error wrapping it, so the process exits non-zero rather than sitting at 503 forever pretending it might recover.",
					},
					rationale: {
						en: "The listener goes live before warm, not after, and that ordering is the whole design. A refused connection and a 503 are different facts: refused means nothing is there, 503 means something is there and is telling you it is not ready. The first is indistinguishable from a crash, the second is a status report. Serving through the warm-up gap is what lets a starting process say the true thing about itself. And a dependency that is never coming is a startup failure, not a state: exit non-zero and let the supervisor decide whether to try again, because it has a restart policy and a backoff and your process does not.",
					},
					hints: [
						{
							label: "the flag is shared state",
							value: "The ready flag is written by Run and read by every /readyz request, and net/http serves every request on its own goroutine. Two goroutines, one of them writing, is the definition of a data race. A plain bool will look like it works. sync/atomic's Bool is the entire fix, costs nothing on the read path, and go test -race ./... will name the exact lines if you skip it.",
						},
						{
							label: "why warm is a parameter",
							value: 'Because it makes the untestable testable. Real dependency wiring is "open a pool to a database that is not in this test". As a function parameter, the suite hands you a warm that blocks on a channel it controls, and the readiness state machine becomes deterministic: hold it open, assert 503, release it, assert 200. No sleeps, no flakes.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command: "go test -run 'TestReadyzWaitsForWarm|TestRunReportsAWarmFailure' ./ship/",
					expect: {
						en: "Both green. Then run the real binary and watch the same transition in wall-clock time, because warmup in main.go sleeps two seconds on purpose: go run -tags solution . in one terminal, then curl -i localhost:8080/readyz twice, two seconds apart. 503, then 200. /healthz is 200 through both.",
					},
					labPath: "labs/ship-it/ship/ship_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In Run, store true into the ready flag before you call warm instead of after it.",
					},
					observe: {
						en: "TestReadyzWaitsForWarm fails on the first assertion: /readyz while warm is still running = 200, want 503.",
					},
					why: {
						en: "Now picture that in a rolling update, which is where it actually bites. The orchestrator starts a new pod, waits for it to report Ready, and only then takes an old pod out of rotation. That handshake is the entire safety mechanism of a zero-downtime deploy, and it runs on your answer. Report Ready at t=0 and the rollout believes you: it tears down the old replicas as fast as it can bring up new ones, and every new pod 503s or times out for the length of its warm-up. You did not break the deploy tooling. You lied to it, and it did exactly what you said.",
					},
				},
			],
			retrievalPrompt:
				"Why does Run start serving before warm has finished, rather than binding the listener once the dependencies are ready? || Because a refused connection and a 503 are different facts. Refused is indistinguishable from a crash; 503 is the process telling the truth about itself while it starts. If you do not serve during the warm-up gap, nothing outside can tell start-up apart from failure, and the only thing that knows the difference is the process you have kept silent.",
		},
		{
			n: "04",
			heading: { en: "Serve the work, and put a deadline on the wire" },
			uses: ["http-handler", "select"],
			blocks: [
				{
					type: "text",
					value: {
						en: "&http.Server{Handler: mux} has no timeouts. Not short ones: none. A client can open a connection, send one byte of a request header, and hold a goroutine and a file descriptor for as long as it feels like. It costs the client almost nothing to hold ten thousand more. That is the entire Slowloris technique, it needs no bandwidth, and the zero value of http.Server invites it.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Handler() registers /work, which sleeps for its ?ms= query parameter (default 0, maximum 5000) and returns 200, or 400 on anything it cannot use. It selects on the request context as well as the timer. Run builds its http.Server with ReadHeaderTimeout set from cfg.ReadHeaderTimeout.",
					},
					rationale: {
						en: "ReadHeaderTimeout is the free one: nothing legitimate takes five seconds to send its request headers, so bounding it costs you nothing and closes the cheapest denial of service there is. WriteTimeout is the one to think about rather than copy, because it is measured from the end of the request headers and would therefore cap /work: set it to 5s here and every request over five seconds dies, including the ones doing exactly what you asked. That is why this config exposes ReadHeaderTimeout and leaves the rest to you. Selecting on r.Context().Done() matters for a different reason: a client that hangs up should not leave a goroutine sleeping out the rest of its duration, and the request context is how net/http tells you the client is gone.",
					},
					hints: [
						{
							label: "what Shutdown does not do",
							value: "Shutdown does not cancel request contexts. It waits for handlers to return; it does not interrupt them. That is precisely why the in-flight requests in the gate complete rather than getting cancelled, and it is worth being certain about before step 06. Close is the one that kills connections, and killing the connection is what cancels the request context.",
						},
						{
							label: "why /work sleeps",
							value: "It stands in for the database query or upstream call a real handler makes, and the only property this project needs from it is that it takes time. A request that is not still running when Shutdown is called cannot prove anything about Shutdown, which is why the gate refuses to pass if your /work returns instantly.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"go test -run 'TestWork|TestReadHeaderTimeoutHangsUpOnASilentClient' ./ship/",
					expect: {
						en: "Three green. The last one is the interesting one: it opens a raw TCP connection to your server, sends nothing at all, and requires the server to hang up within the 200ms ReadHeaderTimeout it was configured with. Read that test rather than just running it, because it is what a Slowloris client's first connection looks like.",
					},
					labPath: "labs/ship-it/ship/ship_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the ReadHeaderTimeout line from your http.Server, leaving &http.Server{Handler: s.Handler()}.",
					},
					observe: {
						en: "TestReadHeaderTimeoutHangsUpOnASilentClient fails after three seconds: the connection was still open, and it never sent a byte. Every other test in the suite passes, and so does the whole gate.",
					},
					why: {
						en: "The connection is still open because there is nothing in the zero value of http.Server that would ever close it. No ReadTimeout, no ReadHeaderTimeout, no IdleTimeout: the defaults are all zero, and zero means no deadline. It stays open until the client goes away or the process does. That test is not clever, it is just the only code in this lab that asks the question, and until you wrote it nothing in your service had an opinion about how long a stranger may hold a file descriptor for free.",
					},
				},
			],
			retrievalPrompt:
				"ReadHeaderTimeout is safe to set to five seconds and WriteTimeout is not. Why not? || WriteTimeout is measured from the end of the request headers, so it bounds the whole handler, not just the write. Set it to 5s and every request that legitimately takes longer than five seconds dies, /work included. ReadHeaderTimeout only bounds the part where a client sends its headers, and nothing legitimate is slow at that.",
		},
		{
			n: "05",
			heading: { en: "SIGTERM is not a request to exit. It is a request to drain." },
			uses: ["context"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Here is the thing almost everyone gets wrong, including most blog posts about graceful shutdown. When Kubernetes terminates a pod, two things happen: the kubelet sends SIGTERM, and the endpoints controller starts removing the pod from the Service. Those are concurrent. There is no ordering between them, and the second one is a distributed system doing a distributed thing: it has to propagate to every kube-proxy and every load balancer on its own schedule. So traffic keeps arriving after the signal lands. Your process has been told to die and is still, correctly, receiving requests.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "main wires signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM) and passes that ctx to Run, with defer stop(). When ctx is cancelled, Run's first move is to store false into the ready flag so /readyz starts answering 503. Its second move is to keep serving anyway for cfg.DrainDelay, still accepting new connections. Only then does it stop accepting.",
					},
					rationale: {
						en: "The delay is not politeness and it is not a fudge factor. It is the only window the thing in front of you has to notice that you are going away, and it exists because you cannot be told when that has happened: nothing sends you a message saying \"the load balancer has taken you out\". You get one signal at the start of an unbounded process and no confirmation at the end of it. So you flip the one bit anything outside can observe, and then you wait long enough for a probe cycle or two, and everything that arrives during the wait gets served normally because you are still fully functional. A process that stops accepting the instant SIGTERM lands is not shutting down fast, it is dropping the requests that were already on their way.",
					},
					hints: [
						{
							label: "why sleep, and why uninterruptible",
							value: "time.Sleep is exactly right here, and it should not select on anything. A second SIGTERM is not a reason to drop the requests already on the wire. If someone wants this process gone now, SIGKILL exists and is not yours to intercept.",
						},
						{
							label: "signal.NotifyContext",
							value: "It turns the first arriving signal into a cancelled context, which means the rest of the program needs exactly one shutdown vocabulary: ctx.Done(). Trap nothing and the Go runtime's default SIGTERM handler kills the process where it stands, mid-request, with no drain at all.",
						},
						{
							label: "how long, in real life",
							value: "Long enough for your load balancer to fail you out, which is typically its probe period plus its failure threshold. A few seconds covers most setups, the default here is 5s, and the number that matters is the one you measure rather than the one you copied.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"go test -tags gate -run TestGateReadinessLeadsTheListener -v ./ship/\n\n# then watch it happen in wall-clock time:\ngo run -tags solution . &\nkill -TERM %1",
					expect: {
						en: 'The gate prints the window it measured, and against the reference it reads something like: /readyz went 503 at +1ms, the listener stopped accepting at +2.003s, window 2.002s (configured drain delay 2s, floor 1s). Your last digits will differ and the shape will not: the flip is immediate, and the window is the delay you asked for. Then the binary takes five seconds to exit and answers requests for every one of them. That pause is not your program being slow. It is your program being the only thing in the system that knows a load balancer takes a moment to catch up.',
					},
					labPath: "labs/ship-it/ship/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the time.Sleep(s.cfg.DrainDelay) from your drain, so readiness flips and Shutdown is called back to back. Then run the whole gate: go test -tags gate -run TestGate ./ship/",
					},
					observe: {
						en: 'Two failures, and the second one is a surprise. TestGateReadinessLeadsTheListener says the listener stopped accepting 0s after the stop was asked for and /readyz never returned 503 before that. But TestGateZeroDroppedOnDrain fails too: 50 of 64 in-flight requests dropped, 78.12%, with "an existing connection was forcibly closed by the remote host". Your Shutdown call was still perfectly correct.',
					},
					why: {
						en: "That second number is the lesson, and it is a level below the one this step is about. Those 50 connections had completed their TCP handshake and were sitting in the kernel's accept queue, waiting for your accept loop to pick them up. Closing a listener discards that queue: the kernel RSTs every connection in it. So they were not requests your server rejected, and not requests it dropped mid-flight. They were requests it never learned about, and the client could not even retry them as a refusal, because from the client's side the connection had already been accepted. The drain delay was doing two jobs at once and you only knew about one of them: it tells the load balancer to stop, and it gives your own accept loop time to pick up what already arrived.",
					},
				},
			],
			retrievalPrompt:
				"SIGTERM arrived. Why is it wrong to stop accepting connections right now, when stopping is exactly what you were told to do? || Because SIGTERM and your removal from the load balancer's pool are concurrent events with no ordering between them, and nothing will ever tell you the second one finished. Traffic keeps arriving after the signal. The signal does not mean traffic has stopped, it means traffic will stop eventually, once something else notices. The drain delay is the window you give it to notice.",
		},
		{
			n: "06",
			heading: { en: "Shutdown waits for the work. The deadline is the escape hatch." },
			uses: ["context", "defer"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The drain delay ends. Now there are requests in your handlers, and you are about to exit. Everything from here is about the difference between a process that stops and a process that finishes, and the gap between them is measured in dropped user requests per deploy times the number of deploys per week.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "After the drain delay, call srv.Shutdown with a fresh context carrying its own cfg.ShutdownTimeout deadline, built from context.Background(). Not the ctx that asked you to stop. If Shutdown returns an error, call srv.Close() to hang up on what is left, and return an error naming the timeout. Return nil only when every in-flight request finished. Run returning is the promise that it is now safe for main to return, so it must not return while a request it accepted is still running.",
					},
					rationale: {
						en: "http.Server.Shutdown closes the listeners, closes idle connections, and then waits for the active ones to go idle. Close does not wait: it hangs up on live connections immediately. That is the whole difference and it is one identifier. The subtler trap is srv.Shutdown(ctx) with the context that asked you to stop, which reads perfectly and is a disaster: that context is already cancelled, so Shutdown closes the listener, sees ctx.Err() is non-nil, and returns immediately without waiting for anything. Run returns, main returns, the process exits, and every request still in a handler dies without a response. It is invisible to any test that does not have a request in flight at that exact moment, which is why the gate is built the way it is.",
					},
					hints: [
						{
							label: "why the deadline has to exist",
							value: "Waiting for in-flight work is the right default; an unbounded wait is not a wait, it is a hang. The orchestrator has its own timer, and when terminationGracePeriodSeconds expires the kernel kills you with no drain at all. Blowing your own deadline and hanging up on a few requests is bad. Blowing the orchestrator's takes everything still in flight with it.",
						},
						{
							label: "why the timeout is an error",
							value: "Because it has to reach the exit code. If a drain that hung up on live requests returns nil, then a deploy that dropped traffic looks exactly like one that did not, in every dashboard you own. The error is how that event becomes countable.",
						},
						{
							label: "Shutdown polls",
							value: "It checks whether connections have gone idle on a backoff that starts around a millisecond and caps at 500ms, so Run can return up to half a second after the last handler returned. That is why the gate's ordering check has a 100ms tolerance in the client's direction and none in yours.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"go test -tags gate -run 'TestGateZeroDroppedOnDrain|TestGateShutdownDeadlineIsReal' -v ./ship/",
					expect: {
						en: "Against the reference: 64 in flight at the stop, 64 completed, 0 dropped, drop rate 0.00%, and Run returns about 1.9s after the stop, which is the 200ms drain delay plus the 1500ms of work it sat and waited for. The deadline test reports Run returning at about 350ms against its configured budget of 50ms + 300ms, carrying the error it is supposed to carry. The count is exact and the milliseconds are not: that is the difference between what the gate asserts and what it prints.",
					},
					labPath: "labs/ship-it/ship/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Replace srv.Shutdown(shutdownCtx) with srv.Close(). Rerun the two gate tests above.",
					},
					observe: {
						en: "64 of 64 dropped. A 100.00% drop rate, every request coming back as a bare EOF, and Run returning 216ms after the stop instead of 1.863s. The deadline test fails too, because Close returned nil and your drain reported a clean shutdown.",
					},
					why: {
						en: "Read the timing, not just the count. 216ms is the drain delay plus nothing: Close hung up on all 64 connections and returned instantly, so Run reported success while sixty-four clients were still waiting for bytes that were never coming. Nothing errored. Nothing logged. The process exited zero. That is the shape of the whole class of bug this project exists for: the failure is not in your process at all, it is in sixty-four other people's, and the only evidence on your side is a deploy that looked completely normal.",
					},
				},
			],
			retrievalPrompt:
				"srv.Shutdown(ctx), where ctx is the context that was cancelled by SIGTERM. It compiles, it reads well, and it is a serious bug. Why? || The context is already cancelled. Shutdown closes the listener, immediately sees ctx.Err() is non-nil, and returns without waiting for a single in-flight request. Run returns, main returns, the process exits on top of live handlers. Shutdown needs its own context, built from context.Background() with its own deadline, because its job starts exactly when the other context's job ended.",
		},
		{
			n: "07",
			heading: { en: "One binary, no libc, no operating system" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "A Go service does not need a Linux distribution to run. It does not need a package manager, a shell, or a libc. Most of the CVE list attached to your image is software you have never called and would not miss. The reason people ship it anyway is that the default FROM in every tutorial is an operating system, and nobody questions it.",
					},
				},
				{
					type: "constraint",
					what: {
						en: 'Read deploy/Dockerfile, then build it. The shipping build is CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/ship-it . in a golang:1.22-alpine stage, and the final stage is gcr.io/distroless/static-debian12:nonroot with the binary copied in and nothing else. ENTRYPOINT is exec form. ENV SHIP_ADDR=:8080.',
					},
					rationale: {
						en: "CGO_ENABLED=0 is the whole trick. With cgo on, the binary links against the libc of whatever built it, and glibc's name resolver dlopen()s more of itself at runtime, so a binary built in one image does not necessarily run in another. With cgo off, Go uses its own DNS resolver and the output depends on nothing, which is what makes a 2MB base image possible at all. The exec-form ENTRYPOINT is the one that quietly undoes the last two steps if you get it wrong: in shell form a shell is PID 1, and it does not forward signals, so docker stop waits ten seconds for nothing to happen and then SIGKILLs everything. One pair of brackets is the difference between the graceful shutdown you just wrote and a graceful shutdown that never runs.",
					},
					hints: [
						{
							label: "why distroless and not scratch",
							value: "scratch is the purer version of the same idea and would run this binary fine today. You will want the CA roots the first time you call an HTTPS API, and an /etc/passwd the first time you want a non-root user that is not a bare UID. distroless/static is those two things and tzdata, and nothing else: no shell, no package manager, no curl.",
						},
						{
							label: "why the version is linked in, not read from env",
							value: "-X main.version=abc1234 writes the string into the binary at link time. Which build is running is a property of the binary, so it belongs in the binary. Read it from an env var and a copy-pasted manifest can make the process lie about its own identity, which is a bad thing to discover while bisecting an incident.",
						},
						{
							label: "no HEALTHCHECK on purpose",
							value: "It would need a shell or a curl and the image has neither. The probes are HTTP endpoints because the thing that needs the answer is outside the container: Kubernetes calls them over the network with httpGet, which is also the only honest version of the question. A health check running inside the container cannot tell you the container is reachable.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						'CGO_ENABLED=0 GOOS=linux go build -tags solution -trimpath -ldflags "-s -w -X main.version=abc1234" -o ship-it-linux .\nfile ship-it-linux\n\n# and if you have Docker:\ndocker build -f deploy/Dockerfile -t ship-it:dev --build-arg VERSION=abc1234 .\ndocker run --rm -p 8080:8080 ship-it:dev',
					expect: {
						en: 'file prints "ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, Go BuildID=..., stripped" and the binary is about 4.9MB. "statically linked" is the claim the whole second stage rests on, and this is you checking it rather than believing it. The cross-compile works from any OS, so you can run this on Windows or macOS and inspect the Linux artifact you are actually shipping.',
					},
					labPath: "labs/ship-it/deploy/Dockerfile",
				},
				{
					type: "breakIt",
					change: {
						en: 'Build without the stamp: go build -tags solution -o ship-it-plain . and run it. Compare the startup log line to the one from the -ldflags build above.',
					},
					observe: {
						en: '{"level":"INFO","msg":"starting","version":"dev",...}. It is the same binary in every other respect, and it has no idea what it is.',
					},
					why: {
						en: 'Now scale that to a registry. Every image you ever built says "dev", so the version field in every log line from every replica says "dev", and when an incident starts at 02:00 the question "which commit is actually serving this traffic" has no answer available from the running system. You would be reconstructing it from deploy timestamps and hope. -X is one flag and it turns that question into a field you already have. The default value being the string "dev" rather than empty is deliberate too: a local go run should say something honest about itself rather than an empty string that looks like a bug.',
					},
				},
			],
			retrievalPrompt:
				'ENTRYPOINT ["/ship-it"] versus ENTRYPOINT /ship-it. What breaks, and which step of this project does it silently undo? || Shell form starts a shell as PID 1, and the shell does not forward signals to your binary. So SIGTERM never arrives, your drain never runs, docker stop waits out its ten-second grace period and SIGKILLs everything, and every in-flight request dies. It undoes steps 05 and 06 completely, in a way no test in the lab can see, because the bug is in the container spec rather than in the Go.',
		},
		{
			n: "08",
			heading: { en: "CI runs exactly what you run" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "A pipeline with a step you cannot reproduce on your machine is a pipeline you debug by pushing commits and waiting four minutes for the answer. That is the only real design rule for CI, and everything in deploy/ci.example.yml follows from it: every step in that file is a command you can paste into your terminal right now.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Read deploy/ci.example.yml and copy it into a repository of your own as .github/workflows/ci.yml. It runs gofmt (failing on any output), go vet ./..., go test -race ./..., the gate, the CGO_ENABLED=0 build, a file(1) check that the binary is statically linked, and a docker build. It is named ci.example.yml and parked under deploy/ so that GoPath's own CI can never pick it up: GitHub only reads workflows from .github/workflows/, so nothing there runs by living there.",
					},
					rationale: {
						en: "Two steps in that file are doing more than they look like. -race is free on a CI runner and costs you nothing to run there rather than in production, where a race presents as one wrong number a week and no stack trace: this is the one place the detector is unambiguously worth it. And the file(1) check exists because a dynamically linked binary produces a distroless image that builds fine, pushes fine, and exits immediately the first time it starts, because there is no loader in there to go find its libc. That failure is worth catching in a step that takes 40 seconds rather than in a rollout.",
					},
					hints: [
						{
							label: "gofmt is not a style opinion",
							value: "It is the absence of one. Anything gofmt rewrites is a diff nobody has to read, review, or argue about in a pull request. That is the entire value proposition and it is why the check is `test -z \"$(gofmt -l .)\"` rather than a linter with a config file.",
						},
						{
							label: "where the sample stops",
							value: "It builds the image and does not push it. Pushing needs a registry, credentials, and a decision about what you tag, and none of those three are Go. The line between them is a good place for this project to end.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"# run the pipeline, locally, in the order the yaml does:\ngofmt -l .\ngo vet ./...\ngo test -race ./...          # drop -race if you have no gcc\ngo test -tags gate -run '^TestGate' ./...\nCGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags=\"-s -w\" -o ship-it-linux .\nfile ship-it-linux",
					expect: {
						en: "gofmt prints nothing, and everything else is green. That is the whole file. If you can run the pipeline, the pipeline cannot surprise you, and the only thing the runner adds is a machine that will not forget to do it.",
					},
					labPath: "labs/ship-it/deploy/ci.example.yml",
				},
				{
					type: "breakIt",
					change: {
						en: 'Add a badly formatted line to any Go file (two spaces of indentation instead of a tab will do it), then run the exact gofmt step from the yaml: unformatted=$(gofmt -l .); if [ -n "$unformatted" ]; then echo "$unformatted"; exit 1; fi; echo $?',
					},
					observe: {
						en: "It names your file and exits 1, on your machine, in under a second. Then run gofmt -w . and it exits 0. Total round trip: about five seconds.",
					},
					why: {
						en: "Compare that to finding out from the runner: commit, push, wait for a queue, wait four minutes, read a log, fix, push again. Same information, three orders of magnitude more expensive, and the expensive version is what most people's CI actually is. The rule is not that CI should be simple. It is that every step in it should be a command with a copy on your machine, because the value of a fast feedback loop is entirely determined by whether the loop exists locally.",
					},
				},
			],
			retrievalPrompt:
				"Your CI does something you cannot run locally. Name the concrete cost. || Every failure in that step costs you a commit, a push, and a queue wait to diagnose, and another one to test each guess at a fix. The feedback loop moves from seconds to minutes, so you make fewer guesses and worse ones. That is why the design rule is that CI runs exactly what you run, and nothing you cannot run.",
		},
		{
			n: "09",
			heading: { en: "Write the deploy story, then let the gate grade it" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have a binary that starts, tells the truth, and stops properly. The last artifact is the one thing a machine cannot check for you: the page someone reads at 02:00 when your service is the one that is broken. It is short, it is prose, and it is the difference between an on-call engineer who has a next step and one who has a stack trace and a guess.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Write the deploy story in your own README, at most one page, covering six things: every SHIP_* variable and what a wrong value does; the total stopping budget (DrainDelay + ShutdownTimeout) and the grace period it has to fit inside; which probe means what, and specifically what a restart does and does not fix; how to tell which build is running; the exact command that builds and runs the image; and what a non-zero exit from a drain means and what to do about it. Then run the full gate and get all three checks green.",
					},
					rationale: {
						en: "Every item on that list is a question that gets asked during an incident, by someone who did not write this and cannot read Go fast enough right now. They are all answerable from the code in about twenty minutes, which is exactly twenty minutes longer than anyone has. The reason the gate cannot check this and the reason it is still mandatory are the same reason: the artifact is not the drain, it is the fact that somebody else can operate the drain without you on the call.",
					},
					hints: [
						{
							label: "the one that always gets skipped",
							value: 'The exit code. "The drain returned an error" means the process hung up on live requests because Shutdown blew its deadline, which means something in a handler is slower than the budget, which means the next question is which handler. Write that chain down. It is three sentences and it is the whole reason step 06 returns an error instead of nil.',
						},
						{
							label: "write it for someone who has your pager, not your context",
							value: "The test for every line: could a competent engineer who has never seen this repo act on it? Not understand it. Act on it.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/ship-it",
					command:
						"go test ./...\ngo test -tags gate -run TestGate -v ./ship/\n\n# and prove the gate is passable, which is the only reason to trust it:\ngo test -tags 'solution gate' -run TestGate -v ./ship/",
					expect: {
						en: "Both runs green, printing the same three measurements: a 0.00% drop rate over 64 in-flight requests, a drain window of about 2s against a 1s floor, and Run returning at about 350ms against its 350ms budget. The second run is not grading you. It is the gate proving it is passable, which is the only reason you should believe it when it says your program is wrong.",
					},
					labPath: "labs/ship-it/ship/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Run the gate against the reference, then break the reference on purpose: in ship/solution.go, delete the time.Sleep(s.cfg.DrainDelay) from drain. Rerun go test -tags 'solution gate' -run TestGate ./ship/, then restore it with git checkout.",
					},
					observe: {
						en: "The reference fails the same two checks your code would have, with the same numbers: readiness never led the listener, and 78% of the in-flight requests dropped. The gate has no idea which file it is looking at.",
					},
					why: {
						en: "That is what makes it a gate rather than a diff against one answer. It builds whatever the tags select and measures observable behaviour: the reference gets no credit for being the reference, and your implementation gets no penalty for not matching it byte for byte. Any Run that flips readiness first, waits, and then waits again for the work in flight will pass, and there are several honest ways to write that. This is also why the lab ships the reference behind the same gate instead of as prose. An unverified reference is an opinion, and this one is held to the same three numbers you are.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "metrics",
						title: "Zero dropped requests across a rolling shutdown",
						labPath: "labs/ship-it/ship",
						description:
							"Machine check: from labs/ship-it, go test -tags gate -run TestGate ./... runs three measurements against your implementation. TestGateZeroDroppedOnDrain puts 64 requests in flight (confirmed on the wire with httptrace, not with a sleep), asks the process to stop while every one is still running, and counts the ones that never got a whole response; it also refuses to pass vacuously, failing if your /work returned too fast for anything to have been in flight, and checks that Run did not return before the last response arrived, because Run returning is what lets main exit. TestGateReadinessLeadsTheListener measures the window between /readyz turning 503 and the listener refusing connections. TestGateShutdownDeadlineIsReal puts one request in flight that cannot finish inside the budget and holds the process to the budget anyway. Human deliverable: the one-page deploy story from this step, and a container image you built and ran.",
						desiredMetrics:
							"0 dropped of 64 requests in flight when the stop arrives (drop rate 0.00%)\nreadiness leads the listener by ≥ 50% of the configured drain delay\nRun returns inside DrainDelay + ShutdownTimeout, carrying an error if it hung up",
						metricsAchievable:
							"Measured against the reference on a stock go1.22 toolchain: 64 of 64 completed, 0 dropped, 0.00%, with Run returning about 1.9s after the stop (a 200ms drain delay plus the 1500ms of work it waited for). The drain window came out at 2.0s against a 1s floor, and the deadline check returned at about 350ms against its 350ms budget. The margins are wide because every threshold is relative to the budget the same Config asked for: no absolute nanoseconds, so both sides move together on a slow or loaded machine. The gate bites hard when it should. Close instead of Shutdown gives a 100.00% drop rate (64 of 64, bare EOFs). Dropping the drain delay gives 78.12% (50 of 64), because connections still in the kernel's accept queue die with the listener. Shutdown(context.Background()) hangs past the budget and the deadline check names it.",
						hints: [
							{
								label: "run the suite first",
								value: "go test ./... is correctness and the gate is the exam. A Run that drains beautifully but whose /healthz consults the readiness flag passes the gate and is still the fleet-restart bug from step 02.",
							},
							{
								label: "no -race on the gate",
								value: "It adds nothing here. The race this project can produce is an unguarded readiness flag, and go test -race ./... on the suite catches that one: Run writes the flag while a /readyz handler goroutine reads it.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"The lab runs the same gate against its own reference solution, which is already known to be correct. What is that for? || It is what proves the gate is passable. A suite nobody has ever passed is a guess, not evidence. Because it goes green against a real implementation and red when that implementation is broken, you can trust it when it tells you your program is wrong. It measures behaviour and does not know or care which file it is looking at.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The whole project is one ordering. Readiness first, because it is the only bit anything outside can observe. Then a delay, because nothing will ever tell you the load balancer noticed. Then stop accepting, and wait for the work you already took. Then a deadline, because an unbounded wait is a hang and the orchestrator has its own timer that does not care about your good intentions. Four steps, about forty lines, and every framework that sells you graceful shutdown is wrapping exactly this.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-it steps were the argument as much as the build steps, and they had a shape in common: none of these bugs crash. A /healthz that checks a database looks perfect until the day it restarts your fleet for you. A Close where a Shutdown belonged drops sixty-four requests and exits zero. A missing drain delay drops fifty more from the kernel's accept queue, requests your process never even learned about, while your Shutdown call was flawless. A shell-form ENTRYPOINT silently deletes the entire drain and no test in the lab can see it. Every one of them reports success. That is the genre: in production, the failure is usually not in your process, it is in somebody else's, and the only trace on your side is a deploy that looked completely normal.",
			},
		},
		{
			type: "text",
			value: {
				en: "You now have the artifact the rest of this tier assumed: one static file with no libc, that reads its whole world once at startup and refuses to run on a value it cannot parse, that answers two different questions about its own health with two different answers, and that can be started and stopped by a machine, on a schedule, dozens of times a week, without anybody noticing. That last clause is the entire job. Deployment is not a thing you do to a service at the end. It is a property the service either has or does not.",
			},
		},
	],
}
