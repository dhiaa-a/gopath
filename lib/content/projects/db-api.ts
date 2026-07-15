import { Project } from "../../content"

export const dbApi: Project = {
	slug: "db-api",
	name: "Database-backed REST API",
	tagline:
		"CRUD REST API with Postgres, migrations, the repository pattern, and transaction safety.",
	code: "DB",
	tier: 3,
	tierLabel: "PRODUCTION",
	estimatedTime: "6–8 hours",
	tags: ["postgres", "pgx", "migrations", "repository", "testing"],
	lab: {
		path: "labs/db-api",
		command: "go test ./...",
		summary: {
			en: "Grades the API at two layers: handler unit tests against a hand-rolled mock repository on every run, and an opt-in integration suite that drives the full Create, Get, Update, Delete lifecycle against whatever Postgres TEST_DATABASE_URL points at.",
		},
	},
	mentalModels: [
		"repository interface as a boundary",
		"dependency injection through constructors",
		"transaction propagation via interface",
		"test doubles without a database",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "HTTP handlers receive a TaskRepository interface, not a *pgxpool.Pool. The Postgres implementation lives behind that interface. Tests inject a mock. Schema changes are versioned SQL migration files. Transactions are propagated through a WithTx method on the interface itself.",
			},
		},
		{
			type: "code",
			value: `handler(repo TaskRepository) → repo.Create / List / Update / Delete
                   ↑ PostgresRepo in production
                   ↑ MockRepo in tests`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `migrations/
 ├── 001_tasks.up.sql
 └── 001_tasks.down.sql
internal/
 ├── repository/
 │    ├── repository.go  — TaskRepository interface
 │    └── postgres.go    — PostgresRepo
 ├── api/
 │    ├── handlers.go
 │    └── handlers_test.go  — MockRepo
cmd/server/main.go`,
		},
		{
			type: "text",
			value: {
				en: "Scope note: that tree is the full production shape, and the steps below teach it. The executable lab at labs/db-api ships a focused slice of it, flat rather than nested: an api/ package (the TaskRepository interface, the handlers, and the mock suite) and a postgres/ package (the pgx repository and the integration suite). It does not ship golang-migrate or a migrations/ directory; the integration test applies a single schema.sql before it runs, which is all one table needs, so step 01's versioned-migration constraint is the production pattern to understand, not a directory to go hunting for here. There is no internal/ or cmd/server/main.go either: the suites construct the server directly, so wiring a main binary is left out of scope.",
			},
		},
	],
	steps: [
		{
			n: "01",
			heading: {
				en: "Define the repository interface and migrations",
			},
			uses: ["interfaces"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "TaskRepository must expose Create, GetByID, List(limit, offset int), Update, Delete, and WithTx(ctx, func(TaskRepository) error) error. Schema changes must be in versioned up/down SQL files applied by golang-migrate, not in application startup code.",
					},
					rationale: {
						en: "The interface is defined by its consumer (handlers), not its implementation (Postgres). WithTx accepts a callback that receives a transaction-scoped repository; the callback never touches the transaction object, so it can be tested with a mock that calls the function directly without a transaction. SQL migration files version the schema independently of the application binary.",
					},
					hints: [
						{
							label: "golang-migrate",
							value: "github.com/golang-migrate/migrate/v4: reads numbered .up.sql/.down.sql files, tracks applied versions in schema_migrations.",
						},
						{
							label: "WithTx pattern",
							value: "Begin a transaction, create a new PostgresRepo wrapping the tx, call fn with it, commit on success or rollback on error.",
						},
					],
				},
			],
		},
		{
			n: "02",
			heading: { en: "Implement the Postgres repository" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Use pgxpool with explicit MaxConns and MinConns. Every query must use $N parameterised placeholders. Wrap all database errors with context before returning. Detect unique constraint violations and return a typed sentinel error.",
					},
					rationale: {
						en: "pgxpool reuses connections; opening one per query would be 10–100× slower. Parameterised queries prevent SQL injection at the driver level. Error wrapping preserves the original pgx error for callers. Typed sentinel errors (ErrDuplicate) let handlers return 409 Conflict instead of 500 Internal Error for known failure modes.",
					},
					hints: [
						{
							label: "pgx",
							value: "github.com/jackc/pgx/v5 and github.com/jackc/pgx/v5/pgxpool",
						},
						{
							label: "unique constraint",
							value: 'var pgErr *pgconn.PgError; if errors.As(err, &pgErr) && pgErr.Code == "23505" { return ErrDuplicate }',
						},
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "HTTP handlers with dependency injection" },
			uses: ["http-handler","interfaces"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: 'Handlers must receive TaskRepository through a constructor, never as a global or package-level variable. Use Go 1.22 method-specific routing patterns. All error responses must be consistent JSON: {"error": "message"}. All success responses must set Content-Type: application/json.',
					},
					rationale: {
						en: 'Constructor injection makes the dependency explicit and swappable: the same principle as the interface itself. Global state makes tests order-dependent and race-prone. Method-specific patterns ("POST /tasks") eliminate the need for a third-party router. Consistent error shapes let clients handle errors uniformly without inspecting response bodies.',
					},
					hints: [
						{
							label: "Go 1.22 routing",
							value: 'mux.HandleFunc("POST /tasks", h.Create). The HTTP method is part of the pattern string.',
						},
					],
				},
			],
		},
		{
			n: "04",
			heading: { en: "Test handlers and run an integration test" },
			uses: ["interfaces"],
			blocks: [
				{
					type: "constraint",
					what: {
						en: "Unit tests must use a MockTaskRepository: no real database. Cover every handler: success, not-found, invalid input, and duplicate. Additionally run an integration test against a real Postgres instance exercising Create → GetByID → Update → Delete. The lab ships both suites; the integration one connects to whatever database TEST_DATABASE_URL points at.",
					},
					rationale: {
						en: "The repository interface exists so tests never need a database. The mock lets you exercise every handler branch in milliseconds. The integration test proves the SQL is correct; mocks cannot do that. A throwaway Docker container is the easiest real Postgres to point it at, and the env var means no container tooling is baked into the tests themselves.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "system",
						title: "Handler unit tests + integration lifecycle",
						description:
							"From labs/db-api, go test ./... runs the handler unit suite (TestCreateTask, TestGetTask, TestListTasks, TestUpdateTask, TestDeleteTask) against a hand-rolled mock repository; no database needed. The integration suite in labs/db-api/postgres skips unless TEST_DATABASE_URL points at a real Postgres, so with no database the postgres 'ok' line is a skip, not a pass: repo.go is never run and never graded. Set TEST_DATABASE_URL (see the throwaway Postgres hint below) and the same command applies schema.sql and grades the SQL: the full lifecycle, list ordering with limit/offset paging, not-found mapping, the duplicate-title path, and a WithTx rollback against the real database.",
						labPath: "labs/db-api",
						testCases: [
							{
								description: "POST /tasks: valid body",
								expected: "HTTP 201, task JSON with id",
							},
							{
								description: "POST /tasks: empty title",
								expected:
									'HTTP 400, {"error":"title required"}',
							},
							{
								description:
									"POST /tasks: duplicate title (repo returns ErrDuplicate)",
								expected: "HTTP 409, error JSON",
							},
							{
								description: "GET /tasks/{id}: exists",
								expected: "HTTP 200, task JSON",
							},
							{
								description: "GET /tasks/{id}: not found",
								expected: "HTTP 404, error JSON",
							},
							{
								description: "DELETE /tasks/{id}",
								expected: "HTTP 204, empty body",
							},
							{
								description:
									"Integration: Create → Get → Update → Delete over HTTP",
								expected: "final GET returns 404",
							},
							{
								description:
									"Integration: List after seeding rows",
								expected:
									"ascending id order, limit/offset paging honored, id/title/done shape",
							},
							{
								description:
									"Integration: Update/Delete a missing id",
								expected:
									"404 and errors.Is(err, api.ErrNotFound) from the real row count",
							},
							{
								description:
									"Integration: WithTx callback returns an error",
								expected:
									"task created inside the transaction is gone after rollback",
							},
						],
						desiredOutput: `# go test ./...   (no TEST_DATABASE_URL set)
ok      gopath.dev/labs/db-api/api        # handler suite, graded against the mock
ok      gopath.dev/labs/db-api/postgres   # SKIPPED, not passed: repo.go was never run

# TEST_DATABASE_URL=postgres://... go test ./...   (a throwaway Postgres)
ok      gopath.dev/labs/db-api/api
ok      gopath.dev/labs/db-api/postgres   # SQL graded: lifecycle, list paging, not-found, duplicate, rollback`,
						hints: [
							{
								label: "throwaway Postgres",
								value: "docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16, then TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/. The suite applies schema.sql and truncates before each test.",
							},
							{
								label: "mock pattern",
								value: "type MockRepo struct { CreateFn func(ctx, title) (*Task, error) }. In Create() call r.CreateFn(ctx, title). Tests set CreateFn to return whatever they need.",
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
				en: "Interface-driven data access, constructor injection, migration-versioned schema, typed error codes, unit tests with mocks, and an integration test with a real database. This is production Go architecture: layered, testable, and decoupled at every boundary.",
			},
		},
	],
}
