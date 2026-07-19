# Lab: gRPC user service

This lab grades the `server` package from the Tier 3 gRPC project. The suite is black-box and runs over bufconn: it registers your implementation on a real `grpc.Server`, dials it through an in-memory listener, and calls it with the generated client stub. Serialization, framing, interceptor dispatch, and status codes all behave exactly as they would over TCP; only the transport is a pipe in memory, so no ports are opened and nothing can flake on a busy machine.

## Layout

```
proto/users.proto   the contract; field numbers are the wire format
proto/wire_demo.proto  not the contract: three shapes of the same three
                       fields, so ./wire can decode one message as each
userspb/            Go code generated from users.proto: committed, never edited
wirepb/             generated from wire_demo.proto: committed, never edited
buf.yaml
buf.gen.yaml        codegen config, see "Regenerating" below
server/
  server.go         yours: the skeleton you fill in (build tag !solution)
  server_test.go    the suite; read it, it is the contract
  solution.go       reference implementation (build tag solution)
wire/               demo: what protobuf puts on the wire (graded: no)
deadline/           demo: a context deadline crossing the wire (graded: no)
details/            demo: what a status error carries besides its code
```

`solution.go` is compiled only with `-tags solution`, so `go test` always grades your file, never the reference. Do not open `solution.go` until your run is green.

## The three demos

None of these are graded and none of them are optional reading. Each one exists because a claim the project makes is only worth making if you can watch it happen.

```
go run ./wire       # field names are not on the wire; field numbers are
go run ./deadline   # a client timeout becomes the server's ctx deadline
go run ./details    # your CreateUser's error, field by field
```

`./wire` and `./deadline` are self-contained and run before you have written anything. `./details` boots **your** `server` package, so it reports whatever your code currently does; run it with `-tags solution` to see the same call against the reference.

## The contract

The suite pins this exported API. The signatures are already in `server.go`; keep them, fill in the bodies.

```go
func New(seed ...*userspb.User) *Server // Server implements userspb.UserServiceServer
func AuthUnaryInterceptor(token string) grpc.UnaryServerInterceptor
```

Seven cases, one per line of the project's assessment block:

| Test | Asserts |
| --- | --- |
| `TestGetUserUnknownID` | `status.Code(err) == codes.NotFound` for an id nobody seeded |
| `TestGetUserKnownID` | the exact seeded `User` message comes back (`proto.Equal`) |
| `TestListUsersStreamsInOrder` | 3 users arrive as a server stream, in seed order, then `io.EOF` |
| `TestCreateUserEmptyEmail` | `codes.InvalidArgument`, validated before anything is stored |
| `TestCreateUserStores` | a valid CreateUser mints a fresh non-empty id, echoes the email, and the user reads back via `GetUser` (`proto.Equal`) |
| `TestAuthNoToken` | a unary call with no `authorization` metadata gets `codes.Unauthenticated` |
| `TestAuthWrongToken` | a unary call with the wrong `authorization` value still gets `codes.Unauthenticated`; presence is not enough |

Two sharp edges the suite will catch:

- Return status errors, never raw Go errors. A raw `error` crosses the wire as `codes.Unknown`, and `TestGetUserUnknownID` will print exactly that code back at you.
- A map alone cannot satisfy `TestListUsersStreamsInOrder`. Go randomizes map iteration order on purpose; you need to remember arrival order separately. Be warned that this one is a *weak* red: with three keys the randomization is a rotation inside a single bucket, so ranging the map replays seed order roughly 3 runs in 4, and the test passes. `-count=10` is how you see it.

One scope note: `AuthUnaryInterceptor` guards unary RPCs only. gRPC routes streaming calls through a separate hook (`grpc.StreamServerInterceptor`), so `ListUsers` is deliberately unguarded here. A production service registers both.

## Run it

```
cd labs/grpc-service
go test ./...
```

The starter skeleton compiles but fails every test with `codes.Unimplemented`; each failure message names the behavior that is missing. The suite is written to be race-clean, so add `-race` where cgo is available (out of the box on Linux and macOS; Windows needs a gcc toolchain, see the labs README).

## Done when

```
?   	gopath.dev/labs/grpc-service/deadline	[no test files]
?   	gopath.dev/labs/grpc-service/details	[no test files]
?   	gopath.dev/labs/grpc-service/userspb	[no test files]
?   	gopath.dev/labs/grpc-service/wire	[no test files]
?   	gopath.dev/labs/grpc-service/wirepb	[no test files]
ok  	gopath.dev/labs/grpc-service/server	0.6s
```

All seven cases pass through a real gRPC round-trip. That, not a hand-tested client script, is what "the service works" means here.

## The performance gate

Correctness is one bar; cost is the other. `server/gate_test.go` (behind the
`gate` build tag) is the Tier 3 hard gate: it asserts that `GetUser`, the read
hot path, allocates **zero** times per call, measured with
`testing.AllocsPerRun`. It measures `CreateUser` in the same run as a control
and requires *it* to allocate, so the zero can never be a broken ruler.

```
# gate your own code:
go test -tags gate -run TestGate ./server/
# prove it is passable, against the reference:
go test -tags 'solution gate' -run TestGate -v ./server/
```

An allocation gate asserts an exact zero rather than a floor-with-headroom
because allocations per call are a property of the code, identical on any
machine, unlike throughput. Never run a gate under `-race`: the detector
allocates on every access and the count stops meaning anything.

## Regenerating the generated code

Running the lab needs neither buf nor protoc: `userspb/` and `wirepb/` are committed. Regenerate only if you change a file under `proto/`:

```
go install github.com/bufbuild/buf/cmd/buf@v1.32.2
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.34.2
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.4.0
buf generate
```

Field numbers are the wire format: changing one after a client has shipped silently corrupts every field it decodes. That is why `userspb/` is generated and committed instead of written by hand, and why the proto file, not the Go code, is the API.
