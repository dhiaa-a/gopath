//go:build !solution

// Package server is the Tier 3 gRPC user service. The proto in
// proto/users.proto is the contract; the generated code in userspb/ turns
// it into a Go interface (userspb.UserServiceServer) and this package
// implements it.
//
// This file is yours. The suite in server_test.go registers your Server on
// a real grpc.Server, dials it over bufconn, and calls it through the
// generated client stub, so every assertion crosses a real gRPC
// round-trip. The stubs below return codes.Unimplemented: a fresh clone
// compiles and fails tests, never builds broken.
package server

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"gopath.dev/labs/grpc-service/userspb"
)

// Server implements userspb.UserServiceServer. Embedding
// UnimplementedUserServiceServer is mandatory: the generated registration
// code demands it (mustEmbedUnimplementedUserServiceServer), and it means
// a new RPC added to the proto degrades to a default Unimplemented
// response instead of breaking your build.
type Server struct {
	userspb.UnimplementedUserServiceServer

	// TODO: your storage. The suite pins two properties: GetUser finds
	// every seeded or created user by id, and ListUsers replays them in
	// the order they arrived. A map alone cannot give you that order.
}

// New returns a Server preloaded with the seed users, in order. The suite
// seeds three users and expects ListUsers to stream them back in exactly
// this order.
func New(seed ...*userspb.User) *Server {
	// TODO: keep the seed. Remember both lookup by id and arrival order.
	return &Server{}
}

// GetUser returns the user with req.Id. Unknown ids are codes.NotFound,
// built with status.Errorf, never a raw Go error: a raw error crosses the
// wire as codes.Unknown and clients cannot branch on it.
func (s *Server) GetUser(ctx context.Context, req *userspb.GetUserRequest) (*userspb.User, error) {
	// TODO: look up req.GetId(); status.Errorf(codes.NotFound, ...) when
	// it is missing.
	return nil, status.Error(codes.Unimplemented, "GetUser not implemented yet")
}

// ListUsers streams every user to the client, one Send per user, in the
// order they were seeded or created. Returning nil ends the stream; the
// client sees that as io.EOF from Recv.
func (s *Server) ListUsers(req *userspb.ListUsersRequest, stream userspb.UserService_ListUsersServer) error {
	// TODO: stream.Send(u) in arrival order, then return nil.
	return status.Error(codes.Unimplemented, "ListUsers not implemented yet")
}

// CreateUser validates the request, stores a new user under a fresh
// unique id, and returns the stored user. An empty email is
// codes.InvalidArgument; the request never touches storage.
func (s *Server) CreateUser(ctx context.Context, req *userspb.CreateUserRequest) (*userspb.User, error) {
	// TODO: reject empty email first, then assign an id nobody has.
	return nil, status.Error(codes.Unimplemented, "CreateUser not implemented yet")
}

// AuthUnaryInterceptor returns a unary server interceptor that admits a
// call only when the incoming metadata carries "authorization" set to
// exactly "Bearer <token>". Anything else, including no metadata at all,
// is codes.Unauthenticated and the handler never runs. gRPC metadata is
// the wire equivalent of HTTP headers; this is the same gatekeeping you
// built as HTTP middleware in Tier 2, one layer down.
//
// Note the scope: unary interceptors see unary RPCs only. gRPC routes
// streaming calls through a separate hook (grpc.StreamServerInterceptor),
// so ListUsers is deliberately not guarded in this lab.
func AuthUnaryInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		// TODO: metadata.FromIncomingContext(ctx), check the
		// "authorization" values, reject with codes.Unauthenticated
		// before the handler ever runs.
		return handler(ctx, req)
	}
}
