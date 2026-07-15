# Lab: TCP echo server

This lab grades the `echo` package from the Tier 2 TCP echo server project, and it grades it the only way that proves anything about a network server: the suite dials your server over real TCP sockets on 127.0.0.1, writes bytes, and reads what comes back. No mocks, no fake connections. Every test binds to port 0, so the OS assigns a free port and parallel runs never collide.

There is a second grader watching. `TestMain` runs [goleak](https://github.com/uber-go/goleak) after the last test: if the accept loop or any connection goroutine you started is still alive, the run fails and prints that goroutine's stack. Echoing bytes is the easy half of this project. Proving that `Shutdown` leaves nothing running is the half production servers get wrong, and it is the half this suite refuses to take on faith.

## Layout

```
echo/
  server.go     yours: Server, Listen, Addr, Shutdown (build tag !solution)
  handler.go    yours: handleConn, the per-connection scanner loop
  echo_test.go  the suite; read it, it is the contract
  solution.go   reference implementation (build tag solution)
```

`solution.go` compiles only with `-tags solution`, so `go test` always grades your files, never the reference. Do not open `solution.go` until your run is green.

## The contract

The suite pins this exported API. The signatures are already in `server.go`; keep them, fill in the bodies.

```go
type Server struct{ ... }             // zero value ready to use

func (s *Server) Listen(addr string) error // bind, start the accept loop, return
func (s *Server) Addr() net.Addr           // the bound address, so a :0 server is dialable
func (s *Server) Shutdown()                // close the listener, wait for every goroutine
```

`Listen` returns once the listener is bound and the accept loop is running in its own goroutine. `Shutdown` closes the listener and blocks until the accept loop and every connection goroutine have exited. The suite squeezes that contract from both sides: `Shutdown` must return within seconds, so forgetting `listener.Close` fails with a named message instead of hanging, and after the last test goleak fails the run if any goroutine survived, so an accept loop that does not exit once `Accept` starts returning `net.ErrClosed` shows up with its stack printed.

Those two bounds leave a gap between them: a `Shutdown` that closes the listener and returns immediately clears both, because every test client has already disconnected by the time goleak looks, so its connection goroutine is gone on its own. `TestShutdownWaitsForActiveConn` closes that gap. It keeps one client parked mid-exchange, calls `Shutdown` in a goroutine, and asserts `Shutdown` does not return until the client closes: a `Shutdown` that only drops the listener returns while that goroutine is still running and fails on the spot.

`TestSlowClientDoesNotBlockOthers` closes a second gap of the same shape. Nothing in the first four tests overlaps two clients: each sends its lines and hangs up in under a millisecond, so a server that serves one connection to completion before calling `Accept` again passes all of them, goleak included, without ever running two connections at once. That server is not the one this project describes. The test parks one client mid-exchange and requires a second to be served while it sits there, which is the cheapest honest way to ask whether there is really a goroutine per connection.

On the wire, per connection:

- every `\n`-terminated line comes back uppercased and `\n`-terminated: `hello` in, `HELLO` out
- the exact line `quit` makes the server close the connection, with no echo
- an idle connection is evicted after 30 seconds via `conn.SetDeadline`, reset after every line

The suite does not sit out the 30-second idle deadline; implement it anyway. A client that loses power never sends FIN, and without a deadline its goroutine blocks in a read forever, which turns your next `Shutdown` into a hang. This one is a deliberate hole rather than an oversight: checking it quickly needs a knob to shorten the timeout, that knob is a field on `Server` that exists only so a test can reach it, and a 30-second wait in every run is worse than the gap. So the deadline is on you, and deleting the per-line reset keeps the whole suite green. Green is not the same as correct, here or anywhere.

Six tests. Four pin one wire behavior each; two pin the guarantees the wire cannot show you:

| Test | Asserts |
| --- | --- |
| `TestEchoSingle` | one line in, the uppercased line back |
| `TestEchoMultiLine` | three lines sent in one TCP write come back as three replies, in order: framing belongs to your scanner, not to the client's write boundaries |
| `TestQuit` | after `quit` the client reads EOF and zero extra bytes |
| `TestConcurrent` | 10 clients at once, 5 lines each, every reply matching its own connection |
| `TestSlowClientDoesNotBlockOthers` | one client parked mid-exchange while a second is served: there is really a goroutine per connection, not an accept loop that serves one caller at a time |
| `TestShutdownWaitsForActiveConn` | a client kept open across `Shutdown`: `Shutdown` stays blocked until the client closes, so it waits for the connection goroutine, not just the listener |

Every dial, read, write, and shutdown in the suite carries a deadline, so a server that blocks forever fails in seconds with a named guarantee instead of hanging the run.

## Run it

```
cd labs/tcp-echo
go test -race ./...
```

The starter compiles but fails every test; each failure message says which part of the contract is missing. Work until the run is green.

`-race` needs cgo. Without a C toolchain the run stops before a single test executes:

```
go: -race requires cgo; enable cgo by setting CGO_ENABLED=1
```

That is the whole failure, and it is not a problem with your code. Install a C compiler (on Windows, a gcc such as the one in mingw-w64) or drop the flag and run `go test ./...`. The tests still drive 10 concurrent connections either way; the detector just cannot watch them without cgo.

## Done when

```
ok  	gopath.dev/labs/tcp-echo/echo	0.5s
```

All six tests pass, goleak stays silent, and where `-race` runs, no data race is reported. If you instead see `found unexpected goroutines` followed by a stack trace, that stack is your leak: it names the exact line where a goroutine of yours is still blocked after `Shutdown` returned.
