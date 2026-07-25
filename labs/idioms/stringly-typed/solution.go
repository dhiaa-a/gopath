//go:build solution

// Package order tracks a shop order through its lifecycle: pending,
// picking, shipped, delivered, with cancellation while the order is
// still in the warehouse.
package order

import (
	"errors"
	"fmt"
	"strings"
)

// Status is an order's position in the lifecycle. It is a named string
// type: identical to string at runtime, but a distinct type to the
// compiler, so a status can no longer be confused with any other string
// in the program. The legal values are the constants below.
type Status string

// The five lifecycle statuses. These are the only values this package
// ever produces; raw input becomes one of them through Parse.
const (
	Pending   Status = "pending"
	Picking   Status = "picking"
	Shipped   Status = "shipped"
	Delivered Status = "delivered"
	Cancelled Status = "cancelled"
)

// Sentinel errors callers can test with errors.Is.
var (
	// ErrUnknownStatus is returned when a status is not one the lifecycle knows.
	ErrUnknownStatus = errors.New("unknown status")
	// ErrTerminal is returned when advancing an order that is already finished.
	ErrTerminal = errors.New("order is in a terminal status")
	// ErrCannotCancel is returned when cancelling an order that is past cancellation.
	ErrCannotCancel = errors.New("order can no longer be cancelled")
)

// lifecycle is the whole state machine in one table: each status, its
// happy-path successor (empty for terminal statuses), and whether the
// order can still be cancelled from it. Membership doubles as validity.
// Changing the machine means editing this table and nothing else.
var lifecycle = map[Status]struct {
	next        Status
	cancellable bool
}{
	Pending:   {next: Picking, cancellable: true},
	Picking:   {next: Shipped, cancellable: true},
	Shipped:   {next: Delivered},
	Delivered: {},
	Cancelled: {},
}

// Parse converts a raw status value, as read from a request or a CSV
// row, into a Status. It is the one place raw strings come in, and the
// one owner of normalization and validation.
func Parse(raw string) (Status, error) {
	s := Status(strings.ToLower(strings.TrimSpace(raw)))
	if _, ok := lifecycle[s]; !ok {
		return "", fmt.Errorf("parse status %q: %w", raw, ErrUnknownStatus)
	}
	return s, nil
}

// IsValid reports whether status is one of the five lifecycle statuses.
func IsValid(status Status) bool {
	_, ok := lifecycle[status]
	return ok
}

// Advance moves an order one step along the happy path and returns the
// new status.
func Advance(status Status) (Status, error) {
	entry, ok := lifecycle[status]
	if !ok {
		return "", fmt.Errorf("advance from %q: %w", status, ErrUnknownStatus)
	}
	if entry.next == "" {
		return "", fmt.Errorf("advance from %q: %w", status, ErrTerminal)
	}
	return entry.next, nil
}

// Cancel cancels an order that has not yet shipped and returns the new
// status.
func Cancel(status Status) (Status, error) {
	entry, ok := lifecycle[status]
	if !ok {
		return "", fmt.Errorf("cancel %q: %w", status, ErrUnknownStatus)
	}
	if !entry.cancellable {
		return "", fmt.Errorf("cancel %q: %w", status, ErrCannotCancel)
	}
	return Cancelled, nil
}

// CanCancel reports whether an order in this status can still be
// cancelled.
func CanCancel(status Status) bool {
	return lifecycle[status].cancellable
}

// IsTerminal reports whether status is one an order can never leave.
func IsTerminal(status Status) bool {
	entry, ok := lifecycle[status]
	return ok && entry.next == ""
}

// UnmarshalText implements encoding.TextUnmarshaler, so a struct field
// of type Status filled by encoding/json or a config loader is validated
// while it is decoded, not sometime after. A plain string can never grow
// this method; a named type earns it in six lines.
func (s *Status) UnmarshalText(text []byte) error {
	parsed, err := Parse(string(text))
	if err != nil {
		return fmt.Errorf("unmarshal status: %w", err)
	}
	*s = parsed
	return nil
}
