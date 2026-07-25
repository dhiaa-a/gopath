//go:build solution

// Package snippets stores small text snippets in memory and serves
// previews of them.
package snippets

import (
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Sentinel errors callers can test with errors.Is. Every error this
// package returns wraps one of them and names the id it was about.
var (
	// ErrNotFound is returned when no snippet has the requested id.
	ErrNotFound = errors.New("snippet not found")
	// ErrDuplicate is returned when a snippet id is already taken.
	ErrDuplicate = errors.New("snippet id already taken")
	// ErrInvalidID is returned when a snippet id is unusable as a key.
	ErrInvalidID = errors.New("invalid snippet id")
	// ErrInvalidBody is returned when a snippet body is unusable.
	ErrInvalidBody = errors.New("invalid snippet body")
)

const (
	// maxBodyRunes is the largest snippet body the store accepts.
	maxBodyRunes = 4096
	// previewWidth is the most runes Preview keeps of a snippet's first line.
	previewWidth = 40
)

// Snippet is one stored snippet: an id and the text filed under it.
type Snippet struct {
	ID   string
	Body string
}

// valid reports the first problem with the snippet, or nil when it can be
// stored.
func (s Snippet) valid() error {
	if err := validID(s.ID); err != nil {
		return err
	}
	runes := utf8.RuneCountInString(s.Body)
	switch {
	case strings.TrimSpace(s.Body) == "":
		return fmt.Errorf("empty body: %w", ErrInvalidBody)
	case runes > maxBodyRunes:
		return fmt.Errorf("body is %d runes, limit %d: %w", runes, maxBodyRunes, ErrInvalidBody)
	}
	return nil
}

// validID reports the problem with id, or nil when it is usable as a key.
func validID(id string) error {
	switch {
	case id == "":
		return fmt.Errorf("empty id: %w", ErrInvalidID)
	case strings.ContainsFunc(id, unicode.IsSpace):
		return fmt.Errorf("id contains whitespace: %w", ErrInvalidID)
	}
	return nil
}

// firstLine returns everything in s before the first newline.
func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}

// truncate shortens s to at most previewWidth runes, marking a cut with a
// trailing ellipsis so the reader can see the text continues.
func truncate(s string) string {
	if utf8.RuneCountInString(s) <= previewWidth {
		return s
	}
	return string([]rune(s)[:previewWidth-1]) + "…"
}

// Store holds snippets in memory, keyed by id.
type Store struct {
	snippets map[string]Snippet
}

// NewStore returns an empty store ready for use.
func NewStore() *Store {
	return &Store{snippets: make(map[string]Snippet)}
}

// Add validates body and stores it as a new snippet under id.
func (s *Store) Add(id, body string) error {
	snip := Snippet{ID: id, Body: body}
	if err := snip.valid(); err != nil {
		return err
	}
	if _, ok := s.snippets[id]; ok {
		return fmt.Errorf("add %q: %w", id, ErrDuplicate)
	}
	s.snippets[id] = snip
	return nil
}

// Get returns the full body of the snippet stored under id.
func (s *Store) Get(id string) (string, error) {
	if err := validID(id); err != nil {
		return "", err
	}
	snip, ok := s.snippets[id]
	if !ok {
		return "", fmt.Errorf("get %q: %w", id, ErrNotFound)
	}
	return snip.Body, nil
}

// Preview returns the first line of the snippet stored under id, cut at
// previewWidth runes.
func (s *Store) Preview(id string) (string, error) {
	body, err := s.Get(id)
	if err != nil {
		return "", err
	}
	return truncate(firstLine(body)), nil
}

// List returns the stored ids, sorted.
func (s *Store) List() []string {
	return slices.Sorted(maps.Keys(s.snippets))
}
