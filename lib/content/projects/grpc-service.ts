import { Project } from "../../content"

export const grpcService: Project = {
	slug: "grpc-service",
	name: "gRPC microservice",
	tagline:
		"Contract-first API design: define a proto, generate Go code, ship a tested gRPC service.",
	code: "RPC",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "5–7 hours",
	tags: ["grpc", "protobuf", "interceptors", "streaming", "bufconn"],
	lab: {
		path: "labs/grpc-service",
		command: "go test ./...",
		summary: {
			en: "A bufconn suite dials your server through the generated client stub and pins seven behaviors: NotFound on unknown ids, the exact seeded user back, a three-user stream in order, InvalidArgument on empty email, a created user stored and read back under a fresh id, and Unauthenticated when the token is missing or wrong.",
		},
	},
	mentalModels: [
		"contract-first design",
		"generated type safety",
		"interceptors as middleware",
		"in-memory transport for testing",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "A .proto file is the single source of truth. protoc generates server interfaces and client stubs. You implement the server interface, chain interceptors for logging and auth, and expose a server-streaming RPC. Tests use bufconn (an in-memory listener) for a real gRPC round-trip with no TCP overhead.",
			},
		},
		{
			type: "code",
			value: `service.proto → protoc → generated interface
      ↓ your implementation
interceptors: logging → auth → handler
tests: bufconn listener → generated client stub → your server`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `proto/user/v1/user.proto
gen/user/v1/              — generated, never edit
internal/
 ├── server/user.go       — implements UserServiceServer
 ├── interceptor/
 │    ├── logging.go
 │    └── auth.go
 └── server_test.go       — bufconn-based tests
cmd/server/main.go`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Define the protobuf schema" },
			uses: [],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "The proto file must define UserService with GetUser (unary), ListUsers (server-streaming), and CreateUser (unary). All fields must use snake_case. Field numbers 1–15 must be reserved for the most frequently sent fields. The go_package option must point to your module's gen path.",
					},
					rationale: {
						en: "The schema is the API contract. Changing a field number is a wire-breaking change; existing clients will misread the data. snake_case is the protobuf convention; the generated Go code converts to CamelCase automatically. Field numbers 1–15 use one byte on the wire; 16+ use two.",
					},
					hints: [
						{
							label: "streaming syntax",
							value: "rpc ListUsers(ListUsersRequest) returns (stream User); the stream keyword generates a server-streaming RPC.",
						},
					],
				},
			],
		},
		{
			n: "02",
			heading: { en: "Implement the server interface" },
			uses: ["interfaces","error-handling"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Embed UnimplementedUserServiceServer. Return codes.NotFound for missing resources, codes.InvalidArgument for malformed input, codes.Internal for unexpected errors. Never return a raw Go error from a gRPC handler.",
					},
					rationale: {
						en: "Embedding UnimplementedUserServiceServer means adding new RPCs to the proto won't break your server; the embedded type provides a default Unimplemented response. gRPC status codes are part of the wire contract: clients branch on them. A raw Go error becomes codes.Unknown, which clients cannot distinguish from a bug.",
					},
					hints: [
						{
							label: "status errors",
							value: 'status.Errorf(codes.NotFound, "user %s not found", id). Import google.golang.org/grpc/status and google.golang.org/grpc/codes.',
						},
						{
							label: "streaming send",
							value: "Call stream.Send(&User{...}) in a loop. Return nil when done, an error to abort the stream.",
						},
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "Chain logging and auth interceptors" },
			uses: ["context","interfaces"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Implement two unary interceptors: one logs method, duration, and error code for every call; one validates a Bearer token from gRPC metadata and returns codes.Unauthenticated on failure. Chain with grpc.ChainUnaryInterceptor. Auth must run before logging sees the result.",
					},
					rationale: {
						en: "gRPC interceptors are the same wrapping pattern as the HTTP middleware you built in T2: wrap one handler in another. gRPC metadata is the equivalent of HTTP headers. Auth before logging ensures unauthenticated requests are not logged as successful; the ordering matters for the same reason middleware ordering mattered in the HTTP server.",
					},
					hints: [
						{
							label: "metadata",
							value: "metadata.FromIncomingContext(ctx). Import google.golang.org/grpc/metadata.",
						},
					],
				},
			],
		},
		{
			n: "04",
			heading: { en: "Test with bufconn" },
			uses: [],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "All tests must use bufconn (no real TCP ports). Tests must cover: GetUser returning NotFound, GetUser returning a valid user, ListUsers streaming at least three items, CreateUser returning InvalidArgument on empty email, CreateUser storing a new user and reading it back under a fresh id, and the auth interceptor rejecting both a missing token and a wrong one.",
					},
					rationale: {
						en: "bufconn creates an in-memory listener. A grpc.Dial with a custom dialer pointing at it gives you a real gRPC round-trip (client stub, interceptors, your handler, response) with zero network overhead and no port allocation. You used net.Dial for TCP integration tests in T2; bufconn is the gRPC equivalent.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "system",
						title: "gRPC service test suite",
						description:
							"The lab ships the suite: go test ./... in labs/grpc-service must pass. Every test dials your server over bufconn through the generated client stub, so serialization, interceptor dispatch, and status codes cross a real gRPC round-trip. The generated code in userspb/ is committed; running the lab needs neither buf nor protoc. The suite is race-clean; add -race where cgo is available.",
						labPath: "labs/grpc-service",
						testCases: [
							{
								description:
									"TestGetUserUnknownID: GetUser with an id nobody seeded",
								expected: "codes.NotFound",
							},
							{
								description:
									"TestGetUserKnownID: GetUser with a seeded id",
								expected:
									"the exact seeded User message (proto.Equal)",
							},
							{
								description:
									"TestListUsersStreamsInOrder: ListUsers over 3 seeded users",
								expected:
									"3 messages in seed order, then io.EOF",
							},
							{
								description:
									"TestCreateUserEmptyEmail: CreateUser with an empty email field",
								expected: "codes.InvalidArgument",
							},
							{
								description:
									"TestCreateUserStores: CreateUser with a valid name and email, then GetUser on the returned id",
								expected:
									"a non-empty fresh id, the email echoed back, and the same user read back (proto.Equal)",
							},
							{
								description:
									"TestAuthNoToken: unary call with no authorization metadata",
								expected:
									"codes.Unauthenticated from the interceptor",
							},
							{
								description:
									"TestAuthWrongToken: unary call whose authorization metadata is present but wrong",
								expected:
									"codes.Unauthenticated (the interceptor checks the token value, not just presence)",
							},
						],
						desiredOutput:
							"ok  \tgopath.dev/labs/grpc-service/server\t0.65s",
						hints: [
							{
								label: "bufconn import",
								value: "google.golang.org/grpc/test/bufconn",
							},
							{
								label: "recv loop",
								value: "Call stream.Recv() in a loop until it returns io.EOF; that signals the server is done sending.",
							},
						],
					},
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "Contract-first design, generated types, interceptor chaining, in-memory test transport. Every pattern (middleware, context propagation, error codes, integration testing with a real transport) you already knew from T1 and T2. protobuf and gRPC were a new surface on familiar foundations.",
			},
		},
	],
}
