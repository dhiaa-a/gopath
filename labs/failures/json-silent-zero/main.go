//go:build !fixed

// invoiceimport pulls invoices from the partner billing feed and posts them
// to the ledger. The lab pins one payload from the feed as a fixture so the
// import is reproducible without the partner sandbox.
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// One invoice, exactly as the partner feed delivers it.
const payload = `{"customer":"acme","amount_cents":12500,"currency":"EUR"}`

// Invoice is the ledger-side shape of a feed invoice. Field names follow
// the billing team's JSON naming guide, which uses camelCase.
type Invoice struct {
	Customer    string `json:"customer"`
	AmountCents int    `json:"amountCents"`
	Currency    string `json:"currency"`
}

func main() {
	errs := 0

	var inv Invoice
	if err := json.Unmarshal([]byte(payload), &inv); err != nil {
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
