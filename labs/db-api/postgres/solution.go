//go:build solution

// Reference implementation of the Postgres repository. Do not open this
// until your own run is green.
package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"gopath.dev/labs/db-api/api"
)

// querier is the subset of pgx that queries need. Both *pgxpool.Pool and
// pgx.Tx satisfy it, which is the entire WithTx mechanism: the same method
// bodies run pooled or transaction-scoped depending on what db holds.
type querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Repository implements api.TaskRepository on top of Postgres.
type Repository struct {
	db   querier
	pool *pgxpool.Pool // nil when this Repository is transaction-scoped
}

// NewRepository wraps a connection pool.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{db: pool, pool: pool}
}

// wrap adds the failing operation to the error while keeping the chain
// intact for errors.Is. A unique violation (SQLSTATE 23505) becomes
// api.ErrDuplicate here, in one place, identified by code rather than by
// matching an error string that changes across locales and versions.
func wrap(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return fmt.Errorf("%s: %w", op, api.ErrDuplicate)
	}
	return fmt.Errorf("%s: %w", op, err)
}

// Create inserts a task and returns it with the ID Postgres assigned.
// RETURNING gets the row back in the same round trip as the insert.
func (r *Repository) Create(ctx context.Context, title string) (*api.Task, error) {
	var t api.Task
	err := r.db.QueryRow(ctx,
		`INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done`,
		title,
	).Scan(&t.ID, &t.Title, &t.Done)
	if err != nil {
		return nil, wrap("create task", err)
	}
	return &t, nil
}

// GetByID fetches one task or api.ErrNotFound.
func (r *Repository) GetByID(ctx context.Context, id int64) (*api.Task, error) {
	var t api.Task
	err := r.db.QueryRow(ctx,
		`SELECT id, title, done FROM tasks WHERE id = $1`,
		id,
	).Scan(&t.ID, &t.Title, &t.Done)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("get task %d: %w", id, api.ErrNotFound)
	}
	if err != nil {
		return nil, wrap("get task", err)
	}
	return &t, nil
}

// List returns up to limit tasks in ID order, skipping offset rows.
func (r *Repository) List(ctx context.Context, limit, offset int) ([]api.Task, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, title, done FROM tasks ORDER BY id LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, wrap("list tasks", err)
	}
	defer rows.Close()

	var tasks []api.Task
	for rows.Next() {
		var t api.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Done); err != nil {
			return nil, wrap("list tasks: scan", err)
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, wrap("list tasks", err)
	}
	return tasks, nil
}

// Update rewrites title and done for task.ID. There is no row to scan, so
// "not found" is detected from the command tag instead of pgx.ErrNoRows.
func (r *Repository) Update(ctx context.Context, task *api.Task) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE tasks SET title = $1, done = $2 WHERE id = $3`,
		task.Title, task.Done, task.ID,
	)
	if err != nil {
		return wrap("update task", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("update task %d: %w", task.ID, api.ErrNotFound)
	}
	return nil
}

// Delete removes one task or returns api.ErrNotFound.
func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return wrap("delete task", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("delete task %d: %w", id, api.ErrNotFound)
	}
	return nil
}

// WithTx runs fn against a transaction-scoped Repository: commit if fn
// returns nil, roll back otherwise. The deferred Rollback also covers a
// panic inside fn; after a successful Commit it is a documented no-op.
func (r *Repository) WithTx(ctx context.Context, fn func(api.TaskRepository) error) error {
	if r.pool == nil {
		// Already inside a transaction: run fn against the same one.
		// Nested transactions would need savepoints; this lab does not.
		return fn(r)
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return wrap("begin tx", err)
	}
	defer tx.Rollback(ctx) // no-op once Commit has succeeded

	if err := fn(&Repository{db: tx}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return wrap("commit tx", err)
	}
	return nil
}
