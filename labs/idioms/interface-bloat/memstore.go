// Package docstore stores named documents in memory and offers a few
// operations over them: archiving, summarizing, purging.
//
// This file is the stable ground of the exercise. MemStore is already
// idiomatic Go and its exported API is identical in both variants; the
// exercise is about what the consumers in docstore.go ask for, not about
// the store itself.
package docstore

import (
	"errors"
	"fmt"
	"maps"
	"slices"
)

// ArchivePrefix is where Archive parks documents: the original key,
// prefixed.
const ArchivePrefix = "archive/"

// Sentinel errors callers can test with errors.Is.
var (
	// ErrNotFound is returned when a key has no document.
	ErrNotFound = errors.New("document not found")
	// ErrEmptyKey is returned by Save for the empty key.
	ErrEmptyKey = errors.New("empty key")
	// ErrCorrupt is reported by Health when the contents are inconsistent.
	ErrCorrupt = errors.New("store corrupt")
)

// Document is one stored document.
type Document struct {
	Body string
}

// StoreStats describes the size of a store at a point in time.
type StoreStats struct {
	Docs  int
	Bytes int
}

// MemStore is an in-memory document store. The zero value is not usable;
// call NewMemStore.
type MemStore struct {
	docs map[string]Document
}

// NewMemStore returns an empty in-memory store.
func NewMemStore() *MemStore {
	return &MemStore{docs: make(map[string]Document)}
}

// Save stores doc under key, overwriting any previous document.
func (m *MemStore) Save(key string, doc Document) error {
	if key == "" {
		return fmt.Errorf("save: %w", ErrEmptyKey)
	}
	m.docs[key] = doc
	return nil
}

// Load returns the document stored under key.
func (m *MemStore) Load(key string) (Document, error) {
	doc, ok := m.docs[key]
	if !ok {
		return Document{}, fmt.Errorf("load %q: %w", key, ErrNotFound)
	}
	return doc, nil
}

// Delete removes the document stored under key.
func (m *MemStore) Delete(key string) error {
	if _, ok := m.docs[key]; !ok {
		return fmt.Errorf("delete %q: %w", key, ErrNotFound)
	}
	delete(m.docs, key)
	return nil
}

// Keys returns every key in the store, sorted.
func (m *MemStore) Keys() []string {
	return slices.Sorted(maps.Keys(m.docs))
}

// Stats reports how many documents the store holds and their combined
// body size in bytes.
func (m *MemStore) Stats() StoreStats {
	st := StoreStats{Docs: len(m.docs)}
	for _, doc := range m.docs {
		st.Bytes += len(doc.Body)
	}
	return st
}

// Snapshot returns a copy of the store's contents, safe to hold across
// later mutation.
func (m *MemStore) Snapshot() map[string]Document {
	snap := make(map[string]Document, len(m.docs))
	maps.Copy(snap, m.docs)
	return snap
}

// Restore replaces the store's contents with a snapshot. It does not
// validate the snapshot; Health reports whether the result is usable.
func (m *MemStore) Restore(snap map[string]Document) {
	m.docs = make(map[string]Document, len(snap))
	maps.Copy(m.docs, snap)
}

// Health reports whether the store's contents are internally consistent.
// A store fed a bad snapshot reports ErrCorrupt.
func (m *MemStore) Health() error {
	for key := range m.docs {
		if key == "" {
			return fmt.Errorf("empty key in store: %w", ErrCorrupt)
		}
	}
	return nil
}
