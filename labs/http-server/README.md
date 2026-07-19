# Lab: HTTP server middleware

This lab grades two packages from the Tier 2 HTTP server project. Both suites are black-box: they import the package and call the exported API the way your own `main` would, so how you implement the internals is your business.

- `middleware` is the chain: composition, logging, auth, and per-IP rate limiting. This is the part with the sharp edges.
- `server` is what the chain runs on: the four deadlines an `http.Server` understands, and the shutdown that lets in-flight requests finish instead of dying with the process.

## Layout

```
middleware/
  middleware.go        yours: the skeleton you fill in (build tag !solution)
  middleware_test.go   the suite; read it, it is the contract
  solution.go          reference implementation (build tag solution)
server/
  server.go            yours (build tag !solution)
  server_test.go       the suite
  solution.go          reference implementation (build tag solution)
```

`solution.go` is compiled only with `-tags solution`, so `go test` always grades your files, never the reference. Do not open them until your run is green.

## The contract

The suites pin this exported API. The signatures are already in place; keep them, fill in the bodies.

```go
// package middleware
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler
func LoggingMiddleware(logger *slog.Logger) Middleware
func AuthMiddleware(tokens map[string]string) Middleware
func UserFromContext(ctx context.Context) (string, bool)
func RateLimitMiddleware(n int) Middleware

// package server
type Timeouts struct{ ReadHeader, Read, Write, Idle time.Duration }

func DefaultTimeouts() Timeouts
func New(h http.Handler, t Timeouts) *http.Server
func Run(ctx context.Context, srv *http.Server, ln net.Listener, grace time.Duration) error
```

Fourteen cases, one per behavior the project steps specify:

| Test | Asserts |
| --- | --- |
| `TestChainOrder` | `Chain(h, mwA, mwB)` runs mwA before mwB: the first middleware is the outermost wrapper |
| `TestLogging404` | the 404 shows up as `status=404`, alongside `method` and `path`, in the slog output |
| `TestLoggingCapturesAnImplicit200AndTheByteCount` | a handler that never calls `WriteHeader` still logs `status=200`, and `bytes=5` for five bytes written |
| `TestAuth/no_Authorization_header` | 401, next handler never runs |
| `TestAuth/invalid_token` | 401, next handler never runs |
| `TestAuth/valid_token` | 200, `UserFromContext` returns the token's user |
| `TestRateLimitWithinLimit` | first N requests from one IP all get 200 |
| `TestRateLimitOverLimit` | request N+1 from the same IP gets 429 |
| `TestRateLimitRefill` | after the burst, waiting one token's worth of time lets a request through again |
| `TestDefaultTimeoutsAreAllSet` | all four deadlines positive, and ReadHeader no looser than Read |
| `TestNewAppliesEveryTimeout` | every field of `Timeouts` reaches the `http.Server` field that means it |
| `TestReadHeaderTimeoutHangsUpOnASilentClient` | a connection that sends nothing gets hung up on |
| `TestIdleTimeoutClosesAQuietKeepAliveConnection` | a kept-alive connection that goes quiet gets hung up on |
| `TestRunWaitsForInFlightRequests` | a request inside a handler when the stop arrives still gets its response, and `Run` returns nil |

The rate limit tests deliver requests from concurrent goroutines, because that is how `net/http` delivers them in production: one goroutine per connection. Your bucket map is shared state; anything shared across goroutines needs a mutex, or the race detector will name the exact lines that disagree.

Two of the `server` tests talk raw TCP rather than going through `net/http`'s client, because the behavior under test is what your server does to a client that never finishes, and an `http.Client` will not let you be that rude.

## Run it

```
cd labs/http-server
go test -race ./...
```

The starter skeletons compile but fail; each failure message names the behavior that is missing. Work until the run is green.

`-race` needs cgo. On Windows without a gcc toolchain it fails with a cgo error; install a C compiler or drop the flag and run `go test ./...`. The tests still exercise the concurrency either way, the detector just cannot watch them without cgo.

That gap matters more than it sounds, and this lab can show you why. Take the mutex out of the bucket map and the suite still passes most of the time: thirty runs of `go test -run TestRateLimit ./middleware/` on a stock go1.22 toolchain with cgo off gave twenty-seven passes and three `fatal error: concurrent map writes`, and `go build` and `go vet` were clean throughout. A green run without the detector is not evidence that your synchronization is right. It is evidence that this time you got away with it.

## Done when

```
ok  	gopath.dev/labs/http-server/middleware	0.639s
ok  	gopath.dev/labs/http-server/server	1.094s
```

All fourteen cases pass and, where `-race` runs, no data race is reported. That, not eyeballing log lines, is what "the middleware works" means here.
