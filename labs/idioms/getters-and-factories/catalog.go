//go:build !solution

// Package catalog tracks a small lending library: which books exist and
// which are currently checked out.
package catalog

import (
	"errors"
	"sort"
)

// BookNotFoundError is returned when a title is not in the catalog.
var BookNotFoundError = errors.New("The requested book was not found.")

// BookRecord abstracts a book so the catalog never touches fields directly.
type BookRecord interface {
	GetTitle() string
	GetAuthor() string
	IsCheckedOut() bool
	SetCheckedOut(checkedOut bool)
}

// book is the concrete record behind BookRecord.
type book struct {
	title      string
	author     string
	checkedOut bool
	timesOut   int
}

// GetTitle returns the book's title.
func (this *book) GetTitle() string { return this.title }

// GetAuthor returns the book's author.
func (b book) GetAuthor() string { return b.author }

// IsCheckedOut reports whether the book is currently checked out.
func (this *book) IsCheckedOut() bool { return this.checkedOut }

// SetCheckedOut updates the book's checked-out flag.
func (this *book) SetCheckedOut(checkedOut bool) { this.checkedOut = checkedOut }

// reset clears the checked-out flag for a fresh season.
func (this *book) reset() { this.checkedOut = false }

// CatalogBookFactory constructs book records for the catalog.
type CatalogBookFactory struct{}

// CreateBook builds a new book record from its parts.
func (f *CatalogBookFactory) CreateBook(title, author string) BookRecord {
	return NewBook(title, author)
}

// NewBook constructs a book record behind the BookRecord abstraction.
func NewBook(title, author string) BookRecord {
	return &book{title: title, author: author}
}

// Catalog is the collection of books the library owns.
type Catalog struct {
	books   []BookRecord
	factory *CatalogBookFactory
}

// NewCatalog returns an empty catalog ready for use.
func NewCatalog() *Catalog {
	return &Catalog{factory: &CatalogBookFactory{}}
}

// Add registers a new title. Adding the same title twice is an error.
func (c *Catalog) Add(title, author string) error {
	for _, b := range c.books {
		if b.GetTitle() == title {
			return errors.New("A book with this title already exists.")
		}
	}
	c.books = append(c.books, c.factory.CreateBook(title, author))
	return nil
}

// Checkout marks a title as checked out.
func (c *Catalog) Checkout(title string) error {
	for _, b := range c.books {
		if b.GetTitle() == title {
			if b.IsCheckedOut() {
				return errors.New("This book is already checked out.")
			}
			b.SetCheckedOut(true)
			return nil
		}
	}
	return BookNotFoundError
}

// Return marks a checked-out title as available again.
func (c *Catalog) Return(title string) error {
	for _, b := range c.books {
		if b.GetTitle() == title {
			if !b.IsCheckedOut() {
				return errors.New("This book was not checked out.")
			}
			b.SetCheckedOut(false)
			return nil
		}
	}
	return BookNotFoundError
}

// Author reports who wrote the given title.
func (c *Catalog) Author(title string) (string, error) {
	for _, b := range c.books {
		if b.GetTitle() == title {
			return b.GetAuthor(), nil
		}
	}
	return "", BookNotFoundError
}

// Available lists the titles currently on the shelf, sorted.
func (c *Catalog) Available() []string {
	titles := []string{}
	for _, b := range c.books {
		if !b.IsCheckedOut() {
			titles = append(titles, b.GetTitle())
		}
	}
	sort.Strings(titles)
	return titles
}
