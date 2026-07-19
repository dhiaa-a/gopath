//go:build gate

// The allocation gate for the user service. Run it without -race: the
// detector allocates shadow memory on every access and the per-call count
// stops meaning anything.
//
//	go test -tags 'solution gate' -run TestGate ./...
//
// The metric is per-request allocation on the read path, and it is a code
// property, not a machine one: GetUser allocates the same number of times on
// a Raspberry Pi and a 64-core server, so this gate needs no threshold, no
// headroom, and no tuning. It asserts zero. A gRPC service answers far more
// reads than writes, and an allocation on every read is paid back to the
// garbage collector under load as latency; "the read path allocates nothing"
// is the kind of claim a production service is expected to keep.
package server_test

import (
	"context"
	"testing"

	"gopath.dev/labs/grpc-service/server"
	"gopath.dev/labs/grpc-service/userspb"
)

// Sinks defeat dead-code elimination: without an observed result the compiler
// is free to prove the whole call has no effect and delete it, and then
// AllocsPerRun measures nothing.
var (
	sinkUser *userspb.User
	sinkErr  error
)

// TestGateGetUserAllocFree pins the project's read-path metric: GetUser is a
// map lookup that returns the stored *User, so it must not reach the heap.
// CreateUser is the control, and requiring it to allocate is not decoration:
// if AllocsPerRun ever stopped observing these calls, "GetUser allocates
// nothing" would still pass while having stopped meaning anything. A
// comparison that cannot fail on the control is not a comparison.
func TestGateGetUserAllocFree(t *testing.T) {
	srv := server.New(
		&userspb.User{Id: "u1", Name: "Ada Lovelace", Email: "ada@example.com"},
		&userspb.User{Id: "u2", Name: "Grace Hopper", Email: "grace@example.com"},
		&userspb.User{Id: "u3", Name: "Ken Thompson", Email: "ken@example.com"},
	)
	ctx := context.Background()
	req := &userspb.GetUserRequest{Id: "u2"}

	// Guard: if GetUser is still a stub we would be measuring the error
	// path, which allocates a status. Fail with the useful message instead.
	if _, err := srv.GetUser(ctx, req); err != nil {
		t.Fatalf("GetUser(u2) on a seeded server returned %v; make `go test ./...` green before the gate", err)
	}

	read := testing.AllocsPerRun(1000, func() {
		sinkUser, sinkErr = srv.GetUser(ctx, req)
	})

	// Control: CreateUser mints a &User and formats a fresh id, so it must
	// allocate. If this reports zero, the harness is not seeing these calls
	// and the read assertion below is worthless.
	create := testing.AllocsPerRun(1000, func() {
		sinkUser, sinkErr = srv.CreateUser(ctx, &userspb.CreateUserRequest{
			Name:  "Rob Pike",
			Email: "rob@example.com",
		})
	})

	if create == 0 {
		t.Fatal("control failed: CreateUser reported 0 allocations, so AllocsPerRun is not observing these calls and the read gate is meaningless")
	}
	if read != 0 {
		t.Fatalf("alloc gate: GetUser allocated %.3g times per call, want 0; a read is a map lookup that returns the stored *User, so it must not build a new message, copy the User, or range a slice to find the id", read)
	}
	t.Logf("alloc gate: GetUser %.3g allocs/op (read path, floor 0), CreateUser %.3g allocs/op (control, must be > 0)", read, create)
	_ = sinkErr
}
