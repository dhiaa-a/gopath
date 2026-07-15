# Lab: db-api

Tier 3. A REST tasks API graded at two layers, which is the whole lesson: the
repository interface in `api/api.go` is the seam that lets each layer be
tested with the cheapest tool that can actually prove something.

- **Handler unit tests** (`api/handlers_test.go`) run on every `go test`.
  They inject a hand-rolled mock repository, the function-field pattern from
  the project page, and grade your handlers over httptest: status codes,
  JSON bodies, the Content-Type header, and the mapping from repository
  sentinels to 404, 409, and 500. Milliseconds per run, no database.
- **Integration tests** (`postgres/integration_test.go`) are opt-in. They
  skip unless `TEST_DATABASE_URL` is set. When it is set, they apply
  `schema.sql` to that database and drive the real stack end to end:
  Create, Get, Update, Delete over HTTP with your pgx repository underneath,
  then a final GET that must 404. Mocks prove your handlers translate
  errors; only Postgres can prove your SQL is right, that the unique index
  fires, and that a rollback rolls back. Both suites exist because each one
  can lie without the other.

## What you write

Two files are yours:

- `api/handlers.go`: `NewServer(repo TaskRepository) http.Handler`, Go 1.22
  method-specific routes, consistent `{"error":"message"}` JSON. The route
  table and constraints are in the file.
- `postgres/repo.go`: the pgx implementation of `TaskRepository`. $N
  placeholders everywhere, SQLSTATE 23505 mapped to `api.ErrDuplicate`,
  `pgx.ErrNoRows` and zero rows affected mapped to `api.ErrNotFound`,
  `WithTx` built on `pool.Begin` with a deferred rollback.

The contract types in `api/api.go` are pinned; the suites compile against
them. Everything behind them is your design.

## Run it

From this directory:

```
go test ./...
```

That runs the unit suite against your handlers and skips the integration
tests with a message telling you how to unskip them. A fresh clone fails
every unit case with `status = 404, want ...`: nothing is routed yet, and
that failure list is the to-do list.

When the unit suite is green, point the integration suite at a throwaway
Postgres. Any Postgres reachable from your machine works; Docker is the
fastest way to get one:

```
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/
```

On Windows cmd, set the variable first (`set TEST_DATABASE_URL=...`), then
run the test. The suite applies `schema.sql` itself and truncates the tasks
table before each test, so reruns are deterministic. Do not point it at a
database whose contents you care about.

`go test -race ./...` also works everywhere in this lab and costs little:
the handlers share nothing mutable, and pgxpool is safe for concurrent use.
If `-race` fails with a cgo error on Windows, see the note in `labs/README.md`.

## What done looks like

Unit layer, always:

```
ok      gopath.dev/labs/db-api/api
```

with `TestCreateTask`, `TestGetTask`, `TestListTasks`, `TestUpdateTask`, and
`TestDeleteTask` green, fourteen cases in all. Integration layer, with
`TEST_DATABASE_URL` set:

```
ok      gopath.dev/labs/db-api/postgres
```

with `TestIntegrationLifecycle`, `TestIntegrationList`,
`TestIntegrationNotFound`, `TestIntegrationDuplicateTitle`, and
`TestIntegrationWithTxRollback` no longer skipping.

## The solution build tag

Reference implementations live in `api/solution.go` and
`postgres/solution.go` behind the `solution` build tag; a plain `go test`
never compiles them, so the suites always grade your files. Do not open them
until your run is green.
