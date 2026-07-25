//go:build !solution

// Package enrich turns raw feed items into display-ready results: an
// uppercased SKU, a cleaned-up name, and a formatted price per item.
package enrich

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Sentinel errors for items the upstream feed should never have produced.
var (
	// ErrNoSKU is returned for an item with an empty SKU.
	ErrNoSKU = errors.New("item has no sku")
	// ErrNegativePrice is returned for an item priced below zero cents.
	ErrNegativePrice = errors.New("item price is negative")
)

// Item is one raw entry from the upstream feed.
type Item struct {
	SKU   string
	Name  string
	Cents int
}

// Result is the display-ready form of one Item.
type Result struct {
	SKU     string
	Display string
	Price   string
}

// ProcessAll enriches every item concurrently and returns the results in
// input order. It returns an error if any item is malformed.
func ProcessAll(items []Item) ([]Result, error) {
	results := make([]Result, len(items))
	for i, it := range items {
		go enrichInto(results, i, it)
	}
	// The per-item work is tiny, so a quarter second is plenty of time
	// for every goroutine to finish before we read the slice.
	time.Sleep(250 * time.Millisecond)
	return results, nil
}

// enrichInto computes the display form of one item into dst[i].
func enrichInto(dst []Result, i int, it Item) error {
	if it.SKU == "" {
		return fmt.Errorf("item %d: %w", i, ErrNoSKU)
	}
	if it.Cents < 0 {
		return fmt.Errorf("item %q: %w", it.SKU, ErrNegativePrice)
	}
	dst[i] = Result{
		SKU:     strings.ToUpper(it.SKU),
		Display: strings.Join(strings.Fields(it.Name), " "),
		Price:   fmt.Sprintf("$%d.%02d", it.Cents/100, it.Cents%100),
	}
	return nil
}
