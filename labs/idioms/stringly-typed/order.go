//go:build !solution

// Package order tracks a shop order through its lifecycle: pending,
// picking, shipped, delivered, with cancellation while the order is
// still in the warehouse.
package order

import (
	"errors"
	"fmt"
	"strings"
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

// IsValid reports whether status is one of the five lifecycle statuses.
func IsValid(status string) bool {
	return status == "pending" ||
		status == "picking" ||
		status == "shipped" ||
		status == "delivered" ||
		status == "cancelled"
}

// Parse checks a raw status value, as read from a request or a CSV row,
// and returns it in canonical lower-case form.
func Parse(raw string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "pending" || s == "picking" || s == "shipped" || s == "delivered" || s == "cancelled" {
		return s, nil
	}
	return "", fmt.Errorf("parse status %q: %w", raw, ErrUnknownStatus)
}

// Advance moves an order one step along the happy path and returns the
// new status.
func Advance(status string) (string, error) {
	s := strings.ToLower(status)
	if s == "pending" {
		return "picking", nil
	} else if s == "picking" {
		return "shipped", nil
	} else if s == "shipped" {
		return "delivered", nil
	} else if s == "delivered" || s == "cancelled" {
		return "", fmt.Errorf("advance from %q: %w", status, ErrTerminal)
	}
	return "", fmt.Errorf("advance from %q: %w", status, ErrUnknownStatus)
}

// Cancel cancels an order that has not yet shipped and returns the new
// status.
func Cancel(status string) (string, error) {
	s := strings.ToLower(status)
	if !IsValid(s) {
		return "", fmt.Errorf("cancel %q: %w", status, ErrUnknownStatus)
	}
	if s == "pending" || s == "picking" {
		return "cancelled", nil
	}
	return "", fmt.Errorf("cancel %q: %w", status, ErrCannotCancel)
}

// CanCancel reports whether an order in this status can still be
// cancelled.
func CanCancel(status string) bool {
	s := strings.ToLower(status)
	return s == "pending" || s == "picking"
}

// IsTerminal reports whether status is one an order can never leave.
func IsTerminal(status string) bool {
	s := strings.ToLower(status)
	return s == "delivered" || s == "cancelled"
}
