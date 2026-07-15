//go:build solution

// Reference implementation. Compiled only with -tags solution, so the
// suite grades server.go by default. Do not open this until your run is
// green.
package server

import (
	"context"
	"fmt"
	"sync"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"gopath.dev/labs/grpc-service/userspb"
)

// Server implements userspb.UserServiceServer. The map answers GetUser in
// O(1); the order slice remembers arrival order for ListUsers, which a map
// cannot (Go randomizes map iteration on purpose). One mutex guards both,
// because gRPC serves each request on its own goroutine.
type Server struct {
	userspb.UnimplementedUserServiceServer

	mu     sync.Mutex
	nextID int
	order  []string
	users  map[string]*userspb.User
}

// New returns a Server preloaded with the seed users, in order.
func New(seed ...*userspb.User) *Server {
	s := &Server{
		nextID: len(seed) + 1,
		users:  make(map[string]*userspb.User, len(seed)),
	}
	for _, u := range seed {
		s.users[u.GetId()] = u
		s.order = append(s.order, u.GetId())
	}
	return s
}

// GetUser returns the user with req.Id, or codes.NotFound. The status
// package is what makes the code cross the wire; a raw Go error would
// arrive as codes.Unknown.
func (s *Server) GetUser(ctx context.Context, req *userspb.GetUserRequest) (*userspb.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[req.GetId()]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "user %q not found", req.GetId())
	}
	return u, nil
}

// ListUsers streams every user in arrival order. The snapshot is taken
// under the lock, the sends happen outside it: Send blocks on the network
// (flow control), and holding a mutex across a blocking network write
// would let one slow client stall every other RPC.
func (s *Server) ListUsers(req *userspb.ListUsersRequest, stream userspb.UserService_ListUsersServer) error {
	s.mu.Lock()
	snapshot := make([]*userspb.User, 0, len(s.order))
	for _, id := range s.order {
		snapshot = append(snapshot, s.users[id])
	}
	s.mu.Unlock()

	for _, u := range snapshot {
		if err := stream.Send(u); err != nil {
			return err
		}
	}
	return nil
}

// CreateUser rejects an empty email with codes.InvalidArgument before
// touching storage, then stores the user under a fresh id.
//
// The rejection carries a google.rpc.BadRequest detail naming the offending
// field. The suite only checks the code, so this is above the bar on
// purpose: it is what ./details exists to show. status.WithDetails keeps the
// code intact and marshals the detail into the status, so a client can
// branch on the field name instead of grepping the message text.
func (s *Server) CreateUser(ctx context.Context, req *userspb.CreateUserRequest) (*userspb.User, error) {
	if req.GetEmail() == "" {
		return nil, invalidField("email", "email must not be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	u := &userspb.User{
		Id:    fmt.Sprintf("u%d", s.nextID),
		Name:  req.GetName(),
		Email: req.GetEmail(),
	}
	s.nextID++
	s.users[u.Id] = u
	s.order = append(s.order, u.Id)
	return u, nil
}

// invalidField builds an InvalidArgument status that names the field it is
// complaining about in a machine-readable detail, not only in its message.
// If attaching the detail fails (it cannot here: BadRequest always
// marshals), fall back to the bare status rather than losing the rejection.
func invalidField(field, desc string) error {
	st := status.New(codes.InvalidArgument, desc)
	withDetail, err := st.WithDetails(&errdetails.BadRequest{
		FieldViolations: []*errdetails.BadRequest_FieldViolation{
			{Field: field, Description: desc},
		},
	})
	if err != nil {
		return st.Err()
	}
	return withDetail.Err()
}

// AuthUnaryInterceptor admits a unary call only when the incoming
// metadata carries "authorization: Bearer <token>". Everything else is
// codes.Unauthenticated and the handler never runs. Metadata keys are
// normalized to lowercase by gRPC, so "authorization" is the only
// spelling to check.
func AuthUnaryInterceptor(token string) grpc.UnaryServerInterceptor {
	want := "Bearer " + token
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "no metadata on request")
		}
		auth := md.Get("authorization")
		if len(auth) == 0 {
			return nil, status.Error(codes.Unauthenticated, "no authorization metadata")
		}
		if auth[0] != want {
			return nil, status.Error(codes.Unauthenticated, "invalid bearer token")
		}
		return handler(ctx, req)
	}
}
