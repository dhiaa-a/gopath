# Lab: gRPC user service

This lab grades the `server` package from the Tier 3 gRPC project. The suite is black-box and runs over bufconn: it registers your implementation on a real `grpc.Server`, dials it through an in-memory listener, and calls it with the generated client stub. Serialization, framing, interceptor dispatch, and status codes all behave exactly as they would over TCP; only the transport is a pipe in memory, so no ports are opened and nothing can flake on a busy machine.

## Layout

```
proto/users.proto   the contract; field numbers are the wire format
userspb/            Go code generated from the proto: committed, never edited
buf.yaml
buf.gen.yaml        codegen config, see "Regenerating" below
server/
  server.go         yours: the skeleton you fill in (build tag !solution)
  server_test.go    the suite; read it, it is the contract
  solution.go       reference implementation (build tag solution)
```

`solution.go` is compiled only with `-tags solution`, so `go test` always grades your file, never the reference. Do not open `solution.go` until your run is green.

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
- A map alone cannot satisfy `TestListUsersStreamsInOrder`. Go randomizes map iteration order on purpose; you need to remember arrival order separately.

One scope note: `AuthUnaryInterceptor` guards unary RPCs only. gRPC routes streaming calls through a separate hook (`grpc.StreamServerInterceptor`), so `ListUsers` is deliberately unguarded here. A production service registers both.

## Run it

```
cd labs/grpc-service
go test ./...
```

The starter skeleton compiles but fails every test with `codes.Unimplemented`; each failure message names the behavior that is missing. The suite is written to be race-clean, so add `-race` where cgo is available (out of the box on Linux and macOS; Windows needs a gcc toolchain, see the labs README).

## Done when

```
?   	gopath.dev/labs/grpc-service/userspb	[no test files]
ok  	gopath.dev/labs/grpc-service/server	0.6s
```

All seven cases pass through a real gRPC round-trip. That, not a hand-tested client script, is what "the service works" means here.

## Regenerating the generated code

Running the lab needs neither buf nor protoc: `userspb/` is committed. Regenerate only if you change `proto/users.proto`:

```
go install github.com/bufbuild/buf/cmd/buf@v1.32.2
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.34.2
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.4.0
buf generate
```

Field numbers are the wire format: changing one after a client has shipped silently corrupts every field it decodes. That is why `userspb/` is generated and committed instead of written by hand, and why the proto file, not the Go code, is the API.
