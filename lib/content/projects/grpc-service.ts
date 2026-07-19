import { Project } from "../../content"

export const grpcService: Project = {
	slug: "grpc-service",
	name: "gRPC microservice",
	tagline:
		"Contract-first API design: define a proto, generate Go code, ship a tested gRPC service.",
	code: "RPC",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "16–18 hours",
	tags: ["grpc", "protobuf", "interceptors", "streaming", "bufconn"],
	lab: {
		path: "labs/grpc-service",
		command: "go test ./...",
		summary: {
			en: "A bufconn suite dials your server through the generated client stub and pins seven behaviors: NotFound on unknown ids, the exact seeded user back, a three-user stream in order, InvalidArgument on empty email, a created user stored and read back under a fresh id, and Unauthenticated when the token is missing or wrong. Three demo commands (wire, deadline, details) make the claims about the wire format, deadline propagation, and structured errors things you watch rather than things you are told.",
		},
	},
	mentalModels: [
		"the number is the API, the name is a comment",
		"the schema is the source, the Go is a build artifact",
		"status codes are a contract clients branch on",
		"interceptors are middleware, metadata is headers",
		"a deadline is a value that travels",
		"in-memory transport for testing",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Every HTTP API you have built on this site had an unwritten contract. The routes lived in one file, the JSON shapes lived in the structs, the client's expectations lived in somebody's head, and nothing connected them except discipline. It works, and it works right up until a field gets renamed and you find out from a customer. gRPC's proposition is that the contract should be a file that both sides compile against, and that a compiler should be the thing enforcing it rather than a code review.",
			},
		},
		{
			type: "text",
			value: {
				en: "That trade has a price, and this project is mostly about the price. You give up a self-describing payload: proto bytes do not carry field names, so nothing can read them without the schema, and curl will not help you. You take on a code generation step, so the build has a stage that is not `go build`. In exchange you get a contract with teeth, an error model richer than an HTTP integer, deadlines that propagate across process boundaries on their own, and streaming that is a first-class part of the interface rather than something you bolt on with a chunked response.",
			},
		},
		{
			type: "text",
			value: {
				en: "The service itself is small: three RPCs over an in-memory store. Almost none of the difficulty is in the handlers. It is in understanding what the wire is actually doing underneath them, because gRPC hides more from you than net/http does, and the things it hides are exactly the things that break in ways your compiler cannot see.",
			},
		},
		{
			type: "code",
			value: `proto/users.proto            the contract: field numbers, not names
     │ buf generate            a build step that is not "go build"
     ▼
userspb/                     server interface + client stub (committed)
     │ you implement
     ▼
grpc.Server
 ├─ auth interceptor         metadata in  → Unauthenticated or through
 ├─ GetUser      (unary)     → User | NotFound
 ├─ CreateUser   (unary)     → User | InvalidArgument + BadRequest detail
 └─ ListUsers    (stream)    → User, User, User, io.EOF

tests: bufconn (in-memory listener) → generated stub → your server`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/grpc-service/
 ├── proto/
 │   ├── users.proto       - the contract. This file is the API.
 │   └── wire_demo.proto   - not the contract: three shapes of the same
 │                           three fields, so ./wire can decode one as each
 ├── userspb/              - generated from users.proto. Committed, never edited.
 ├── wirepb/               - generated from wire_demo.proto. Committed.
 ├── server/
 │   ├── server.go         - yours: New, the three RPCs, the interceptor
 │   ├── server_test.go    - the suite: 7 cases over bufconn. Read it.
 │   └── solution.go       - the reference (build tag solution)
 ├── wire/                 - demo: what protobuf actually puts on the wire
 ├── deadline/             - demo: a client timeout becoming a server deadline
 ├── details/              - demo: your CreateUser error, field by field
 ├── buf.yaml
 └── buf.gen.yaml          - codegen config; you never need to run it`,
		},
	],
	constraints: [
		{
			type: "list",
			items: [
				{
					en: "The generated code is committed. Running this lab needs neither buf nor protoc, and that is a deliberate property: a learner should never be blocked on a toolchain to read a lesson about a toolchain. Regenerating is a documented, optional step.",
				},
				{
					en: "Never edit anything under userspb/ or wirepb/. The header says DO NOT EDIT and means it: your change survives exactly until the next generate. If the generated code is wrong, the proto is wrong.",
				},
				{
					en: "Return status errors, never raw Go errors. A bare error crosses the wire as codes.Unknown, which is indistinguishable from your server panicking. The status code is the part of your API that clients write code against.",
				},
				{
					en: "The suite is black-box. It registers your Server on a real grpc.Server and reaches it only through the generated client stub, so every assertion crosses serialization, framing, interceptor dispatch, and status translation. How you store users is entirely your business.",
				},
				{
					en: "The auth interceptor here guards unary RPCs only. Streaming calls route through a separate hook and ListUsers is deliberately left unguarded, which is a hole, is called out as one in step 06, and is not something the suite checks.",
				},
			],
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Read the contract, then watch what it puts on the wire" },
			uses: ["structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Everybody's first protobuf lesson says the same sentence: field numbers matter, do not change them. It is true and it is useless, because it is a rule without a mechanism, and a rule you cannot derive is a rule you will break the first time it is inconvenient. So before you write any Go, spend twenty minutes finding out what is actually in those bytes. The rule falls out of it, and afterwards you will not need to remember it.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Read proto/users.proto end to end, then run go run ./wire and read every section of its output against the file. You are looking for one thing: which parts of the .proto survive into the bytes and which parts are gone. Do not write any server code in this step.",
					},
					rationale: {
						en: "proto3 encodes each field as a tag byte followed by a value, where the tag packs the field number and a wire type. That is the whole format. The name is not encoded, because encoding it would defeat the point: a name costs 4 or 5 bytes on every message and the receiver already has the schema. So the decoder has exactly one question it can ask of an incoming field, which is what number is this, and it answers by looking up the number in whatever schema it was compiled against. Every protobuf compatibility rule you will ever read is a consequence of that single sentence. Renaming is free because names were never there. Adding is safe because unknown numbers are retained rather than rejected. Changing or reusing a number is catastrophic and silent because the decoder has no way to notice it was wrong.",
					},
					hints: [
						{
							label: "why 1 to 15 are worth rationing",
							value: "The tag is a varint holding (field_number << 3 | wire_type). Three bits go to the wire type, so field numbers 1 to 15 leave the tag at one byte and 16 to 2047 push it to two. On a message you send a billion times a day, spending your one-byte numbers on the fields that are always present is the difference between a rule of thumb and a line item. That is why every field in users.proto is in that range.",
						},
						{
							label: "reserved is not bureaucracy",
							value: 'When you delete a field, you write `reserved 3;` (or `reserved "email";`) where it was. That makes protoc reject any future attempt to reuse the number, which is the only defense that exists, because the failure it prevents produces no error at runtime. Section 5 of ./wire is what you are defending against.',
						},
						{
							label: "you cannot curl this",
							value: "That is the honest cost. A JSON API is debuggable with tools that know nothing about it; a proto API is not, because the payload is meaningless without the schema. grpcurl exists and solves this by loading your schema (from reflection or a file). The tradeoff is real: you bought a compiler-checked contract and paid for it in ad-hoc introspection.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command: "go run ./wire",
					expect: {
						en: 'Section 1 hexdumps a 35-byte User and section 2 walks it: three rows reading "field 1, LEN, u1", "field 2, LEN, Ada Lovelace", "field 3, LEN, ada@example.com". The tag bytes are 0a, 12 and 1a. Search that hexdump for the letters "email" and you will not find them; section 3 prints the same message as JSON, at 59 bytes, with all three names in it as text. Section 6 decodes the User into a message that only knows field 1, marshals it straight back out, and prints identical: true. Nothing was lost, and the decoder never knew what it was carrying.',
					},
					labPath: "labs/grpc-service/wire/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Nothing to edit: section 5 of ./wire is the break, already wired up. Before you scroll to it, commit to a prediction. It decodes those exact User bytes into ShuffledUser, which has the same three field names and rotated numbers (id = 3, name = 1, email = 2). Write down what you expect proto.Unmarshal to return.",
					},
					observe: {
						en: 'It returns nil. No error. id = "ada@example.com", name = "u1", email = "Ada Lovelace". Every field is populated, every field is wrong, and the program had no way to tell.',
					},
					why: {
						en: 'Most people predict an error, because every other deserializer they have used would give them one. There is nothing to detect. The decoder read tag 0x0a, extracted field number 1, looked up field 1 in the schema it was compiled with, found a string called name, and stored a string in it. It did its job perfectly. A type mismatch would have been caught (field 2 as an int32 against a string on the wire is an error), which is exactly why this is dangerous: three strings shuffled among themselves is the one shape that slips through completely clean. Now stop thinking of it as a contrived demo, because the realistic version has no villain in it: you delete a field, someone later reuses its number for something else, and an old client that has not regenerated in six months keeps talking happily. That is not two message types, that is one message type across two points in time, and it is the same decode.',
					},
				},
			],
			retrievalPrompt:
				'A teammate renames a proto field from `email` to `email_address` and ships it without telling the client team. What breaks on the wire? || Nothing. Field names are not on the wire; only numbers are. Every deployed client keeps decoding field 3 exactly as before. The rename breaks their Go source the next time they regenerate (GetEmail becomes GetEmailAddress), which is a compiler error, at build time, with a file and a line. That is the trade protobuf makes: it moves the breakage to the only place it can be seen.',
		},
		{
			n: "02",
			heading: { en: "Codegen is a build step, and its output is not yours" },
			uses: ["interfaces", "packages"],
			blocks: [
				{
					type: "text",
					value: {
						en: "There are about 900 lines of Go in this lab that nobody wrote. They arrived from a compiler you have not run, they are committed to the repo like real code, and the first line of each one tells you not to touch it. That is a genuinely strange thing to have in a Go project, and it is worth understanding before you build on top of it rather than after you have edited one by hand and lost the change.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Open userspb/users_grpc.pb.go and find four things: the UserServiceServer interface your code has to satisfy, the UserServiceClient interface the suite calls, the UnimplementedUserServiceServer struct, and the mustEmbedUnimplementedUserServiceServer method. Then open userspb/users.pb.go and find the file_users_proto_rawDesc byte slice. Do not run buf; you do not need it.",
					},
					rationale: {
						en: "Two generators ran over one file. protoc-gen-go turned the messages into structs with getters and a serializer, and protoc-gen-go-grpc turned the service into a pair of interfaces plus the plumbing that routes a method name to a handler. Neither knows about the other. The reason the output is committed here rather than generated during the build is a deliberate call for a teaching repo: making `go test` depend on protoc being installed and version-matched would put a toolchain problem between a learner and a lesson. Real projects split on this. Committing means any clone builds and the diff shows you when the contract moved; generating means the artifact can never drift from the source. Both are defensible. What is not defensible is editing the output, because the generator has the last word and your change lives exactly until someone runs it.",
					},
					hints: [
						{
							label: "what mustEmbed is actually for",
							value: "It is an unexported method on the interface, so no type outside userspb can satisfy UserServiceServer without embedding UnimplementedUserServiceServer. That embedding is what makes adding an RPC to the proto a non-breaking change for every server: the new method already has a default that returns Unimplemented, so your code still compiles. It is a compile-time trick that buys you a deployment property, and it is why the generator forces it on you instead of suggesting it.",
						},
						{
							label: "the rawDesc bytes are the proto file",
							value: "file_users_proto_rawDesc is your .proto, serialized as a FileDescriptorProto and embedded in the binary. That is how a running server can describe its own schema at runtime, which is what powers grpc reflection and lets grpcurl call a service it has never seen. The contract is not just compiled in, it is present.",
						},
						{
							label: "the generated struct is not a plain struct",
							value: "It carries state, impl and sizeCache fields plus a mutex-free internal message pointer. That is why the suite compares with proto.Equal rather than == or reflect.DeepEqual: two Users with identical contents can differ in that internal state, and == on a struct containing them will not even compile. Compare protos with proto.Equal, always.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"go doc gopath.dev/labs/grpc-service/userspb UserServiceServer\ngo doc gopath.dev/labs/grpc-service/userspb UnimplementedUserServiceServer\n\n# go doc will not show you the method that matters. Read it directly:\ngrep -n mustEmbed userspb/users_grpc.pb.go",
					expect: {
						en: 'The first prints the three-method interface you are about to implement, and then the line "// Has unexported methods." That line is the whole step: go doc will not name it, because you are not meant to call it. The grep finds it, at three places in the file: declared on the interface, defined on UnimplementedUserServiceServer, and required again on the registration path. Note the shapes while you are there. GetUser and CreateUser take a context and return a value; ListUsers takes a stream and returns only an error. Unary and streaming differ at the type level, which is step 05. The second doc command shows the struct whose methods all return codes.Unimplemented, which is exactly what your starter returns right now, because you embed it and have overridden nothing.',
					},
					labPath: "labs/grpc-service/userspb/users_grpc.pb.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the embedded userspb.UnimplementedUserServiceServer line from the Server struct in server/server.go, then run go build ./...",
					},
					observe: {
						en: "It does not compile: cannot use server.New(...) as userspb.UserServiceServer value in argument to userspb.RegisterUserServiceServer: *server.Server does not implement userspb.UserServiceServer (missing method mustEmbedUnimplementedUserServiceServer). Put the line back.",
					},
					why: {
						en: "You cannot write that method yourself. It is unexported and defined in userspb, so no package outside userspb can declare it, and embedding is the only way in. That is the generator deliberately taking the choice away from you, and it is worth appreciating what it bought: the day someone adds a fourth RPC to users.proto, every server in your company keeps compiling and answers the new method with Unimplemented instead of failing the build. The alternative, a bare interface, means adding one line to a shared proto breaks every implementer at once, which in practice means nobody adds the line. The awkward embedded struct is the price of a schema you can actually evolve.",
					},
				},
			],
			retrievalPrompt:
				"Why does the generated server interface contain an unexported method you are forced to satisfy by embedding, instead of just listing the three RPCs? || Because it makes adding an RPC to the proto a non-breaking change. Embedding UnimplementedUserServiceServer gives every server a default implementation of every future method, so a new RPC compiles everywhere and returns codes.Unimplemented until someone overrides it. With a plain interface, one new line in a shared proto would break every implementer's build simultaneously.",
		},
		{
			n: "03",
			heading: { en: "Implement GetUser, and make the store remember order" },
			uses: ["maps", "slices", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The first real code, and the only design decision in the project that the suite genuinely constrains. You need lookup by id, which is a map. You will need arrival order in step 05, which a map cannot give you. Deciding that now costs one field; discovering it in step 05 costs a rewrite of every method you are about to write.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Implement New(seed ...*userspb.User) *Server and GetUser. New keeps the seed users so that both lookup by id and arrival order are answerable. GetUser returns the stored user for req.GetId(), or status.Errorf(codes.NotFound, ...) for an id nobody seeded. Guard the storage: gRPC serves every request on its own goroutine.",
					},
					rationale: {
						en: "Go randomizes map iteration deliberately, and it is one of the language's better hostile decisions: the spec does not promise an order, so the runtime makes sure you cannot accidentally depend on one. A map plus a slice of ids is the standard shape and it is what the reference does. On the locking: net/http gave every request a goroutine and gRPC does exactly the same thing, so your store is shared mutable state reached concurrently the moment two calls overlap. The suite is sequential and will not catch a missing mutex, which is precisely why it is worth doing now rather than being taught by a race detector later.",
					},
					hints: [
						{
							label: "status.Errorf, not fmt.Errorf",
							value: 'status.Errorf(codes.NotFound, "user %q not found", id) builds an error that carries a code across the wire. fmt.Errorf builds one that does not, and the client sees codes.Unknown. Step 04 is entirely about why that distinction is worth this much attention.',
						},
						{
							label: "returning the stored pointer",
							value: "GetUser returning s.users[id] hands the caller a pointer into your store. It is fine here because nothing mutates a User after it is stored and the value is immediately serialized by gRPC. It stops being fine the day you add an UpdateUser: then two goroutines share a *User and the mutex you took is protecting the map, not the thing the map points at. Worth noticing now; not worth solving now.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"go test -run 'TestGetUserKnownID|TestGetUserUnknownID' ./server/",
					expect: {
						en: "Both green. TestGetUserKnownID compares with proto.Equal, so it is checking the message actually round-tripped through serialization and came back byte-equivalent, not that you returned the same pointer. The other five tests still fail, and TestAuthNoToken failing with Unimplemented rather than Unauthenticated is expected: the interceptor is step 06.",
					},
					labPath: "labs/grpc-service/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Make GetUser return the user without checking whether it was found: drop the ok check and just return s.users[req.GetId()], nil.",
					},
					observe: {
						en: 'TestGetUserUnknownID fails, and read what it says: "GetUser with an unknown id returned no error, want codes.NotFound". Not a wrong code. No error at all. The call succeeded, and what the client received was a User with every field empty.',
					},
					why: {
						en: 'A map read on a missing key returns the zero value, which for *userspb.User is nil, and gRPC serializes a nil message as zero bytes. The client does not receive nothing; it receives an empty User, and because proto3 has no way to distinguish an absent string from an empty one, that user has an id of "" and a name of "" and looks exactly like a real record of a person with no name. The status code is the only channel that could have said "this does not exist", and you declined to use it. This is the whole argument for codes as an API in one failure: without them, absence and emptiness are the same bytes.',
					},
				},
			],
			retrievalPrompt:
				"Your store is a map[string]*User and GetUser forgets to check the comma-ok. What does the client receive for an unknown id? || A User with every field zero, and no error. The map returns nil for a missing key, proto serializes a nil message as zero bytes, and proto3 cannot tell an empty string from an absent one. The client cannot distinguish that from a real user with blank fields. The status code was the only thing that could have carried the difference.",
		},
		{
			n: "04",
			heading: { en: "Status codes are an API, not a log message" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Here is the failure this step prevents, and it is not a crash. Your handler returns fmt.Errorf(\"user not found\"). The client gets an error. The client logs it. Six months later someone writes a retry loop, and it retries the not-found forever, because from the client's side a not-found and a server panic are the same value: an error whose text they are not allowed to trust. Everything about gRPC's error model exists to stop that.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Implement CreateUser. Reject an empty email with codes.InvalidArgument before touching storage, then store the user under a fresh id nobody has and return the stored user. Every error your handlers produce, in this method and everywhere else, must be built with the status package.",
					},
					rationale: {
						en: 'gRPC ships 16 codes and they are a genuine API surface: the client library itself branches on them, retry policies are written in terms of them, and every language binding agrees on their meaning. The three in this lab are the three you will use most. NotFound means the thing is not there and asking again will not help. InvalidArgument means the request is wrong and will be wrong every time you send it, which is the signal that stops a retry loop dead. Internal means something broke on my side and a retry might work. Compare that to HTTP, where you get an integer and a culture of arguing about whether a validation failure is 400 or 422. The code is the part clients write code against; the message is the part humans read. Keep them separate and neither can hurt the other.',
					},
					hints: [
						{
							label: "validate before you store",
							value: "The order is load-bearing, not tidiness. If you assign an id, append to the order slice, and then notice the email is empty, you have a partial write to undo and an id burned. Reject at the top and there is nothing to unwind. This is the file renamer's boundary validation from Tier 1, three tiers later, unchanged.",
						},
						{
							label: "Unknown is the code you never want to send",
							value: "It is what a raw Go error becomes, and what a panic in your handler becomes. So a client seeing Unknown genuinely cannot tell a business outcome from your server having a bad day. If you find Unknown in a client's logs, it is nearly always a server that returned an error the standard library made up a code for.",
						},
						{
							label: "why the suite reads the user back",
							value: 'TestCreateUserStores does not trust the return value. It calls GetUser on the id you handed back, because a handler that validates the email and returns a plausible User without storing it passes every other assertion in the suite. That test exists because the suite once had exactly that hole: five tests green, and CreateUser\'s success path completely uncovered.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"go test -run 'TestCreateUserEmptyEmail|TestCreateUserStores' ./server/",
					expect: {
						en: "Both green. The second is the interesting one: it does a CreateUser and then a GetUser on the returned id, over the wire, through the stub, and requires proto.Equal between what you returned and what you stored. Four of seven tests now pass; ListUsers and the two auth cases remain.",
					},
					labPath: "labs/grpc-service/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Swap GetUser\'s not-found error for a raw Go error: return nil, fmt.Errorf("user %q not found", req.GetId()). Rerun go test -run TestGetUserUnknownID ./server/',
					},
					observe: {
						en: "It fails with status code = Unknown, want NotFound. Read the error text the client got: it is your sentence, delivered intact, with the wrong code attached.",
					},
					why: {
						en: 'That is the trap. The message survived, so a human tailing logs sees "user \\"no-such-id\\" not found" and concludes everything is working. Nothing is: the code is the machine-readable half, and it now says Unknown, which means "my server did something unexpected". A generated client with a retry policy will retry it, because Unknown is a plausibly transient condition and NotFound is not. So the same handler, with the same message, produces either a clean 404-shaped answer or a client hammering you forever for a user that does not exist, and the difference is which function you built the error with. status.Errorf and fmt.Errorf look equally reasonable at the call site. Only one of them is talking to the client.',
					},
				},
			],
			retrievalPrompt:
				'Your handler returns fmt.Errorf("user not found"). The client logs "user not found", so it looks fine. What did you actually break? || The code. A raw Go error crosses the wire as codes.Unknown, which means "the server hit something unexpected" rather than "this does not exist". The human-readable half arrived and the machine-readable half is now a lie, so a client with a retry policy retries a request that can never succeed. The message is for people; the code is the API.',
		},
		{
			n: "05",
			heading: { en: "Server streaming: one call, many messages, one order" },
			uses: ["interfaces", "maps"],
			blocks: [
				{
					type: "text",
					value: {
						en: "ListUsers is the first method whose signature does not look like a function call. No context, no return value, just a stream and an error. That shape is the whole feature: the RPC stops being a request that produces a response and becomes a conversation that produces a sequence, and the client can start work on the first message long before the last one exists.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Implement ListUsers. Send every stored user exactly once, in the order they arrived (seed order, then anything CreateUser added), then return nil. Take your snapshot of the store under the lock and do the Sends outside it.",
					},
					rationale: {
						en: "A unary handler returns (msg, error) and gRPC serializes the result. A streaming handler is handed the stream and returns only an error, because there is no single result to return: you call Send as many times as you like and returning nil is what tells the client the sequence ended, which surfaces on its side as io.EOF from Recv. The reason to stream at all is memory and latency, on both ends. A million users as a repeated field is one message that has to fit in RAM twice (yours to build it, theirs to parse it) and cannot be looked at until the last byte arrives; as a stream it is a million small messages and a client that can render the first one immediately. On the locking: Send writes to the transport and blocks on HTTP/2 flow control, so it can wait on a slow client for as long as that client wants. Hold your mutex across it and one slow reader stalls every other RPC in the process. Snapshot under the lock, send outside it.",
					},
					hints: [
						{
							label: "the stream is not a channel",
							value: "userspb.UserService_ListUsersServer is an interface with Send and an embedded grpc.ServerStream. Its Context() is the request context, which matters more than it looks: a client that hangs up mid-stream cancels it, and a loop that never checks it keeps Sending into a connection nobody is reading. For three users, irrelevant. For three million, that is a goroutine burning CPU for a client that left.",
						},
						{
							label: "Send errors are terminal",
							value: "If Send returns an error the stream is already broken; return the error and stop. Do not continue the loop hoping the next one works. There is no next one.",
						},
						{
							label: "this is where the store design pays",
							value: "If you kept only a map in step 03, this is the step that makes you rewrite it. That is the entire reason step 03 asked for arrival order before anything needed it.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command: "go test -run TestListUsersStreamsInOrder -count=10 ./server/",
					expect: {
						en: "Green, ten times out of ten. The -count=10 is not superstition, and the break-it below is why: this specific test can pass a broken implementation most of the time, so a single green run is not evidence. Six of seven tests now pass.",
					},
					labPath: "labs/grpc-service/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Range over the map directly instead of the order slice: for _, u := range s.users { snapshot = append(snapshot, u) }. Predict the result, then run go test -run TestListUsersStreamsInOrder -count=10 ./server/",
					},
					observe: {
						en: "It passes. Not always: roughly 8 runs in 10 on a stock go1.22 toolchain, measured. The failures, when they come, are a stream in the wrong order. Most people predict a clean red here.",
					},
					why: {
						en: "Go randomizes map iteration, and the randomization is not what you think. It picks a random starting bucket and a random offset inside it, then walks forward and wraps. Three keys land in one 8-cell bucket, so 6 of the 8 possible start offsets replay them in insertion order: 75% by construction, and 16 of 20 when actually run. The safeguard is real and at n=3 it is far too weak to catch you. Nine keys force a second bucket, the bucket order randomizes too, and it drops to under 1%. So this bug is green on your laptop, green in CI, green in review, and then someone seeds a ninth user and a stream that always worked starts coming back shuffled, in production, with a diff that touched nothing near your code. That is the actual shape of an order dependency: not a test that fails, a test that has not failed yet.",
					},
				},
			],
			retrievalPrompt:
				"You replace the order slice with a plain range over the map and the order test passes ten times in a row. Are you fine? || No. With three keys in one bucket, Go's iteration randomization only rotates the start offset, so insertion order survives about 3 runs in 4. The test is not evidence at that size. Add a ninth user, the map splits into two buckets, the bucket order randomizes too, and it collapses to under 1%. The bug was always there; the map was just too small to show it.",
		},
		{
			n: "06",
			heading: { en: "Interceptors are middleware, metadata is headers" },
			uses: ["context", "interfaces"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You built HTTP middleware in Tier 2: a function that takes a handler and returns a handler, so cross-cutting work happens in one place instead of at the top of forty functions. gRPC has exactly that, under a different name, with one signature you have to learn and one scope trap that is easy to miss and is sitting in this lab on purpose.",
					},
				},
				{
					type: "constraint",
					what: {
						en: 'Implement AuthUnaryInterceptor(token string). It admits a call only when the incoming metadata carries authorization set to exactly "Bearer " + token. No metadata, no authorization key, or any other value is codes.Unauthenticated, and the handler must not run.',
					},
					rationale: {
						en: 'A UnaryServerInterceptor is func(ctx, req, info, handler) (any, error): it receives the call before the handler does, and calling handler(ctx, req) is what lets it through. Return an error instead and the handler never executes. That is http.Handler wrapping with the types spelled differently, and the same reasoning applies about ordering: whatever runs first sees the request first. Metadata is gRPC\'s headers, and it is genuinely just headers, carried as HTTP/2 headers on the wire. Two things about it will catch you. Keys are normalized to lowercase, so "Authorization" and "authorization" are the same key and only the lowercase spelling exists by the time you read it. And a key holds a []string, not a string, because a header can legitimately appear more than once.',
					},
					hints: [
						{
							label: "the scope trap, stated plainly",
							value: "Unary interceptors see unary RPCs only. ListUsers is a streaming RPC and routes through grpc.StreamServerInterceptor, an entirely separate hook, so the interceptor you are writing does not guard it. That is true in this lab and the suite does not check it: ListUsers is reachable with no token at all. A production service registers both, and this one does not, so that the hole is visible rather than hidden behind a green suite.",
						},
						{
							label: "why the interceptor takes the token as a parameter",
							value: "Same trick as every other testable-boundary decision on this site: a package-level constant or an os.Getenv inside the interceptor makes the auth layer depend on global state, and the suite would have to mutate the environment to test it. As a parameter, the test constructs one with a known token and the whole problem disappears.",
						},
						{
							label: "constant time comparison, in real life",
							value: 'auth[0] != want is a string compare that returns early on the first differing byte, which technically leaks timing. For a bearer token of this length over a network it is not a practical attack, and crypto/subtle.ConstantTimeCompare is what you would reach for if it were. Worth knowing the name; not worth pretending this lab is a security boundary.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"go test ./...\n\n# and watch what the server actually receives:\ngo run ./deadline",
					expect: {
						en: 'All seven green: ok gopath.dev/labs/grpc-service/server. Then the deadline demo\'s first run prints the incoming metadata exactly as the server got it, and there is your authorization: Bearer demo-token sitting next to :authority, content-type: application/grpc and user-agent: grpc-go/1.65.1. Nothing exotic. It is a header map, it arrived over HTTP/2, and your interceptor reads it the way middleware reads r.Header.',
					},
					labPath: "labs/grpc-service/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Check only that the header is present, not what it says: replace the value comparison with a length check, so any authorization key at all admits the call. Rerun go test ./server/",
					},
					observe: {
						en: 'Six of seven pass. Exactly one fails: "GetUser with a wrong token succeeded, want codes.Unauthenticated from the interceptor". Not a wrong code, a success. The call carrying Bearer wrong-token was let through and cheerfully returned Ada Lovelace.',
					},
					why: {
						en: 'You have written authentication that authenticates nothing. Any client sending "authorization: hello" is now an admin, and every test that sends the correct token still passes, because sending the right token is not the thing you broke. Look at how thin the surviving evidence is: one assertion, in a suite of seven, standing between this service and no auth at all. This is not hypothetical; the lab\'s suite really did ship with only TestAuthNoToken, and a presence-only interceptor passed it clean. That is the general lesson worth more than the specific bug: a test that sends a valid credential proves nothing about your auth, because it exercises the path where you are correct. The only test that has ever proven an auth check works is the one that sends the wrong answer and demands rejection.',
					},
				},
			],
			retrievalPrompt:
				"Your auth interceptor checks that the authorization header exists and the suite is green. What have you actually built, and which test would have caught it? || Nothing: a client sending any value at all gets in. Every passing test sends the correct token, so they only exercise the path where you are right. The one that catches it sends a wrong token and demands Unauthenticated. Credential checks are only proven by the requests you must reject, never by the ones you accept.",
		},
		{
			n: "07",
			heading: { en: "A deadline is a value that travels" },
			uses: ["context", "select"],
			blocks: [
				{
					type: "text",
					value: {
						en: "In Tier 2 you passed a context down a call stack and cancellation propagated through your program. Now the call stack has a network in the middle of it, in a different process, possibly on a different continent, and the context still works. This is the single best thing gRPC does for you, most people never notice it is happening, and the ones who do notice mostly find out because they turned it off by accident.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Write no code. Run go run ./deadline and account for three things in the output: why the server's ctx has a deadline nobody in that file set, why grpc-timeout does not appear in the metadata dump when the client demonstrably sent a timeout, and why run 2's server stops working at 100ms instead of finishing its 2 seconds of work.",
					},
					rationale: {
						en: "context.WithTimeout on the client makes gRPC serialize the remaining time into a grpc-timeout request header. The server's transport parses it, and the ctx your handler receives already has that deadline on it. Then it recurses: if that handler calls another gRPC service, the remaining time goes out on the next hop's header too. One timeout at the edge bounds the entire call tree, and every service in it stops working the moment the caller stops caring. Compare what net/http gives you: a client timeout aborts the client's wait and the server keeps computing a response for a connection that is gone, because nothing told it. You can build deadline propagation over HTTP by hand with a header and a convention, and people do, and it is exactly as reliable as the least careful service in the chain.",
					},
					hints: [
						{
							label: "why the header is missing from the dump",
							value: 'Because the transport eats it. In grpc-go v1.65.1, internal/transport/http2_server.go parses the "grpc-timeout" header, sets the timeout, and never appends it to the metadata your interceptor sees. Headers gRPC defines are consumed and turned into behavior; headers you invent, like authorization, are handed to you as data. The absence in that dump is the mechanism, not a bug in the demo.',
						},
						{
							label: "the deadline is a deadline, not a duration",
							value: "It goes on the wire as remaining time and is immediately turned back into an absolute instant on the far side. That is why the demo prints 1.999s rather than 2s: the microseconds it took to serialize, send and parse are gone, and correctly so. Every hop pays its own latency out of the same budget.",
						},
						{
							label: "the client can lie and the server should not care",
							value: 'grpc-timeout comes from the caller, so a client can ask for an hour. Your own timeouts are still yours to enforce: taking the smaller of the client\'s deadline and your own policy is what a service with an SLO does. context.WithTimeout on the handler\'s ctx does exactly that, because the derived context fires on whichever deadline comes first.',
						},
						{
							label: "DeadlineExceeded is a code, not an exception",
							value: "The client sees codes.DeadlineExceeded, the server's ctx.Err() says context deadline exceeded, and status.FromContextError is what turns one into the other. Both sides agree on what happened, which is more than a dropped TCP connection ever tells you.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command: "go run ./deadline",
					expect: {
						en: 'Run 1 says "my ctx has a deadline 1.999s from now" and returns a user. Run 2 sets 100ms against 2s of work, and the server prints "gave up after 100ms because ctx.Err() = context deadline exceeded" while the client reports code=DeadlineExceeded at the same moment. Run 3 sends no timeout and the server says "my ctx has no deadline; I could sit here forever". Same handler, same pipe, three different behaviors, and the only thing that changed is what the client asked for. That is the proof it crossed the wire: nothing in that file gives the handler a deadline.',
					},
					labPath: "labs/grpc-service/deadline/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In deadline/main.go, stop the handler from ever noticing: change the select's case <-ctx.Done(): to case <-(chan struct{})(nil):, a nil channel, which blocks forever. The arm is still there and can never fire. Rerun go run ./deadline and compare run 2 against what it printed before.",
					},
					observe: {
						en: 'The client half is identical, to the millisecond: "got code=DeadlineExceeded after 110ms". On the server side, the line "gave up after 100ms because ctx.Err() = context deadline exceeded" is simply gone, and nothing takes its place. The server announces its 97ms deadline and then says nothing at all for the rest of the program.',
					},
					why: {
						en: "Sit with that silence, because it is the finding. gRPC hands the client its DeadlineExceeded whether or not your handler cooperates, so the client-facing behavior did not change by one millisecond and no black-box test could tell these two servers apart. And the wasted work does not announce itself either: the handler is still sitting in its 2 second sleep, in a goroutine nobody is waiting for, and the process exits before it ever finishes. You cannot see the cost. That is the cost. Now scale it: a service gets slow, clients time out at 100ms and retry, and every abandoned request keeps running to completion right next to its own retry, holding a database connection and a chunk of memory to produce a response that has nowhere to go. Load rises because you got slow, and it cannot recover, because none of that work is deliverable. A deadline that only the client honors is a load amplifier. Receiving it is free; respecting it is the part you write.",
					},
				},
			],
			retrievalPrompt:
				"A client sets a 100ms timeout and your gRPC handler never looks at ctx.Done(). The client sees DeadlineExceeded at 100ms, so what is the problem? || The client's view is correct and the server is still working. gRPC hands the client its DeadlineExceeded regardless, so nothing observable from outside changes, while the handler runs to completion holding resources and produces a response for a connection nobody is reading. Under load, every timed-out request keeps burning capacity next to its own retry. Getting the deadline is free; honoring it is code you write.",
		},
		{
			n: "08",
			heading: { en: "Errors that carry more than a sentence" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: 'Your CreateUser rejects an empty email with InvalidArgument and a clear message, and the suite is satisfied. Now write the client. It has a form on screen and wants a red border around the field that was rejected. Which field was it? The only thing on the wire that knows is an English sentence, so the client writes strings.Contains(msg, "email") and you have accidentally made your prose an API.',
					},
				},
				{
					type: "constraint",
					what: {
						en: "Run go run ./details against your implementation, then go run -tags solution ./details, and read the difference. Then decide whether to attach a google.rpc.BadRequest detail to your own CreateUser rejection naming the offending field. The suite checks only the code, so this is above the bar and stays your call.",
					},
					rationale: {
						en: 'A status is a code, a message, and a repeated Any of details. The details are ordinary protobuf messages marshalled into the status, which means the error itself is schema-typed, versioned, and evolvable under exactly the rules the wire demo showed you. Google publishes a standard set in google.rpc (BadRequest for field violations, RetryInfo for how long to wait, QuotaFailure, ErrorInfo) so clients in every language agree on what a field violation looks like without your team inventing a convention. The split is the point: the code is for the client\'s control flow, the details are for the client\'s code, and the message is for a human reading a log. Three audiences, three channels. Collapse them into one string and every consumer is parsing prose, which means your error text is now something you cannot change without a migration.',
					},
					hints: [
						{
							label: "WithDetails returns a new status",
							value: "st.WithDetails(...) does not mutate; it returns (*Status, error) and you take .Err() from the result. The error return is the marshalling failing, which for a BadRequest cannot happen, but swallowing it silently would drop the rejection entirely. Fall back to the bare status rather than returning nil.",
						},
						{
							label: "details ride in a trailer",
							value: "They are serialized into the grpc-status-details-bin trailer, which is base64 because it is binary in a header. That means they cost bytes on every error response, which is a good reason not to attach a stack trace to everything, and a fine reason to attach the twelve bytes naming a bad field.",
						},
						{
							label: "the client side is a type switch",
							value: "status.FromError(err) then st.Details() gives []any, already unmarshalled into concrete types. Type-switch on *errdetails.BadRequest and read the field violations. That is the whole client API, and it is why this beats any convention you would have invented.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command: "go run ./details\ngo run -tags solution ./details",
					expect: {
						en: 'The first reports your implementation: code InvalidArgument, your message, and "details: (none)" until you add one. The second shows where it is going: the same code and message, plus "details: 1 attached", google.rpc.BadRequest, field: email. Same rejection, same code, same suite result. The difference is entirely in whether a client can act on it without parsing English.',
					},
					labPath: "labs/grpc-service/details/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'You do not need to edit anything to see this one, only to think it through honestly. Take the version with no details and imagine the client that must highlight the bad field. It writes strings.Contains(st.Message(), "email"). Now you reword the message to "a valid address is required".',
					},
					observe: {
						en: "Nothing fails. Your tests are green, the code is still InvalidArgument, the reworded message is better English, and the client silently stops highlighting the field. Nobody finds out from a build, a test, or a log line.",
					},
					why: {
						en: 'You shipped a breaking API change in a copy edit. That is the real cost of putting machine-readable information in a human-readable channel: the compatibility rules you learned in step 01 protect your fields, and they protect nothing about your prose, because the string is opaque to every tool you own. The moment a client parses your message text, that text is part of your contract, with none of the tooling a contract gets. A BadRequest detail costs a dozen bytes and moves the field name into a typed field with a field number, which is to say into the part of the system that has rules.',
					},
				},
			],
			retrievalPrompt:
				"Why is a status detail better than putting the field name in the error message, when the message already says which field is wrong? || Because the message is prose and prose has no compatibility rules. A client that greps your message text has made your wording part of the contract, so rewording it is a silent breaking change no test or compiler catches. A google.rpc.BadRequest detail is a protobuf message with field numbers, so the field name is data the client type-switches on, and the sentence stays free to change.",
		},
		{
			n: "09",
			heading: { en: "bufconn: a real round trip with no port" },
			uses: ["interfaces", "goroutines"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been running this suite all along without asking what it is. Now is the time, because how it is built is the reason you can trust it, and the reason it is worth copying into your own services. It never opens a port, and it is not a mock.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Read server/server_test.go end to end, particularly newClient. Account for why it can dial an address that does not exist, why the whole suite runs a real grpc.Server, and what the suite would fail to catch if it called server.New(...).GetUser(ctx, req) directly instead. Then get all seven green.",
					},
					rationale: {
						en: 'bufconn.Listen returns a net.Listener backed by an in-memory pipe. grpc.NewClient with a WithContextDialer pointing at it produces a client whose connections are that pipe, so "passthrough:///bufconn" is a name nothing resolves and never needs to. What is real is everything else: a genuine grpc.Server, genuine HTTP/2 framing, genuine protobuf serialization, genuine interceptor dispatch, genuine status translation. Only the socket is fake, which is the exact opposite of a mock. A mock replaces the thing you are testing with something that agrees with you; bufconn replaces the one part of the stack that has nothing to teach you and is the only part that can flake. No port to collide on a busy CI box, no listen backlog, no TIME_WAIT, no firewall dialog.',
					},
					hints: [
						{
							label: "what calling the method directly would miss",
							value: "Everything the wire does. Serialization never runs, so proto.Equal is comparing pointers you already had. The interceptor never runs, so both auth tests become impossible to write. status.Code never gets exercised, so a raw fmt.Errorf looks identical to a status error and the entire lesson of step 04 disappears. Direct calls test your Go; bufconn tests your service.",
						},
						{
							label: "why each test gets its own server",
							value: "newClient builds a fresh listener, server and store per test, with t.Cleanup to tear it down. Shared state across tests means test order becomes a dependency, and TestCreateUserStores adds a fourth user, which would break TestListUsersStreamsInOrder's count if the store leaked between them. Cheap isolation is worth more than a saved millisecond.",
						},
						{
							label: "this is the shape of your integration tests",
							value: "bufconn is not a lab trick. It is how you test a real gRPC service: the whole stack in one process, in-memory, fast enough to run on every save. httptest.NewServer is the direct analogue for HTTP, with the difference that httptest does bind a real port.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"go test ./...\n\n# and prove the suite is passable, which is the only reason to trust it:\ngo test -tags solution ./...",
					expect: {
						en: "Both green: ok gopath.dev/labs/grpc-service/server, with the demo packages reporting [no test files]. The second run is not grading you. It is the suite proving it goes green against a real implementation, which is what earns it the right to tell you your code is wrong.",
					},
					labPath: "labs/grpc-service/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In newClient, comment out the grpc.ChainUnaryInterceptor(...) option so the server is built with no interceptor at all. Rerun go test ./server/, then restore it with git checkout.",
					},
					observe: {
						en: 'Five pass, and both auth tests fail identically: "GetUser with no token succeeded" and "GetUser with a wrong token succeeded", each wanting codes.Unauthenticated. The calls went through and returned real users. Your interceptor did not change. It was simply never installed.',
					},
					why: {
						en: "Worth sitting with, because it is the one class of bug a black-box suite is uniquely good at and a unit test cannot see at all. Your AuthUnaryInterceptor is perfect and fully covered; the wiring that puts it in the request path is what broke. A test that called the interceptor function directly would still be green, because the function is fine. Registration is exactly the kind of thing that gets dropped in a refactor, and the only test that catches it is one that goes in the front door and finds out what actually happens to a request. That is what buys the round trip: not testing your handler, testing your server.",
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
							{
								label: "run the order test more than once",
								value: "go test -run TestListUsersStreamsInOrder -count=10 ./server/. A store that ranges a map passes this roughly 8 runs in 10 with three users. One green run is not evidence for that one.",
							},
							{
								label: "what the suite does not check",
								value: "ListUsers is unguarded: the auth interceptor is unary-only, and a streaming interceptor is not part of this lab. If you want the real thing, grpc.ChainStreamInterceptor is the hook, and nothing here will grade it.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"bufconn replaces the network with an in-memory pipe. Why is that not a mock, and what does it still catch? || A mock replaces the code under test with something that agrees with you. bufconn replaces only the socket: the real grpc.Server, real HTTP/2 framing, real protobuf serialization, real interceptor dispatch and real status translation all still run. It catches everything a direct method call cannot, including the wiring bugs, like an interceptor that is written perfectly and never registered.",
		},
		{
			n: "10",
			heading: { en: "The gate: the read path allocates nothing" },
			uses: ["escape-analysis", "benchmarks"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The suite proves the service is correct. This is the other bar a Tier 3 project has to clear: correct at a cost you can measure. A user service answers far more reads than writes, so the read is the hot path. GetUser is a map lookup that hands back the *User it already holds, so the honest number of heap allocations for a read is zero. Anything above zero is a per-request tax the garbage collector collects later, under load, as latency. This gate pins the number.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "GetUser allocates zero times per call. The gate lives in server/gate_test.go behind the gate build tag and measures GetUser with testing.AllocsPerRun, requiring 0. It measures CreateUser in the same run as a control and requires that one to allocate: CreateUser mints a &User and formats an id, so if the harness ever reports it at zero the harness has stopped observing the calls and the read assertion means nothing. Run it against your server; keep it at zero.",
					},
					rationale: {
						en: "Throughput gates need a floor with headroom, because throughput is a property of the machine and a CI box with two slow cores must still pass. Allocations per call are the opposite: the same source allocates the same number of times on a Raspberry Pi and a 64-core server, so this gate needs no threshold and no tuning. It asserts zero, exactly, which is why it is the sharper of the two kinds of gate: it cannot be passed by a fast machine, only by code that does not touch the heap on the read path. The control is not decoration. A comparison that cannot fail on the control is not a comparison, so the gate makes CreateUser prove the ruler still works before it trusts the zero.",
					},
					hints: [
						{
							label: "run the gate against your code",
							value: "go test -tags gate -run TestGate ./server/. The gate grades your GetUser, not the reference; a suite-first guard tells you to make `go test ./...` green before it will measure anything.",
						},
						{
							label: "never under -race",
							value: "The detector allocates shadow memory on every access, so the per-call count under -race describes the detector, not your handler. Correctness under -race and allocations without it are two separate runs, and the gate build tag keeps them apart.",
						},
						{
							label: "why a read is zero and a write is not",
							value: "GetUser returns the stored pointer, so nothing escapes and escape analysis leaves the call allocating nothing. CreateUser builds a message that outlives the call (it goes in the map) and formats a string, both of which the compiler must move to the heap.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/grpc-service",
					command:
						"# prove the gate is passable, against the reference:\ngo test -tags 'solution gate' -run TestGate -v ./server/\n\n# then gate your own code:\ngo test -tags gate -run TestGate ./server/",
					expect: {
						en: 'PASS, with a line like "alloc gate: GetUser 0 allocs/op (read path, floor 0), CreateUser 2 allocs/op (control, must be > 0)". The zero is the bar; the 2 is the control proving the measurement is live. Your CreateUser number may differ and does not matter, only that it is above zero.',
					},
					labPath: "labs/grpc-service/server/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Make GetUser return a copy instead of the stored pointer: replace return u, nil with cp := *u; return &cp, nil. Every test still passes, because a copy is proto-equal to the original. Rerun the gate, then restore it with git checkout.",
					},
					observe: {
						en: 'The suite is green and the gate fails: "GetUser allocated 1 times per call, want 0". One phrase, cp := *u, moved the read off the stack and onto the heap, and the only test in the project that can see it is the one that counts allocations.',
					},
					why: {
						en: "This is the allocation twin of the reworded-error-message break in step 08: a change invisible to every correctness test that changes the cost of the system. proto.Equal cannot tell a copy from the original, so no assertion about the returned value will ever catch it. Allocation count is not a property of what the function returns, it is a property of how it is written, and that is a different claim needing a different test. A service that copies on every read looks perfect in review and in the suite, then shows up six months later as a GC profile nobody can explain. The gate is the thing that catches it in the pull request instead.",
					},
				},
			],
			retrievalPrompt:
				"The throughput gate on the worker pool had a floor of 500,000 with ten times the headroom; this gate asserts exactly zero. Why can an allocation gate be exact when a throughput gate cannot? || Throughput is a property of the machine, so its floor has to survive the slowest box that will ever run it, which costs it the ability to see anything short of a total collapse. Allocations per call are a property of the code: the same source allocates the same number of times everywhere. With nothing machine-dependent in the number, the gate needs no headroom and can assert the real target, zero, so it catches a one-line regression a throughput gate with headroom never would.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The through-line is that gRPC moves things you were carrying by hand into the contract. The field's identity moves from a name in a string to a number in a schema. The error's meaning moves from a sentence to a code plus typed details. The timeout moves from a thing each service invents to a value that travels. The streaming shape moves from a chunked-encoding convention to a type signature. Every one of those is the same trade: less flexibility, less introspection, no curl, and in exchange a contract that a compiler and a transport enforce instead of a wiki page.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-it steps had a shape, and it is the T3 shape: almost none of them fail. A shuffled field number decodes clean and returns nil. A raw Go error delivers your exact message with a code that means something else. A map with three keys replays insertion order 8 runs in 10 and hides an order dependency until someone adds a ninth user. An auth check that tests only for presence passes six of seven tests while admitting anyone. A handler that ignores its deadline is invisible from outside and doubles your load under stress. A reworded error message breaks a client with no build, test or log to show for it. None of these crash. Every one of them is a green suite and a wrong system.",
			},
		},
		{
			type: "text",
			value: {
				en: "Two things you should leave holding. bufconn is not a lab trick, it is how you test a gRPC service for real: the entire stack in one process, no ports, fast enough to run on save, and the only kind of test that catches an interceptor you forgot to register. And the reason the wire demo came before any Go: a rule you can derive is a rule you keep, and a rule you were told is a rule you break the first time a field number is inconvenient. You did not memorize that field numbers are the API. You watched an email address land in an id.",
			},
		},
	],
}
