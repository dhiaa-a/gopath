// Package api holds the HTTP layer of the tasks service and, crucially, the
// TaskRepository interface it consumes. The interface lives here, next to the
// handlers, because the consumer defines the contract: the handlers say what
// they need, and any storage backend that satisfies it will do. The postgres
// package in this module is one such backend; the mock in handlers_test.go is
// another, and the whole point of the exercise is that the handlers cannot
// tell them apart.
//
// This file is the pinned contract. The test suite compiles against these
// types, so their shape is fixed; everything in handlers.go is yours.
package api

import (
	"context"
	"errors"
)

// Task is the one resource this API serves. The JSON tags are part of the
// wire contract: clients see id, title, done.
type Task struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

// The two bounds the handlers enforce at the boundary. They are here, in the
// pinned file, because a limit a client can hit is part of the contract: it
// belongs in the same place as the routes and the JSON tags, not buried as a
// magic number three calls down.
const (
	// MaxTitleRunes bounds a title in runes rather than bytes. Postgres
	// TEXT has no length limit worth relying on (a value can reach 1GB), so
	// this bound is a decision about the domain and nothing else. Counting
	// bytes would silently give a Japanese title a third of the room an
	// English one gets, since UTF-8 spends three bytes on most CJK
	// codepoints and one on ASCII.
	MaxTitleRunes = 200

	// MaxBodyBytes caps the request body. Without a cap, json.Decoder reads
	// whatever the client sends: the only limit on memory is the client's
	// patience, and it costs an attacker one curl to find that out.
	MaxBodyBytes = 64 << 10 // 64 KiB
)

// ErrNotFound is returned by a repository when the requested task does not
// exist. Handlers translate it to 404. It is a sentinel so callers can test
// for it with errors.Is even after the repository wraps it with context.
var ErrNotFound = errors.New("task not found")

// ErrDuplicate is returned by a repository when a write violates the unique
// title constraint. Handlers translate it to 409 Conflict instead of a
// generic 500: the client can fix a duplicate title, so it deserves to know.
var ErrDuplicate = errors.New("duplicate task title")

// TaskRepository is everything the handlers need from storage. Note what is
// absent: no *pgxpool.Pool, no SQL, no transactions leaking through except
// via WithTx, which takes a callback so the caller never touches the
// transaction object itself. That absence is what makes the handlers
// testable in microseconds with a hand-rolled mock.
type TaskRepository interface {
	// Create stores a new task with the given title and returns it with
	// its assigned ID. A title that already exists returns ErrDuplicate.
	Create(ctx context.Context, title string) (*Task, error)
	// GetByID returns the task with the given ID, or ErrNotFound.
	GetByID(ctx context.Context, id int64) (*Task, error)
	// List returns up to limit tasks in ID order, skipping offset rows.
	List(ctx context.Context, limit, offset int) ([]Task, error)
	// Update rewrites the task with ID task.ID. It returns ErrNotFound if
	// no such row exists, ErrDuplicate if the new title collides.
	Update(ctx context.Context, task *Task) error
	// Delete removes the task with the given ID, or returns ErrNotFound.
	Delete(ctx context.Context, id int64) error
	// WithTx runs fn against a repository scoped to a single transaction:
	// commit if fn returns nil, roll back if it returns an error. The
	// callback receives a TaskRepository, not a transaction, so a mock can
	// satisfy WithTx by calling fn(mock) directly.
	WithTx(ctx context.Context, fn func(TaskRepository) error) error
}
