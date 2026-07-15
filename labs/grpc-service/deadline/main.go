// Command deadline shows a context deadline crossing the wire.
//
// Nothing here is graded and none of it touches your server package. It is a
// self-contained gRPC service, dialed over bufconn, whose handlers do
// nothing but report what they were given:
//
//	go run ./deadline
//
// It exists to make one claim checkable. When you write
// context.WithTimeout on the client, gRPC does not keep that to itself. It
// serializes the remaining time into a request header, the server rebuilds
// a context with that deadline on its own side, and cancellation propagates
// backwards through every hop without a line of your code participating.
// That is not something net/http does for you, and it is the single most
// useful thing gRPC gives you for free.
package main

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"gopath.dev/labs/grpc-service/userspb"
)

// slowServer answers GetUser only after `work` has elapsed, and reports what
// it observed about the caller's deadline while it waited.
type slowServer struct {
	userspb.UnimplementedUserServiceServer
	work time.Duration
}

func (s *slowServer) GetUser(ctx context.Context, req *userspb.GetUserRequest) (*userspb.User, error) {
	start := time.Now()

	// The handler's ctx already carries the client's deadline. Nobody in
	// this file put it there.
	if dl, ok := ctx.Deadline(); ok {
		fmt.Printf("  server: my ctx has a deadline %v from now\n", time.Until(dl).Round(time.Millisecond))
	} else {
		fmt.Println("  server: my ctx has no deadline; I could sit here forever")
	}

	select {
	case <-time.After(s.work):
		fmt.Printf("  server: finished %v of work, returning a user\n", s.work)
		return &userspb.User{Id: req.GetId(), Name: "Ada Lovelace", Email: "ada@example.com"}, nil
	case <-ctx.Done():
		// This is the payoff. The client gave up, and the server found out.
		fmt.Printf("  server: gave up after %v because ctx.Err() = %v\n",
			time.Since(start).Round(10*time.Millisecond), ctx.Err())
		return nil, status.FromContextError(ctx.Err()).Err()
	}
}

// dumpMetadata is an interceptor that prints the request headers exactly as
// the server received them. Metadata is gRPC's headers; this is the
// equivalent of dumping r.Header in an HTTP handler.
func dumpMetadata(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		fmt.Println("  server: no metadata at all")
		return handler(ctx, req)
	}
	keys := make([]string, 0, len(md))
	for k := range md {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	fmt.Println("  server: incoming metadata, as it arrived on the wire:")
	for _, k := range keys {
		fmt.Printf("    %-16s %s\n", k+":", strings.Join(md.Get(k), ", "))
	}
	return handler(ctx, req)
}

func newClient(work time.Duration) (userspb.UserServiceClient, func()) {
	lis := bufconn.Listen(1 << 20)
	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(dumpMetadata))
	userspb.RegisterUserServiceServer(srv, &slowServer{work: work})
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

func main() {
	section("1. A call with a deadline the server can meet")
	client, stop := newClient(50 * time.Millisecond)
	call(client, 2*time.Second, true)
	stop()

	section("2. The same call, with a deadline it cannot")
	client, stop = newClient(2 * time.Second)
	call(client, 100*time.Millisecond, false)
	stop()

	section("3. The same call, with no deadline at all")
	client, stop = newClient(50 * time.Millisecond)
	callNoDeadline(client)
	stop()

	section("What you just saw")
	fmt.Println("Start with what is NOT in those metadata dumps. Runs 1 and 2 both")
	fmt.Println("set a timeout, and neither dump shows a grpc-timeout header. That")
	fmt.Println("is not a bug in this program, it is the mechanism.")
	fmt.Println()
	fmt.Println("The client really does send one: grpc-timeout is a normal HTTP/2")
	fmt.Println("header carrying the remaining time. But the server's transport")
	fmt.Println("consumes it on the way in. It parses the value, throws the header")
	fmt.Println("away, and hands your handler a ctx that already has the deadline")
	fmt.Println("on it. (grpc-go v1.65.1, internal/transport/http2_server.go: the")
	fmt.Println("\"grpc-timeout\" case sets the timeout and never appends it to the")
	fmt.Println("metadata.) You get the effect, not the header.")
	fmt.Println()
	fmt.Println("Contrast authorization in run 1. That one is not special to")
	fmt.Println("gRPC, so it is handed to you untouched, and an interceptor can")
	fmt.Println("read it. That is the line: headers gRPC defines are consumed and")
	fmt.Println("turned into behavior, headers you invent are delivered as data.")
	fmt.Println()
	fmt.Println("So the proof the deadline crossed the wire is not a header, it is")
	fmt.Println("the server's own ctx. Nothing in this file gives the handler a")
	fmt.Println("deadline. Run 1 says 1.999s, run 3 says none, and the only")
	fmt.Println("difference between them is what the client asked for.")
	fmt.Println()
	fmt.Println("Run 2 is the one worth rereading. The client stopped waiting at")
	fmt.Println("100ms and the server stopped working at 100ms, because ctx.Done()")
	fmt.Println("fired on the server side. It did not run the full 2s and throw the")
	fmt.Println("result into a connection nobody was listening to.")
	fmt.Println()
	fmt.Println("Now imagine the handler had called another gRPC service. The")
	fmt.Println("deadline would ride along again, and again, all the way down. One")
	fmt.Println("timeout at the edge bounds the entire call tree, and every hop")
	fmt.Println("stops working the moment the caller stops caring. That is the")
	fmt.Println("thing you would otherwise build by hand, badly, in every service")
	fmt.Println("you own.")
}

func call(client userspb.UserServiceClient, timeout time.Duration, withAuth bool) {
	fmt.Printf("  client: context.WithTimeout(ctx, %v), then GetUser\n", timeout)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// A header gRPC has no opinion about, for contrast: this one is
	// delivered to the handler verbatim, because nothing in the transport
	// wants it.
	if withAuth {
		fmt.Println("  client: ...and one authorization header of my own")
		ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer demo-token")
	}

	start := time.Now()
	u, err := client.GetUser(ctx, &userspb.GetUserRequest{Id: "u1"})
	report(u, err, start)
}

func callNoDeadline(client userspb.UserServiceClient) {
	fmt.Println("  client: context.Background(), no timeout, then GetUser")
	start := time.Now()
	u, err := client.GetUser(context.Background(), &userspb.GetUserRequest{Id: "u1"})
	report(u, err, start)
}

func report(u *userspb.User, err error, start time.Time) {
	elapsed := time.Since(start).Round(10 * time.Millisecond)
	if err != nil {
		fmt.Printf("  client: got code=%v after %v\n", status.Code(err), elapsed)
		if status.Code(err) == codes.DeadlineExceeded {
			fmt.Println("  client: that is the deadline I set, reported as a status code")
		}
		return
	}
	fmt.Printf("  client: got user %q after %v\n", u.GetName(), elapsed)
}

func section(title string) {
	fmt.Printf("\n%s\n%s\n\n", title, strings.Repeat("─", len(title)))
}
