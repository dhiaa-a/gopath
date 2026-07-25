// The suite pins behavior, not structure: it drives the ledger only
// through its public surface (NewLedger, Post, Balance, Entry), and it
// never asserts on error text or error identity, because those differ
// between the starter and the reference. Valid lines must post and move
// balances; broken lines and overdrafts must come back as non-nil errors
// with the ledger left intact. Any internal shape that keeps those
// outcomes is a valid ledger.
package ledger_test

import (
	"testing"

	ledger "gopath.dev/labs/idioms/panic-as-control-flow"
)

const (
	checking = "checking"
	savings  = "savings"
)

func newLedgerWith(t *testing.T, lines ...string) *ledger.Ledger {
	t.Helper()
	l := ledger.NewLedger()
	for _, line := range lines {
		if _, err := l.Post(line); err != nil {
			t.Fatalf("Post(%q): %v", line, err)
		}
	}
	return l
}

func mustBalance(t *testing.T, l *ledger.Ledger, account string) int64 {
	t.Helper()
	cents, err := l.Balance(account)
	if err != nil {
		t.Fatalf("Balance(%q): %v", account, err)
	}
	return cents
}

func TestDepositPostsNormalizedEntry(t *testing.T) {
	l := ledger.NewLedger()
	got, err := l.Post("checking,deposit,125.50,paycheck")
	if err != nil {
		t.Fatalf("Post: %v", err)
	}
	want := ledger.Entry{Account: checking, Cents: 12550, Memo: "paycheck"}
	if got != want {
		t.Fatalf("Post = %+v, want %+v", got, want)
	}
	if cents := mustBalance(t, l, checking); cents != 12550 {
		t.Fatalf("Balance(%q) = %d, want 12550", checking, cents)
	}
}

func TestWithdrawalIsNegativeAndMovesBalance(t *testing.T) {
	l := newLedgerWith(t, "checking,deposit,200.00,opening")
	got, err := l.Post("checking,withdraw,75.25,groceries")
	if err != nil {
		t.Fatalf("Post: %v", err)
	}
	want := ledger.Entry{Account: checking, Cents: -7525, Memo: "groceries"}
	if got != want {
		t.Fatalf("Post = %+v, want %+v", got, want)
	}
	if cents := mustBalance(t, l, checking); cents != 12475 {
		t.Fatalf("Balance(%q) = %d, want 12475", checking, cents)
	}
}

func TestWholeAmountAndExactDrain(t *testing.T) {
	l := newLedgerWith(t, "savings,deposit,40,gift")
	if cents := mustBalance(t, l, savings); cents != 4000 {
		t.Fatalf("Balance(%q) = %d, want 4000", savings, cents)
	}
	if _, err := l.Post("savings,withdraw,40.00,all of it"); err != nil {
		t.Fatalf("withdrawing the exact balance: %v", err)
	}
	if cents := mustBalance(t, l, savings); cents != 0 {
		t.Fatalf("Balance(%q) = %d, want 0", savings, cents)
	}
}

func TestAccountsAreIndependent(t *testing.T) {
	l := newLedgerWith(t,
		"checking,deposit,10.00,split one",
		"savings,deposit,7.50,split two",
	)
	if cents := mustBalance(t, l, checking); cents != 1000 {
		t.Fatalf("Balance(%q) = %d, want 1000", checking, cents)
	}
	if cents := mustBalance(t, l, savings); cents != 750 {
		t.Fatalf("Balance(%q) = %d, want 750", savings, cents)
	}
}

func TestOverdraftFailsAndChangesNothing(t *testing.T) {
	l := newLedgerWith(t, "checking,deposit,10.00,opening")
	if _, err := l.Post("checking,withdraw,10.01,one cent too far"); err == nil {
		t.Fatal("overdraft succeeded, want error")
	}
	if _, err := l.Post("savings,withdraw,1.00,never funded"); err == nil {
		t.Fatal("withdrawing from an unfunded account succeeded, want error")
	}
	if cents := mustBalance(t, l, checking); cents != 1000 {
		t.Fatalf("after failed posts, Balance(%q) = %d, want 1000", checking, cents)
	}
}

func TestBrokenLinesFailAndChangeNothing(t *testing.T) {
	tests := []struct {
		name string
		line string
	}{
		{"empty line", ""},
		{"three fields", "checking,deposit,10.00"},
		{"five fields from a comma in the memo", "checking,deposit,5.00,lunch, and coffee"},
		{"empty account", ",deposit,10.00,ghost"},
		{"unknown kind", "checking,transfer,10.00,payday"},
		{"one decimal place", "checking,deposit,10.5,typo"},
		{"three decimal places", "checking,deposit,10.505,typo"},
		{"spelled out amount", "checking,deposit,ten,spelled out"},
		{"negative amount", "checking,withdraw,-5.00,sneaky"},
		{"dot with no whole part", "checking,deposit,.50,shorthand"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newLedgerWith(t, "checking,deposit,50.00,opening")
			if _, err := l.Post(tt.line); err == nil {
				t.Fatalf("Post(%q) succeeded, want error", tt.line)
			}
			if cents := mustBalance(t, l, checking); cents != 5000 {
				t.Fatalf("after a failed post, Balance(%q) = %d, want 5000", checking, cents)
			}
		})
	}
}

func TestBalanceOfUnknownAccountFails(t *testing.T) {
	l := ledger.NewLedger()
	if _, err := l.Balance("nobody"); err == nil {
		t.Fatal("Balance of an unknown account succeeded, want error")
	}
}
