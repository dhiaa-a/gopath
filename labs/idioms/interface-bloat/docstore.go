//go:build !solution

package docstore

import (
	"fmt"
	"strings"
)

// Storage is everything a document store can do. Any backend that wants
// to serve this package's consumers must implement all of it.
type Storage interface {
	Save(key string, doc Document) error
	Load(key string) (Document, error)
	Delete(key string) error
	Keys() []string
	Stats() StoreStats
	Snapshot() map[string]Document
	Restore(snap map[string]Document)
	Health() error
}

// Archive moves the document at key under the archive/ prefix: the copy
// is written first, so a failure can lose the operation but never the
// document.
func Archive(s Storage, key string) error {
	doc, err := s.Load(key)
	if err != nil {
		return err
	}
	if err := s.Save(ArchivePrefix+key, doc); err != nil {
		return err
	}
	return s.Delete(key)
}

// Summarize reports how much the store holds: document and word counts.
func Summarize(s Storage) (string, error) {
	keys := s.Keys()
	words := 0
	for _, key := range keys {
		doc, err := s.Load(key)
		if err != nil {
			return "", err
		}
		words += len(strings.Fields(doc.Body))
	}
	return fmt.Sprintf("%d documents, %d words", len(keys), words), nil
}

// Purge deletes every document whose key starts with prefix and reports
// how many were removed.
func Purge(s Storage, prefix string) (int, error) {
	removed := 0
	for _, key := range s.Keys() {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		if err := s.Delete(key); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}
