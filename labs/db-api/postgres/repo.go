//go:build !solution

package postgres

// This file is yours. The integration suite in integration_test.go grades it
// against a real Postgres, but only when TEST_DATABASE_URL is set; until
// then every stub below returns errNotImplemented and the suite skips.
//
// The constraints from the project page:
//
//   - Every query uses $N placeholders. String concatenation into SQL is
//     injection; the driver never sees where data ends and query begins.
//   - Wrap every database error with context before returning it, and wrap
//     the sentinels the same way: fmt.Errorf("create task: %w", ...) keeps
//     errors.Is working while telling a human which query failed.
//   - pgx.ErrNoRows means api.ErrNotFound. For Update and Delete there is
//     no scan to fail, so check CommandTag.RowsAffected() == 0 instead.
//   - A unique violation is SQLSTATE 23505. Detect it with
//     var pgErr *pgconn.PgError; errors.As(err, &pgErr) and map it to
//     api.ErrDuplicate. Matching on the error string breaks across locales
//     and driver versions; the code is the contract.
//   - WithTx: pool.Begin, defer tx.Rollback(ctx), run fn against a
//     Repository whose db is the transaction, tx.Commit(ctx) only if fn
//     returned nil. Rollback after Commit is a no-op, which is what makes
//     the defer safe.
//
// The db field is deliberately an interface: *pgxpool.Pool and pgx.Tx both
// satisfy it, so the same query methods run pooled or inside a transaction
// depending on how the Repository was built. That one field is the whole
// WithTx trick.

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"gopath.dev/labs/db-api/api"
)

// querier is the subset of pgx that queries need. Both *pgxpool.Pool and
// pgx.Tx satisfy it.
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

var errNotImplemented = errors.New("postgres: not implemented, fill in repo.go")

// Create inserts a task and returns it with the ID Postgres assigned.
// Use INSERT ... RETURNING id, title, done: one round trip, no second query.
func (r *Repository) Create(ctx context.Context, title string) (*api.Task, error) {
	return nil, errNotImplemented
}

// GetByID fetches one task or api.ErrNotFound.
func (r *Repository) GetByID(ctx context.Context, id int64) (*api.Task, error) {
	return nil, errNotImplemented
}

// List returns up to limit tasks in ID order, skipping offset rows.
func (r *Repository) List(ctx context.Context, limit, offset int) ([]api.Task, error) {
	return nil, errNotImplemented
}

// Update rewrites title and done for task.ID.
func (r *Repository) Update(ctx context.Context, task *api.Task) error {
	return errNotImplemented
}

// Delete removes one task or returns api.ErrNotFound.
func (r *Repository) Delete(ctx context.Context, id int64) error {
	return errNotImplemented
}

// WithTx runs fn inside a single transaction.
func (r *Repository) WithTx(ctx context.Context, fn func(api.TaskRepository) error) error {
	return errNotImplemented
}
