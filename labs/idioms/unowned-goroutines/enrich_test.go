// The suite pins behavior, not structure: it drives enrichment only
// through the public surface (ProcessAll, Item, Result) and asserts on
// returned state, never on timing. Note the one thing it cannot pin:
// ProcessAll's error return, which the starter hardcodes to nil. That
// lesson fell to the linter; REVIEW.md walks through why, and how to see
// the reference surface a seeded failure by hand.
package enrich_test

import (
	"fmt"
	"slices"
	"testing"

	enrich "gopath.dev/labs/idioms/unowned-goroutines"
)

const (
	skuKettle = "ket-01"
	skuMug    = "mug-02"
	skuPress  = "prs-03"
	skuBulk   = "bulk-9"

	nameKettle = "  Stovetop   Kettle "
	nameMug    = "Diner Mug"
	namePress  = " French  Press"
	nameBulk   = "Bulk  Beans"
)

func TestProcessAllEnrichesEveryItem(t *testing.T) {
	items := []enrich.Item{
		{SKU: skuKettle, Name: nameKettle, Cents: 4250},
		{SKU: skuMug, Name: nameMug, Cents: 899},
		{SKU: skuPress, Name: namePress, Cents: 3005},
	}
	want := []enrich.Result{
		{SKU: "KET-01", Display: "Stovetop Kettle", Price: "$42.50"},
		{SKU: "MUG-02", Display: "Diner Mug", Price: "$8.99"},
		{SKU: "PRS-03", Display: "French Press", Price: "$30.05"},
	}
	got, err := enrich.ProcessAll(items)
	if err != nil {
		t.Fatalf("ProcessAll(three items): %v", err)
	}
	if !slices.Equal(got, want) {
		t.Fatalf("ProcessAll(three items) = %v, want %v", got, want)
	}
}

// Sixty-four items with index-coded prices: if ProcessAll returns before
// every item is enriched, or shuffles the order, the comparison names the
// first slot that is wrong.
func TestProcessAllFillsEverySlotInOrder(t *testing.T) {
	const n = 64
	items := make([]enrich.Item, n)
	want := make([]enrich.Result, n)
	for i := range items {
		items[i] = enrich.Item{SKU: skuBulk, Name: nameBulk, Cents: i}
		want[i] = enrich.Result{
			SKU:     "BULK-9",
			Display: "Bulk Beans",
			Price:   fmt.Sprintf("$0.%02d", i),
		}
	}
	got, err := enrich.ProcessAll(items)
	if err != nil {
		t.Fatalf("ProcessAll(64 items): %v", err)
	}
	for i := range want {
		if i >= len(got) || got[i] != want[i] {
			t.Fatalf("slot %d: got %v, want %v (missing or misordered result)", i, got, want[i])
		}
	}
}

func TestProcessAllCleansNames(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		display string
	}{
		{"collapses inner runs", "French  Press", "French Press"},
		{"trims the edges", "  Kettle ", "Kettle"},
		{"handles tabs and newlines", "Camp\tMug\n", "Camp Mug"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := enrich.ProcessAll([]enrich.Item{{SKU: skuKettle, Name: tt.raw, Cents: 100}})
			if err != nil {
				t.Fatalf("ProcessAll(%q): %v", tt.raw, err)
			}
			if len(got) != 1 || got[0].Display != tt.display {
				t.Fatalf("Display for %q = %v, want %q", tt.raw, got, tt.display)
			}
		})
	}
}

func TestProcessAllEmptyInput(t *testing.T) {
	got, err := enrich.ProcessAll(nil)
	if err != nil {
		t.Fatalf("ProcessAll(nil): %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("ProcessAll(nil) = %v, want no results", got)
	}
}
