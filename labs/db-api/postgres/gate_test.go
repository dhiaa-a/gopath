//go:build gate

// The round-trip gate for the repository. It needs no Postgres and no timing:
// round-trip count is a property of the SQL you write, not of the machine or
// the network, so the same code reaches the database the same number of times
// everywhere. That is why this is an exact assertion with no threshold.
//
//	go test -tags 'solution gate' -run TestGate ./...
//
// Latency against a real database is dominated by round trips: each Query,
// QueryRow, or Exec is one network hop to Postgres and back, and the hops
// serialize. The single most common way a correct repository is still a slow
// one is doing two hops where one would do, so this gate counts them. It runs
// against a countingQuerier, a querier that executes no SQL at all and only
// tallies how many times each method is called.
package postgres

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"gopath.dev/labs/db-api/api"
)

// countingQuerier satisfies the same querier interface *pgxpool.Pool and
// pgx.Tx do, so a Repository built around it runs its real method bodies
// while every database hop is intercepted and counted here.
type countingQuerier struct {
	exec, query, queryRow int
}

func (c *countingQuerier) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	c.exec++
	// Report one row affected so Update/Delete see a hit, not ErrNotFound.
	return pgconn.NewCommandTag("UPDATE 1"), nil
}

func (c *countingQuerier) Query(context.Context, string, ...any) (pgx.Rows, error) {
	c.query++
	return &emptyRows{}, nil
}

func (c *countingQuerier) QueryRow(context.Context, string, ...any) pgx.Row {
	c.queryRow++
	return cannedRow{}
}

func (c *countingQuerier) total() int { return c.exec + c.query + c.queryRow }

// cannedRow fills whatever a caller scans so a QueryRow-based method (Create,
// GetByID) completes without a real row behind it.
type cannedRow struct{}

func (cannedRow) Scan(dest ...any) error {
	for _, d := range dest {
		switch p := d.(type) {
		case *int64:
			*p = 1
		case *string:
			*p = "canned"
		case *bool:
			*p = false
		}
	}
	return nil
}

// emptyRows is a pgx.Rows that yields no rows, so List returns an empty slice
// with no error. Only Next, Err, and Close are exercised; the rest exist to
// satisfy the interface.
type emptyRows struct{}

func (*emptyRows) Close()                                       {}
func (*emptyRows) Err() error                                   { return nil }
func (*emptyRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (*emptyRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (*emptyRows) Next() bool                                   { return false }
func (*emptyRows) Scan(...any) error                            { return nil }
func (*emptyRows) Values() ([]any, error)                       { return nil, nil }
func (*emptyRows) RawValues() [][]byte                          { return nil }
func (*emptyRows) Conn() *pgx.Conn                              { return nil }

// TestGateCreateSingleRoundTrip is the project's headline metric: Create is
// one hop, not two. INSERT ... RETURNING gets the assigned id back in the same
// statement that writes the row; the habit carried over from other databases,
// INSERT and then a separate SELECT of the id, is two round trips for the same
// result. The gate pins the hop to a single QueryRow: an Exec (write) followed
// by a QueryRow (read-back) would show up as total 2, and a bare Exec with no
// RETURNING would show queryRow 0.
func TestGateCreateSingleRoundTrip(t *testing.T) {
	q := &countingQuerier{}
	r := &Repository{db: q}

	if _, err := r.Create(context.Background(), "write the docs"); err != nil {
		t.Fatalf("Create against the counting querier returned %v; make `go test ./...` green before the gate", err)
	}

	if q.total() != 1 {
		t.Fatalf("round-trip gate: Create issued %d database hops (exec=%d query=%d queryRow=%d), want exactly 1; use INSERT ... RETURNING to read the assigned row back in the same statement instead of a second SELECT",
			q.total(), q.exec, q.query, q.queryRow)
	}
	if q.queryRow != 1 {
		t.Fatalf("round-trip gate: Create's single hop was not a QueryRow (exec=%d query=%d queryRow=%d); RETURNING makes the INSERT return a row, so read it with QueryRow(...).Scan, not a bare Exec",
			q.exec, q.query, q.queryRow)
	}
	t.Logf("round-trip gate: Create = 1 hop (queryRow), via INSERT ... RETURNING")
}

// TestGateCrudNoRedundantQueries walks the whole surface once and pins the
// total to five hops: Create, GetByID, List, Update, Delete, one each. It is
// the N+1 tripwire. A List that fetches ids and then loops a per-row SELECT,
// or any method that reads a row back after writing it, pushes the total above
// five and fails here with the per-method breakdown.
func TestGateCrudNoRedundantQueries(t *testing.T) {
	q := &countingQuerier{}
	r := &Repository{db: q}
	ctx := context.Background()

	if _, err := r.Create(ctx, "a"); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := r.GetByID(ctx, 1); err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if _, err := r.List(ctx, 10, 0); err != nil {
		t.Fatalf("List: %v", err)
	}
	if err := r.Update(ctx, &api.Task{ID: 1, Title: "a", Done: true}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := r.Delete(ctx, 1); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	const want = 5
	if q.total() != want {
		t.Fatalf("round-trip gate: one Create+GetByID+List+Update+Delete issued %d database hops (exec=%d query=%d queryRow=%d), want %d (one per operation); a read-back after a write or a per-row query in List is the usual cause",
			q.total(), q.exec, q.query, q.queryRow, want)
	}
	t.Logf("round-trip gate: full CRUD = %d hops (exec=%d query=%d queryRow=%d)", q.total(), q.exec, q.query, q.queryRow)
}
