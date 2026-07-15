# Lab: ship it

This lab is a service that has to survive being deployed. Not "works on my
machine" and not "passes its tests": starts under a supervisor, tells that
supervisor the truth about itself while it starts, and stops when it is told
to without dropping a request it had already accepted.

The handlers are not the interesting part. `Run` is. Everything hard here is
lifecycle, and lifecycle is the part that no amount of unit testing a handler
will teach you.

## The shape

```
main.go              yours: the process contract. Signals, listener, exit code.
solution.go          the reference main (build tag solution)
ship/
  ship.go            the Config type. Pinned: the suite builds these.
  server.go          yours: LoadConfig, Handler, Run (build tag !solution)
  solution.go        the reference (build tag solution)
  ship_test.go       the suite. Correctness. Read it, it is the contract.
  gate_test.go       the gate. The numbers. Build tag gate.
deploy/
  Dockerfile         read and build it yourself; no check here runs Docker
  ci.example.yml     copy into your own repo as .github/workflows/ci.yml
```

`solution.go` compiles only with `-tags solution`, so `go test` always grades
your file. Do not open either one until your gate is green.

## The contract

```go
func LoadConfig(getenv func(string) string) (Config, error)

func New(cfg Config, warm func(context.Context) error) *Server
func (s *Server) Handler() http.Handler
func (s *Server) Run(ctx context.Context, ln net.Listener) error
```

`LoadConfig` takes the lookup as a parameter instead of calling `os.Getenv`
itself. That is the whole reason its tests need no `t.Setenv`, no cleanup, and
no ordering: they pass it a map.

`Run` takes the listener rather than binding one. `main` binds, so "port
already in use" is a startup error with an exit code, and the suite binds
`127.0.0.1:0` so every test gets its own port and they can all run at once.

### The environment

| Variable                   | Default          | Notes                                    |
| -------------------------- | ---------------- | ---------------------------------------- |
| `SHIP_ADDR`                | `127.0.0.1:8080` | The container sets `:8080`               |
| `SHIP_SHUTDOWN_TIMEOUT`    | `15s`            | Must be > 0                              |
| `SHIP_DRAIN_DELAY`         | `5s`             | May be 0                                 |
| `SHIP_READ_HEADER_TIMEOUT` | `5s`             | Must be > 0                              |

Unset means "the default was right", not "zero". A bad value stops the process
at startup, naming the variable and the value it could not use, and reporting
every bad variable at once rather than one per redeploy.

`SHIP_DRAIN_DELAY` + `SHIP_SHUTDOWN_TIMEOUT` is your total stopping budget, and
it has to fit inside the grace period of whatever supervises you. Kubernetes
sends SIGTERM, waits `terminationGracePeriodSeconds` (30 by default), then
sends SIGKILL. The defaults here sum to 20s against that 30s.

### The routes

| Route     | Answers                                                              |
| --------- | -------------------------------------------------------------------- |
| `/healthz`| 200, always, from the moment the mux serves. Liveness: "am I wedged?" |
| `/readyz` | 200 only while this process is worth traffic. 503 otherwise.          |
| `/work`   | Sleeps `?ms=` (default 0, max 5000), then 200. 400 on anything else.  |

`/healthz` must not consult a dependency, ever. A liveness probe that goes red
when the database goes red turns one sick database into an orchestrator
restarting every replica you have, at exactly the moment the database is least
able to survive a thundering herd of reconnects.

`/work` stands in for the upstream call a real handler makes. The only property
this lab needs from it is that it takes time, because a request that is not
still running when `Shutdown` is called cannot prove anything about `Shutdown`.

## Run it

```
go test ./...
```

The starter compiles and fails every test; each failure names the behaviour
that is missing. `-race` is worth it here and free on Linux and macOS:

```
go test -race ./...
```

The readiness flag is written by `Run` and read by every `/readyz` request on
its own goroutine, which is the textbook shape of a data race. A plain `bool`
will appear to work and will be undefined behaviour. `-race` needs cgo; on
Windows without a gcc toolchain, drop the flag.

## The gate

```
go test -tags gate -run TestGate ./...
```

Three checks, and all three compare the process against the budget its own
`Config` asked for, never against a guess about how fast your machine is:

- **`TestGateZeroDroppedOnDrain`** is the exam. It puts 64 requests in flight,
  asks the process to stop while every one of them is still running, and counts
  how many never got a whole response. The budget is zero. A deploy is a
  shutdown you chose the timing of; there is no acceptable drop rate for
  something you scheduled. It also refuses to pass vacuously: if `/work` came
  back instantly, nothing was in flight and the gate says so instead of going
  green.
- **`TestGateReadinessLeadsTheListener`** measures the window between
  "`/readyz` starts saying 503" and "the listener stops accepting", and fails
  if it is under half the configured drain delay.
- **`TestGateShutdownDeadlineIsReal`** puts one request in flight that cannot
  finish inside the budget, and holds the process to the budget anyway. An
  unbounded wait is not a wait, it is a hang, and the orchestrator's SIGKILL
  timer does not care that you were being polite.

Run it without `-race`. Nothing here needs it: the race this project can
produce is caught by `go test -race ./...` on the suite above.

## The drain, in order

This is the entire project, and `Run` has to do it in this order:

1. **Lie.** `/readyz` starts returning 503 the instant a stop is asked for.
2. **Keep serving anyway**, for `DrainDelay`. SIGTERM and your removal from
   the load balancer's pool are concurrent events with no ordering between
   them. The signal does not mean traffic has stopped; it means traffic will
   stop, eventually, once something else notices. Until then, requests keep
   arriving at a process that has been told to die.
3. **Stop accepting, and wait** for what is already running. `Shutdown` gets a
   fresh context with its own deadline. Handing it the context that asked you
   to stop is the classic version of this bug: it is already cancelled, so
   `Shutdown` closes the listener, returns `ctx.Err()` without waiting, and the
   process exits on top of live requests.
4. **Hang up** if that deadline expires, and return an error, so a deploy that
   dropped traffic does not look exactly like one that did not.

## The artifacts

`deploy/Dockerfile` and `deploy/ci.example.yml` are read-and-adapt, not
checked. Nothing in `check.sh` runs Docker, and `ci.example.yml` is parked
under `deploy/` precisely so it cannot be picked up as a workflow. Build the
image yourself: it is the only way to find out what a Dockerfile does.

```
docker build -f deploy/Dockerfile -t ship-it:dev .
docker run --rm -p 8080:8080 ship-it:dev
```

## Done when

```
go test ./...                        ok
go test -tags gate -run TestGate ./... ok
```

and your own binary drains in front of you:

```
go run . &
curl -i localhost:8080/readyz    # 503 for the first two seconds
curl -i localhost:8080/healthz   # 200 straight away
kill -TERM %1                    # takes five seconds, on purpose
```

That pause is not your program being slow. It is your program being the only
thing in the system that knows a load balancer takes a moment to catch up.
