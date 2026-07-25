//go:build solution

// Package enrich turns raw feed items into display-ready results: an
// uppercased SKU, a cleaned-up name, and a formatted price per item.
package enrich

import (
	"errors"
	"fmt"
	"strings"
	"sync"
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
// input order. If any items are malformed it returns nil results and one
// error covering every bad item; errors.Is matches it against the
// sentinels above.
func ProcessAll(items []Item) ([]Result, error) {
	results := make([]Result, len(items))
	errs := make([]error, len(items))
	var wg sync.WaitGroup
	for i, it := range items {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], errs[i] = enrichItem(i, it)
		}()
	}
	wg.Wait()
	if err := errors.Join(errs...); err != nil {
		return nil, fmt.Errorf("process %d items: %w", len(items), err)
	}
	return results, nil
}

// enrichItem computes the display form of one item.
func enrichItem(i int, it Item) (Result, error) {
	if it.SKU == "" {
		return Result{}, fmt.Errorf("item %d: %w", i, ErrNoSKU)
	}
	if it.Cents < 0 {
		return Result{}, fmt.Errorf("item %q: %w", it.SKU, ErrNegativePrice)
	}
	return Result{
		SKU:     strings.ToUpper(it.SKU),
		Display: strings.Join(strings.Fields(it.Name), " "),
		Price:   fmt.Sprintf("$%d.%02d", it.Cents/100, it.Cents%100),
	}, nil
}
