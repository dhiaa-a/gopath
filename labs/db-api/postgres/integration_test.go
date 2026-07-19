// Integration suite: the same repository the unit tests mock, run against a
// real Postgres. Mocks prove the handlers translate errors correctly; only a
// real database can prove the SQL is right, that RETURNING returns, that the
// unique index actually fires, that a rollback actually rolls back.
//
// The suite is opt-in. Without TEST_DATABASE_URL every test here skips, so
// `go test ./...` never requires a database. To run it, point the variable
// at any throwaway Postgres, for example:
//
//	docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
//	TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/
//
// The suite applies schema.sql itself and truncates the tasks table before
// each test, so reruns are deterministic. Do not point it at a database you
// care about.
package postgres_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gopath.dev/labs/db-api/api"
	"gopath.dev/labs/db-api/config"
	"gopath.dev/labs/db-api/postgres"
)

const skipMsg = "TEST_DATABASE_URL not set; skipping integration tests.\n" +
	"Run a throwaway Postgres and point the variable at it:\n" +
	"  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16\n" +
	"  TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/"

// setup connects, applies schema.sql, and empties the tasks table. Each test
// starts from the same blank slate, so order and reruns cannot matter.
//
// It builds the pool through your own config package rather than calling
// pgxpool.New directly, so the whole chain gets exercised: Load validates the
// URL, PoolConfig applies the limits, and pgxpool connects with them. Note
// how the getenv parameter pays off here: the suite hands Load a function
// that answers DATABASE_URL out of TEST_DATABASE_URL, so the integration
// tests read a different variable than production without config knowing or
// caring, and without anything mutating the process environment.
func setup(t *testing.T) *postgres.Repository {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip(skipMsg)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cfg, err := config.Load(func(key string) string {
		if key == config.EnvDatabaseURL {
			return dsn
		}
		return ""
	})
	if err != nil {
		t.Fatalf("config.Load from TEST_DATABASE_URL: %v", err)
	}
	poolCfg, err := cfg.PoolConfig()
	if err != nil {
		t.Fatalf("PoolConfig: %v", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		t.Fatalf("connect to %s: %v", cfg, err)
	}
	t.Cleanup(pool.Close)

	schema, err := os.ReadFile(filepath.Join("..", "schema.sql"))
	if err != nil {
		t.Fatalf("read schema.sql: %v", err)
	}
	if _, err := pool.Exec(ctx, string(schema)); err != nil {
		t.Fatalf("apply schema.sql: %v", err)
	}
	if _, err := pool.Exec(ctx, `TRUNCATE tasks RESTART IDENTITY`); err != nil {
		t.Fatalf("truncate tasks: %v", err)
	}
	return postgres.NewRepository(pool)
}

// TestIntegrationLifecycle drives the full stack end to end over HTTP: real
// handlers, real repository, real Postgres. Create, read it back, update it,
// delete it, and prove the final GET is a 404, which means the DELETE hit
// the database and not just the response writer.
func TestIntegrationLifecycle(t *testing.T) {
	repo := setup(t)
	srv := newServer(t, repo)

	// Create.
	rec := request(t, srv, http.MethodPost, "/tasks", `{"title":"integration task"}`)
	if rec.StatusCode != http.StatusCreated {
		t.Fatalf("POST /tasks: status = %d, want 201; body: %s", rec.StatusCode, rec.Body)
	}
	var created api.Task
	mustDecode(t, rec.Body, &created)
	if created.ID == 0 {
		t.Fatal("POST /tasks: created task has no id; is the INSERT using RETURNING?")
	}

	// Read it back.
	path := fmt.Sprintf("/tasks/%d", created.ID)
	rec = request(t, srv, http.MethodGet, path, "")
	if rec.StatusCode != http.StatusOK {
		t.Fatalf("GET %s: status = %d, want 200; body: %s", path, rec.StatusCode, rec.Body)
	}
	var got api.Task
	mustDecode(t, rec.Body, &got)
	if got.Title != "integration task" || got.Done {
		t.Fatalf("GET %s: task = %+v, want title=%q done=false", path, got, "integration task")
	}

	// Update: change BOTH the title and done, then read the row back from the
	// database. Reusing the create title would let an UPDATE that writes done
	// but never touches the title column pass; a new title forces the
	// follow-up GET to prove the column was actually written.
	rec = request(t, srv, http.MethodPut, path, `{"title":"integration task v2","done":true}`)
	if rec.StatusCode != http.StatusOK {
		t.Fatalf("PUT %s: status = %d, want 200; body: %s", path, rec.StatusCode, rec.Body)
	}
	rec = request(t, srv, http.MethodGet, path, "")
	mustDecode(t, rec.Body, &got)
	if got.Title != "integration task v2" {
		t.Fatalf("GET %s after update: title = %q, want %q; did the UPDATE write the title column?", path, got.Title, "integration task v2")
	}
	if !got.Done {
		t.Fatalf("GET %s after update: done = false, want true; did the UPDATE reach the database?", path)
	}

	// Delete, then prove it is gone.
	rec = request(t, srv, http.MethodDelete, path, "")
	if rec.StatusCode != http.StatusNoContent {
		t.Fatalf("DELETE %s: status = %d, want 204; body: %s", path, rec.StatusCode, rec.Body)
	}
	rec = request(t, srv, http.MethodGet, path, "")
	if rec.StatusCode != http.StatusNotFound {
		t.Fatalf("GET %s after delete: status = %d, want 404", path, rec.StatusCode)
	}
}

// TestIntegrationList seeds several rows and drives repo.List against the real
// database. The unit suite mocks List, so it pins how the handler passes limit
// and offset, but a mock cannot prove the SQL: only Postgres shows that
// ORDER BY id LIMIT $1 OFFSET $2 returns the right rows in the right order. A
// List that never runs its query, drops the ORDER BY, or ignores the bounds
// would sail through every other test in this module.
func TestIntegrationList(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	// ids are assigned ascending by insertion, so this is also the order the
	// rows must come back in.
	titles := []string{"alpha", "bravo", "charlie"}
	ids := make([]int64, len(titles))
	for i, title := range titles {
		task, err := repo.Create(ctx, title)
		if err != nil {
			t.Fatalf("seed Create(%q): %v", title, err)
		}
		ids[i] = task.ID
	}

	// A wide page returns every row, in ascending id order, with the full
	// shape intact (id, title, done).
	all, err := repo.List(ctx, 50, 0)
	if err != nil {
		t.Fatalf("List(50, 0): %v", err)
	}
	if len(all) != len(titles) {
		t.Fatalf("List(50, 0): got %d rows, want %d", len(all), len(titles))
	}
	for i := range titles {
		if all[i].ID != ids[i] || all[i].Title != titles[i] || all[i].Done {
			t.Fatalf("List row %d = %+v, want id=%d title=%q done=false", i, all[i], ids[i], titles[i])
		}
		if i > 0 && all[i-1].ID >= all[i].ID {
			t.Fatalf("List: ids not ascending at %d: %d then %d", i, all[i-1].ID, all[i].ID)
		}
	}

	// limit clamps the window to its first rows.
	firstTwo, err := repo.List(ctx, 2, 0)
	if err != nil {
		t.Fatalf("List(2, 0): %v", err)
	}
	if len(firstTwo) != 2 || firstTwo[0].ID != ids[0] || firstTwo[1].ID != ids[1] {
		t.Fatalf("List(2, 0) = %+v, want the first two rows %d and %d", firstTwo, ids[0], ids[1])
	}

	// offset skips from the front, so limit and offset together page.
	lastOne, err := repo.List(ctx, 2, 2)
	if err != nil {
		t.Fatalf("List(2, 2): %v", err)
	}
	if len(lastOne) != 1 || lastOne[0].ID != ids[2] {
		t.Fatalf("List(2, 2) = %+v, want exactly the third row %d", lastOne, ids[2])
	}

	// An offset past the end is an empty page, not an error.
	none, err := repo.List(ctx, 50, 100)
	if err != nil {
		t.Fatalf("List(50, 100): %v", err)
	}
	if len(none) != 0 {
		t.Fatalf("List(50, 100): got %d rows, want 0", len(none))
	}

	// The same query through the wired handler returns an ordered JSON array,
	// proving the HTTP list path and the repository agree.
	srv := newServer(t, repo)
	rec := request(t, srv, http.MethodGet, "/tasks?limit=2&offset=0", "")
	if rec.StatusCode != http.StatusOK {
		t.Fatalf("GET /tasks: status = %d, want 200; body: %s", rec.StatusCode, rec.Body)
	}
	var page []api.Task
	mustDecode(t, rec.Body, &page)
	if len(page) != 2 || page[0].ID != ids[0] || page[1].ID != ids[1] {
		t.Fatalf("GET /tasks?limit=2 = %+v, want the first two rows %d and %d", page, ids[0], ids[1])
	}
}

// TestIntegrationNotFound proves the repository turns a missing row into
// api.ErrNotFound. Update and Delete have no row to scan, so "not found" can
// only come from CommandTag.RowsAffected() == 0; a version that skips that
// check returns nil and silently loses the write. The sentinel is wrapped, so
// errors.Is must see through the wrap, and the handler must map it to 404.
func TestIntegrationNotFound(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()
	const missing = int64(424242)

	if err := repo.Update(ctx, &api.Task{ID: missing, Title: "ghost", Done: true}); !errors.Is(err, api.ErrNotFound) {
		t.Fatalf("Update(missing): err = %v, want errors.Is(err, api.ErrNotFound)", err)
	}
	if err := repo.Delete(ctx, missing); !errors.Is(err, api.ErrNotFound) {
		t.Fatalf("Delete(missing): err = %v, want errors.Is(err, api.ErrNotFound)", err)
	}
	if _, err := repo.GetByID(ctx, missing); !errors.Is(err, api.ErrNotFound) {
		t.Fatalf("GetByID(missing): err = %v, want errors.Is(err, api.ErrNotFound)", err)
	}

	// The same misses become 404 once the handler maps the sentinel.
	srv := newServer(t, repo)
	path := fmt.Sprintf("/tasks/%d", missing)
	if rec := request(t, srv, http.MethodPut, path, `{"title":"ghost","done":true}`); rec.StatusCode != http.StatusNotFound {
		t.Fatalf("PUT %s on a missing id: status = %d, want 404", path, rec.StatusCode)
	}
	if rec := request(t, srv, http.MethodDelete, path, ""); rec.StatusCode != http.StatusNotFound {
		t.Fatalf("DELETE %s on a missing id: status = %d, want 404", path, rec.StatusCode)
	}
}

// TestIntegrationDuplicateTitle proves the unique index and the SQLSTATE
// mapping. A mock cannot test this: the 23505 comes from Postgres itself.
func TestIntegrationDuplicateTitle(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	if _, err := repo.Create(ctx, "only once"); err != nil {
		t.Fatalf("first Create: %v", err)
	}
	_, err := repo.Create(ctx, "only once")
	if !errors.Is(err, api.ErrDuplicate) {
		t.Fatalf("second Create: err = %v, want errors.Is(err, api.ErrDuplicate)", err)
	}
}

// TestIntegrationHostileTitlesAreJustData is the injection test, and it is
// the one test in this module that cannot be faked. A mock repository proves
// nothing here: the question is what PostgreSQL does with these bytes, and
// only PostgreSQL can answer it.
//
// Each title below is a string that breaks a query built by concatenation.
// Against $1 placeholders every one of them is an unremarkable title: it goes
// in, it comes back byte for byte, and the table is still standing at the
// end. That is not the placeholders escaping anything. pgx's default exec
// mode sends the statement and the parameters as separate messages in the
// extended protocol, so the server has finished parsing the SQL before it has
// looked at a single byte of your data. Data that arrives after parsing
// cannot become syntax. There is nothing to escape because there is no
// ambiguity to resolve.
//
// If any case here fails, the message tells you which one, and the cause is
// always the same: something built that query with Sprintf.
func TestIntegrationHostileTitlesAreJustData(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	titles := []struct {
		name  string
		title string
	}{
		{
			// The attack everyone has heard of.
			name:  "statement terminator and a drop",
			title: `'; DROP TABLE tasks; --`,
		},
		{
			// The same bug, with no attacker involved. You do not need
			// somebody hostile to find this: you need a customer with an
			// apostrophe in their name. Concatenated, this is not an
			// exploit, it is a syntax error, and it is the same defect.
			name:  "an ordinary apostrophe",
			title: `Call O'Brien about the invoice`,
		},
		{
			// Tautology injection: the shape that turns a WHERE clause into
			// a full table read rather than destroying anything.
			name:  "always-true tautology",
			title: `anything' OR '1'='1`,
		},
		{
			// Backslashes are an escape character in some databases and not
			// in Postgres by default, which is exactly why hand-rolled
			// escaping is a losing game: the rules are per-server and per
			// setting, and your string formatter knows none of them.
			name:  "trailing backslash",
			title: `windows\path\`,
		},
	}

	for _, tc := range titles {
		t.Run(tc.name, func(t *testing.T) {
			created, err := repo.Create(ctx, tc.title)
			if err != nil {
				t.Fatalf("Create(%q): %v\nA hostile-looking title is still a title. If this is a syntax error, the query was built by concatenation.", tc.title, err)
			}
			if created.Title != tc.title {
				t.Fatalf("Create returned title %q, want %q byte for byte", created.Title, tc.title)
			}

			// Read it back through a second query, so the round trip covers
			// both the write path and the read path.
			got, err := repo.GetByID(ctx, created.ID)
			if err != nil {
				t.Fatalf("GetByID(%d): %v", created.ID, err)
			}
			if got.Title != tc.title {
				t.Fatalf("stored title = %q, want %q byte for byte.\nThe payload is data. It is not supposed to be interpreted, escaped, stripped, or cleaned up: it round trips exactly.", got.Title, tc.title)
			}

			// And the table is still there. This is the assertion that would
			// have caught the drop, and it is deliberately the last one:
			// with a concatenated query the test above already failed, and
			// this is what tells you why.
			if _, err := repo.List(ctx, 1, 0); err != nil {
				t.Fatalf("List after storing %q: %v\nIf the tasks table no longer exists, the title stopped being data and became SQL.", tc.title, err)
			}
		})
	}
}

// TestIntegrationWithTxRollback proves WithTx actually rolls back: a task
// created inside a failing transaction must not exist afterwards. If it
// does, WithTx committed on error or never used the transaction it began.
func TestIntegrationWithTxRollback(t *testing.T) {
	repo := setup(t)
	ctx := context.Background()

	sentinel := errors.New("abort on purpose")
	var insideID int64
	err := repo.WithTx(ctx, func(txRepo api.TaskRepository) error {
		task, err := txRepo.Create(ctx, "must roll back")
		if err != nil {
			return fmt.Errorf("create inside tx: %w", err)
		}
		insideID = task.ID
		// Inside the transaction the row is visible.
		if _, err := txRepo.GetByID(ctx, task.ID); err != nil {
			return fmt.Errorf("read back inside tx: %w", err)
		}
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("WithTx: err = %v, want the callback's own error back", err)
	}

	// Outside the rolled-back transaction the row must be gone.
	_, err = repo.GetByID(ctx, insideID)
	if !errors.Is(err, api.ErrNotFound) {
		t.Fatalf("GetByID after rollback: err = %v, want errors.Is(err, api.ErrNotFound)", err)
	}
}

// response is what request returns: status plus the fully read body, so
// tests can print the body in failure messages without re-reading.
type response struct {
	StatusCode int
	Body       []byte
}

// newServer starts an httptest.Server around the real handler stack and
// returns its base URL. httptest picks a free loopback port itself.
func newServer(t *testing.T, repo api.TaskRepository) string {
	t.Helper()
	srv := httptest.NewServer(api.NewServer(repo))
	t.Cleanup(srv.Close)
	return srv.URL
}

// request performs one HTTP call against the test server.
func request(t *testing.T, base, method, path, body string) response {
	t.Helper()
	var req *http.Request
	var err error
	if body == "" {
		req, err = http.NewRequest(method, base+path, nil)
	} else {
		req, err = http.NewRequest(method, base+path, bytes.NewReader([]byte(body)))
	}
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		t.Fatalf("read response body: %v", err)
	}
	return response{StatusCode: resp.StatusCode, Body: buf.Bytes()}
}

func mustDecode(t *testing.T, data []byte, v any) {
	t.Helper()
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("response body is not the expected JSON: %v\nbody: %q", err, data)
	}
}
