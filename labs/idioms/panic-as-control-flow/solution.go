//go:build solution

// Package ledger ingests transaction lines in a tiny CSV shape
// ("account,kind,amount,memo") and tracks per-account balances in cents.
package ledger

import (
	"errors"
	"fmt"
	"strings"
)

// Sentinel errors callers can test with errors.Is. One named value per
// way a post can fail; the panic strings in the starter carried the same
// six distinctions and lost them at the recover.
var (
	// ErrMalformedLine is returned when a line does not have exactly
	// four comma-separated fields.
	ErrMalformedLine = errors.New("malformed entry line")
	// ErrNoAccount is returned when a line names no account.
	ErrNoAccount = errors.New("empty account name")
	// ErrUnknownKind is returned when the kind field is neither
	// "deposit" nor "withdraw".
	ErrUnknownKind = errors.New("unknown entry kind")
	// ErrBadAmount is returned when the amount is not a plain positive
	// decimal with either no fractional part or exactly two places.
	ErrBadAmount = errors.New("bad amount")
	// ErrInsufficientFunds is returned when a withdrawal would take an
	// account below zero.
	ErrInsufficientFunds = errors.New("insufficient funds")
	// ErrUnknownAccount is returned when asking for the balance of an
	// account no entry has touched.
	ErrUnknownAccount = errors.New("unknown account")
)

const (
	kindDeposit  = "deposit"
	kindWithdraw = "withdraw"
)

// Entry is one posted transaction, normalized: Cents is positive for a
// deposit and negative for a withdrawal.
type Entry struct {
	Account string
	Cents   int64
	Memo    string
}

// Ledger tracks the balance of every account it has seen.
type Ledger struct {
	balances map[string]int64
}

// NewLedger returns an empty ledger ready for use.
func NewLedger() *Ledger {
	return &Ledger{balances: make(map[string]int64)}
}

// Post parses one "account,kind,amount,memo" line and applies it to the
// ledger. The returned error wraps a sentinel, so callers can pick the
// failure apart with errors.Is while the message still names the line.
func (l *Ledger) Post(line string) (Entry, error) {
	e, err := parseLine(line)
	if err != nil {
		return Entry{}, fmt.Errorf("post %q: %w", line, err)
	}
	if l.balances[e.Account]+e.Cents < 0 {
		return Entry{}, fmt.Errorf("post %q: %w", line, ErrInsufficientFunds)
	}
	l.balances[e.Account] += e.Cents
	return e, nil
}

// Balance reports the current balance of an account in cents.
func (l *Ledger) Balance(account string) (int64, error) {
	cents, ok := l.balances[account]
	if !ok {
		return 0, fmt.Errorf("balance %q: %w", account, ErrUnknownAccount)
	}
	return cents, nil
}

// parseLine splits and validates one raw line, returning the normalized
// entry: withdrawals come back with negative cents.
func parseLine(line string) (Entry, error) {
	fields := strings.Split(line, ",")
	if len(fields) != 4 {
		return Entry{}, fmt.Errorf("want account,kind,amount,memo, got %d fields: %w", len(fields), ErrMalformedLine)
	}
	account, kind, raw, memo := fields[0], fields[1], fields[2], fields[3]
	if account == "" {
		return Entry{}, ErrNoAccount
	}
	if kind != kindDeposit && kind != kindWithdraw {
		return Entry{}, fmt.Errorf("kind %q: %w", kind, ErrUnknownKind)
	}
	cents, err := parseCents(raw)
	if err != nil {
		return Entry{}, err
	}
	if kind == kindWithdraw {
		cents = -cents
	}
	return Entry{Account: account, Cents: cents, Memo: memo}, nil
}

// parseCents converts a decimal amount ("125.50", "40") to cents. The
// amount must be a plain positive decimal with either no fractional part
// or exactly two places.
func parseCents(raw string) (int64, error) {
	whole, frac, hasDot := strings.Cut(raw, ".")
	if !hasDot {
		frac = "00"
	}
	if len(frac) != 2 || whole == "" {
		return 0, fmt.Errorf("amount %q: %w", raw, ErrBadAmount)
	}
	var cents int64
	for _, r := range whole + frac {
		if r < '0' || r > '9' {
			return 0, fmt.Errorf("amount %q: %w", raw, ErrBadAmount)
		}
		cents = cents*10 + int64(r-'0')
	}
	return cents, nil
}
