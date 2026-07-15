// Command details shows what a status error carries besides its code.
//
// Unlike ./wire and ./deadline, this one runs YOUR server package. It boots
// whatever is in server/ over bufconn, calls CreateUser with an empty email,
// and prints the error the client actually receives, field by field:
//
//	go run ./details               # your implementation
//	go run -tags solution ./details  # the reference
//
// The suite only ever asserts the code. That is the floor, not the ceiling,
// and the gap between the two runs is the point of the exercise.
package main

import (
	"context"
	"fmt"
	"net"
	"strings"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"gopath.dev/labs/grpc-service/server"
	"gopath.dev/labs/grpc-service/userspb"
)

const token = "gopath-lab-token"

func main() {
	client, stop := newClient()
	defer stop()

	ctx := metadata.AppendToOutgoingContext(context.Background(),
		"authorization", "Bearer "+token)

	section("CreateUser with an empty email")
	_, err := client.CreateUser(ctx, &userspb.CreateUserRequest{
		Name:  "No Email",
		Email: "",
	})
	if err == nil {
		fmt.Println("  no error at all: CreateUser accepted an empty email")
		return
	}

	st, ok := status.FromError(err)
	if !ok {
		fmt.Printf("  not a status error at all: %v\n", err)
		fmt.Println("  a raw Go error crosses the wire as codes.Unknown")
		return
	}

	fmt.Printf("  code:    %v\n", st.Code())
	fmt.Printf("  message: %s\n", st.Message())

	ds := st.Details()
	if len(ds) == 0 {
		fmt.Println("  details: (none)")
		fmt.Println()
		if st.Code() == codes.Unimplemented {
			fmt.Println("  That is the starter stub talking: CreateUser does not")
			fmt.Println("  validate anything yet. Implement it first, then come back")
			fmt.Println("  and run this again to see the error your own code sends.")
			fmt.Println()
			fmt.Println("  To see where this is going: go run -tags solution ./details")
			return
		}
		fmt.Println("  This is the floor, and the suite is happy with it: the code")
		fmt.Println("  is what the assessment demands and a human can read the")
		fmt.Println("  message.")
		fmt.Println()
		fmt.Println("  Now write the client. It has a form on screen and wants to")
		fmt.Println("  put a red border around the field that was rejected. Which")
		fmt.Println("  field was it? The only thing on the wire that knows is the")
		fmt.Println("  English sentence \"email must not be empty\", so the client")
		fmt.Println("  gets to write strings.Contains(msg, \"email\") and hope. Now")
		fmt.Println("  someone fixes a typo in your message and that client breaks,")
		fmt.Println("  silently, with no version bump and no compiler error. Prose")
		fmt.Println("  is not an API, but it becomes one the moment it is the only")
		fmt.Println("  thing carrying the information.")
		fmt.Println()
		fmt.Println("  Compare: go run -tags solution ./details")
		return
	}

	fmt.Printf("  details: %d attached\n", len(ds))
	for _, d := range ds {
		switch v := d.(type) {
		case *errdetails.BadRequest:
			fmt.Println("    google.rpc.BadRequest")
			for _, fv := range v.GetFieldViolations() {
				fmt.Printf("      field:       %s\n", fv.GetField())
				fmt.Printf("      description: %s\n", fv.GetDescription())
			}
		default:
			fmt.Printf("    %T: %v\n", v, v)
		}
	}
	fmt.Println()
	fmt.Println("  Now the field name is a field, not a substring. The client")
	fmt.Println("  type-switches on *errdetails.BadRequest, reads \"email\", and")
	fmt.Println("  highlights it. Reword the message all you like: nothing breaks,")
	fmt.Println("  because the machine-readable part and the human-readable part")
	fmt.Println("  are different parts.")
	fmt.Println()
	fmt.Println("  That detail is itself a protobuf message, marshalled into the")
	fmt.Println("  status and shipped in a trailer. Which means it obeys every")
	fmt.Println("  rule ./wire showed you: it is a schema, its field numbers are")
	fmt.Println("  the contract, and google.rpc.BadRequest is a schema Google")
	fmt.Println("  already wrote so that clients in every language agree on what")
	fmt.Println("  a field violation looks like.")
}

func newClient() (userspb.UserServiceClient, func()) {
	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(server.AuthUnaryInterceptor(token)),
	)
	userspb.RegisterUserServiceServer(srv, server.New())
	go srv.Serve(lis) //nolint:errcheck // Stop() makes Serve return.

	conn, err := grpc.NewClient("passthrough:///bufconn",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		panic(err)
	}
	return userspb.NewUserServiceClient(conn), func() { conn.Close(); srv.Stop() }
}

func section(title string) {
	fmt.Printf("\n%s\n%s\n\n", title, strings.Repeat("─", len(title)))
}
