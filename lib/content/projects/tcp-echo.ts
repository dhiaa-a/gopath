import { Project } from "../../content"

export const tcpEcho: Project = {
	slug: "tcp-echo",
	name: "TCP echo server",
	tagline:
		"Handle concurrent TCP connections: the network plumbing under every Go service.",
	code: "TCP",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "3–4 hours",
	tags: ["net", "io", "bufio", "goroutines", "integration-testing"],
	lab: {
		path: "labs/tcp-echo",
		command: "go test -race ./...",
		summary: {
			en: "An integration suite dials your server over real TCP sockets: per-line uppercase echo, framing across one connection, the quit command, 10 concurrent clients, a Shutdown that returns while a connection goroutine is still running failing the run, and goleak catching any goroutine that outlives the suite.",
		},
	},
	mentalModels: [
		"accept loop: one goroutine per connection",
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
			value: `labs/tcp-echo/echo/
 ├── server.go     your implementation: Server, Listen, Addr, Shutdown
 ├── handler.go    yours too: handleConn, the per-connection scanner loop
 ├── echo_test.go  integration suite: real sockets, goleak in TestMain
 └── solution.go   reference, sealed behind the solution build tag`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "The accept loop" },
			uses: ["goroutines","sync-waitgroup"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write Server with Listen(addr string) error, Addr() net.Addr, and Shutdown(). Listen binds the address, starts the accept loop in a background goroutine, and returns; the loop hands each accepted connection to a goroutine. Addr reports the bound address, so a server started on port :0 is dialable. Shutdown closes the listener (causing Accept to return an error) and waits for the accept loop and all connection goroutines to finish with a WaitGroup. This exact surface is what the lab suite compiles against.",
					},
					why: {
						en: "This is the accept loop pattern: the foundation of every network server. net.Listener.Accept blocks until a connection arrives or the listener is closed. Closing the listener is the shutdown signal; the error from Accept tells you which case occurred. The per-connection goroutine is the same fan-out pattern as the log parser worker pool, applied to connections instead of file paths.",
					},
					stdlibHint: "net: net.Listen, net.Listener, net.Conn",
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
			uses: ["defer"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: 'Implement handleConn(conn net.Conn). Read lines with bufio.Scanner, uppercase each with strings.ToUpper, write back with fmt.Fprintln. If the client sends "quit", close the connection cleanly. Set a 30-second idle deadline with conn.SetDeadline and reset it on each line received.',
					},
					why: {
						en: "net.Conn implements both io.Reader and io.Writer. bufio.Scanner wraps the Reader exactly as it wrapped os.File in the log parser: same API, different underlying type. conn.SetDeadline prevents a goroutine from blocking forever on an idle connection. You must reset the deadline after each successful read or the connection times out even for active clients.",
					},
					stdlibHint:
						"bufio, strings, fmt, net, time: bufio.NewScanner, conn.SetDeadline",
				},
			],
		},
		{
			n: "03",
			heading: { en: "Integration test with net.Dial" },
			uses: [],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "The lab ships this suite: echo_test.go starts your server on 127.0.0.1:0 (the OS assigns a free port), connects with net.Dial, sends lines, and asserts the responses; TestConcurrent drives 10 connections at once. Read it before you run it, it is the model for the integration tests you will write yourself in T3. Every test ends in Shutdown, and goleak in TestMain fails the run if any goroutine survives the suite.",
					},
					why: {
						en: "Unit tests with mocks cannot tell you if TCP framing, buffering, or connection lifecycle is correct. An integration test with a real socket proves the full path. Port :0 lets the OS pick a free port, so no conflicts between parallel test runs. This is the integration testing approach you will apply in all T3 projects.",
					},
					stdlibHint:
						"net, testing, bufio: net.Dial, listener.Addr().String()",
				},
				{
					type: "assessment",
					assessment: {
						kind: "integration",
						title: "TCP server integration tests",
						description:
							"The lab ships the suite: go test -race ./... in labs/tcp-echo must pass. The tests dial your server over real TCP sockets on 127.0.0.1 through the exported API stubbed in echo/server.go, and goleak.VerifyTestMain in TestMain fails the run if the accept loop or any connection goroutine is still alive after the tests finish.",
						labPath: "labs/tcp-echo",
						testCases: [
							{
								description: "TestEchoSingle: one line",
								input: "hello",
								expected: "HELLO",
							},
							{
								description:
									"TestEchoMultiLine: three lines sent in one TCP write",
								input: "foo\\nbar\\nbaz",
								expected:
									"FOO\\nBAR\\nBAZ, one reply per line, in order",
							},
							{
								description: "TestQuit: the quit command",
								input: "quit",
								expected:
									"server closes the connection: EOF, zero extra bytes",
							},
							{
								description:
									"TestConcurrent: 10 clients at once, 5 lines each",
								expected:
									"every reply matches its own connection",
							},
							{
								description:
									"TestShutdownWaitsForActiveConn: a client held open across Shutdown",
								expected:
									"Shutdown blocks until the client closes, then returns: it waits for the connection goroutine, not just the listener",
							},
						],
						desiredOutput:
							"--- PASS: TestEchoSingle (0.00s)\n--- PASS: TestEchoMultiLine (0.00s)\n--- PASS: TestQuit (0.00s)\n--- PASS: TestConcurrent (0.00s)\n--- PASS: TestShutdownWaitsForActiveConn (0.20s)\nPASS\nok  \tgopath.dev/labs/tcp-echo/echo\t0.44s",
						hints: [
							{
								label: "goleak",
								value: "go.uber.org/goleak: the suite's TestMain calls goleak.VerifyTestMain(m). A goroutine that outlives the tests fails the run and prints its stack, which names the exact line where it is still blocked.",
							},
							{
								label: "the pinned API",
								value: 'The suite constructs &echo.Server{}, calls Listen("127.0.0.1:0"), dials Addr().String(), and ends every test with Shutdown. The signatures are already stubbed in labs/tcp-echo/echo/server.go.',
							},
							{
								label: "-race",
								value: "go test -race ./... runs the Go race detector across the 10 concurrent connections. -race needs cgo; on Windows without gcc, drop the flag.",
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
				en: "The accept loop, per-connection goroutines, bufio scanning, idle deadlines: these are the exact primitives gRPC and the database driver use internally. You now understand the layer underneath.",
			},
		},
	],
}
