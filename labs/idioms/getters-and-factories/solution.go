//go:build solution

// Package catalog tracks a small lending library: which books exist and
// which are currently checked out.
package catalog

import (
	"errors"
	"fmt"
	"slices"
)

// Sentinel errors callers can test with errors.Is.
var (
	// ErrNotFound is returned when a title is not in the catalog.
	ErrNotFound = errors.New("book not found")
	// ErrDuplicate is returned when a title is added twice.
	ErrDuplicate = errors.New("book already in catalog")
	// ErrCheckedOut is returned when checking out a book that is out.
	ErrCheckedOut = errors.New("book already checked out")
	// ErrNotCheckedOut is returned when returning a book on the shelf.
	ErrNotCheckedOut = errors.New("book not checked out")
)

// book needs no interface, no factory, and no accessors: it is a row of
// data owned by Catalog, and only Catalog touches it.
type book struct {
	author     string
	checkedOut bool
}

// Catalog is the collection of books the library owns.
type Catalog struct {
	books map[string]*book // keyed by title
}

// NewCatalog returns an empty catalog ready for use.
func NewCatalog() *Catalog {
	return &Catalog{books: make(map[string]*book)}
}

// Add registers a new title. Adding the same title twice is an error.
func (c *Catalog) Add(title, author string) error {
	if _, ok := c.books[title]; ok {
		return fmt.Errorf("add %q: %w", title, ErrDuplicate)
	}
	c.books[title] = &book{author: author}
	return nil
}

// Checkout marks a title as checked out.
func (c *Catalog) Checkout(title string) error {
	b, ok := c.books[title]
	if !ok {
		return fmt.Errorf("checkout %q: %w", title, ErrNotFound)
	}
	if b.checkedOut {
		return fmt.Errorf("checkout %q: %w", title, ErrCheckedOut)
	}
	b.checkedOut = true
	return nil
}

// Return marks a checked-out title as available again.
func (c *Catalog) Return(title string) error {
	b, ok := c.books[title]
	if !ok {
		return fmt.Errorf("return %q: %w", title, ErrNotFound)
	}
	if !b.checkedOut {
		return fmt.Errorf("return %q: %w", title, ErrNotCheckedOut)
	}
	b.checkedOut = false
	return nil
}

// Author reports who wrote the given title.
func (c *Catalog) Author(title string) (string, error) {
	b, ok := c.books[title]
	if !ok {
		return "", fmt.Errorf("author %q: %w", title, ErrNotFound)
	}
	return b.author, nil
}

// Available lists the titles currently on the shelf, sorted.
func (c *Catalog) Available() []string {
	var titles []string
	for title, b := range c.books {
		if !b.checkedOut {
			titles = append(titles, title)
		}
	}
	slices.Sort(titles)
	return titles
}
