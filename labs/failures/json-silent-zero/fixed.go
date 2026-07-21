//go:build fixed

// The fix has two layers, because the bug had two parts. The tag now
// matches the wire name exactly, so the amount lands where it was sent.
// And the decode is strict plus validated, so the next tag that drifts
// from the feed becomes a loud error instead of a silent zero:
// DisallowUnknownFields turns any wire key the struct fails to claim into
// an error, and the post-decode check refuses an invoice whose required
// fields never arrived. Each layer catches the half the other cannot.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// One invoice, exactly as the partner feed delivers it.
const payload = `{"customer":"acme","amount_cents":12500,"currency":"EUR"}`

// Invoice is the ledger-side shape of a feed invoice. Tags mirror the
// partner API spec byte for byte; the wire owns these names, not our
// style guide.
type Invoice struct {
	Customer    string `json:"customer"`
	AmountCents int    `json:"amount_cents"`
	Currency    string `json:"currency"`
}

// decode is strict in both directions: unknown wire keys are errors, and
// required fields must actually arrive with sane values.
func decode(raw string) (Invoice, error) {
	var inv Invoice
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&inv); err != nil {
		return Invoice{}, err
	}
	if inv.Customer == "" || inv.Currency == "" {
		return Invoice{}, fmt.Errorf("invoice missing customer or currency: %q %q", inv.Customer, inv.Currency)
	}
	if inv.AmountCents <= 0 {
		return Invoice{}, fmt.Errorf("invoice for %s has amount %d cents", inv.Customer, inv.AmountCents)
	}
	return inv, nil
}

func main() {
	errs := 0

	inv, err := decode(payload)
	if err != nil {
		errs++
		fmt.Fprintln(os.Stderr, "import failed:", err)
	} else {
		fmt.Printf("imported invoice: %s %d %s\n", inv.Customer, inv.AmountCents, inv.Currency)
	}

	if errs > 0 {
		fmt.Printf("import finished (%d errors)\n", errs)
		os.Exit(1)
	}
	fmt.Println("import ok (0 errors)")
}
