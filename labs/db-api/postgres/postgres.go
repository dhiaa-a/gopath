// Package postgres is the pgx-backed implementation of api.TaskRepository.
// It is the only package in this lab that knows SQL exists; the handlers
// upstairs see nothing but the interface.
package postgres

import "gopath.dev/labs/db-api/api"

// The compiler enforces the contract before any test runs: if Repository
// drifts from the interface, the build breaks here, in both the starter and
// the solution.
var _ api.TaskRepository = (*Repository)(nil)
