//go:build !solution

// Package snippets stores small text snippets in memory and serves
// previews of them.
package snippets

import (
	"errors"
	"fmt"
	"maps"
	"slices"

	"gopath.dev/labs/idioms/package-sprawl/model"
	"gopath.dev/labs/idioms/package-sprawl/util"
	"gopath.dev/labs/idioms/package-sprawl/validate"
)

// Storage failures callers can test with errors.Is.
var (
	// ErrNotFound is returned when no snippet has the requested id.
	ErrNotFound = errors.New("snippet not found")
	// ErrDuplicate is returned when a snippet id is already taken.
	ErrDuplicate = errors.New("snippet id already taken")
)

// Validation failures, re-exported here so callers of this package do not
// have to import the validate package to match them.
var (
	// ErrInvalidID is returned when a snippet id is unusable as a key.
	ErrInvalidID = validate.ErrInvalidID
	// ErrInvalidBody is returned when a snippet body is unusable.
	ErrInvalidBody = validate.ErrInvalidBody
)

// previewWidth is the most runes Preview keeps of a snippet's first line.
const previewWidth = 40

// Store holds snippets in memory, keyed by id.
type Store struct {
	snippets map[string]model.ModelSnippet
}

// NewStore returns an empty store ready for use.
func NewStore() *Store {
	return &Store{snippets: make(map[string]model.ModelSnippet)}
}

// Add validates body and stores it as a new snippet under id.
func (s *Store) Add(id, body string) error {
	m := model.ModelSnippet{ID: id, Body: body}
	if err := validate.ValidateSnippet(m); err != nil {
		return err
	}
	if _, ok := s.snippets[id]; ok {
		return fmt.Errorf("add %q: %w", id, ErrDuplicate)
	}
	s.snippets[id] = m
	return nil
}

// Get returns the full body of the snippet stored under id.
func (s *Store) Get(id string) (string, error) {
	if err := validate.ValidateID(id); err != nil {
		return "", err
	}
	m, ok := s.snippets[id]
	if !ok {
		return "", fmt.Errorf("get %q: %w", id, ErrNotFound)
	}
	return m.Body, nil
}

// Preview returns the first line of the snippet stored under id, cut at
// previewWidth runes.
func (s *Store) Preview(id string) (string, error) {
	body, err := s.Get(id)
	if err != nil {
		return "", err
	}
	return util.UtilTruncate(util.UtilFirstLine(body), previewWidth), nil
}

// List returns the stored ids, sorted.
func (s *Store) List() []string {
	return slices.Sorted(maps.Keys(s.snippets))
}
