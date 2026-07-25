//go:build solution

package docstore

import (
	"fmt"
	"strings"
)

// Each consumer below declares the interface it consumes, next to itself
// and sized to what its body actually calls. No type says it implements
// them, because none has to: *MemStore already satisfies all three, and
// so will any other type with the right methods.

// loadSaveDeleter is what Archive needs: read one document, write one,
// remove one.
type loadSaveDeleter interface {
	Load(key string) (Document, error)
	Save(key string, doc Document) error
	Delete(key string) error
}

// Archive moves the document at key under the archive/ prefix: the copy
// is written first, so a failure can lose the operation but never the
// document.
func Archive(s loadSaveDeleter, key string) error {
	doc, err := s.Load(key)
	if err != nil {
		return fmt.Errorf("archive %q: load: %w", key, err)
	}
	if err := s.Save(ArchivePrefix+key, doc); err != nil {
		return fmt.Errorf("archive %q: save copy: %w", key, err)
	}
	if err := s.Delete(key); err != nil {
		return fmt.Errorf("archive %q: delete original: %w", key, err)
	}
	return nil
}

// loadLister is what Summarize needs: list the keys, read the documents.
type loadLister interface {
	Keys() []string
	Load(key string) (Document, error)
}

// Summarize reports how much the store holds: document and word counts.
func Summarize(s loadLister) (string, error) {
	keys := s.Keys()
	words := 0
	for _, key := range keys {
		doc, err := s.Load(key)
		if err != nil {
			return "", fmt.Errorf("summarize: load %q: %w", key, err)
		}
		words += len(strings.Fields(doc.Body))
	}
	return fmt.Sprintf("%d documents, %d words", len(keys), words), nil
}

// deleteLister is what Purge needs: list the keys, remove documents.
type deleteLister interface {
	Keys() []string
	Delete(key string) error
}

// Purge deletes every document whose key starts with prefix and reports
// how many were removed.
func Purge(s deleteLister, prefix string) (int, error) {
	removed := 0
	for _, key := range s.Keys() {
		if !strings.HasPrefix(key, prefix) {
			continue
		}
		if err := s.Delete(key); err != nil {
			return removed, fmt.Errorf("purge %q: delete %q: %w", prefix, key, err)
		}
		removed++
	}
	return removed, nil
}
