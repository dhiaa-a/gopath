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
			uses: ["goroutines","sync-waitgroup"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write Server with Listen(addr string) error and Shutdown(). Listen must accept connections in a loop and hand each to a goroutine. Shutdown closes the listener (causing Accept to return an error) and waits for all connection goroutines to finish with a WaitGroup.",
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
						en: "Write integration tests that start a real server on :0 (OS assigns a free port), connect with net.Dial, send lines, and assert the response. The server must shut down cleanly after each test. Run 10 concurrent connections in one test.",
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
								value: "go.uber.org/goleak: add goleak.VerifyNone(t) in each test or goleak.VerifyTestMain(m) in TestMain.",
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
