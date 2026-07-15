// Black-box suite for the HTTP layer. It imports the api package, injects a
// hand-rolled mock repository, and grades responses through httptest: status
// codes, JSON bodies, headers. No real database anywhere in this file; that
// is exactly what the TaskRepository interface buys you.
//
// The mock is the function-field pattern from the project page: a struct with
// one function field per interface method. Each test sets only the fields it
// expects to be called; an unexpected call panics with the method name, which
// fails the test loudly instead of returning a silent zero value. No mock
// library, no code generation. For an interface this size, thirty lines of
// plain Go beat both.
package api_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gopath.dev/labs/db-api/api"
)

type mockRepo struct {
	createFn func(ctx context.Context, title string) (*api.Task, error)
	getFn    func(ctx context.Context, id int64) (*api.Task, error)
	listFn   func(ctx context.Context, limit, offset int) ([]api.Task, error)
	updateFn func(ctx context.Context, task *api.Task) error
	deleteFn func(ctx context.Context, id int64) error
	withTxFn func(ctx context.Context, fn func(api.TaskRepository) error) error
}

func (m *mockRepo) Create(ctx context.Context, title string) (*api.Task, error) {
	if m.createFn == nil {
		panic("unexpected call to Create")
	}
	return m.createFn(ctx, title)
}

func (m *mockRepo) GetByID(ctx context.Context, id int64) (*api.Task, error) {
	if m.getFn == nil {
		panic("unexpected call to GetByID")
	}
	return m.getFn(ctx, id)
}

func (m *mockRepo) List(ctx context.Context, limit, offset int) ([]api.Task, error) {
	if m.listFn == nil {
		panic("unexpected call to List")
	}
	return m.listFn(ctx, limit, offset)
}

func (m *mockRepo) Update(ctx context.Context, task *api.Task) error {
	if m.updateFn == nil {
		panic("unexpected call to Update")
	}
	return m.updateFn(ctx, task)
}

func (m *mockRepo) Delete(ctx context.Context, id int64) error {
	if m.deleteFn == nil {
		panic("unexpected call to Delete")
	}
	return m.deleteFn(ctx, id)
}

func (m *mockRepo) WithTx(ctx context.Context, fn func(api.TaskRepository) error) error {
	if m.withTxFn == nil {
		panic("unexpected call to WithTx")
	}
	return m.withTxFn(ctx, fn)
}

// do sends one request through the handler and returns the recorder.
func do(t *testing.T, repo api.TaskRepository, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, target, nil)
	} else {
		r = httptest.NewRequest(method, target, strings.NewReader(body))
	}
	rec := httptest.NewRecorder()
	api.NewServer(repo).ServeHTTP(rec, r)
	return rec
}

// decodeJSON fails the test if the body is not valid JSON for v, which also
// catches handlers that forget to write a body at all.
func decodeJSON(t *testing.T, rec *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), v); err != nil {
		t.Fatalf("response body is not the expected JSON: %v\nbody: %q", err, rec.Body.String())
	}
}

// wantContentType enforces the project constraint that every JSON response
// says so in its header.
func wantContentType(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
}

// wantError decodes an {"error":"..."} body and returns the message.
func wantError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	wantContentType(t, rec)
	var body struct {
		Error string `json:"error"`
	}
	decodeJSON(t, rec, &body)
	if body.Error == "" {
		t.Fatalf(`error response has no "error" key: %q`, rec.Body.String())
	}
	return body.Error
}

func TestCreateTask(t *testing.T) {
	t.Run("valid body", func(t *testing.T) {
		repo := &mockRepo{
			createFn: func(_ context.Context, title string) (*api.Task, error) {
				if title != "write the lab" {
					t.Fatalf("Create received title %q, want %q", title, "write the lab")
				}
				return &api.Task{ID: 42, Title: title}, nil
			},
		}
		rec := do(t, repo, http.MethodPost, "/tasks", `{"title":"write the lab"}`)

		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
		}
		wantContentType(t, rec)
		var got api.Task
		decodeJSON(t, rec, &got)
		if got.ID != 42 || got.Title != "write the lab" || got.Done {
			t.Fatalf("body = %+v, want id=42 title=%q done=false", got, "write the lab")
		}
	})

	t.Run("empty title", func(t *testing.T) {
		// createFn deliberately unset: validation must reject the request
		// before the repository is ever consulted.
		rec := do(t, &mockRepo{}, http.MethodPost, "/tasks", `{"title":""}`)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
		if msg := wantError(t, rec); msg != "title required" {
			t.Fatalf(`error = %q, want "title required"`, msg)
		}
	})

	t.Run("missing title field", func(t *testing.T) {
		rec := do(t, &mockRepo{}, http.MethodPost, "/tasks", `{}`)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
		if msg := wantError(t, rec); msg != "title required" {
			t.Fatalf(`error = %q, want "title required"`, msg)
		}
	})

	t.Run("malformed json", func(t *testing.T) {
		rec := do(t, &mockRepo{}, http.MethodPost, "/tasks", `{"title": nope`)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
		wantError(t, rec)
	})

	t.Run("duplicate title", func(t *testing.T) {
		repo := &mockRepo{
			createFn: func(context.Context, string) (*api.Task, error) {
				// Wrapped, the way the postgres package returns it.
				// errors.Is unwraps; == would not.
				return nil, fmt.Errorf("create task: %w", api.ErrDuplicate)
			},
		}
		rec := do(t, repo, http.MethodPost, "/tasks", `{"title":"write the lab"}`)

		if rec.Code != http.StatusConflict {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusConflict)
		}
		wantError(t, rec)
	})

	t.Run("repository failure", func(t *testing.T) {
		repo := &mockRepo{
			createFn: func(context.Context, string) (*api.Task, error) {
				return nil, errors.New("connection refused")
			},
		}
		rec := do(t, repo, http.MethodPost, "/tasks", `{"title":"write the lab"}`)

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
		}
		wantError(t, rec)
	})
}

// rejectingRepo is a repository that must never be called. Every method fails
// the test by name and says what it was handed, which is the real assertion in
// TestTitleValidation: validation that happens after the write is not
// validation.
//
// The other tests in this file pass a bare &mockRepo{}, whose unset fields
// panic on an unexpected call. That is the louder option and it is the right
// one for a single case. It is the wrong one here: a panic takes the whole
// test binary down with it, so the first bad title would hide the other five,
// and a table exists precisely to report all of its rows.
func rejectingRepo(t *testing.T) *mockRepo {
	t.Helper()
	return &mockRepo{
		createFn: func(_ context.Context, title string) (*api.Task, error) {
			t.Errorf("repository Create was called with %q; validation must reject it before storage", title)
			return &api.Task{ID: 1, Title: title}, nil
		},
		updateFn: func(_ context.Context, task *api.Task) error {
			t.Errorf("repository Update was called with %q; validation must reject it before storage", task.Title)
			return nil
		},
	}
}

// TestTitleValidation runs every rejectable title against both routes that
// accept one, and asserts twice per row: the client gets the right 400, and
// the repository was never consulted at all.
func TestTitleValidation(t *testing.T) {
	cases := []struct {
		name      string
		title     string
		wantError string
	}{
		{
			// A title of spaces is not a title. Trim, then check, or " "
			// is a perfectly good one-character task forever.
			name:      "whitespace only",
			title:     "   \t\n  ",
			wantError: "title required",
		},
		{
			// Legal JSON, legal Go string, and Postgres documents that it
			// cannot be stored in a character type. Rejected here it is a
			// 400; passed through it is a 500 from the INSERT.
			name:      "null byte",
			title:     "tidy the kitchen\x00",
			wantError: "title contains a null byte",
		},
		{
			name:      "one rune over the limit",
			title:     strings.Repeat("a", api.MaxTitleRunes+1),
			wantError: "title too long",
		},
	}

	routes := []struct {
		method string
		path   string
		body   func(title string) string
	}{
		{http.MethodPost, "/tasks", func(title string) string {
			return mustJSON(map[string]any{"title": title})
		}},
		{http.MethodPut, "/tasks/3", func(title string) string {
			return mustJSON(map[string]any{"title": title, "done": true})
		}},
	}

	for _, tc := range cases {
		for _, route := range routes {
			t.Run(tc.name+" via "+route.method, func(t *testing.T) {
				rec := do(t, rejectingRepo(t), route.method, route.path, route.body(tc.title))

				if rec.Code != http.StatusBadRequest {
					t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
					return
				}
				if msg := wantError(t, rec); msg != tc.wantError {
					t.Errorf("error = %q, want %q", msg, tc.wantError)
				}
			})
		}
	}
}

// TestTitleAtTheLimitIsAccepted is the other half of the bound. A limit that
// rejects the value it says it allows is an off-by-one nobody notices until a
// client hits it.
func TestTitleAtTheLimitIsAccepted(t *testing.T) {
	title := strings.Repeat("a", api.MaxTitleRunes)
	repo := &mockRepo{
		createFn: func(_ context.Context, got string) (*api.Task, error) {
			return &api.Task{ID: 1, Title: got}, nil
		},
	}
	rec := do(t, repo, http.MethodPost, "/tasks", mustJSON(map[string]any{"title": title}))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d: a title of exactly MaxTitleRunes is legal", rec.Code, http.StatusCreated)
	}
}

// TestTitleIsCountedInRunesNotBytes pins which unit the bound uses. The title
// below is well under the rune limit and well over it in bytes, so a handler
// that reaches for len() rejects a title it should accept. Every non-ASCII
// language on earth finds this bug for you eventually.
func TestTitleIsCountedInRunesNotBytes(t *testing.T) {
	// Each of these runes costs 3 bytes in UTF-8.
	title := strings.Repeat("日", api.MaxTitleRunes)
	if len(title) <= api.MaxTitleRunes {
		t.Fatalf("test is not testing what it thinks: %d bytes", len(title))
	}
	repo := &mockRepo{
		createFn: func(_ context.Context, got string) (*api.Task, error) {
			return &api.Task{ID: 1, Title: got}, nil
		},
	}
	rec := do(t, repo, http.MethodPost, "/tasks", mustJSON(map[string]any{"title": title}))
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d.\n%d runes is at the limit; %d bytes is over it. len() counts bytes, utf8.RuneCountInString counts runes.",
			rec.Code, http.StatusCreated, api.MaxTitleRunes, len(title))
	}
}

// TestTitleIsTrimmedBeforeItIsStored proves the cleaned value is the stored
// value. Validating a trimmed copy and then storing the raw one is a real and
// popular bug: every check passes and the row is still wrong.
func TestTitleIsTrimmedBeforeItIsStored(t *testing.T) {
	var got string
	repo := &mockRepo{
		createFn: func(_ context.Context, title string) (*api.Task, error) {
			got = title
			return &api.Task{ID: 1, Title: title}, nil
		},
	}
	rec := do(t, repo, http.MethodPost, "/tasks", `{"title":"  padded  "}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
	}
	if got != "padded" {
		t.Fatalf("repository received %q, want %q: validate the trimmed value and store the same one", got, "padded")
	}
}

// TestOversizedBodyIsRejected is the one case none of the title checks can
// catch. The body is valid JSON and its title is perfectly fine; there is
// simply far too much of everything else. Without a cap on r.Body, Decode
// reads all of it into memory and answers 201, and the only bound on what a
// stranger can make this process allocate is their upload bandwidth.
func TestOversizedBodyIsRejected(t *testing.T) {
	body := mustJSON(map[string]any{
		"title": "perfectly fine title",
		"junk":  strings.Repeat("x", api.MaxBodyBytes*2),
	})
	if len(body) <= api.MaxBodyBytes {
		t.Fatalf("test body is only %d bytes, under the %d cap", len(body), api.MaxBodyBytes)
	}

	// No createFn: an oversized body must never reach the repository.
	rec := do(t, &mockRepo{}, http.MethodPost, "/tasks", body)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d.\nThe title is valid, so no title check can reject this: the body has to be capped before Decode reads it. http.MaxBytesReader is the cap; errors.As on *http.MaxBytesError is how you tell it apart from malformed JSON.",
			rec.Code, http.StatusRequestEntityTooLarge)
	}
	wantError(t, rec)
}

// mustJSON builds a request body. Going through encoding/json rather than
// string concatenation means the null-byte case above is transported the way
// a real client would send it, as a u0000 escape, rather than as something
// this test invented.
func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func TestGetTask(t *testing.T) {
	t.Run("exists", func(t *testing.T) {
		repo := &mockRepo{
			getFn: func(_ context.Context, id int64) (*api.Task, error) {
				if id != 7 {
					t.Fatalf("GetByID received id %d, want 7", id)
				}
				return &api.Task{ID: 7, Title: "ship it", Done: true}, nil
			},
		}
		rec := do(t, repo, http.MethodGet, "/tasks/7", "")

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		wantContentType(t, rec)
		var got api.Task
		decodeJSON(t, rec, &got)
		if got.ID != 7 || got.Title != "ship it" || !got.Done {
			t.Fatalf("body = %+v, want id=7 title=%q done=true", got, "ship it")
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &mockRepo{
			getFn: func(context.Context, int64) (*api.Task, error) {
				return nil, api.ErrNotFound
			},
		}
		rec := do(t, repo, http.MethodGet, "/tasks/9999", "")

		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		wantError(t, rec)
	})
}

func TestListTasks(t *testing.T) {
	repo := &mockRepo{
		listFn: func(_ context.Context, limit, offset int) ([]api.Task, error) {
			if limit != 2 || offset != 4 {
				t.Fatalf("List received (limit=%d, offset=%d), want (2, 4)", limit, offset)
			}
			return []api.Task{
				{ID: 5, Title: "five"},
				{ID: 6, Title: "six"},
			}, nil
		},
	}
	rec := do(t, repo, http.MethodGet, "/tasks?limit=2&offset=4", "")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	wantContentType(t, rec)
	var got []api.Task
	decodeJSON(t, rec, &got)
	if len(got) != 2 || got[0].ID != 5 || got[1].ID != 6 {
		t.Fatalf("body = %+v, want tasks 5 and 6", got)
	}
}

func TestUpdateTask(t *testing.T) {
	t.Run("updates and echoes", func(t *testing.T) {
		repo := &mockRepo{
			updateFn: func(_ context.Context, task *api.Task) error {
				if task.ID != 3 || task.Title != "renamed" || !task.Done {
					t.Fatalf("Update received %+v, want id=3 title=%q done=true", task, "renamed")
				}
				return nil
			},
		}
		rec := do(t, repo, http.MethodPut, "/tasks/3", `{"title":"renamed","done":true}`)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		wantContentType(t, rec)
		var got api.Task
		decodeJSON(t, rec, &got)
		if got.ID != 3 || got.Title != "renamed" || !got.Done {
			t.Fatalf("body = %+v, want the updated task", got)
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &mockRepo{
			updateFn: func(context.Context, *api.Task) error {
				return api.ErrNotFound
			},
		}
		rec := do(t, repo, http.MethodPut, "/tasks/9999", `{"title":"renamed","done":false}`)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		wantError(t, rec)
	})

	t.Run("empty title", func(t *testing.T) {
		rec := do(t, &mockRepo{}, http.MethodPut, "/tasks/3", `{"title":"","done":true}`)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
		if msg := wantError(t, rec); msg != "title required" {
			t.Fatalf(`error = %q, want "title required"`, msg)
		}
	})
}

func TestDeleteTask(t *testing.T) {
	t.Run("deletes", func(t *testing.T) {
		var gotID int64
		repo := &mockRepo{
			deleteFn: func(_ context.Context, id int64) error {
				gotID = id
				return nil
			},
		}
		rec := do(t, repo, http.MethodDelete, "/tasks/11", "")

		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
		}
		if gotID != 11 {
			t.Fatalf("Delete received id %d, want 11", gotID)
		}
		if rec.Body.Len() != 0 {
			t.Fatalf("204 must have no body, got %q", rec.Body.String())
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &mockRepo{
			deleteFn: func(context.Context, int64) error {
				return api.ErrNotFound
			},
		}
		rec := do(t, repo, http.MethodDelete, "/tasks/9999", "")

		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
		wantError(t, rec)
	})
}
