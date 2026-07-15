# Lab: HTTP server middleware

This lab grades the `middleware` package from the Tier 2 HTTP server project. The suite is black-box: it imports the package and calls the exported API the way your own `server.go` would, so how you implement the internals is your business. Handlers, mux setup, and the `http.Server` itself are not graded here; the middleware chain is the part with the sharp edges, so the middleware chain is what gets tested.

## Layout

```
middleware/
  middleware.go        yours: the skeleton you fill in (build tag !solution)
  middleware_test.go   the suite; read it, it is the contract
  solution.go          reference implementation (build tag solution)
```

`solution.go` is compiled only with `-tags solution`, so `go test` always grades your file, never the reference. Do not open `solution.go` until your run is green.

## The contract

The suite pins this exported API. The signatures are already in `middleware.go`; keep them, fill in the bodies.

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler
func LoggingMiddleware(logger *slog.Logger) Middleware
func AuthMiddleware(tokens map[string]string) Middleware
func UserFromContext(ctx context.Context) (string, bool)
func RateLimitMiddleware(n int) Middleware
```

Eight cases, one per behavior the project steps specify:

| Test | Asserts |
| --- | --- |
| `TestAuth/no_Authorization_header` | 401, next handler never runs |
| `TestAuth/invalid_token` | 401, next handler never runs |
| `TestAuth/valid_token` | 200, `UserFromContext` returns the token's user |
| `TestChainOrder` | `Chain(h, mwA, mwB)` runs mwA before mwB, the first middleware is the outermost wrapper |
| `TestRateLimitWithinLimit` | first N requests from one IP all get 200 |
| `TestRateLimitOverLimit` | request N+1 from the same IP gets 429 |
| `TestRateLimitRefill` | after the burst, waiting one token's worth of time lets a request through again |
| `TestLogging404` | the 404 shows up as `status=404`, alongside `method` and `path`, in the slog output |

The rate limit tests deliver requests from concurrent goroutines, because that is how `net/http` delivers them in production: one goroutine per connection. Your bucket map is shared state; anything shared across goroutines needs a mutex or the race detector will name the exact lines that disagree.

## Run it

```
cd labs/http-server
go test -race ./...
```

The starter skeleton compiles but fails every test; each failure message tells you which behavior is missing. Work until the run is green.

`-race` needs cgo. On Windows without a gcc toolchain it fails with a cgo error; install a C compiler or drop the flag and run `go test ./...`. The tests still exercise the concurrency either way, the detector just cannot watch them without cgo.

## Done when

```
ok  	gopath.dev/labs/http-server/middleware	0.65s
```

All eight cases pass and, where `-race` runs, no data race is reported. That, not eyeballing log lines, is what "the middleware works" means here.
