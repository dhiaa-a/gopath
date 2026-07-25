// The suite pins behavior, not representation: it drives the package
// only through its public functions and compares results against the
// UNTYPED constants below. An untyped Go constant has no fixed type
// until a context demands one, so `pending` converts implicitly to
// string against the starter and to the named status type the refactor
// introduces. The same suite compiles against both shapes, which is
// exactly what makes the signature migration safe to do.
package order_test

import (
	"testing"

	order "gopath.dev/labs/idioms/stringly-typed"
)

// Deliberately untyped: no type on any of these. See the comment above.
const (
	pending   = "pending"
	picking   = "picking"
	shipped   = "shipped"
	delivered = "delivered"
	cancelled = "cancelled"

	bogus = "misplaced" // not a status, never will be
)

func TestAdvanceWalksTheHappyPath(t *testing.T) {
	got, err := order.Advance(pending)
	if err != nil {
		t.Fatalf("Advance(pending): %v", err)
	}
	if got != picking {
		t.Fatalf("Advance(pending) = %q, want %q", got, picking)
	}

	got, err = order.Advance(got)
	if err != nil {
		t.Fatalf("Advance(picking): %v", err)
	}
	if got != shipped {
		t.Fatalf("Advance(picking) = %q, want %q", got, shipped)
	}

	got, err = order.Advance(got)
	if err != nil {
		t.Fatalf("Advance(shipped): %v", err)
	}
	if got != delivered {
		t.Fatalf("Advance(shipped) = %q, want %q", got, delivered)
	}
}

func TestCancelBeforeShipping(t *testing.T) {
	got, err := order.Cancel(pending)
	if err != nil {
		t.Fatalf("Cancel(pending): %v", err)
	}
	if got != cancelled {
		t.Fatalf("Cancel(pending) = %q, want %q", got, cancelled)
	}

	got, err = order.Cancel(picking)
	if err != nil {
		t.Fatalf("Cancel(picking): %v", err)
	}
	if got != cancelled {
		t.Fatalf("Cancel(picking) = %q, want %q", got, cancelled)
	}
}

// requireErr fails the test unless the transition was refused. The
// assertion lives here, right next to the call, rather than in the loop:
// handing the package's error back out of a table closure is an unwrapped
// return across a package boundary, and a test has nothing to wrap it
// into. The linter is right about that even in a suite.
func requireErr(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("got nil, want error")
	}
}

func TestRefusedTransitions(t *testing.T) {
	tests := []struct {
		name string
		op   func(t *testing.T)
	}{
		{"advance a delivered order", func(t *testing.T) { _, err := order.Advance(delivered); requireErr(t, err) }},
		{"advance a cancelled order", func(t *testing.T) { _, err := order.Advance(cancelled); requireErr(t, err) }},
		{"advance an unknown status", func(t *testing.T) { _, err := order.Advance(bogus); requireErr(t, err) }},
		{"advance the empty string", func(t *testing.T) { _, err := order.Advance(""); requireErr(t, err) }},
		{"cancel a shipped order", func(t *testing.T) { _, err := order.Cancel(shipped); requireErr(t, err) }},
		{"cancel a delivered order", func(t *testing.T) { _, err := order.Cancel(delivered); requireErr(t, err) }},
		{"cancel a cancelled order", func(t *testing.T) { _, err := order.Cancel(cancelled); requireErr(t, err) }},
		{"cancel an unknown status", func(t *testing.T) { _, err := order.Cancel(bogus); requireErr(t, err) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, tt.op)
	}
}

func TestCancellationWindow(t *testing.T) {
	tests := []struct {
		name string
		got  bool
		want bool
	}{
		{"pending is cancellable", order.CanCancel(pending), true},
		{"picking is cancellable", order.CanCancel(picking), true},
		{"shipped is not cancellable", order.CanCancel(shipped), false},
		{"delivered is not cancellable", order.CanCancel(delivered), false},
		{"cancelled is not cancellable", order.CanCancel(cancelled), false},
		{"unknown is not cancellable", order.CanCancel(bogus), false},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s: CanCancel = %v, want %v", tt.name, tt.got, tt.want)
		}
	}
}

func TestTerminalStatuses(t *testing.T) {
	tests := []struct {
		name string
		got  bool
		want bool
	}{
		{"pending is not terminal", order.IsTerminal(pending), false},
		{"picking is not terminal", order.IsTerminal(picking), false},
		{"shipped is not terminal", order.IsTerminal(shipped), false},
		{"delivered is terminal", order.IsTerminal(delivered), true},
		{"cancelled is terminal", order.IsTerminal(cancelled), true},
		{"unknown is not terminal", order.IsTerminal(bogus), false},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s: IsTerminal = %v, want %v", tt.name, tt.got, tt.want)
		}
	}
}

func TestValidity(t *testing.T) {
	tests := []struct {
		name string
		got  bool
		want bool
	}{
		{"pending is a status", order.IsValid(pending), true},
		{"picking is a status", order.IsValid(picking), true},
		{"shipped is a status", order.IsValid(shipped), true},
		{"delivered is a status", order.IsValid(delivered), true},
		{"cancelled is a status", order.IsValid(cancelled), true},
		{"bogus is not a status", order.IsValid(bogus), false},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s: IsValid = %v, want %v", tt.name, tt.got, tt.want)
		}
	}
}

func TestParseOwnsNormalization(t *testing.T) {
	got, err := order.Parse("  Shipped ")
	if err != nil {
		t.Fatalf("Parse of padded mixed case: %v", err)
	}
	if got != shipped {
		t.Fatalf("Parse of padded mixed case = %q, want %q", got, shipped)
	}

	got, err = order.Parse("PENDING")
	if err != nil {
		t.Fatalf("Parse of upper case: %v", err)
	}
	if got != pending {
		t.Fatalf("Parse of upper case = %q, want %q", got, pending)
	}

	got, err = order.Parse(cancelled)
	if err != nil {
		t.Fatalf("Parse of canonical form: %v", err)
	}
	if got != cancelled {
		t.Fatalf("Parse of canonical form = %q, want %q", got, cancelled)
	}
}

func TestParseRejectsGarbage(t *testing.T) {
	if _, err := order.Parse(bogus); err == nil {
		t.Fatal("Parse accepted a word that is not a status")
	}
	if _, err := order.Parse(""); err == nil {
		t.Fatal("Parse accepted the empty string")
	}
}
