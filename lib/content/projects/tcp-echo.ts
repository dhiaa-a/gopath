import { Project } from "../../content"

export const tcpEcho: Project = {
	slug: "tcp-echo",
	name: "TCP echo server",
	tagline:
		"Handle concurrent TCP connections: the network plumbing under every Go service.",
	code: "TCP",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "13–15 hours",
	tags: ["net", "io", "bufio", "goroutines", "sync", "integration-testing"],
	lab: {
		path: "labs/tcp-echo",
		command: "go test ./...",
		summary: {
			en: "An integration suite that dials your server over real TCP sockets: per-line uppercase echo, framing across one connection, the quit command, 10 concurrent clients, one client parked mid-exchange while another is served, a Shutdown that returns while a connection goroutine is still running failing the run, and goleak catching any goroutine that outlives the suite.",
		},
	},
	mentalModels: [
		"a connection is an io.Reader plus an io.Writer",
		"the delimiter is the protocol",
		"accept loop: one goroutine per connection",
		"deadlines are absolute, not rolling",
		"shutdown waits, it does not just close",
		"a green suite is not a correct server",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "A net.Listener accepts connections in a loop. Each net.Conn is handed to a goroutine that owns it for life. The goroutine reads lines with bufio.Scanner, uppercases them, and writes them back. A read deadline evicts idle connections. Shutdown closes the listener and then waits for every goroutine it started to exit.",
			},
		},
		{
			type: "text",
			value: {
				en: "That last sentence is the project. Echoing bytes is an afternoon. Proving that nothing is still running when Shutdown returns is the part production servers get wrong, and it is the part this lab refuses to take on faith. Half of these steps are about the difference between a server that works and a server you can prove things about, because on this project you will meet three separate bugs that leave the test suite completely green.",
			},
		},
		{
			type: "code",
			value: `net.Listen(":addr") → accept loop → go handleConn(conn)
                                → bufio.Scanner → uppercase → conn.Write

Shutdown() → listener.Close() → Accept returns net.ErrClosed
                              → wg.Wait() → nothing is running`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/tcp-echo/echo/
 ├── server.go     your implementation: Server, Listen, Addr, Shutdown
 ├── handler.go    yours too: handleConn, the per-connection scanner loop
 ├── echo_test.go  integration suite: real sockets, 6 tests, goleak in TestMain
 └── solution.go   reference, sealed behind the solution build tag`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "The accept loop" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Start with the spine, because nothing else in this project can run until it exists. A server is the loop that keeps producing connections to hand off, and the interesting part of that loop is not how it starts. It is how it stops, because the only way to interrupt a goroutine blocked in Accept is to close the thing it is blocked on and read the error correctly.",
					},
				},
				{
					type: "requirement",
					what: {
						en: 'Implement Listen(addr string) error, Addr() net.Addr, and a first version of Shutdown() in labs/tcp-echo/echo/server.go. Listen binds addr with net.Listen("tcp", addr), keeps the listener on the Server, starts the accept loop in a background goroutine, and returns while that loop is running. Addr reports the listener\'s address, which is how a server started on port :0 becomes dialable. The accept loop calls Accept in a for loop, hands each connection to go s.handleConn(conn), and exits when Accept returns an error. Shutdown, for now, closes the listener and nothing else. handleConn stays the empty stub; it is step 02.',
					},
					why: {
						en: "This is the accept loop pattern, and it is under every network server you have ever used, including net/http's. Accept blocks until a connection arrives or the listener is closed, and there is no other way to wake it: you cannot cancel it with a context, and you cannot interrupt the goroutine from outside. That is why Shutdown starts life as listener.Close(): closing is the shutdown signal, and the error Accept returns is how the loop learns which of the two things happened. Listen returning while the loop runs in the background is what makes the Server usable: the caller gets control back, and the tests can dial it on the next line. Port :0 is the OS telling you which port it picked rather than you guessing, which is why the suite can run tests without ever colliding with a leftover server or with whatever else on your machine wanted 8080.",
					},
					stdlibHint:
						"net: net.Listen, net.Listener, net.Conn, net.ErrClosed, Listener.Addr, Listener.Close. errors: errors.Is.",
					complexSnippet: `func (s *Server) acceptLoop() {
    for {
        conn, err := s.ln.Accept()
        if err != nil {
            // Closed listener, or a real failure. Either way this
            // loop is over: Accept on a broken listener does not heal.
            // errors.Is(err, net.ErrClosed) tells the two apart when
            // you want to log only the real ones.
            return
        }
        go s.handleConn(conn)   // step 05 is about this line
    }
}`,
					hints: [
						{
							label: "net.ErrClosed is the sentinel",
							value: 'Accept on a closed listener returns an error wrapping net.ErrClosed, matchable with errors.Is(err, net.ErrClosed). Do not string-match on "use of closed network connection". That text is not API and it has changed.',
						},
						{
							label: "why return on every error, not just ErrClosed",
							value: "Because there is no error from Accept that this program recovers from by trying again. A production server distinguishes the cases to decide what to log, and historically to retry on temporary errors like hitting the fd limit, but it still never loops on ErrClosed. Returning on everything is right here and honest; what is never right is continuing on everything, which is the break-it below.",
						},
						{
							label: "Addr before Listen",
							value: "Addr() is called by the tests right after Listen, and on a zero-value Server it would nil-dereference. Return nil when the listener is nil. The suite's message for that case names it exactly.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command: "go test -run TestEchoSingle -count=1 ./...",
					expect: {
						en: 'The failure moves, which is the whole point of running it now. You no longer get "Addr() returned nil after a successful Listen"; you now wait five seconds and get `reading the echo for "hello": read tcp 127.0.0.1:20349->127.0.0.1:20348: i/o timeout`. That is progress, and it is the expected shape of it here: the listener is bound, Addr reported a real port, the client dialed it successfully, and the accept loop handed the connection to a handler that does nothing yet. Read the failure as a map of how far the bytes got.',
					},
					labPath: "labs/tcp-echo/echo/server.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In the accept loop, change return to continue on the Accept error, so the loop tries again instead of giving up. Run go test -count=1 -timeout 20s ./... and watch your CPU.",
					},
					observe: {
						en: "Every test fails with `Shutdown still blocked after 5s; it must close the listener and return once the accept loop and every connection goroutine have exited`, the run eventually dies with `panic: test timed out after 20s`, and one core is pinned at 100% the whole time. The panic prints every goroutine's stack, and yours is sitting in Accept.",
					},
					why: {
						en: "A closed listener does not become open again. Accept returns net.ErrClosed immediately, every time, forever, so continue turns the loop into a spin: millions of failed Accept calls a second, burning a core, and the loop never exits. This is the version of the bug that gets shipped, because with the listener open, which is every moment before shutdown, continue and return behave identically. The difference only appears on the path you exercise once per process lifetime, which is precisely the path nobody tests by hand.",
					},
				},
			],
			retrievalPrompt:
				"A goroutine is blocked in listener.Accept(). You want it to stop. What are your options? || One: close the listener. Accept returns an error wrapping net.ErrClosed and the loop can exit. There is no second option. You cannot cancel Accept with a context, you cannot interrupt the goroutine from outside, and nothing else will wake it. That is why closing the listener is the shutdown signal in every Go server, and why the loop's error handling is a shutdown mechanism rather than error hygiene.",
		},
		{
			n: "02",
			heading: { en: "A connection is an io.Reader and an io.Writer" },
			uses: ["interfaces"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Your accept loop is handing connections to a function that does nothing. Before you fill it in, find out what a net.Conn actually is, because the shape of the rest of this project falls out of the answer. It is not a network object with a network API. It is an io.Reader and an io.Writer with an address attached, which means every tool you already used on files works on it unchanged, and the scanner loop you wrote over an os.File in the log parser is the loop you are about to write over a socket.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Commit to the shape of handleConn(conn net.Conn) in labs/tcp-echo/echo/handler.go, and give it the one line it needs no matter what goes inside: defer conn.Close() at the top. This function owns conn. It is the only code in the program that reads it, writes it, or closes it, and when it returns the connection is finished. Nothing reachable from the Server struct touches that conn.",
					},
					why: {
						en: "net.Conn's method set is Read([]byte) (int, error) and Write([]byte) (int, error), plus Close, two addresses, and three deadline setters. Eight methods. The first two are exactly io.Reader and io.Writer, which is why bufio.Scanner, io.Copy, fmt.Fprintln and every other consumer of those interfaces accepts a socket without knowing it is one. The standard library is composed this way deliberately: the interfaces are small enough that satisfying them is cheap, so anything that does inherits the whole ecosystem for free. Single ownership matters for the same reason it did in the log parser, only the failure is nastier here: two goroutines writing one conn interleave their bytes inside a line, and the client has no way to detect it. The deferred Close is how ownership becomes a fact rather than an intention, and step 04 is where you find out what it costs to leave it out.",
					},
					stdlibHint: "net: net.Conn, Conn.Close. io: io.Reader, io.Writer, io.Copy. defer.",
					hints: [
						{
							label: "read the method set, do not take my word for it",
							value: "go doc net.Conn prints the whole interface. Notice what is absent: no ReadLine, no ReadMessage, no SendString. That absence is step 03.",
						},
						{
							label: "ownership is a convention, not a compiler feature",
							value: "Nothing stops you from stashing conn on the Server struct and writing to it from elsewhere. The reason not to is that the moment two goroutines can reach one conn, you own a data race whose symptom is a corrupted line on a customer's screen, not a crash.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command: "go doc net.Conn",
					expect: {
						en: "The full interface, and it is small: Read and Write with the io signatures, Close, LocalAddr, RemoteAddr, and SetDeadline / SetReadDeadline / SetWriteDeadline. Read the doc comments on Read and Write while you are here, because they point at SetDeadline, which is step 06. There is nothing about lines, messages, or requests. Everything this server does beyond moving raw bytes, you are about to build out of those eight methods.",
					},
					labPath: "labs/tcp-echo/echo/handler.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Write the shortest echo server that exists and nothing else. In handleConn, under the defer: io.Copy(conn, conn). Import io, drop whatever the compiler says is unused, and run go test -count=1 ./... in labs/tcp-echo.",
					},
					observe: {
						en: 'It echoes. TestEchoSingle fails with `echo for "hello" = "hello", want "HELLO"`, and TestQuit fails five seconds later with an i/o timeout. The bytes made the round trip. The server just did not do anything to them on the way, and it never hung up.',
					},
					why: {
						en: 'io.Copy(conn, conn) is a real echo server, and on a good day it is the right answer: it reads whatever bytes are there and writes them straight back, forever, until one side closes. Read that failure precisely, because it is not saying the copy is broken. It is saying the copy is a byte pump and this protocol is about lines, and a byte pump cannot see a line, because at the level it operates there is no such thing. io.Copy has no idea where "hello" ends, so it cannot uppercase it. It has no idea that "quit" is a word rather than four bytes among many, so it cannot hang up on it. Every remaining step in this project exists because moving bytes is not speaking a protocol.',
					},
				},
			],
			retrievalPrompt:
				"bufio.Scanner was written for files. Why does it work on a TCP socket with no adapter? || Because it never knew about files. It takes an io.Reader, and net.Conn's Read method has exactly the io.Reader signature, so a socket satisfies the interface without being told. That is the payoff of the standard library's interfaces being one method wide: satisfying them is nearly free, so almost everything does, and every consumer of them works on things their authors never saw.",
		},
		{
			n: "03",
			heading: { en: "The delimiter is the protocol" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: 'TCP does not send messages. It sends bytes, in order, with no record of where one of your writes ended and the next began. A client calling Write once with "foo\\nbar\\nbaz\\n" is not sending three of anything. It is putting twelve bytes into a stream. If your server thinks in terms of what the client sent, it is already wrong, and it will keep working on your laptop for months before it stops working in production.',
					},
				},
				{
					type: "requirement",
					what: {
						en: "Replace the io.Copy from the last step. Read lines from conn with a bufio.Scanner, uppercase each one with strings.ToUpper, and write each back with fmt.Fprintln. The suite sends three lines in a single TCP write and requires three separate replies, in order, one per line. Where a line ends is your scanner's decision and never the client's.",
					},
					why: {
						en: "TCP is a byte stream, so the boundaries of the client's Write calls are not preserved and nothing promises to preserve them: the kernel, the NIC, and every router in between may split one write into four segments or coalesce four writes into one. Three writes can arrive as one read; one write can arrive as four. A line protocol answers this by agreeing on a delimiter, \\n, and that agreement is the entire protocol. bufio.Scanner's default split function is ScanLines: it buffers until it finds the delimiter, then hands you exactly one token with the delimiter stripped, so Scan() returning true means a complete line arrived and Text() is that line, whatever the packets did. This is the same problem HTTP solves with Content-Length and chunked encoding, and gRPC with a length prefix on every message. You have never had to think about it because that framing shipped inside the library. Here you are the library.",
					},
					stdlibHint:
						"bufio: bufio.NewScanner, Scanner.Scan, Scanner.Text, bufio.ScanLines, bufio.MaxScanTokenSize. strings.ToUpper. fmt.Fprintln.",
					complexSnippet: `sc := bufio.NewScanner(conn)   // conn is just an io.Reader here
for sc.Scan() {                // true = one whole line arrived
    line := sc.Text()          // the line, delimiter already stripped
    // ... transform and write it back, delimiter included
}
// Scan returned false: EOF, a deadline, or a read error.
// sc.Err() tells them apart. It is nil on a clean EOF.`,
					hints: [
						{
							label: "Scan strips the delimiter, Fprintln puts one back",
							value: "Text() gives you the line without its \\n. fmt.Fprintln appends one. The two cancel out, which is why the pair reads as a no-op and why using fmt.Fprint instead is such an easy mistake to make. Try it in the break-it below.",
						},
						{
							label: "a line is not unbounded",
							value: "bufio.MaxScanTokenSize caps a token at 64KB unless you call Scanner.Buffer. A client that sends 100KB with no newline does not get an error from your echo; Scan just returns false and your handler exits, which the client sees as an unexplained hang-up. Real line protocols set that limit on purpose, because otherwise a single client can make you buffer as much memory as it feels like sending.",
						},
						{
							label: "check sc.Err() or decide not to",
							value: "Scan returning false means EOF, deadline, or error, and only sc.Err() distinguishes them. An echo server genuinely does not need to care: every case ends the same way, by closing the connection. Saying so in a comment is worth more than logging it, because the next reader will wonder.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"go test -run 'TestEchoSingle|TestEchoMultiLine' -count=1 -v ./...",
					expect: {
						en: 'Both PASS. Then read TestEchoMultiLine: it sends "foo\\nbar\\nbaz\\n" in one conn.Write and reads three replies. Nothing in your handler knew that was one write, and nothing in it would have known if the client had sent the twelve bytes one at a time with a second between each. That is the property you just bought. TestQuit and TestShutdownWaitsForActiveConn still fail; they are steps 04 and 07.',
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Change fmt.Fprintln to fmt.Fprint in your write, so the reply goes out without its trailing newline. Run go test -count=1 ./...",
					},
					observe: {
						en: 'Three tests fail, each after a five second wait: `reading the echo for "hello": read tcp 127.0.0.1:51065->127.0.0.1:51064: i/o timeout; the server must write the uppercased line back, terminated by \\n`. Not "wrong answer". A timeout.',
					},
					why: {
						en: 'Every byte you sent was correct and the client already has them. HELLO is sitting in its receive buffer right now. It is blocked in ReadString(\'\\n\') waiting for the one byte that says the line is over, and that byte is the only thing in this protocol that means anything: it is the frame. Without it the client cannot tell "the reply is HELLO" from "the reply starts with HELLO and more is coming", and it must assume the second, because that is what a stream is. You did not fail to answer. You failed to say you were finished, and on a stream those are the same thing. This is why a timeout, not a wrong value, is the signature failure of a framing bug, and why framing bugs get diagnosed as network problems for a week before someone reads the protocol.',
					},
				},
			],
			retrievalPrompt:
				'A client sends "foo\\nbar\\n" in one Write. Your server replies to each line separately and it all works. What did your scanner actually guarantee, and what did it not? || It guaranteed that you saw two complete lines, because it buffers until it finds each \\n. It did not guarantee anything about how those bytes arrived: one read or six, one packet or four. The client\'s write boundaries were never visible to you and never will be. TCP is a byte stream; the delimiter is the only thing that makes it a sequence of messages.',
		},
		{
			n: "04",
			heading: { en: "Own the connection to the end" },
			uses: ["defer"],
			blocks: [
				{
					type: "text",
					value: {
						en: 'A connection has more ways to end than you have branches: the client sends quit, the client vanishes, the deadline fires, a write fails, your scanner gives up on a 70KB line. Every one of those has to close the socket, and "every one" is the problem, because you will add a branch in six months and forget.',
					},
				},
				{
					type: "requirement",
					what: {
						en: 'Implement the quit command: the exact line "quit" makes the server close the connection with no echo. Every other line, including "QUIT" and "quit " with a trailing space, is just a line to uppercase. The defer conn.Close() you wrote in step 02 is what makes this a two-line change rather than a new exit path to get wrong.',
					},
					why: {
						en: "defer is the answer to a question that has no good answer without it: how do you guarantee cleanup across five exit paths, one of which is a panic, without repeating the cleanup five times and missing the sixth when you add it? Registering the close once, next to the thing it closes, means the cleanup cannot drift away from the acquisition. That is the whole idiom, and it is why Go has no finally. The quit command is a small thing with a real lesson attached: it is a command, not data, and telling those apart is the job of the layer that understands the protocol, which is you. The client asked you to hang up. Hanging up is not an error and is not an echo.",
					},
					stdlibHint: "defer. net: Conn.Close.",
					hints: [
						{
							label: "close the conn, not just the scanner",
							value: "bufio.Scanner has no Close and needs none: it holds a buffer, not a resource. The socket is the resource. Closing it is what the client sees as EOF.",
						},
						{
							label: "quit is exact",
							value: 'sc.Text() gives you the line with the delimiter already stripped, so compare against "quit" directly. If you find yourself reaching for TrimSpace, decide deliberately whether "quit " is the same command, and write down which. Protocols are made of decisions like this one, and undocumented leniency is how two implementations stop agreeing.',
						},
						{
							label: "Close returns an error you can ignore here",
							value: "defer conn.Close() discards it, which vet accepts and is right for a read path: there is nothing you would do about a failed close on a socket you are done with. On a file you wrote, the opposite is true, because Close is where a buffered write finally fails.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command: "go test -run TestQuit -count=1 -v ./...",
					expect: {
						en: 'PASS, in about 0.00s. The test sends "quit" and then calls io.ReadAll on the connection: it requires a clean EOF and exactly zero bytes. EOF is what your conn.Close() looks like from the other end of the wire. Zero bytes is the assertion that you did not echo the command back.',
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the defer conn.Close() from handleConn, changing nothing else. Your handler still returns on quit, exactly as before. Run go test -count=1 ./...",
					},
					observe: {
						en: 'TestQuit fails after a five second wait: `read after "quit": read tcp 127.0.0.1:24129->127.0.0.1:24128: i/o timeout; the server must close the connection, which this client sees as a clean EOF`. Everything else passes, and goleak says nothing.',
					},
					why: {
						en: "Your goroutine returned. The connection did not close. Those are unrelated events, and conflating them is the bug: a goroutine ending does not release what it was holding, because the socket is a file descriptor owned by the process, and nothing collects it when the last function that mentioned it returns. Go has no destructors. So the client sits there, correctly, waiting for a server that has already forgotten it exists, until its own deadline gives up. Now notice which tool did not save you. goleak counts goroutines, and there is no leaked goroutine here: yours exited cleanly. What leaked is a file descriptor, which goleak cannot see, and which under load is how a server dies at 3am with `accept: too many open files` while every dashboard reads green. The tool answers the question it was asked. Knowing which question that was is the difference between a passing suite and a correct server.",
					},
				},
			],
			retrievalPrompt:
				"handleConn returns. What have you released, and what have you not? || You have released the goroutine and its stack, and nothing else. The socket is a file descriptor the process owns, and it stays open until something calls Close on it. Go has no destructors and the garbage collector will not do it for you. That is why the close is a defer at the top of the function that owns the conn: it is the only way to tie the descriptor's life to the goroutine's, which is what you meant all along.",
		},
		{
			n: "05",
			heading: { en: "One goroutine per connection" },
			uses: ["goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Your server works. It has worked since step 03, and every test you have run has agreed. Now look at the one line you have not thought about since step 01, the go in front of handleConn, and find out what your suite would have said if you had left it off. The answer is: almost nothing, for four tests out of six.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Confirm the accept loop hands off and does no work itself: its body is Accept, start a goroutine, loop. Then hold the line that makes the handoff safe: every piece of per-connection state lives as a local variable inside handleConn, never as a field on Server. The conn, the scanner, the current line, the deadline: all locals. Server holds the listener and nothing that belongs to one conversation.",
					},
					why: {
						en: "This is fan-out, the same pattern as the log parser's worker pool, applied to connections instead of file paths, and with one difference that matters: there is no pool. A worker pool bounds concurrency on purpose because the work is CPU-bound and more workers than cores is waste. Connections are the opposite: they are almost always blocked on the network, costing a few KB of stack and nothing else, so Go's answer is one goroutine each and no ceiling. That is exactly what net/http does for every request it serves, and it is why goroutines were made cheap enough to be spent this way. The cost of the design is that the accept loop can no longer be where anything happens: the moment it does work, the server is serial again. And the rule about per-connection state is what pays for the goroutines being cheap: state on the stack is private by construction, so a hundred connections need no locks at all. Move one of those locals to a Server field and you have shared mutable state across every connection, which is a data race in a program that had none, bought for nothing.",
					},
					stdlibHint: "go statement. net: Listener.Accept, net.Conn.",
					hints: [
						{
							label: "the loop variable is not the trap it used to be",
							value: "conn is declared inside the loop body by :=, so each iteration has its own. Even the classic Go loop-variable capture bug would not bite here, and since Go 1.22 (this module's version) per-iteration scoping is the language rule anyway. Capturing conn in a closure is safe.",
						},
						{
							label: "no pool, no limit, on purpose",
							value: "Unbounded goroutines sounds reckless and is: a real internet-facing server bounds accepted connections, because each one is memory an attacker can make you spend. That control belongs at the listener, not in the handler, and it is out of scope here. Know that the ceiling is missing rather than assuming it does not exist.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"go test -run 'TestConcurrent|TestSlowClientDoesNotBlockOthers' -count=1 -v ./...",
					expect: {
						en: "Both PASS, both in about 0.00s. TestConcurrent drives 10 clients at once with 5 lines each and checks that no reply crosses between connections. TestSlowClientDoesNotBlockOthers is the one that actually proves the design: it parks one client mid-exchange and requires a second one to be served while the first sits there.",
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Drop the goroutine: call s.handleConn(conn) directly from the accept loop. Run go test -count=1 ./...",
					},
					observe: {
						en: 'TestConcurrent passes. Ten clients at once, five lines each, every reply correct, in under a millisecond. Only TestSlowClientDoesNotBlockOthers fails, after five seconds: `second client: reading the echo for "second": ... i/o timeout; the first client is still connected and idle, and it must not stop the server from serving anyone else.`',
					},
					why: {
						en: 'Look at what TestConcurrent just told you, which is nothing. Its ten clients each finish and hang up in well under a millisecond, and none of them overlaps another, so a server that handles them strictly one at a time serves all ten before the first deadline is close: accept, echo five lines, client leaves, accept the next. Concurrency that is never contended is indistinguishable from a queue that is fast enough. The test named for concurrency cannot see the absence of concurrency, and it took a test that deliberately makes two clients overlap to find it. Note what still works in the broken case, too: the second client\'s dial succeeds. The kernel completes the TCP handshake and parks the connection in the listen backlog whether or not your program ever calls Accept, which is why "the client connected" proves nothing about a server, and why this failure reads as a hang rather than a refusal.',
					},
				},
			],
			retrievalPrompt:
				"Ten clients hit your server at once and every one gets correct replies within a millisecond. What have you proved about whether your handler runs concurrently? || Nothing at all. If each client is fast and none overlaps another, serving them one at a time in a queue produces identical results, just sooner than anyone notices. Proving concurrency needs contention: one client held open while another demands service. This is the shape of most false confidence in concurrent tests, and it is why the lab ships a test whose whole job is to make two clients collide.",
		},
		{
			n: "06",
			heading: { en: "Deadlines are absolute, not rolling" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "A client that closes cleanly gives you an EOF and your handler exits. A client whose laptop lid closes, or whose wifi drops, or whose power fails, sends nothing at all: no FIN, no RST, no notice. Your handler stays blocked in Scan waiting for a byte that is never coming, from a machine that no longer exists. That goroutine is now permanent, and in step 07 you will make Shutdown wait for goroutines like it, which turns this from a slow leak into a hang.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Give every connection a 30-second idle deadline with conn.SetDeadline(time.Now().Add(idleTimeout)), set once before the scan loop and pushed forward again after every line you successfully handle. idleTimeout is already declared in handler.go. An active client must never time out; a silent one must be evicted 30 seconds after its last line, not 30 seconds after it connected.",
					},
					why: {
						en: 'This is the sentence to keep: a Go deadline is an absolute point in time, not a duration and not a rolling window. SetDeadline says "fail any I/O on this conn that is still outstanding at 14:32:07", and it keeps meaning that until you say otherwise. It does not restart when data arrives, because it does not know or care that data arrived. So the deadline you set once at connect time is a 30-second limit on the connection\'s whole life, not on its idleness, and an active client gets hung up on mid-conversation. Pushing it forward after each line is what converts an absolute deadline into the idle timeout you actually wanted. Note also which deadline you are setting: SetDeadline covers reads and writes both. The write half is not decoration. A client that stops reading while it keeps sending fills your socket\'s send buffer, at which point your Write blocks, and without a write deadline it blocks forever, parking the goroutine just as thoroughly as the vanished client did. That is backpressure, and SetDeadline is what stops it from being a leak.',
					},
					stdlibHint:
						"net: Conn.SetDeadline, Conn.SetReadDeadline, Conn.SetWriteDeadline. time: time.Now, time.Duration, Time.Add.",
					complexSnippet: `_ = conn.SetDeadline(time.Now().Add(idleTimeout))
sc := bufio.NewScanner(conn)
for sc.Scan() {
    // ... handle the line ...

    // Absolute, not rolling: without this, the deadline you set
    // above is a 30-second cap on the whole connection.
    _ = conn.SetDeadline(time.Now().Add(idleTimeout))
}`,
					hints: [
						{
							label: "the deadline surfaces as an error, not a signal",
							value: "When it fires, the pending Read fails, so Scan returns false and your loop ends like any other disconnect. sc.Err() would return an error satisfying net.Error with Timeout() true. Your handler does not need to tell the cases apart; the deferred Close is correct for all of them.",
						},
						{
							label: "SetDeadline is read + write",
							value: "SetReadDeadline and SetWriteDeadline set the halves independently. Reaching for SetReadDeadline here looks more precise and quietly removes the only thing bounding a blocked write to a client that stopped reading.",
						},
						{
							label: "30 seconds is a decision, not a default",
							value: "Nothing in Go picks this number. Too short and you evict real users on slow links; too long and dead connections accumulate. net/http exposes the same choice as ReadTimeout and IdleTimeout and defaults them to zero, meaning no timeout at all, which is why an unconfigured net/http server is a known way to leak connections.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"# temporarily, in handler.go:\n#   const idleTimeout = 50 * time.Millisecond\ngo test -run TestShutdownWaitsForActiveConn -count=1 ./...",
					expect: {
						en: "The test fails, in about 0.06s: `Shutdown returned within 200ms while a connection was still open`. That failure is your proof, and it is the only proof the suite can give you: that test holds a client open and idle for 200ms, your 50ms deadline evicted it, so the connection goroutine exited early and Shutdown came back. Your deadline is wired and it fires. Read the message with your eyes open, though, because it is wrong about why: it blames Shutdown for not waiting, since that is the usual cause. The actual cause is the deadline you just shortened. A test can only report the symptom it checked, never the mechanism. Put idleTimeout back to 30 * time.Second before you move on.",
					},
					labPath: "labs/tcp-echo/echo/handler.go",
					note: {
						en: "Nothing in the suite waits out a 30-second timeout, so this hand-edit is the only way to watch the deadline work. That is deliberate and the lab README says so: a fast test for it would need a knob on Server that exists purely so a test can shorten the timeout, and putting test scaffolding in the taught API is a worse trade than the gap.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Put idleTimeout back to 30 * time.Second, then delete the SetDeadline call at the bottom of the scan loop, keeping the one above it. You have just removed the rolling reset: every connection now dies 30 seconds after it opens, mid-sentence, no matter how active. Run the whole suite: go test -count=1 ./...",
					},
					observe: {
						en: "ok. All six tests pass in half a second. goleak is silent. There is no warning, no skip, no hint that anything changed.",
					},
					why: {
						en: 'You just shipped a server that hangs up on every user after 30 seconds regardless of what they are doing, and your suite congratulated you. The reason is not that the suite is bad. It is that no test in it talks to the server for longer than one timeout window, and nothing that finishes in half a second ever can: to see the difference between a rolling deadline and an absolute one you need a client that outlives the timeout, and the timeout is 30 seconds. This is the second bug in this project that leaves the suite completely green, and you met the first one in step 04 as a leaked file descriptor. Neither is exotic. Both are the ordinary result of asking a tool a narrower question than the one you cared about. The habit worth taking from this project is not "write more tests", it is knowing, for each thing you believe about your server, which specific check would fail if it were false. Where that check does not exist, you are trusting the code, which is fine, as long as you know that is what you are doing rather than mistaking a green run for evidence.',
					},
				},
			],
			retrievalPrompt:
				'You call conn.SetDeadline(time.Now().Add(30*time.Second)) once, when the connection opens, and your client sends a line every second. What happens at t=30s, and why? || The connection dies, mid-conversation, on a perfectly active client. The deadline is an absolute instant, not a window and not an inactivity timer: it means "fail whatever I/O is outstanding at 14:32:07" and it never reconsiders, because arriving data does not move it. Pushing it forward after every line is the only thing that turns it into an idle timeout. And SetDeadline covers writes too, which is what bounds a Write to a client that stopped reading.',
		},
		{
			n: "07",
			heading: { en: "A Shutdown that waits" },
			uses: ["sync-waitgroup", "goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You wrote Shutdown back in step 01 and it has been closing the listener ever since. Run the suite now and TestShutdownWaitsForActiveConn is the one test still failing. Here is what it caught. Closing the listener stops new connections and does nothing whatsoever to the twelve conversations already in progress: those goroutines are still reading, still writing, still holding sockets, and they have never heard of your listener. A Shutdown that returns at that moment is telling its caller a lie with a very short shelf life, and the caller is usually main, about to call os.Exit.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Upgrade the Shutdown you wrote in step 01. Add a sync.WaitGroup to Server that counts every goroutine the server starts: one entry for the accept loop, taken in Listen before the go statement, and one entry per connection, taken in the accept loop before its go statement. Shutdown keeps closing the listener, which unblocks Accept, and then calls Wait. When Shutdown returns, nothing this Server started may still be running.",
					},
					why: {
						en: "A WaitGroup is a counter with a blocking Wait, and that is the whole of it. Add before you start the goroutine, Done as the goroutine's first defer, Wait to block until the count is zero. Take the Add before the go statement, never inside it, or you have a race between the counter reaching zero and the goroutine that was about to increment it. The accept loop holding its own entry is not bookkeeping symmetry, it is what makes the whole scheme sound: it means the count cannot reach zero while the loop is alive, so a connection accepted at the last microsecond is always added to a counter that is still above zero, which is exactly the condition sync.WaitGroup's documentation puts on this pattern. Chain the guarantees and you get the property worth having: Shutdown returning means the listener is closed, every connection goroutine has run its deferred Close, and every socket this server ever owned is released. That is what lets main exit knowing it finished rather than hoping.",
					},
					stdlibHint:
						"sync: sync.WaitGroup, WaitGroup.Add, WaitGroup.Done, WaitGroup.Wait. net: Listener.Close.",
					complexSnippet: `// In Listen, before the loop starts: the accept loop owns an entry
// for its whole life, so the counter can never hit zero while it
// is still able to accept another connection.
s.wg.Add(1)
go s.acceptLoop()

// In the accept loop, per connection, Add before the go statement:
s.wg.Add(1)
go func() {
    defer s.wg.Done()
    s.handleConn(conn)
}()

// Shutdown: signal, then wait. Order matters.
func (s *Server) Shutdown() {
    if s.ln != nil {
        _ = s.ln.Close()   // unblocks Accept
    }
    s.wg.Wait()            // nothing is running when this returns
}`,
					hints: [
						{
							label: "the ordering rule, from the docs",
							value: 'sync.WaitGroup\'s documentation states it: "Note that calls with a positive delta that occur when the counter is zero must happen before a Wait." Run go doc sync.WaitGroup.Add and read the rest of that paragraph, which tells you what to do about it: "Typically this means the calls to Add should execute before the statement creating the goroutine." The accept loop\'s own Add(1), taken in Listen before Wait can ever be called, is what satisfies the rule here. Drop it and the per-connection Adds become exactly the calls the docs warn about.',
						},
						{
							label: "close first, then wait",
							value: "Wait before Close and you block forever: the accept loop is still in Accept, holding its entry, and nothing has told it to stop. Close is the signal; Wait is the confirmation. Every graceful shutdown is those two beats in that order.",
						},
						{
							label: "this Shutdown does not interrupt anyone",
							value: "It waits for connections to end on their own, which is why the idle deadline from step 06 is what bounds it: without one, a vanished client makes Shutdown block forever. A production drain adds a deadline of its own and stops accepting before it starts waiting; that ordering problem is the ship-it project's, not yours today.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"go test -run TestShutdownWaitsForActiveConn -count=1 -v ./...",
					expect: {
						en: "PASS, and note the time: about 0.21s, when every other test in this suite finishes in 0.00s. That 200ms is the test holding a connection open and requiring that Shutdown stay blocked the whole time. You are being graded on not returning.",
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the s.wg.Wait() line from Shutdown, so it closes the listener and returns, exactly like your step 01 version did. Leave every Add and Done where they are. Run go test -count=1 ./...",
					},
					observe: {
						en: "Five of six tests pass. goleak is silent. Only TestShutdownWaitsForActiveConn fails, instantly: `Shutdown returned within 200ms while a connection was still open; it must wait for every connection goroutine to exit, not just close the listener`.",
					},
					why: {
						en: 'Shutdown now means "the listener is closed" and nothing more, and the caller cannot tell, because the word Shutdown promises otherwise. In this lab the cost is one failed test. In a real service it is the whole reason graceful shutdown exists: main calls Shutdown, gets control back, and calls os.Exit while forty requests are mid-write. Every one of those clients sees a connection torn down with no reply and no error to distinguish your deploy from a network fault. The deploy looks clean from your side, because nothing crashed and nothing logged. Only one test in six catches this, and that is not an accident of test design: step 08 is about why the other five could not.',
					},
				},
			],
			retrievalPrompt:
				'Shutdown closes the listener and returns. The accept loop exits a microsecond later, every connection goroutine finishes soon after, nothing crashes, nothing logs. What did you get wrong? || Shutdown returned before its work was done, so its return value carries no information. The caller, usually main, treats it as "finished" and exits the process, killing every conversation still in flight. The fix is a WaitGroup counting the accept loop plus each connection: close the listener to signal, then Wait to confirm. Closing is a request. Waiting is what makes the word Shutdown true.',
		},
		{
			n: "08",
			heading: { en: "What goleak and the race detector cannot see" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have now met two bugs that left this suite completely green: a leaked file descriptor in step 04 and a deleted deadline reset in step 06. This step is about the third, and about why the tooling everyone reaches for would not have caught any of them. This is the most transferable half hour in the project, because the tools are not going to get better at reading your mind and you are going to keep trusting them.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Run one experiment rather than take this on faith. With your server green, delete s.wg.Wait() from Shutdown again, and this time run only the four tests that existed before this lab grew its last two: go test -count=1 -run 'TestEchoSingle|TestEchoMultiLine|TestQuit|TestConcurrent' ./... . Predict the result before you press enter. Then put Wait back.",
					},
					why: {
						en: 'goleak asks exactly one question, after the last test, once: is any goroutine still running that was not running when we started? A Shutdown that closes the listener and never waits does leave goroutines running, briefly, and then they end. The accept loop sees net.ErrClosed and returns. The connection goroutines see EOF, because the test client closed, and return. All of that takes microseconds, and goleak looks afterwards, and finds a clean process. It is not being fooled. It is answering the question it was asked, which is "is anything running at the end", not "did Shutdown wait", and those questions have the same answer only when the thing that would still be running is stuck forever. Orphaned goroutines that exit on their own a moment later are invisible to it by construction.',
					},
					stdlibHint:
						"go.uber.org/goleak: goleak.VerifyTestMain. testing: TestMain. go test -race.",
					thirdPartyHint:
						"goleak is the suite's second grader and it is already wired up in echo_test.go's TestMain. You do not add it; you find out what it is worth.",
					hints: [
						{
							label: "goleak only speaks on a green run",
							value: 'Its message begins "Errors on successful test run", and that is literal: if a test already failed, goleak stays quiet. So while you are red it is not checking anything, and its silence during the debugging you did in steps 01 to 07 meant nothing at all.',
						},
						{
							label: "what -race can tell you, and what it cannot",
							value: "The race detector instruments memory access and reports unsynchronized concurrent access it actually observes. The Go race detector documentation is explicit about the limit: it finds races that happen at runtime, so it cannot find races in code paths that are not executed. It is a witness, not a proof. A race on a path your tests never drive is a race it never sees.",
						},
						{
							label: "-race needs cgo, and says so first",
							value: "Without a C toolchain the run stops before a single test executes: `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`. That is the whole failure and it is not about your code. It works out of the box on Linux and macOS; on Windows it needs a gcc. Without it the tests still drive 10 concurrent connections, the detector just cannot watch them.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"# with s.wg.Wait() deleted from Shutdown:\ngo test -count=1 -run 'TestEchoSingle|TestEchoMultiLine|TestQuit|TestConcurrent' ./...",
					expect: {
						en: "ok, in about 0.36s. Four passes and a silent goleak, on a server whose Shutdown does not wait for anything. That was this suite before it grew its fifth and sixth tests, and it is the exact state a reasonable person would have called done. The bug was there the whole time. The suite had to be extended on purpose, by someone who already suspected, to make it speak.",
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Now make Shutdown do nothing at all: delete the listener Close too, so the body is empty. Run the same four tests.",
					},
					observe: {
						en: "PASS, and then the run fails anyway: `goleak: Errors on successful test run: found unexpected goroutines:` followed by a stack with `internal/poll.(*FD).Accept` on it. This time goleak catches you, and it names the exact line where your goroutine is still sitting.",
					},
					why: {
						en: "Hold these two results next to each other, because the pair is the lesson. Deleting Wait leaves goroutines that are dying: nobody waits for them, but the listener closed and the clients hung up, so they finish on their own before goleak looks, and it reports nothing. Deleting Close as well leaves a goroutine that is stuck: the listener is open, so Accept blocks forever, and nothing will ever wake it. goleak finds that one instantly, because permanence is the only thing it can detect. So the tool is not measuring correctness of shutdown, it is measuring whether anything is permanently parked at the end of the process, and a great many real bugs are neither permanent nor at the end of a process. Same tool, same suite, same silence, two completely different situations. When goleak passes, what you have learned is that nothing is stuck forever. Everything else you believe about your server, you believe because of a test you wrote for it or not at all.",
					},
				},
			],
			retrievalPrompt:
				"goleak passes. Precisely what do you now know? || That no goroutine was permanently parked when the process was about to exit, on the code paths your tests actually drove. Not that Shutdown waited: goroutines orphaned by a non-waiting Shutdown exit on their own microseconds later, long before goleak looks, so it sees a clean process. Not that you have no leaks under load, since it only saw the paths the tests ran. It is a check for permanence at exit, and reading it as a certificate of correct lifecycle management is how the bug ships.",
		},
		{
			n: "09",
			heading: { en: "Green, and the suite that got you there" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "Get all six green, then spend twenty minutes on the file you have been graded by rather than reading. You have just learned that this suite has blind spots and that two of its six tests exist only because someone went looking for one. That makes it worth reading as a piece of design, not as a grader.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Get the suite green. Then read labs/tcp-echo/echo/echo_test.go end to end and answer three questions from the source: why does every test bind 127.0.0.1:0 instead of a port you choose; why does dial set a deadline on the client side when the server has its own; and why does the t.Cleanup registered by startServer run after the one registered by dial, and what did that ordering hide for as long as the suite had four tests. Then open solution.go and compare where the WaitGroup entries are taken and where the deadline is reset.",
					},
					why: {
						en: 'Port :0 asks the OS for a free port and Addr reports which one it picked, so tests never collide with each other, with a leftover server from a crashed run, or with whatever else on your machine wanted 8080. Guessing a port is a flaky test you write yourself. The client-side deadlines are the difference between a failure and a hang: a server that never replies must fail this suite in five seconds with a message naming the guarantee, not stall CI for ten minutes and get killed by a timeout nobody reads. That is a property you design in, and it is why every dial, read, write, and Shutdown in there carries one. The t.Cleanup ordering is the subtle one and it is the whole story of this project: cleanups run in reverse registration order, so the connection closes before Shutdown is called, which means the connection goroutine was always already gone, which is exactly why four tests could not see a Shutdown that never waited. The hole was not carelessness. It was a consequence of a reasonable helper, and it took someone asking "what would still pass if this were broken" to find it.',
					},
					stdlibHint:
						"testing: testing.T, T.Cleanup, T.Helper, TestMain. net: net.Dial, net.DialTimeout, Conn.SetDeadline.",
					hints: [
						{
							label: "why a real socket instead of a mock",
							value: "A fake net.Conn would have passed every framing bug in this project. It cannot split a write across two reads the way a real stack can, it has no send buffer to fill, no deadline behaviour, and no listen backlog. The bugs in this project live in the space between your code and the kernel, and a mock is a model of your code's assumptions, which is where the bugs came from. This is the integration approach every T3 project uses.",
						},
						{
							label: "read the reference after you are green, not before",
							value: "Once you have made the decisions yourself you have a question about every line: not what does this do, but why did they put it there when I put it here. Before that, the same file is prose that looks obvious.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/tcp-echo",
					command:
						"go test -v -count=1 ./...\ngo test -count=1 -tags solution ./...",
					expect: {
						en: "The first run shows six PASS lines and ok. The second runs the identical suite against the reference implementation and is also ok, which is the only reason you should believe the first: a suite nobody has ever passed is a guess, not evidence. Note TestShutdownWaitsForActiveConn's 0.21s against everything else's 0.00s. That is the one test in here that is graded on waiting.",
					},
					labPath: "labs/tcp-echo/echo/echo_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Run go test -count=1 -tags solution ./... and confirm the reference is green. Then edit solution.go to break one thing: drop the strings.ToUpper, or delete the Wait. Rerun with -tags solution. Then restore it with git checkout.",
					},
					observe: {
						en: "The reference fails exactly the tests your code would have failed for the same mistake. The suite has no idea which file it is looking at.",
					},
					why: {
						en: "The suite compiles against whatever satisfies the package's exported API and dials it over a socket; it has no privileged knowledge of the reference and no diff against a known answer. That is what makes it a description of the contract rather than a check that you wrote the same code as someone else, and it is why your design decisions inside Server are yours. It is also why the lab ships the reference behind the same six tests instead of as prose: an unverified reference is an opinion. Which brings this project back to where it started. The suite is honest, it is passable, it is proven passable, and it still cannot see a leaked file descriptor or a deadline that never rolls. Both things are true at once, and holding both is what the next tier is for.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "integration",
						title: "TCP server integration tests",
						description:
							"The lab ships the suite: go test -race ./... in labs/tcp-echo must pass. The tests dial your server over real TCP sockets on 127.0.0.1 through the exported API stubbed in echo/server.go, and goleak.VerifyTestMain in TestMain fails the run if the accept loop or any connection goroutine is still alive after the tests finish. Four tests pin one wire behaviour each; two pin the guarantees the wire cannot show you.",
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
									"TestSlowClientDoesNotBlockOthers: one client parked mid-exchange while a second dials",
								expected:
									"the second client is served anyway: there is a goroutine per connection, not an accept loop serving one caller at a time",
							},
							{
								description:
									"TestShutdownWaitsForActiveConn: a client held open across Shutdown",
								expected:
									"Shutdown blocks until the client closes, then returns: it waits for the connection goroutine, not just the listener",
							},
						],
						desiredOutput:
							"--- PASS: TestEchoSingle (0.00s)\n--- PASS: TestEchoMultiLine (0.00s)\n--- PASS: TestQuit (0.00s)\n--- PASS: TestConcurrent (0.00s)\n--- PASS: TestSlowClientDoesNotBlockOthers (0.00s)\n--- PASS: TestShutdownWaitsForActiveConn (0.21s)\nPASS\nok  \tgopath.dev/labs/tcp-echo/echo\t0.50s",
						hints: [
							{
								label: "goleak",
								value: "go.uber.org/goleak: the suite's TestMain calls goleak.VerifyTestMain(m). A goroutine that outlives the tests fails the run and prints its stack, which names the exact line where it is still blocked. It reports only on an otherwise-successful run, and it detects permanence, not correctness: see step 08.",
							},
							{
								label: "the pinned API",
								value: 'The suite constructs &echo.Server{}, calls Listen("127.0.0.1:0"), dials Addr().String(), and ends every test with Shutdown. The signatures are already stubbed in labs/tcp-echo/echo/server.go.',
							},
							{
								label: "-race",
								value: "go test -race ./... runs the Go race detector across the 10 concurrent connections. It needs cgo: without a C toolchain the run stops immediately with `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`. On Windows install a gcc or drop the flag; the tests still drive the concurrency either way.",
							},
							{
								label: "what green does not cover",
								value: "The 30-second idle deadline is not checked by any test, deliberately: see step 06 and the lab README. Delete its per-line reset and this suite stays green.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"Why does the lab run the same six tests against the reference solution, when the reference is known to be correct? || Because that is what proves the suite is passable. A suite nobody has ever passed is a guess, not evidence, and when it tells you your server is wrong you can only trust it because it goes green against a real implementation. It is the same argument as the rest of this project: a claim nobody has checked is an opinion, whether it is made by a reference, a test, or you.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The accept loop, one goroutine per connection, bufio framing over a byte stream, absolute deadlines, and a WaitGroup that makes Shutdown mean something: these are the exact primitives net/http, gRPC, and your database driver use internally. You have now written the layer underneath the thing you usually import, and net/http's Server is this file with more features and the same five ideas.",
			},
		},
		{
			type: "text",
			value: {
				en: "The other half of what happened here is worth more. Three real bugs in this project leave the test suite completely green: a file descriptor leaked when a goroutine returns without closing its conn, a deadline that never rolls forward and hangs up on every user at 30 seconds, and a Shutdown that returns while connections are still live. goleak sees none of them, because it detects permanence at exit and these are not that. The race detector sees none of them, because they are not races. Both tools are working correctly and answering the questions they were asked. The suite grew two tests specifically to catch two of these, and each one only exists because someone asked what would still pass if this were broken. That question is the tier 2 skill, and you will need it before the tier 3 projects, where the thing you are wrong about is measured in latency and nothing prints a stack trace at all.",
			},
		},
	],
}
