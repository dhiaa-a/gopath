// Black-box suite for the gRPC user service, one test per assessment
// case. Nothing here calls your methods directly: the suite registers
// your Server on a real grpc.Server, dials it over bufconn (an in-memory
// net.Listener, no TCP ports), and speaks to it through the generated
// client stub. Requests are serialized, framed, routed through the auth
// interceptor, and dispatched exactly as they would be over a socket;
// only the transport is in-memory.
package server_test

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"gopath.dev/labs/grpc-service/server"
	"gopath.dev/labs/grpc-service/userspb"
)

const testToken = "gopath-lab-token"

// seedUsers is what every test's server starts with. The order matters:
// TestListUsersStreamsInOrder asserts the stream replays exactly this
// sequence.
func seedUsers() []*userspb.User {
	return []*userspb.User{
		{Id: "u1", Name: "Ada Lovelace", Email: "ada@example.com"},
		{Id: "u2", Name: "Grace Hopper", Email: "grace@example.com"},
		{Id: "u3", Name: "Ken Thompson", Email: "ken@example.com"},
	}
}

// newClient boots a fresh server for one test: bufconn listener, real
// grpc.Server with your auth interceptor installed, your Server seeded
// with three users, and a client stub dialed through the in-memory pipe.
func newClient(t *testing.T) userspb.UserServiceClient {
	t.Helper()

	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(server.AuthUnaryInterceptor(testToken)),
	)
	userspb.RegisterUserServiceServer(srv, server.New(seedUsers()...))
	go srv.Serve(lis) //nolint:errcheck // Stop() makes Serve return.
	t.Cleanup(srv.Stop)

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("grpc.NewClient: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	return userspb.NewUserServiceClient(conn)
}

// testCtx returns a context that fails the test with a timeout instead of
// hanging forever if a call never returns.
func testCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}

// authCtx attaches the bearer token the interceptor expects. Client
// metadata is the gRPC equivalent of setting an HTTP request header.
func authCtx(t *testing.T) context.Context {
	return metadata.AppendToOutgoingContext(testCtx(t),
		"authorization", "Bearer "+testToken)
}

// TestGetUserUnknownID: an id nobody seeded must come back as
// codes.NotFound. status.Code unwraps the code from the error the stub
// returns; a handler that returns a raw Go error shows up here as
// codes.Unknown, which is exactly the bug the assertion message names.
func TestGetUserUnknownID(t *testing.T) {
	client := newClient(t)

	_, err := client.GetUser(authCtx(t), &userspb.GetUserRequest{Id: "no-such-id"})
	if err == nil {
		t.Fatal("GetUser with an unknown id returned no error, want codes.NotFound")
	}
	if got := status.Code(err); got != codes.NotFound {
		t.Fatalf("GetUser unknown id: status code = %v, want %v (raw Go errors cross the wire as Unknown; use status.Errorf)", got, codes.NotFound)
	}
}

// TestGetUserKnownID: a seeded id must return the exact seeded message.
// proto.Equal, not ==, is the comparison: generated structs carry internal
// state that reflect.DeepEqual and == would trip over.
func TestGetUserKnownID(t *testing.T) {
	client := newClient(t)
	want := seedUsers()[1]

	got, err := client.GetUser(authCtx(t), &userspb.GetUserRequest{Id: want.GetId()})
	if err != nil {
		t.Fatalf("GetUser(%q): unexpected error: %v", want.GetId(), err)
	}
	if !proto.Equal(got, want) {
		t.Fatalf("GetUser(%q) = %v, want %v", want.GetId(), got, want)
	}
}

// TestListUsersStreamsInOrder: the server stream must deliver all three
// seeded users, in seed order, then end cleanly. Recv returning io.EOF is
// how the client learns the server returned nil from the handler.
func TestListUsersStreamsInOrder(t *testing.T) {
	client := newClient(t)
	want := seedUsers()

	stream, err := client.ListUsers(authCtx(t), &userspb.ListUsersRequest{})
	if err != nil {
		t.Fatalf("ListUsers: unexpected error: %v", err)
	}

	var got []*userspb.User
	for {
		u, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("stream.Recv after %d message(s): %v", len(got), err)
		}
		got = append(got, u)
	}

	if len(got) != len(want) {
		t.Fatalf("stream delivered %d user(s), want %d", len(got), len(want))
	}
	for i := range want {
		if !proto.Equal(got[i], want[i]) {
			t.Fatalf("stream message %d = %v, want %v (users must arrive in seed order)", i, got[i], want[i])
		}
	}
}

// TestCreateUserEmptyEmail: validation failure is codes.InvalidArgument,
// part of the wire contract clients branch on.
func TestCreateUserEmptyEmail(t *testing.T) {
	client := newClient(t)

	_, err := client.CreateUser(authCtx(t), &userspb.CreateUserRequest{
		Name:  "No Email",
		Email: "",
	})
	if err == nil {
		t.Fatal("CreateUser with an empty email returned no error, want codes.InvalidArgument")
	}
	if got := status.Code(err); got != codes.InvalidArgument {
		t.Fatalf("CreateUser empty email: status code = %v, want %v", got, codes.InvalidArgument)
	}
}

// TestCreateUserStores: the success path must mint a fresh non-empty id, echo
// the submitted fields back, and actually persist the user. The GetUser
// round-trip is the real assertion: a handler that validates the email and then
// returns an empty or unstored User still passes TestCreateUserEmptyEmail, so
// only reading the user back proves it was stored under the returned id.
func TestCreateUserStores(t *testing.T) {
	client := newClient(t)

	created, err := client.CreateUser(authCtx(t), &userspb.CreateUserRequest{
		Name:  "Rob Pike",
		Email: "rob@example.com",
	})
	if err != nil {
		t.Fatalf("CreateUser: unexpected error: %v", err)
	}
	if created.GetId() == "" {
		t.Fatal("CreateUser returned a user with an empty Id, want a freshly assigned id")
	}
	if created.GetEmail() != "rob@example.com" {
		t.Fatalf("CreateUser echoed Email = %q, want %q", created.GetEmail(), "rob@example.com")
	}

	got, err := client.GetUser(authCtx(t), &userspb.GetUserRequest{Id: created.GetId()})
	if err != nil {
		t.Fatalf("GetUser(%q) after CreateUser: unexpected error: %v (the created user was never stored)", created.GetId(), err)
	}
	if !proto.Equal(got, created) {
		t.Fatalf("GetUser(%q) = %v, want %v (the stored user must match what CreateUser returned)", created.GetId(), got, created)
	}
}

// TestAuthNoToken: a unary call carrying no authorization metadata must be
// rejected by the interceptor with codes.Unauthenticated. The request uses
// a seeded id on purpose: if the handler ran anyway it would succeed, and
// the failure message would say OK instead of Unauthenticated.
func TestAuthNoToken(t *testing.T) {
	client := newClient(t)

	_, err := client.GetUser(testCtx(t), &userspb.GetUserRequest{Id: "u1"})
	if err == nil {
		t.Fatal("GetUser with no token succeeded, want codes.Unauthenticated from the interceptor")
	}
	if got := status.Code(err); got != codes.Unauthenticated {
		t.Fatalf("GetUser with no token: status code = %v, want %v", got, codes.Unauthenticated)
	}
}

// TestAuthWrongToken: a call whose authorization metadata is present but wrong
// must still be rejected with codes.Unauthenticated. Presence of the header is
// not enough; the interceptor has to compare the value against the token it was
// built with. The id is a seeded one on purpose, so an interceptor that only
// checks for presence would let the handler run and return the user, turning
// this into an OK instead of the Unauthenticated the assertion demands.
func TestAuthWrongToken(t *testing.T) {
	client := newClient(t)

	ctx := metadata.AppendToOutgoingContext(testCtx(t),
		"authorization", "Bearer wrong-token")
	_, err := client.GetUser(ctx, &userspb.GetUserRequest{Id: "u1"})
	if err == nil {
		t.Fatal("GetUser with a wrong token succeeded, want codes.Unauthenticated from the interceptor")
	}
	if got := status.Code(err); got != codes.Unauthenticated {
		t.Fatalf("GetUser with a wrong token: status code = %v, want %v (the interceptor must check the token value, not just its presence)", got, codes.Unauthenticated)
	}
}
