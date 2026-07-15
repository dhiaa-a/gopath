# Lab: db-api

Tier 3. A REST tasks API graded at three layers, which is the whole lesson:
the repository interface in `api/api.go` is the seam that lets each layer be
tested with the cheapest tool that can actually prove something.

- **Config tests** (`config/config_test.go`) run on every `go test` and need
  no database: `Load` never connects and `pgxpool.ParseConfig` only parses.
  They grade the env boundary and, mostly, the one thing that matters about
  a DSN: that the password cannot reach a log line.
- **Handler unit tests** (`api/handlers_test.go`) run on every `go test`.
  They inject a hand-rolled mock repository, the function-field pattern from
  the project page, and grade your handlers over httptest: status codes,
  JSON bodies, the Content-Type header, input validation, and the mapping
  from repository sentinels to 404, 409, and 500. Milliseconds per run, no
  database.
- **Integration tests** (`postgres/integration_test.go`) are opt-in. They
  skip unless `TEST_DATABASE_URL` is set. When it is set, they apply
  `schema.sql` to that database and drive the real stack end to end:
  Create, Get, Update, Delete over HTTP with your pgx repository underneath,
  list paging, the unique index, a `WithTx` rollback, and the injection
  payloads that only a real server can adjudicate. Mocks prove your handlers
  translate errors; only Postgres can prove your SQL is right. Both suites
  exist because each one can lie without the other.

## What you write

Three files are yours:

- `config/load.go`: `Load(getenv func(string) string) (Config, error)`, a
  value-receiver `String()` that redacts the password, and `PoolConfig()`.
- `api/handlers.go`: `NewServer(repo TaskRepository) http.Handler`, Go 1.22
  method-specific routes, consistent `{"error":"message"}` JSON, and the
  validation the suite pins. The route table and constraints are in the file.
- `postgres/repo.go`: the pgx implementation of `TaskRepository`. `$N`
  placeholders everywhere, SQLSTATE 23505 mapped to `api.ErrDuplicate`,
  `pgx.ErrNoRows` and zero rows affected mapped to `api.ErrNotFound`,
  `WithTx` built on `pool.Begin` with a deferred rollback.

The contract types in `api/api.go` and `config/config.go` are pinned; the
suites compile against them. Everything behind them is your design.

## Run it

From this directory:

```
go test ./...
```

That runs the config and handler suites against your code and skips the
integration tests with a message telling you how to unskip them. A fresh
clone fails every config case with `not implemented` and every handler case
with `status = 404, want ...`: nothing is routed yet, and that failure list is
the to-do list.

**Read the skip.** With no database this command prints three `ok` lines:

```
ok      gopath.dev/labs/db-api/api        graded
ok      gopath.dev/labs/db-api/config     graded
ok      gopath.dev/labs/db-api/postgres   SKIPPED, not passed
```

The third one is not a pass. `repo.go` was never run, and a file full of
`errNotImplemented` produces exactly that line. `go test` reports a package
whose every test skipped as `ok`, which is correct and is not what you want
to rely on. Run `go test -v ./postgres/` and read the word `SKIP` before you
believe your SQL works.

When the unit suites are green, point the integration suite at a throwaway
Postgres. Any Postgres reachable from your machine works; Docker is the
fastest way to get one:

```
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/
```

On Windows cmd, set the variable first (`set TEST_DATABASE_URL=...`), then
run the test. The suite applies `schema.sql` itself and truncates the tasks
table before each test, so reruns are deterministic. Do not point it at a
database whose contents you care about: `TestIntegrationHostileTitlesAreJustData`
stores real `DROP TABLE` payloads, and proving they are inert is the point.

`go test -race ./...` also works everywhere in this lab and costs little:
the handlers share nothing mutable, and pgxpool is safe for concurrent use.
If `-race` fails with a cgo error on Windows, see the note in `labs/README.md`.

## What done looks like

Config and unit layers, always, no database required:

```
ok      gopath.dev/labs/db-api/config
ok      gopath.dev/labs/db-api/api
```

Integration layer, with `TEST_DATABASE_URL` set, with
`TestIntegrationLifecycle`, `TestIntegrationList`, `TestIntegrationNotFound`,
`TestIntegrationDuplicateTitle`, `TestIntegrationHostileTitlesAreJustData`,
and `TestIntegrationWithTxRollback` no longer skipping:

```
ok      gopath.dev/labs/db-api/postgres
```

## The solution build tag

Reference implementations live in `config/solution.go`, `api/solution.go`,
and `postgres/solution.go` behind the `solution` build tag; a plain `go test`
never compiles them, so the suites always grade your files. Do not open them
until your run is green.
