//go:build !solution

package api

// This file is yours. The suite in handlers_test.go grades NewServer through
// nothing but HTTP: it injects a mock TaskRepository and checks status codes,
// JSON bodies, and the Content-Type header. How you structure the inside is
// your call; the constraints from the project page still bind:
//
//   - The repository arrives through this constructor. No globals.
//   - Go 1.22 method-specific patterns ("POST /tasks"), no third-party
//     router. Read path parameters with r.PathValue("id").
//   - Every error response is JSON of the shape {"error":"message"}.
//   - Every response body is JSON and carries Content-Type: application/json.
//   - Repository sentinels map to statuses: ErrNotFound to 404, ErrDuplicate
//     to 409, anything else to 500. Use errors.Is; repositories wrap.
//
// The route table to register:
//
//	POST   /tasks        create from body {"title":"..."}: 201 + task JSON
//	GET    /tasks        list, ?limit= and ?offset= optional: 200 + array
//	GET    /tasks/{id}   200 + task JSON, or 404
//	PUT    /tasks/{id}   update from body {"title":"...","done":bool}: 200
//	DELETE /tasks/{id}   204, no body
//
// Both routes that accept a title validate it identically, before the
// repository is consulted at all. The suite's mock has no functions set on
// the validation cases, so a handler that writes first panics rather than
// quietly passing:
//
//   - Cap r.Body at MaxBodyBytes with http.MaxBytesReader BEFORE decoding.
//     Over the cap is 413 {"error":"request body too large"}, which
//     errors.As on *http.MaxBytesError distinguishes from malformed JSON
//     (400 {"error":"invalid json"}).
//   - Trim the title. Empty after trimming is 400 {"error":"title required"},
//     and the trimmed value is the one you store.
//   - A title containing a null byte is 400 {"error":"title contains a null
//     byte"}. Postgres cannot store code point zero in a text column, so
//     this is a 400 you must raise yourself or a 500 the database raises for
//     you.
//   - Over MaxTitleRunes is 400 {"error":"title too long"}. Runes, not
//     bytes: utf8.RuneCountInString, not len.
//
// None of that validation is what stops SQL injection. That job belongs to
// the $1 placeholders in postgres/repo.go and cannot be done up here.
//
// A fresh clone serves 404 for everything, so the first test run fails with
// "status = 404, want ..." on every case. That list is your to-do list.

import "net/http"

// server owns the injected repository. Handler methods hang off it so every
// handler reaches storage through s.repo and nothing else.
type server struct {
	repo TaskRepository
}

// NewServer wires the routes and returns the root handler. This constructor
// is the entire public surface of the package's HTTP side: main.go calls it
// with a Postgres-backed repository, the tests call it with a mock.
func NewServer(repo TaskRepository) http.Handler {
	s := &server{repo: repo}
	_ = s

	mux := http.NewServeMux()
	// TODO: register the five method-specific routes listed above and
	// implement their handlers as methods on *server.
	return mux
}
