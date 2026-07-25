// The suite pins behavior, not structure: it drives the catalog only
// through its public surface (NewCatalog, Add, Checkout, Return, Author,
// Available), never through accessors or construction plumbing. That is
// what makes the refactor safe: any internal shape that keeps these
// observable outcomes is a valid catalog.
package catalog_test

import (
	"slices"
	"testing"

	catalog "gopath.dev/labs/idioms/getters-and-factories"
)

const (
	sulwe    = "Sulwe"
	piranesi = "Piranesi"
	hild     = "Hild"

	nyongo   = "Lupita Nyong'o"
	clarke   = "Susanna Clarke"
	griffith = "Nicola Griffith"
)

func newCatalogWith(t *testing.T, titles map[string]string) *catalog.Catalog {
	t.Helper()
	c := catalog.NewCatalog()
	for title, author := range titles {
		if err := c.Add(title, author); err != nil {
			t.Fatalf("Add(%q, %q): %v", title, author, err)
		}
	}
	return c
}

func TestAvailableIsSorted(t *testing.T) {
	c := newCatalogWith(t, map[string]string{
		sulwe:    nyongo,
		piranesi: clarke,
		hild:     griffith,
	})
	want := []string{hild, piranesi, sulwe}
	if got := c.Available(); !slices.Equal(got, want) {
		t.Fatalf("Available() = %v, want %v", got, want)
	}
}

func TestAddDuplicateFails(t *testing.T) {
	c := newCatalogWith(t, map[string]string{sulwe: nyongo})
	if err := c.Add(sulwe, "Someone Else"); err == nil {
		t.Fatal("adding a duplicate title succeeded, want error")
	}
}

func TestCheckoutRemovesFromShelf(t *testing.T) {
	c := newCatalogWith(t, map[string]string{
		sulwe: nyongo,
		hild:  griffith,
	})
	if err := c.Checkout(hild); err != nil {
		t.Fatalf("Checkout(%q): %v", hild, err)
	}
	want := []string{sulwe}
	if got := c.Available(); !slices.Equal(got, want) {
		t.Fatalf("after checkout, Available() = %v, want %v", got, want)
	}
	if err := c.Return(hild); err != nil {
		t.Fatalf("Return(%q): %v", hild, err)
	}
	want = []string{hild, sulwe}
	if got := c.Available(); !slices.Equal(got, want) {
		t.Fatalf("after return, Available() = %v, want %v", got, want)
	}
}

func TestCheckoutAndReturnErrors(t *testing.T) {
	tests := []struct {
		name string
		op   func(t *testing.T, c *catalog.Catalog) error
	}{
		{"checkout unknown title", func(t *testing.T, c *catalog.Catalog) error {
			return c.Checkout("No Such Book")
		}},
		{"checkout a book twice", func(t *testing.T, c *catalog.Catalog) error {
			if err := c.Checkout(sulwe); err != nil {
				t.Fatalf("first Checkout(%q): %v", sulwe, err)
			}
			return c.Checkout(sulwe)
		}},
		{"return a book on the shelf", func(t *testing.T, c *catalog.Catalog) error {
			return c.Return(sulwe)
		}},
		{"return unknown title", func(t *testing.T, c *catalog.Catalog) error {
			return c.Return("No Such Book")
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newCatalogWith(t, map[string]string{sulwe: nyongo})
			if err := tt.op(t, c); err == nil {
				t.Fatalf("%s: got nil, want error", tt.name)
			}
		})
	}
}

func TestAuthor(t *testing.T) {
	c := newCatalogWith(t, map[string]string{piranesi: clarke})
	got, err := c.Author(piranesi)
	if err != nil {
		t.Fatalf("Author(%q): %v", piranesi, err)
	}
	if got != clarke {
		t.Fatalf("Author(%q) = %q, want %q", piranesi, got, clarke)
	}
	if _, err := c.Author("No Such Book"); err == nil {
		t.Fatal("Author of unknown title succeeded, want error")
	}
}
