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
	"gopath.dev/labs/db-api/postgres"
)

const skipMsg = "TEST_DATABASE_URL not set; skipping integration tests.\n" +
	"Run a throwaway Postgres and point the variable at it:\n" +
	"  docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16\n" +
	"  TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' go test ./postgres/"

// setup connects, applies schema.sql, and empties the tasks table. Each test
// starts from the same blank slate, so order and reruns cannot matter.
func setup(t *testing.T) *postgres.Repository {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip(skipMsg)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("parse TEST_DATABASE_URL: %v", err)
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
