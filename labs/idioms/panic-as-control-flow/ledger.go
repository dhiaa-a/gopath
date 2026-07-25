//go:build !solution

// Package ledger ingests transaction lines in a tiny CSV shape
// ("account,kind,amount,memo") and tracks per-account balances in cents.
package ledger

import (
	"errors"
	"fmt"
	"strings"
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
// ledger. The helpers below throw on anything they dislike; the deferred
// recover catches whatever came up and turns it into the error this
// signature promises.
func (l *Ledger) Post(line string) (entry Entry, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("ledger: %v", r)
		}
	}()
	account, kind, cents, memo := parseLine(line)
	if kind == kindDeposit {
		l.balances[account] += cents
		return Entry{Account: account, Cents: cents, Memo: memo}, nil
	} else {
		if l.balances[account] < cents {
			panic("insufficient funds in " + account)
		}
		l.balances[account] -= cents
		return Entry{Account: account, Cents: -cents, Memo: memo}, nil
	}
}

// Balance reports the current balance of an account in cents.
func (l *Ledger) Balance(account string) (int64, error) {
	cents, ok := l.balances[account]
	if ok {
		return cents, nil
	} else {
		return 0, errors.New("ledger: unknown account: " + account)
	}
}

// parseLine splits and validates one raw line. It panics if the line does
// not have exactly four fields, names no account, or uses an unknown kind.
func parseLine(line string) (string, string, int64, string) {
	fields := strings.Split(line, ",")
	if len(fields) != 4 {
		panic("expected account,kind,amount,memo: " + line)
	}
	account, kind, raw, memo := fields[0], fields[1], fields[2], fields[3]
	if account == "" {
		panic("empty account name in line: " + line)
	}
	if kind != kindDeposit && kind != kindWithdraw {
		panic("unknown entry kind: " + kind)
	}
	return account, kind, parseCents(raw), memo
}

// parseCents converts a decimal amount ("125.50", "40") to cents. It
// panics unless the amount is a plain positive decimal with either no
// fractional part or exactly two places.
func parseCents(raw string) int64 {
	whole, frac, hasDot := strings.Cut(raw, ".")
	if !hasDot {
		frac = "00"
	}
	if len(frac) != 2 || whole == "" {
		panic("amount must look like 12.34 or 12: " + raw)
	}
	var cents int64
	for _, r := range whole + frac {
		if r >= '0' && r <= '9' {
			cents = cents*10 + int64(r-'0')
			continue
		} else {
			panic("bad amount: " + raw)
		}
	}
	return cents
}
