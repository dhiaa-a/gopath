import { Project } from "../../content"

export const dbApi: Project = {
	slug: "db-api",
	name: "Database-backed REST API",
	tagline:
		"A CRUD API where the handlers have never heard of Postgres, the payloads are data, and the password never reaches a log line.",
	code: "DB",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "16–18 hours",
	tags: ["postgres", "pgx", "repository", "interfaces", "testing", "integration-testing"],
	lab: {
		path: "labs/db-api",
		command: "go test ./...",
		summary: {
			en: "Grades the API at three layers: a config suite and a handler suite that run on every command with no database anywhere, and an integration suite that drives the real SQL against whatever TEST_DATABASE_URL points at, including the injection payloads only a real server can adjudicate.",
		},
	},
	mentalModels: [
		"the consumer defines the interface, the implementation obeys it",
		"data and syntax are separated by the protocol, not by escaping",
		"the boundary decides whose fault an error is: 400 or 500",
		"a connection is a process on someone else's machine, and there is a budget",
		"a struct that can be printed will be printed",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Almost every backend job is this program. The interesting part is not the CRUD, which you could write before lunch. It is that four different things in here can be perfectly correct on their own and still combine into an outage: handlers that pass their tests against a mock, SQL that works when you paste it into psql, a config layer that parses fine, and a database that does exactly what it was asked. This project is about the seams between them.",
			},
		},
		{
			type: "text",
			value: {
				en: "The spine is one dependency arrow, and it points the wrong way from what you might expect. Handlers receive a TaskRepository interface. They do not receive a *pgxpool.Pool, they do not import the postgres package, and they could not name a driver if you asked them. The interface is declared next to the handlers because the handlers are what it is for. Postgres implements it. So does a thirty-line mock. Neither one gets a vote about what the interface says.",
			},
		},
		{
			type: "code",
			value: `      package api                          package postgres
      ┌────────────────────────┐           ┌────────────────────┐
      │ handlers               │           │ Repository         │
      │   ↓ (needs)            │  ←────────│   (implements)     │
      │ TaskRepository ────────┼───────────│                    │
      └────────────────────────┘           └────────────────────┘
                ↑                            imports api
                │ (also implements)          api imports nothing
      ┌────────────────────────┐
      │ mockRepo, 30 lines     │            the arrow points INTO api,
      │ in handlers_test.go    │            and never back out
      └────────────────────────┘`,
		},
		{
			type: "text",
			value: {
				en: "Read that diagram once more, because it is the reason the lab is shaped the way it is. Nothing in package api imports package postgres. That is what lets twenty-four handler cases run in a quarter of a second with no database on the machine, and it is what lets the SQL be graded separately by the only thing qualified to grade SQL, which is a real server.",
			},
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/db-api/
 ├── config/
 │   ├── config.go            - pinned: the Config type and the env var names
 │   ├── load.go              - yours: Load, String, PoolConfig  (!solution)
 │   ├── solution.go          - the reference                    (solution)
 │   └── config_test.go       - always runs: parses, never connects
 ├── api/
 │   ├── api.go               - pinned: Task, the sentinels, TaskRepository, the limits
 │   ├── handlers.go          - yours: NewServer and the validation (!solution)
 │   ├── solution.go          - the reference                       (solution)
 │   └── handlers_test.go     - the mock suite. Read it, it is the contract.
 ├── postgres/
 │   ├── postgres.go          - the compile-time proof that Repository fits the interface
 │   ├── repo.go              - yours: the pgx implementation      (!solution)
 │   ├── solution.go          - the reference                      (solution)
 │   └── integration_test.go  - SKIPS unless TEST_DATABASE_URL is set
 └── schema.sql               - one table, applied by the integration suite`,
		},
		{
			type: "text",
			value: {
				en: "One table needs one file, so schema.sql is applied verbatim by the integration suite and there is no migration tool in this lab. That is an honest description of the lab, not a recommendation for your job. The moment a second developer changes that schema while a version of the binary that predates the change is still running, you need versioned up/down migrations applied by something like golang-migrate or goose, an ordering guarantee, and a rule that every migration is backward compatible with the currently deployed code. That is a real subject and it is not this project's subject: nothing here would teach it honestly, because with one table there is nothing that can go wrong.",
			},
		},
		{
			type: "text",
			value: {
				en: "There is no cmd/server/main.go either. The suites construct the server directly, which is the same thing a main would do and is already fully exercised. Wiring a binary would add a file with no test behind it, and this project's whole argument is that the parts with no test behind them are the parts that hurt.",
			},
		},
	],
	constraints: [
		{
			type: "list",
			items: [
				{
					en: "One dependency: pgx. Everything else is the standard library. No ORM, no query builder, no mock-generation tool, no test-container library. Every one of those is a wrapper around something in this project, and you should be able to describe what it wraps before you decide you want it.",
				},
				{
					en: "Package api imports nothing from package postgres. If you ever need to break that rule the interface is wrong, not the rule.",
				},
				{
					en: "Every query uses $N placeholders. Not because a style guide says so: because of what the wire protocol does with them, which is step 05.",
				},
				{
					en: "The integration suite is opt-in and skips without TEST_DATABASE_URL. That is a real constraint on you, not a convenience: it means go test ./... prints ok for a postgres package whose code never ran. Step 09 is about what to do with that.",
				},
			],
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "The interface belongs to the handlers, not to Postgres" },
			uses: ["interfaces", "packages"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Here is the version of this program almost everyone writes first. The handler takes a *pgxpool.Pool, because that is what it needs to run a query. It works. It ships. And then the first test you try to write for a handler needs a running Postgres, so the test suite takes ninety seconds instead of nine milliseconds, cannot run on a laptop on a plane, and fails in CI for reasons that have nothing to do with your code. Nobody decided that. It followed from one parameter type.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "TaskRepository is declared in package api, next to the handlers that consume it, and exposes Create, GetByID, List(limit, offset), Update, Delete, and WithTx. Package api imports nothing from package postgres; the dependency runs the other way. The two sentinel errors, ErrNotFound and ErrDuplicate, are declared in api too, because they are part of what the handlers require of any storage, not facts about Postgres.",
					},
					rationale: {
						en: "This is the part of Go that people coming from Java or C# get backwards for about a month, and the compiler will never tell them. There is no implements keyword, so an interface does not have to live with its implementation, which means it should not: it lives with the code that needs it. The consumer knows what it wants. The implementation just has to be shaped like it. The practical consequence is the whole lab: because api declares the interface and imports nothing, a mock in the test file satisfies it without asking anyone's permission, and the handler suite never touches a database. Declare the interface in package postgres instead and every consumer must import postgres to name the thing it depends on, which means every consumer's tests link a driver, and the seam you built the interface for does not exist.",
					},
					hints: [
						{
							label: "the sentinels are a contract, not an implementation detail",
							value: "ErrNotFound lives in api because 404 is the handler's decision. Postgres has no idea what a 404 is. It reports pgx.ErrNoRows, and the repository's job is to translate that into the vocabulary the interface promised. If the sentinel lived in postgres, the handler would import postgres to check for a missing row, and the arrow would be pointing the wrong way again.",
						},
						{
							label: "why WithTx takes a callback",
							value: "Because the alternative leaks. Returning a transaction object means the interface has to name a pgx type, and now api imports pgx. A callback that receives a TaskRepository keeps the transaction entirely inside the implementation: the caller never sees one, and a mock satisfies WithTx with fn(mock). Step 07 is where this pays.",
						},
						{
							label: "keep the interface small on purpose",
							value: "Six methods is already at the edge. The Go proverb is that the bigger the interface, the weaker the abstraction, and the mechanism behind the proverb is that every method is a method every implementation must write, including every fake in every test. Six is what the handlers actually call. Do not add a seventh for a caller that does not exist yet.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command: "go build ./... && go vet ./...\ncat postgres/postgres.go",
					expect: {
						en: 'Both commands are silent, which is the point of the second file. postgres.go contains one line of real code: var _ api.TaskRepository = (*Repository)(nil). It declares nothing and costs nothing at runtime; it exists so that the moment Repository drifts from the interface, the build breaks in postgres, naming the missing method, instead of failing later at whatever line first tried to use it. A nil pointer of the concrete type, assigned to the interface, checked entirely at compile time.',
					},
					labPath: "labs/db-api/postgres/postgres.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Add a method to the TaskRepository interface in api/api.go: Count(ctx context.Context) (int, error). Change nothing else. Then run go build ./... and go test ./...",
					},
					observe: {
						en: "Two separate failures, in two packages you did not touch. postgres fails to build at postgres.go, on the compile-time assertion line, saying *Repository does not implement api.TaskRepository (missing method Count). And the api test suite fails to build, because mockRepo in handlers_test.go does not implement it either.",
					},
					why: {
						en: "That is the cost of an interface method, made visible: adding one is not a local edit, it is a change every implementation must answer, including every fake in every test you will ever write. This is the mechanism under \"the bigger the interface, the weaker the abstraction\", and it is also the argument for the assertion line in postgres.go. Without it, postgres would still compile fine right now, and you would find out at whatever future call site first passed a *Repository to something expecting the interface, with an error message about that call site rather than about the type. Notice which direction the breakage did not travel: nothing in api broke because postgres changed, because api does not know postgres exists.",
					},
				},
			],
			retrievalPrompt:
				"Go has no implements keyword. What does that let you do with an interface's declaration site, and why does it matter here? || The interface does not have to live with its implementation, so it can live with its consumer instead. Declaring TaskRepository in api means api imports nothing to depend on storage, so a mock in the test file satisfies it and the handler suite needs no database. Declare it in postgres and every consumer must import postgres, which links a driver into every consumer's tests and destroys the seam the interface existed for.",
		},
		{
			n: "02",
			heading: { en: "Handlers that have never met a database" },
			uses: ["http-handler", "interfaces", "json-decode"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The interface bought you something and this step spends it. Every branch a handler has, the 201, the 404, the 409, the 500, is reachable in microseconds by handing it a mock that returns whatever you want. Getting a real Postgres to produce a duplicate-key violation on demand takes a container, a schema, and a seeded row. Getting a mock to produce one takes a return statement. Same assertion, four orders of magnitude apart.",
					},
				},
				{
					type: "constraint",
					what: {
						en: 'NewServer(repo TaskRepository) http.Handler takes the repository through the constructor and returns the root handler. No globals, no package-level state, no init. Routes use Go 1.22 method-specific patterns ("POST /tasks", "GET /tasks/{id}") and no third-party router; read parameters with r.PathValue("id"). Every response body is JSON with Content-Type: application/json, and every error body is exactly {"error":"message"}. Repository sentinels map to statuses with errors.Is, never ==: ErrNotFound to 404, ErrDuplicate to 409, anything else to 500.',
					},
					rationale: {
						en: "errors.Is rather than == is the one in that list that will bite you silently. The repository wraps its errors, because an error that says only \"no rows\" is useless in a log at 3am; it returns fmt.Errorf(\"get task %d: %w\", id, api.ErrNotFound). A == comparison against that value is false, so the handler falls through to its default branch and answers 500. Nothing errors, nothing logs, the test with an unwrapped sentinel still passes, and your 404s quietly became 500s: the client sees a server fault for a resource that simply is not there, retries because 500 is retryable and 404 is not, and your error rate now includes every request for a missing task. errors.Is walks the %w chain and finds the sentinel underneath. This is exactly why the suite's duplicate case returns a wrapped error rather than a bare one.",
					},
					hints: [
						{
							label: "the constructor is the injection",
							value: "There is no framework here and none is needed. A parameter is dependency injection. The reason it beats a package-level var is not purity: a global makes two tests in the same binary share state, so they become order-dependent and race under -race, and the failure shows up in whichever test happens to run second.",
						},
						{
							label: "Go 1.22 routing",
							value: 'mux.HandleFunc("POST /tasks", h.create) puts the method in the pattern, and "GET /tasks/{id}" captures a wildcard you read with r.PathValue("id"). Before 1.22 this needed a third-party router or a switch on r.Method inside every handler. A pattern with no method matches every method, which is how you accidentally let DELETE hit your read path.',
						},
						{
							label: "nil slices marshal to null",
							value: 'An empty []Task that is nil encodes as null, not []. A client doing for (const t of body) then crashes on a perfectly successful empty list. Return []Task{} when there is nothing. This is the single most common Go JSON bug that reaches production, and it only appears when the table is empty, which is never true in your dev database and always true on day one.',
						},
						{
							label: "write the header exactly once",
							value: "w.WriteHeader locks the header map: Content-Type set after it is silently ignored, and a second WriteHeader logs a superfluous call and changes nothing. Funnel every response through one writeJSON helper and the ordering problem disappears by construction.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command: "go test ./api/",
					expect: {
						en: 'Green, in about a quarter of a second, with no database anywhere on the machine. A fresh clone before you start fails every case with "status = 404, want 201" and similar: nothing is routed yet, so the mux 404s everything, and that failure list is your to-do list. Read handlers_test.go rather than only running it. The mock is thirty lines of plain Go with one function field per method, and any method a test did not expect panics with its own name, so a handler that calls the repository when it should not fails loudly instead of silently receiving a zero value.',
					},
					labPath: "labs/db-api/api/handlers_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In your sentinel mapping, swap errors.Is(err, ErrNotFound) for err == ErrNotFound. Run go test ./api/ and then go test -run TestIntegrationNotFound ./postgres/",
					},
					observe: {
						en: 'The api suite stays green on TestGetTask/not_found. It goes red only where the mock returns a wrapped error, which in this suite is the duplicate-title case: "status = 500, want 409". And the integration test that would catch the 404 version skips, because you have no database set.',
					},
					why: {
						en: "Look at why the not-found case survived: that mock returns a bare api.ErrNotFound, so == is true and the handler answers 404 correctly. The real repository never returns a bare sentinel. It wraps, every time, because context is the entire point of wrapping. So this bug is invisible to the test that looks most like the thing it breaks, and it is caught by a different test entirely, and only because that one happens to wrap. That is not luck, it is the suite being written by someone who knew this: a mock reproduces the interface, and it is on you to make it reproduce the interface's habits too. A fake that is politer than the real implementation tests a program you do not have.",
					},
				},
			],
			retrievalPrompt:
				"Your handler maps repository errors with err == ErrNotFound and every unit test passes. What breaks in production, and why did no test see it? || The real repository wraps its errors to add context, so == is false, the handler falls through to 500, and every request for a missing row returns a server fault the client will retry. The tests passed because the mocks returned bare sentinels, which the real code never does. errors.Is walks the %w chain; == compares one value to one value.",
		},
		{
			n: "03",
			heading: { en: "Refuse what you cannot store" },
			uses: ["http-handler", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: 'A 400 and a 500 are not two shades of failure. They are an assignment of blame, and something is listening. 4xx means the client sent something wrong and should stop; 5xx means you are broken, so retry, alert, and burn error budget. Every request you answer with a 500 that was actually a bad input is a page for a human about a bug that does not exist, and a client that retries a request that will never work.',
					},
				},
				{
					type: "constraint",
					what: {
						en: 'Both routes that accept a title validate it identically, before the repository is consulted. Cap r.Body at MaxBodyBytes with http.MaxBytesReader before decoding: over the cap is 413 {"error":"request body too large"}, distinguished from malformed JSON (400 {"error":"invalid json"}) with errors.As on *http.MaxBytesError. Trim the title; empty after trimming is 400 {"error":"title required"} and the trimmed value is the one you store. A title containing a null byte is 400 {"error":"title contains a null byte"}. Over MaxTitleRunes is 400 {"error":"title too long"}, counted in runes.',
					},
					rationale: {
						en: 'Three of those four are decisions about your domain, and one is a fact about your database. Postgres documents that "the character with code zero (sometimes called NUL) cannot be stored" in a character type. A Go string holds one without complaint. JSON transports it as a completely legal escape. So that request arrives having passed every check your type system can perform, and dies at the INSERT, and the client gets a 500 for a value your database was never going to accept. Caught at the boundary it is a 400 the client can act on. The body cap is the same argument with a bigger blast radius: json.Decoder reads until EOF, and the zero value of http.Server has no limit on a request body, so the ceiling on what a stranger can make this process allocate is their upload bandwidth. Runes rather than bytes matters for a reason you will not hit in testing: UTF-8 spends one byte on ASCII and three on most CJK, so a byte-counted limit of 200 quietly gives a Japanese title a third of the room an English one gets, and you will hear about it from a user, not a test.',
					},
					hints: [
						{
							label: "this is not injection defence, and it never will be",
							value: "Nothing in this step looks for quotes, semicolons, or the word DROP, and nothing in it should. Blocklisting hostile-looking characters is whack-a-mole against a parser you did not write and cannot see, and it is a game where the attacker only has to win once. Injection is defended one layer down, by the placeholder, structurally. Step 05 is about why the two are different problems that people have been conflating for twenty years.",
						},
						{
							label: "the cap goes on the reader, not on the result",
							value: "You cannot check the length of the body after reading it: reading it is the thing you were trying to avoid. http.MaxBytesReader wraps r.Body so the read itself stops at the limit and returns an error, and it also tells the server to close the connection rather than let a client keep streaming into a request you already rejected.",
						},
						{
							label: "413 and 400 say different things",
							value: 'errors.As on *http.MaxBytesError is what separates them. Collapsing an oversized body into "invalid json" sends a client off to debug a syntax error that is not there. The body was perfect JSON; there was simply too much of it, and only one of those two messages tells them to send less.',
						},
						{
							label: "validate the value you store",
							value: "Trim, then validate the trimmed value, then store that same value. Validating a cleaned copy and storing the raw one is a real and popular bug: every check passes and the row is still wrong, and the difference only surfaces when someone queries for an exact match and gets nothing.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command: "go test -run 'TestTitle|TestOversized' -v ./api/",
					expect: {
						en: 'Green, no database: six subtests from TestTitleValidation plus four standalone tests. TestTitleValidation runs all three rejections through both POST and PUT and asserts twice per row: the client gets the right 400, and the repository was never called at all, because every method on that mock fails the test by name if it is. TestTitleIsCountedInRunesNotBytes sends 200 CJK runes, which is 600 bytes, and requires a 201: a handler that reached for len() rejects a title it promised to accept. TestOversizedBodyIsRejected sends valid JSON with a perfectly good title and 128KB of junk beside it, which no title check can catch.',
					},
					labPath: "labs/db-api/api/handlers_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the null-byte check from your validation and run go test -run TestTitleValidation ./api/",
					},
					observe: {
						en: 'Two failures, one per route, and each one says it twice: repository Create was called with "tidy the kitchen\\x00"; validation must reject it before storage, followed by status = 201, want 400 (and 200 on the PUT). The other four rows still pass. The handler accepted the title, answered 201, and handed the value to storage.',
					},
					why: {
						en: "That 201 is the whole lesson. The value is a valid Go string, it was valid JSON, it satisfies every type in the program, and the mock stored it without complaint because a mock is a Go map and a Go map takes NUL bytes all day. Point that same handler at Postgres and the INSERT fails, the repository wraps a database error, the handler maps an unrecognised error to 500, and you have a server error caused entirely by a client sending something your database documents that it will not accept. The mock cannot catch this and is not supposed to: it is not a database, and it does not share the constraint. This is the exact seam where a fake stops being able to tell you the truth, and knowing where that seam is for every fake you write is most of what testing skill actually is.",
					},
				},
			],
			retrievalPrompt:
				"A title arrives as valid JSON and a valid Go string, and your handler stores it. Why might that still be a 500 waiting to happen, and whose fault does the client think it is? || Postgres documents that code point zero cannot be stored in a character type, so a NUL byte passes every check Go can make and fails at the INSERT. The handler sees an unrecognised database error and answers 500, so a bad input gets reported as a server fault: the client retries something that can never work and someone gets paged. The database's constraints are not visible to your type system, so the boundary has to know them.",
		},
		{
			n: "04",
			heading: { en: "The repository, one round trip at a time" },
			uses: ["error-handling", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Now the part where correctness stops being checkable by reading. Everything so far was Go, and Go you can reason about. From here your program's behaviour is decided by another process, in another language, possibly on another machine, and the only honest way to find out what it does is to ask it.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Repository implements api.TaskRepository over pgx. Every query uses $N placeholders and no query is built with fmt.Sprintf or string concatenation. Create is a single INSERT ... RETURNING id, title, done. Every database error is wrapped with the operation before it is returned, and a unique violation (SQLSTATE 23505) becomes api.ErrDuplicate, identified by its code, never by matching the error string.",
					},
					rationale: {
						en: "INSERT ... RETURNING is Postgres doing in one round trip what a lesser database needs two for: insert, then ask what id you got. A round trip is a network hop plus a scheduling delay on both ends, and it is the unit that matters, not the query. Two of them per create, at a few hundred microseconds each inside a datacentre and a few milliseconds across one, is the difference between a 2ms endpoint and a 12ms one, multiplied by every write you will ever do. The SQLSTATE rule is a different kind of durability: pgErr.Code == \"23505\" is a documented, stable, five-character contract, and the error message next to it is prose that changes when Postgres is upgraded, when the server's locale differs from yours, and when someone renames the index. Matching the string works on your laptop and fails in Frankfurt.",
					},
					hints: [
						{
							label: "the querier interface is the whole WithTx trick",
							value: "Repository holds db as a small interface with Exec, Query, and QueryRow rather than a concrete *pgxpool.Pool. Both *pgxpool.Pool and pgx.Tx satisfy it. That one field is why the same method bodies run pooled or inside a transaction with no duplication, and it is step 07 already paid for. It is also the consumer-defined interface idea from step 01 applied a second time, one layer down, against a library you did not write.",
						},
						{
							label: "errors.As, not a type assertion",
							value: "var pgErr *pgconn.PgError; errors.As(err, &pgErr) unwraps the chain looking for that type. A plain err.(*pgconn.PgError) sees only the outermost error and fails the moment anything wraps it, including you.",
						},
						{
							label: "wrap once, where you know something",
							value: 'fmt.Errorf("create task: %w", err) adds the one fact the caller does not have: which operation failed. %w keeps the original underneath so errors.Is and errors.As still work upstairs. %v flattens it to text and the handler\'s entire sentinel mapping stops working, silently, with everything becoming a 500.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# needs a throwaway Postgres; see the note below\ndocker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16\nTEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test -v ./postgres/",
					expect: {
						en: 'TestIntegrationLifecycle and TestIntegrationDuplicateTitle green, and no longer printing SKIP. The lifecycle test creates over HTTP, reads it back, updates both columns, deletes, and requires the final GET to 404, which is what proves the DELETE reached the database rather than just the response writer. The duplicate test inserts the same title twice and requires errors.Is(err, api.ErrDuplicate): that 23505 comes from Postgres itself and no mock can manufacture it.',
					},
					note: {
						en: "This is the first check in the project that needs a real database, and every check from here to step 07 does. Without TEST_DATABASE_URL these tests skip, go test prints ok for the postgres package, and nothing in repo.go has been graded. That is not a failure of the lab and it is not a pass either: it is the honest state of a suite that has not been run. If you cannot get a Postgres, read step 09 before you decide you are done, because the ok line is exactly what a stubbed-out repository also prints.",
					},
					labPath: "labs/db-api/postgres/integration_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Change your 23505 detection to match the message instead of the code: strings.Contains(err.Error(), "duplicate key value"). Rerun the duplicate test, then rerun it against a server started with a different locale: docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e LANG=de_DE.utf8 -e POSTGRES_INITDB_ARGS="--locale=de_DE.utf8" postgres:16',
					},
					observe: {
						en: "Green against the first server. Against a server whose messages are localised, errors.Is(err, api.ErrDuplicate) is false, the handler answers 500 instead of 409, and the test says so.",
					},
					why: {
						en: 'You did not write a bug that a code review would catch: you wrote a program whose correctness depends on the language your database prints its errors in. SQLSTATE exists precisely because the message is for humans and the code is for programs; 23505 is unique_violation in the SQL standard and it is the same five characters on every server, in every locale, in every version. The general rule is worth taking out of this project: when an error carries both a code and a description, the code is the API and the description is documentation. Matching on prose is how you write software that works until it is deployed somewhere else.',
					},
				},
			],
			retrievalPrompt:
				'Your duplicate detection greps the error message for "duplicate key value" and every test passes. What is the failure mode? || The message is prose: it is localised, it changes across Postgres versions, and it names an index somebody can rename. On a server running a different locale the match fails, ErrDuplicate is never returned, and every duplicate becomes a 500 instead of a 409. SQLSTATE 23505 is a stable documented code and the same everywhere. When an error has a code and a description, the code is the API.',
		},
		{
			n: "05",
			heading: { en: "Injection is a property of the protocol, not of your escaping" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You already know to use placeholders. Almost nobody knows why, and the folk explanation is wrong in a way that matters: placeholders do not escape your quotes. Something considerably better than escaping is happening, one layer below your program, and if you know what it is you can also say precisely when it stops happening, which is the part that actually saves you.",
					},
				},
				{
					type: "text",
					value: {
						en: "Two ways to ask the same question. The first one has a hole in it and the hole is not the quote character.",
					},
				},
				{
					type: "code",
					value: `// The vulnerable one. There is exactly one string here, and the
// server will parse all of it.
sql := "INSERT INTO tasks (title) VALUES ('" + title + "') RETURNING id"
r.db.QueryRow(ctx, sql)

//   title = "buy milk"
//     → INSERT INTO tasks (title) VALUES ('buy milk') RETURNING id
//   title = "O'Brien"
//     → INSERT INTO tasks (title) VALUES ('O'Brien') RETURNING id
//                                            ────┴─── string ends here.
//                                                     Brien is now syntax.

// The parameterised one. Two things go on the wire, separately.
r.db.QueryRow(ctx,
    "INSERT INTO tasks (title) VALUES ($1) RETURNING id",
    title)

//   Parse:  "INSERT INTO tasks (title) VALUES ($1) RETURNING id"
//           → server parses this. It has never seen title. It cannot
//             have seen title. The parse tree is finished and has a
//             parameter-shaped hole in it.
//   Bind:   $1 = <the bytes of title, length-prefixed>
//           → dropped into the hole. Not parsed. Not re-parsed. Data.`,
				},
				{
					type: "constraint",
					what: {
						en: "No query in the repository is assembled from a value at runtime. Placeholders carry every value, including ones that look harmless, including integers. A title is data on the way in and data on the way out: it round trips byte for byte, unescaped, unstripped, and uncleaned, and the repository never inspects it for hostile-looking characters.",
					},
					rationale: {
						en: "pgx's default execution mode is QueryExecModeCacheStatement, which uses the PostgreSQL extended query protocol: your SQL goes in a Parse message and your arguments go in a separate Bind message. The server parses the statement into a tree before a single byte of your data has arrived. There is no moment at which title is a candidate for being syntax, because parsing is over. That is not escaping being done well, it is escaping being unnecessary, and the difference shows up the moment you compare the failure modes. Escaping fails when the escaper's rules and the parser's rules disagree, which they do across locales, across encodings, and across the standard_conforming_strings setting. Separation cannot fail that way, because there is no second parse to disagree with the first. This is also the reason the injection bug and the O'Brien bug are the same bug. One of them arrives with a security researcher and the other arrives with a customer, and concatenation cannot tell them apart because in both cases the same thing happened: a string ended somewhere you did not intend.",
					},
					hints: [
						{
							label: "the protocol is doing more for you than you asked, and it is a default",
							value: 'Postgres documents that "the query string contained in a Parse message cannot include more than one SQL statement; else a syntax error is reported", and that "this restriction does not exist in the simple-query protocol". So the classic \'; DROP TABLE payload does not actually drop your table through pgx even if you concatenate it: the extended protocol refuses multi-statement Parse, and you get "cannot insert multiple commands into a prepared statement". Read that twice. You were saved by pgx\'s default exec mode, not by your code, and it is one config line deep.',
						},
						{
							label: "when the net comes off",
							value: "pgx offers QueryExecModeSimpleProtocol, whose own documentation says it \"uses client side parameter interpolation. All values are quoted and escaped\" and to prefer QueryExecModeExec \"whenever possible\". People turn it on for real reasons: some connection poolers and non-Postgres servers speaking the wire protocol do not support the extended protocol. That mode is still safe with $1, because pgx does the escaping, but you have moved from \"impossible by construction\" to \"correct if the escaper is correct\", and you have re-enabled multi-statement strings. Concatenation plus that mode is the textbook exploit, live.",
						},
						{
							label: "placeholders are not string interpolation and cannot be",
							value: "$1 works where a value goes and nowhere else. You cannot parameterise a table name, a column name, or ORDER BY $1: those are syntax, and syntax is decided at Parse, before Bind exists. When you genuinely need a dynamic column, the answer is a whitelist mapping user input to identifiers you wrote yourself, never a formatted string. Discovering this while sorting a table is where a lot of otherwise careful code springs a leak.",
						},
						{
							label: "why an integer is not an excuse",
							value: 'fmt.Sprintf("... WHERE id = %d", id) with an int64 genuinely is not injectable: an int64 cannot hold a payload. The reason to use $1 anyway is that the type is a property of today\'s signature, and the day someone changes id to a string, or adds a "sort" parameter next to it, the safety was never in the code, it was in a type that is no longer there. Uniformity means there is no line to review.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# needs a throwaway Postgres; see the note below\nTEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test -run TestIntegrationHostileTitles -v ./postgres/",
					expect: {
						en: "Four subtests green, and read what they store before you move on. One of them is literally '; DROP TABLE tasks; --. Another is Call O'Brien about the invoice. Another is anything' OR '1'='1. Each one goes in through Create, comes back out through GetByID byte for byte identical, and then the test lists the table to prove it is still there. Nothing was escaped, nothing was stripped, nothing was sanitised: they are titles, and titles are data. The apostrophe case is in that list on purpose, because it is the one that arrives without an attacker.",
					},
					note: {
						en: "This one needs the database more than any other check in the lab, and that is not a limitation to work around: the entire question is what PostgreSQL does with these bytes, and only PostgreSQL can answer it. Without TEST_DATABASE_URL it skips and tells you so. If you run one integration test in this whole project, run this one.",
					},
					labPath: "labs/db-api/postgres/integration_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Make Create vulnerable on purpose: replace the placeholder with concatenation, sql := "INSERT INTO tasks (title) VALUES (\'" + title + "\') RETURNING id, title, done", and pass no arguments. Rerun TestIntegrationHostileTitles. Predict which of the four subtests fail before you look.',
					},
					observe: {
						en: 'Three fail and one passes, and the pass is the surprise. The DROP payload does not drop the table: it fails with "cannot insert multiple commands into a prepared statement". O\'Brien fails with a plain syntax error at or near "Brien". The tautology fails too. And windows\\path\\ goes straight through and stores correctly.',
					},
					why: {
						en: "Every one of those four outcomes is a lesson and none of them is the one you were expecting. The table survived because the extended protocol forbids multi-statement Parse, which is a property of a protocol you did not choose and a default you did not set: flip pgx to the simple protocol for a connection pooler and that payload is a dropped table. O'Brien is the same defect as the attack, discovered by an ordinary customer instead of an attacker, and it is the reason this bug ships even in places with no adversary. The backslash passing is the sharpest one: it survives only because standard_conforming_strings has defaulted to on since Postgres 9.1, so a backslash is not an escape character here, though it is in MySQL and it was in Postgres once. Your query's safety just depended on a server setting, in a database engine, in a version. That is the entire case against escaping in four subtests: the rules are per-server, per-version, per-setting, per-locale, and your string formatter knows none of them. The placeholder does not need to know them either, because it never asks the question.",
					},
				},
			],
			retrievalPrompt:
				"Explain why $1 stops SQL injection without using the word escape. || The statement and the arguments travel as separate messages: Parse carries the SQL, Bind carries the values. The server has finished parsing the statement into a tree before it has seen any of your data, so there is no point at which your data could be read as syntax. Escaping is making dangerous text safe to parse; parameterisation means the text is never parsed at all. That is why it cannot be defeated by a quoting rule you did not know about.",
		},
		{
			n: "06",
			heading: { en: "Not found, when there is no row to find out from" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A SELECT that matches nothing hands you an error and makes the decision for you. An UPDATE that matches nothing is a complete success: valid statement, zero rows changed, no error, nothing wrong. If you write the obvious code, your API will report 200 OK for updates to tasks that do not exist, and it will do it forever, because there is nothing in the Go to look at.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "GetByID maps pgx.ErrNoRows to api.ErrNotFound. Update and Delete have no row to scan, so they read CommandTag.RowsAffected() and return api.ErrNotFound when it is zero. Every sentinel is returned wrapped, with the operation and the id in the message, and errors.Is must still find it through the wrap.",
					},
					rationale: {
						en: "The asymmetry is not pgx being inconsistent, it is the two operations genuinely differing. QueryRow promises exactly one row, so zero rows is a broken promise and pgx has to tell you: it returns pgx.ErrNoRows from Scan. Exec promises nothing about rows; UPDATE tasks SET ... WHERE id = 424242 is a valid statement that correctly matched nothing, and the server reports success plus a command tag reading UPDATE 0. There is no error because nothing failed. The only place the information exists is the tag, and if you do not read it you have thrown away the only evidence you were ever given. What makes this worth a step of its own is that it is invisible from Go: no nil to check, no error to ignore, no lint that fires. The row count is a fact that lives on the wire and nowhere else.",
					},
					hints: [
						{
							label: "wrap the sentinel, do not replace it",
							value: 'return fmt.Errorf("update task %d: %w", id, api.ErrNotFound) gives the handler something errors.Is can match and gives the log something a human can act on. Returning bare api.ErrNotFound is a log line that says "task not found" with no id, on a server handling a thousand requests a second, which is the same as no log line at all.',
						},
						{
							label: "RowsAffected is not a row count you can trust for everything",
							value: "For UPDATE and DELETE it is the rows matched and changed, which is what you want here. Do not carry the habit to INSERT ... ON CONFLICT DO NOTHING, where a zero means the conflict fired and the row already exists, which is usually not an error at all. The tag reports what the server did, not what you meant.",
						},
						{
							label: "the mock cannot find this for you",
							value: "A mock's Update returns whatever the test told it to. It has no rows, no tag, and no opinion about whether anything matched. The unit suite pins that ErrNotFound becomes a 404; only Postgres can tell you whether ErrNotFound is ever returned in the first place. This is the second time in this project a fake has been unable to see the bug, and both times it was the same reason: the fact lived in the database.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# needs a throwaway Postgres; see the note on step 04\nTEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test -run TestIntegrationNotFound -v ./postgres/",
					expect: {
						en: "Green. It asks for id 424242 three ways: Update, Delete, and GetByID must each return an error satisfying errors.Is(err, api.ErrNotFound), and then the same two misses must come back as 404 through the wired handler. Three sentinels and two status codes, and the only reason any of them are right is that something read the command tag.",
					},
					note: {
						en: "Skips without TEST_DATABASE_URL, and this is one of the two places in the lab where a skip is genuinely expensive, because a repository that never checks RowsAffected passes literally everything else.",
					},
					labPath: "labs/db-api/postgres/integration_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the RowsAffected check from Update, so it returns nil whenever Exec returned no error. Run the whole suite: go test ./... with no database, and then with TEST_DATABASE_URL set.",
					},
					observe: {
						en: "With no database: three ok lines, everything green, including the api suite, which tests the not-found mapping thoroughly. With a database: TestIntegrationNotFound fails on the first assertion, Update(missing): err = <nil>, want errors.Is(err, api.ErrNotFound).",
					},
					why: {
						en: 'The green run is the one to sit with. Your API now answers 200 OK, with a JSON body describing the task, for an update to a task that does not exist. It echoes back the object the client sent, so it looks exactly like a successful write, and nothing was written. A client syncing state will believe it. The unit suite could not catch this because it asserts the handler maps ErrNotFound to 404, which your handler does perfectly; the repository simply never returns it. The two suites are testing two different halves of one sentence and only the database knows the other half. This is why "go test ./... is green" is a sentence that means nothing in this project without knowing which suites actually ran.',
					},
				},
			],
			retrievalPrompt:
				"GetByID gets pgx.ErrNoRows for a missing row. Update gets no error at all. Why the difference, and what do you read instead? || QueryRow promises exactly one row, so zero rows breaks the promise and pgx reports it. Exec promises nothing: an UPDATE matching no rows is a completely successful statement that changed nothing, so there is no error to return. The row count exists only in the command tag, so CommandTag.RowsAffected() == 0 is the only evidence that anything was missing, and ignoring it means your API reports 200 OK for writes that never happened.",
		},
		{
			n: "07",
			heading: { en: "The callback that never sees the transaction" },
			uses: ["interfaces", "defer"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Transactions are where the interface you designed in step 01 gets its real test, and where most repository patterns quietly fall over. The obvious move is to return a transaction object so the caller can use it. Do that and api imports pgx, the seam is gone, and every test that touches a transaction needs a database again. The whole edifice comes down through one return type.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "WithTx(ctx, fn func(TaskRepository) error) error begins a transaction, builds a Repository whose querier is that transaction, and calls fn with it. Commit only if fn returns nil; roll back otherwise, and return fn's error unwrapped so the caller can match their own sentinel with errors.Is. The rollback is deferred, so a panic inside fn cannot leave a transaction open. The callback receives a TaskRepository and never a pgx.Tx.",
					},
					rationale: {
						en: "The callback shape is what keeps the transaction from escaping into the interface's vocabulary, and it buys three things at once. Nothing above the repository can name a pgx type, so the api package stays driver-free. A mock satisfies WithTx with fn(mock), which is why the transaction path is testable with no database at all. And the lifetime is structural rather than remembered: a caller cannot forget to commit or roll back, because a caller cannot commit or roll back. Compare the alternative, tx, err := repo.Begin(), where every caller owns a resource that holds a connection out of the pool until somebody remembers it, and forgetting is one early return away. The deferred Rollback is the same instinct: after a successful Commit it is a documented no-op, which is precisely what makes it safe to arm unconditionally on the line after Begin, before anything exists that could go wrong.",
					},
					hints: [
						{
							label: "the querier field is what makes this possible",
							value: "Repository.db is an interface with Exec, Query, and QueryRow, satisfied by both *pgxpool.Pool and pgx.Tx. So &Repository{db: tx} is a complete, working repository whose every method now runs inside the transaction, with no duplicated method bodies and no tx parameter threaded through six signatures. Step 04 built that field; this is what it was for.",
						},
						{
							label: "return fn's error, do not wrap it",
							value: "The callback's error belongs to the callback's author, and they will want errors.Is against their own sentinel. Wrapping with %w preserves that, but returning it unchanged is better here: WithTx has nothing to add. You did not fail, they did. Wrap the errors that are yours: Begin and Commit.",
						},
						{
							label: "the nil-pool guard",
							value: "The reference keeps pool alongside db and leaves it nil for a transaction-scoped Repository, so a WithTx called on one runs fn against the same transaction instead of trying to begin a nested one. Real nesting needs savepoints and this lab does not. The guard is there so the shape is obvious the day you need them.",
						},
						{
							label: "a transaction is a held connection",
							value: "It is checked out of the pool from Begin until Commit or Rollback, and it is not available to anyone else in that window. This is why a long-running transaction is a pool problem before it is a lock problem, and why step 08's arithmetic and this step are the same subject seen from two ends.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# needs a throwaway Postgres; see the note on step 04\nTEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test -run TestIntegrationWithTxRollback -v ./postgres/",
					expect: {
						en: "Green. The test creates a task inside the transaction, reads it back inside the transaction to prove it is really there, and then returns its own sentinel error to force the rollback. Afterwards, from outside, GetByID on that id must be api.ErrNotFound. Both halves matter: visible inside, gone outside. A WithTx that never used the transaction it began passes the first half.",
					},
					note: {
						en: "Skips without TEST_DATABASE_URL. A rollback is a claim about a database's behaviour, so a mock asserting it would be a mock asserting its own opinion.",
					},
					labPath: "labs/db-api/postgres/integration_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Commit unconditionally: run fn, ignore what it returned, and call tx.Commit(ctx) regardless. Rerun the rollback test.",
					},
					observe: {
						en: 'GetByID after rollback: err = <nil>, want errors.Is(err, api.ErrNotFound). The row is still there. WithTx returned the callback\'s error correctly, so every caller was told the operation failed, and the write it was supposed to undo is committed.',
					},
					why: {
						en: "This is the worst failure mode in the project, and notice that the error handling is flawless: the caller got the error, logged it, returned 500, and the client retried, exactly as designed. The transaction is not there to make the failure visible. It is there to make the failure total. Half a multi-step write, plus a correctly reported error, plus a retry, is how you get double charges and orphaned rows, and the report says it failed, so nobody goes looking. Atomicity is not about error handling, it is about the state you are left in after error handling has already done its job perfectly.",
					},
				},
			],
			retrievalPrompt:
				"Why does WithTx take a callback instead of returning a transaction the caller drives? || Returning one would put a pgx type in the interface, so package api would import a driver and the seam that keeps handlers testable without a database would be gone. The callback keeps the transaction inside the implementation: a mock satisfies WithTx with fn(mock), and the caller cannot forget to commit or roll back because the caller cannot do either. Lifetime becomes structural instead of remembered.",
		},
		{
			n: "08",
			heading: { en: "The DSN is a secret, and the pool is a budget you share" },
			uses: ["structs", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Two ways to lose a database, neither of which is a bug in your SQL. The first: your connection string reaches your log aggregator, which is indexed, searchable, retained for a year, and readable by every engineer in the company plus whoever you bought the aggregator from. The second: you deploy more replicas, each one opens as many connections as it likes, and Postgres stops accepting new ones. Both are configuration, both are one line, and neither will ever fail a test you did not write.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Load(getenv func(string) string) (Config, error) reads the whole environment once and never calls os.Getenv. DATABASE_URL is required with no default and must parse as a URL with a postgres or postgresql scheme. DBAPI_MAX_CONNS and DBAPI_MIN_CONNS are optional with documented defaults, and set-but-unparseable is an error naming the variable and the value, never a silent fallback. No error may contain the raw DATABASE_URL. Config has a String method, with a value receiver, that redacts the password. PoolConfig applies the limits over the ones pgxpool chose for itself.",
					},
					rationale: {
						en: "Start with the value receiver, because it is the one that looks like a style note and is not. fmt reaches a Stringer through an interface, and interface satisfaction obeys method sets: a method on *Config is not in the method set of a Config. Load returns a Config by value, so a value is what every caller has and a value is what they log. Write func (c *Config) String() and calling cfg.String() still works, because Go takes the address of an addressable value for you, so it looks completely fine; but fmt.Sprintf(\"%v\", cfg) does not get that favour, finds no Stringer, and prints the struct fields, password included. The method you wrote to protect the secret is right there, correct, and never called. Now the arithmetic. Postgres's max_connections defaults to 100 and each connection is a separate backend process on that server, not a thread, holding its own memory: it is a hard, shared, finite budget, and every replica of every service spends from the same pot, minus the three superuser_reserved_connections that are the only reason you can still get in to see what happened. pgxpool's own default MaxConns is the greater of 4 and runtime.NumCPU(), which is a per-machine number: the same image on a 32-core node opens eight times what it opened on a 4-core node, and the difference is not in your config, your manifest, or your diff. Four replicas at 32 is 128 against a budget of 100, and it fails at the moment you scale up, which is the moment you were trying to handle more traffic.",
					},
					hints: [
						{
							label: "url.Redacted has existed since Go 1.15",
							value: 'It returns the URL with any password replaced by the literal "xxxxx", leaving the host and database name, which are the parts an operator actually needs from that log line. Writing this by hand is how you get it wrong. Redacting by dropping the URL entirely passes the leak test and makes the line useless.',
						},
						{
							label: "why Load refuses a libpq keyword string",
							value: 'pgx accepts "host=db user=api password=hunter2" as well as URLs. Load rejects it, and not out of tidiness: String cannot redact what Load never parsed, so accepting a format you cannot take apart is accepting a format you cannot make safe. Constrain the input at the boundary and the method downstream gets an invariant instead of a guess.',
						},
						{
							label: "the error path is the leak path",
							value: "An unparseable DATABASE_URL is still a DATABASE_URL. It is the likeliest string in the process to contain a secret, and an error is a thing that gets logged, so no error here may echo the raw value. If it did not parse you cannot know which part of it was the password, so none of it can be printed. The suite tests exactly this.",
						},
						{
							label: "pgx redacts its errors and not your struct",
							value: "pgconn redacts the password in the errors it raises about a connection string, which is easy to mistake for a guarantee. It is not one: pgconn.Config has a plain Password string field and no String method at all, so %+v on one prints it. The library protects its own error messages. Your struct is your problem.",
						},
						{
							label: "getenv as a parameter, again",
							value: "The integration suite in this lab hands Load a function that answers DATABASE_URL out of TEST_DATABASE_URL. Same Load, different source, no environment mutated, tests still parallel. That is the payoff, and it is why the parameter is worth the slight awkwardness at the call site in main.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command: "go test -v ./config/",
					expect: {
						en: 'Green: six tests plus TestLoadRejects, which is a table of seven. Not one of them needs a database, because Load never connects and pgxpool.ParseConfig only parses. TestConfigStringRedactsThePassword renders the same Config four ways, through String directly and through %v, %+v, and Sprint, and requires that "hunter2" appears in none of them while "db.internal" appears in all. TestPoolConfigAppliesTheLimits proves your MaxConns replaced the one ParseConfig defaulted to. TestLoadErrorsDoNotLeakThePassword feeds Load three malformed DSNs with the password embedded and requires the error to name the variable and not the value.',
					},
					labPath: "labs/db-api/config/config_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Change one character: make String a pointer receiver, func (c *Config) String() string. Change nothing else. Run go test -run TestConfigStringRedacts ./config/",
					},
					observe: {
						en: 'It fails, printing "rendered config contains the password: {postgres://api:hunter2@db.internal:5432/tasks?sslmode=require 10 0}". Your String method compiles, is correct, is tested, and cfg.String() still returns the redacted text. fmt printed the struct instead.',
					},
					why: {
						en: 'cfg.String() worked because cfg is addressable and Go silently rewrote it as (&cfg).String(). fmt has no such option: it received a Config as an any, and an interface value carries only the method set of the type stored in it, which for a Config does not include pointer-receiver methods. So the Stringer check failed, fmt fell back to printing fields, and the password went to stdout. Then look at what vet does and does not do, because that is the sharpest part: %s on a non-Stringer is a build error vet catches instantly, which is why the suite deliberately does not test %s. %v is legal on absolutely anything, so vet has nothing to say, and %v is the verb everyone actually writes in a log line. The tool catches the mistake you would not have made and is silent on the one you would.',
					},
				},
			],
			retrievalPrompt:
				"Your Config has a String method that redacts the password. cfg.String() returns the redacted text. Why can the password still end up in your logs? || If the receiver is *Config, the method is not in the method set of a Config value. cfg.String() works because Go auto-addresses an addressable value, but fmt receives the Config through an interface, finds no Stringer, and prints the fields including the password. Load returns a value, so a value is what gets logged. A value receiver puts the method in both method sets, and vet cannot warn you because %v is legal on anything.",
		},
		{
			n: "09",
			heading: { en: "Two suites, and the one that will lie to you" },
			uses: ["interfaces"],
			blocks: [
				{
					type: "text",
					value: {
						en: "One last thing, and it is the most important sentence in the project. Run go test ./... in this lab right now, with no database, having written nothing in repo.go. Read the output. Three ok lines. Green. Your repository is a file of stubs that return errNotImplemented, and the test runner just told you everything is fine, and it is not lying: a package whose tests all skipped is a package with no failures.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Get all three suites green, and know at every moment which of them actually ran. The config and api suites are graded on every command. The postgres suite skips silently unless TEST_DATABASE_URL is set, so run go test -v ./postgres/ and read the word SKIP rather than trusting the summary line. Done for this project means the integration suite ran, against a real Postgres, and passed.",
					},
					rationale: {
						en: "Each suite can only see what it is made of, and the honest version of testing skill is knowing exactly where each one goes blind. The mock suite proves your handlers translate: a repository error becomes a status code, a sentinel becomes a 404, a bad title never reaches storage. It cannot prove your SQL parses, because there is no SQL in it. It cannot see a missing RowsAffected check, a NUL byte, a 23505, or a rollback that does not roll back, and you have now watched it miss all five. The integration suite proves the SQL and cannot be run everywhere, so it skips, and skipping prints ok. Both properties are correct in isolation and their combination is a trap: the cheap suite is the one that always runs, and the expensive suite is the one that catches the bugs that end weekends. Nothing about that is fixable, which is exactly why it has to be known.",
					},
					hints: [
						{
							label: "make the skip loud where it counts",
							value: "This lab skips rather than fails on purpose, because a lab that will not run without Docker is a lab that does not run. Your repository should make the opposite choice: in CI, an integration suite that silently skips because a service was not reachable is worse than no suite, because it reports green. Fail when a variable you expect is missing. The lab's own README spells out which ok line is a skip for exactly this reason.",
						},
						{
							label: "the fastest real Postgres is a throwaway one",
							value: "docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16, then TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./... The suite applies schema.sql itself and truncates before each test, so reruns are deterministic. Do not point it at anything you care about: one test stores DROP TABLE payloads, and proving they are inert is the entire point.",
						},
						{
							label: "a fake should be hostile, and how hostile is a real choice",
							value: "Every method on mockRepo panics if the test did not set its function field, so a handler that reaches storage when it should not dies by name instead of silently receiving a zero value. A fake that returns a zero value hides the bug and reports success. But notice where the suite backs off: TestTitleValidation passes a repo whose methods call t.Errorf rather than panic, because a panic takes the whole test binary with it, and the first bad title would hide the other five rows. Loud for a single case, reportable for a table.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# what the world looks like with no database:\ngo test ./...\ngo test -v ./postgres/ | grep -c SKIP\n\n# and with one:\ndocker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16\nTEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./...",
					expect: {
						en: "The first command prints three ok lines and grades two packages. The second prints 6, which is how many of your integration tests did not run while that ok line was being printed. The third grades all three, and only then does the summary mean what it appears to mean. The difference between run one and run three is not the output, which is identical: it is that one of them checked your SQL.",
					},
					note: {
						en: "The grep is the check here, not the go test. Everything above the third command runs with no database and is the honest state of this lab on a machine without Docker: two suites graded, one skipped, one summary that does not distinguish them.",
					},
					labPath: "labs/db-api/README.md",
				},
				{
					type: "breakIt",
					change: {
						en: "Stub out your entire postgres repository: make every method return nil, nil. Not errNotImplemented, just nil. Then run go test ./... with no TEST_DATABASE_URL.",
					},
					observe: {
						en: "ok, ok, ok. Three green packages, in under a second, for an API that cannot store a task, cannot retrieve one, and would nil-pointer panic on the first request it ever served.",
					},
					why: {
						en: "Keep that output somewhere. It is what green means when you do not know which suites ran, and the failure is not in the test runner: go test correctly reported that nothing failed, because nothing ran. Every real version of this exists: the integration job whose service container failed to start and whose steps all skipped, the suite guarded by a variable CI stopped setting two months ago, the pipeline that went green faster after someone deleted a dependency. They all report ok. The habit that survives this project is not \"write integration tests\", it is that a green run is a claim with a scope, and if you cannot say out loud what was in scope, you have not been told anything.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "system",
						title: "Three suites, two of which run anywhere",
						labPath: "labs/db-api",
						description:
							"From labs/db-api, go test ./... grades the config suite (Load's boundary validation, the redaction of the password through String, %v, %+v and Sprint, and PoolConfig applying your limits over pgxpool's defaults) and the handler suite (TestCreateTask, TestGetTask, TestListTasks, TestUpdateTask, TestDeleteTask, TestTitleValidation, TestTitleAtTheLimitIsAccepted, TestTitleIsCountedInRunesNotBytes, TestTitleIsTrimmedBeforeItIsStored, TestOversizedBodyIsRejected) against a hand-rolled mock repository. Neither needs a database. The integration suite in labs/db-api/postgres skips unless TEST_DATABASE_URL points at a real Postgres, so with no database the postgres ok line is a skip, not a pass: repo.go is never run and never graded, and a file of stubs returning nil produces the identical output. Set TEST_DATABASE_URL (see the throwaway Postgres hint below) and the same command applies schema.sql and grades the SQL: the full lifecycle, list ordering with limit/offset paging, not-found via RowsAffected, the duplicate-title path through SQLSTATE 23505, a WithTx rollback, and the hostile-title suite proving injection payloads round trip as data. Human deliverable: run the injection test against a real server and read what it stored.",
						testCases: [
							{
								description: "POST /tasks: valid body",
								expected: "HTTP 201, task JSON with id",
							},
							{
								description: "POST /tasks: empty or whitespace-only title",
								expected: 'HTTP 400, {"error":"title required"}, repository never called',
							},
							{
								description: "POST or PUT: title over MaxTitleRunes, counted in runes not bytes",
								expected: 'HTTP 400, {"error":"title too long"}; 200 CJK runes (600 bytes) is accepted',
							},
							{
								description: "POST or PUT: title containing a null byte",
								expected:
									'HTTP 400, {"error":"title contains a null byte"}: Postgres cannot store code point zero, so this is a 400 you raise or a 500 it raises',
							},
							{
								description: "POST /tasks: valid JSON body over MaxBodyBytes",
								expected: "HTTP 413, distinguished from malformed JSON with errors.As on *http.MaxBytesError",
							},
							{
								description: "POST /tasks: duplicate title (repo returns a wrapped ErrDuplicate)",
								expected: "HTTP 409, error JSON, found with errors.Is through the wrap",
							},
							{
								description: "GET /tasks/{id}: exists / not found",
								expected: "HTTP 200 with task JSON / HTTP 404 with error JSON",
							},
							{
								description: "DELETE /tasks/{id}",
								expected: "HTTP 204, empty body",
							},
							{
								description: "Config: String, %v, %+v and Sprint on a Config value",
								expected: "password replaced by xxxxx in all four, host still present; a pointer receiver fails this",
							},
							{
								description: "Config: Load with a bad or unparseable DATABASE_URL",
								expected: "error naming the variable, never echoing the value",
							},
							{
								description: "Integration: Create → Get → Update → Delete over HTTP",
								expected: "final GET returns 404",
							},
							{
								description: "Integration: List after seeding rows",
								expected: "ascending id order, limit/offset paging honored, id/title/done shape",
							},
							{
								description: "Integration: Update/Delete a missing id",
								expected: "404 and errors.Is(err, api.ErrNotFound) from the real row count",
							},
							{
								description:
									"Integration: hostile titles ('; DROP TABLE tasks; --, O'Brien, ' OR '1'='1, trailing backslash)",
								expected: "each round trips byte for byte as data, and the tasks table still exists",
							},
							{
								description: "Integration: WithTx callback returns an error",
								expected: "task created inside the transaction is gone after rollback",
							},
						],
						desiredOutput: `# go test ./...   (no TEST_DATABASE_URL set)
ok      gopath.dev/labs/db-api/api        # handler suite, graded against the mock
ok      gopath.dev/labs/db-api/config     # config suite, graded: parses, never connects
ok      gopath.dev/labs/db-api/postgres   # SKIPPED, not passed: repo.go was never run

# TEST_DATABASE_URL=postgres://... go test ./...   (a throwaway Postgres)
ok      gopath.dev/labs/db-api/api
ok      gopath.dev/labs/db-api/config
ok      gopath.dev/labs/db-api/postgres   # SQL graded: lifecycle, paging, not-found, 23505, injection, rollback`,
						hints: [
							{
								label: "throwaway Postgres",
								value: "docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16, then TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./... The suite applies schema.sql and truncates before each test. Do not point it at a database you care about.",
							},
							{
								label: "the third ok line is the exam",
								value: "Two of these three suites run on any machine and the third is the one that grades the SQL. If you finish this project without ever setting TEST_DATABASE_URL, you have graded your handlers and your config and taken the repository entirely on faith. Read step 09's break-it before you decide that is fine.",
							},
							{
								label: "mock pattern",
								value: "type mockRepo struct { createFn func(ctx, title) (*Task, error) }. In Create() call m.createFn(ctx, title), and panic if the field is nil so an unexpected call fails loudly instead of returning a silent zero value. Tests set only the fields they expect to be used.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"go test ./... prints ok for a package whose tests all skipped. Why is that correct behaviour and what does it cost you here? || A skip is not a failure, so the package has no failures and the runner says ok. It costs you the ability to read the summary line: a repository full of stubs and a finished implementation produce identical output when no database is set. Green is a claim with a scope, and here the scope is decided by an environment variable nothing will remind you about.",
		},
		{
			n: "10",
			heading: { en: "The gate: one round trip, and no more" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "Step 04 made the claim: Create is one round trip, not two, because INSERT ... RETURNING reads the assigned row back in the statement that writes it. A claim like that is worth exactly as much as the test that holds it, and a correctness suite does not hold it: a Create that inserts and then runs a separate SELECT returns the identical task and passes every functional test you have. The cost is invisible to them and visible to production, which is the definition of the thing a Tier 3 gate exists to pin.",
					},
				},
				{
					type: "constraint",
					what: {
						en: "Create issues exactly one database round trip, and a full Create+GetByID+List+Update+Delete issues exactly five. The gate lives in postgres/gate_test.go behind the gate build tag. It needs no Postgres: it runs your repository against a countingQuerier, a querier that executes no SQL and only tallies how many times Exec, Query, and QueryRow are called. Round-trip count is a property of the SQL you wrote, not of the machine or the network, so the gate is an exact count with no threshold.",
					},
					rationale: {
						en: "Latency against a real database is dominated by round trips: each Query, QueryRow, or Exec is one network hop to Postgres and back, and the hops serialize. A hop is a few hundred microseconds inside a datacentre and a few milliseconds across one, so the single most common way a correct repository is still a slow one is doing two hops where one would do. RETURNING is Postgres handing you the tool to not do that, and the gate is what keeps you honest about using it. Counting hops with a fake querier rather than timing a real database is deliberate: a stopwatch measures the machine and the network and flakes on both, while the hop count measures only your code and is identical everywhere, which is the only kind of number a gate can assert exactly.",
					},
					hints: [
						{
							label: "run the gate against your code",
							value: "go test -tags gate -run TestGate ./postgres/. It grades your repo.go, needs no TEST_DATABASE_URL, and a guard tells you to make `go test ./...` green first if Create still errors.",
						},
						{
							label: "why a fake querier and not a real Postgres",
							value: "The querier interface that makes WithTx work (both *pgxpool.Pool and pgx.Tx satisfy it) is the same seam the gate uses: a countingQuerier satisfies it too, so your real method bodies run while every hop is intercepted and counted. No container, no schema, no flake.",
						},
						{
							label: "what two hops looks like",
							value: "An INSERT via Exec followed by a SELECT of the new id via QueryRow is the habit carried over from databases without RETURNING. The gate sees exec=1, queryRow=1, total 2, and fails: the result is right and the cost is doubled.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/db-api",
					command:
						"# prove the gate is passable, against the reference:\ngo test -tags 'solution gate' -run TestGate -v ./postgres/\n\n# then gate your own repository:\ngo test -tags gate -run TestGate ./postgres/",
					expect: {
						en: 'PASS, with "round-trip gate: Create = 1 hop (queryRow), via INSERT ... RETURNING" and "full CRUD = 5 hops (exec=2 query=1 queryRow=2)". Create and GetByID read a row back (QueryRow); List reads many (Query); Update and Delete write without reading (Exec). Five operations, five hops.',
					},
					labPath: "labs/db-api/postgres/gate_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Split Create into two hops: an Exec that runs INSERT INTO tasks (title) VALUES ($1) with no RETURNING, then a QueryRow that SELECTs the row back. It stores the task and returns it, so the functional suite stays green. Rerun the gate, then restore it with git checkout.",
					},
					observe: {
						en: 'The integration tests pass and the gate fails twice: "Create issued 2 database hops (exec=1 query=0 queryRow=1), want exactly 1" and the CRUD total reads 6, not 5. The task is correct in the table; the endpoint is twice as slow, and nothing that checks correctness can tell.',
					},
					why: {
						en: "This is the round-trip version of every silent-cost break in the path: the reworded gRPC error, the read that copies instead of aliasing. Each is invisible to a test that only asks whether the answer is right, because the answer is right. Round-trip count is a property of how the repository talks to the database, not of what it returns, so it needs a test that watches the conversation rather than the result. Ship the two-hop Create and it will not fail anything; it will just quietly add a network hop to every write your service ever does, and you will meet it again as a latency graph nobody can source.",
					},
				},
			],
			retrievalPrompt:
				"The gate counts database round trips with a fake querier instead of timing queries against a real Postgres. Why is a count the thing to assert, and not a duration? || A duration measures the machine and the network as much as your code, so it flakes and forces a threshold with headroom, which blinds it to small regressions. Round-trip count is a property of the SQL you wrote: it is identical on a laptop and in production, so the gate can assert it exactly, with no database, and catch a one-hop regression a timing gate never could.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The spine was one arrow. The handlers declared what they needed, the database implemented it, and nothing above the repository ever learned that pgx exists. That single decision paid four times: a thirty-line mock exercises every handler branch in microseconds, the transaction never leaked into the interface's vocabulary, the config layer stayed a pure function of its input, and the SQL got graded by the only thing qualified to grade SQL. None of that is architecture for its own sake. Each one is a test that runs somewhere it otherwise could not.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-it steps had a pattern worth naming: not one of them was caught by the suite that looked most like it. == instead of errors.Is stayed green on the not-found test and failed on the duplicate. A missing RowsAffected check passed the entire unit suite while the API answered 200 OK for writes that never happened. A NUL byte passed every check Go can perform and became a 500 at the INSERT. A pointer receiver on String left the method correct, tested, callable, and never called by fmt. In every case the fake shared the bug's blind spot, because a fake is made of the same assumptions you are.",
			},
		},
		{
			type: "text",
			value: {
				en: "And the injection step should have rearranged something. The placeholder is not escaping done well, it is the statement and the data travelling as separate messages so that parsing is over before your bytes arrive. Which is why the same defect that lets an attacker in is the one that breaks on a customer called O'Brien, why a payload that would drop a table merely errors under pgx's default exec mode and would not under another, and why a trailing backslash is harmless here only because of a server setting that changed in 2011. Escaping means knowing every rule of a parser you did not write, on a server you did not configure, in a version you did not choose. Parameterisation means never asking the question.",
			},
		},
	],
}
