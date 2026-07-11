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
						en: "Unit tests must use a MockTaskRepository: no real database. Cover every handler: success, not-found, invalid input, and duplicate. Additionally write one integration test against a real Postgres instance (testcontainers-go) exercising Create → GetByID → Update → Delete.",
					},
					rationale: {
						en: "The repository interface exists so tests never need a database. The mock lets you exercise every handler branch in milliseconds. The integration test proves the SQL is correct; mocks cannot do that. testcontainers-go spins up a real Postgres container and tears it down after, with no manual setup.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "system",
						title: "Handler unit tests + integration lifecycle",
						description:
							"go test -race ./... must pass. The integration test must run against a real Postgres container.",
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
								description: "GET /tasks/:id: exists",
								expected: "HTTP 200, task JSON",
							},
							{
								description: "GET /tasks/:id: not found",
								expected: "HTTP 404",
							},
							{
								description: "DELETE /tasks/:id",
								expected: "HTTP 204",
							},
							{
								description:
									"Integration: Create → Get → Update → Delete",
								expected: "final GET returns 404",
							},
						],
						desiredOutput: "PASS",
						hints: [
							{
								label: "testcontainers",
								value: "github.com/testcontainers/testcontainers-go: spins up a real Postgres container, runs migrations, tears down after test.",
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
