// The suite pins behavior, not structure: it drives the store and the
// consumers through their public surface, and it builds the concrete
// *MemStore for every call. What type the consumer functions accept is
// exactly what this exercise refactors, so the tests never name it: a
// *MemStore satisfies the starter's fat interface and the reference's
// small ones alike.
package docstore_test

import (
	"errors"
	"fmt"
	"slices"
	"testing"

	docstore "gopath.dev/labs/idioms/interface-bloat"
)

const (
	alpha   = "notes/alpha"
	beta    = "notes/beta"
	pitch   = "drafts/pitch"
	missing = "notes/missing"

	notesPrefix = "notes/"

	alphaBody = "five words in this body"
	betaBody  = "two words"
	pitchBody = "one"
)

func newStoreWith(t *testing.T, docs map[string]string) *docstore.MemStore {
	t.Helper()
	s := docstore.NewMemStore()
	for key, body := range docs {
		if err := s.Save(key, docstore.Document{Body: body}); err != nil {
			t.Fatalf("Save(%q): %v", key, err)
		}
	}
	return s
}

func TestSaveLoadDelete(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody})
	doc, err := s.Load(alpha)
	if err != nil {
		t.Fatalf("Load(%q): %v", alpha, err)
	}
	if doc.Body != alphaBody {
		t.Fatalf("Load(%q).Body = %q, want %q", alpha, doc.Body, alphaBody)
	}
	if err := s.Delete(alpha); err != nil {
		t.Fatalf("Delete(%q): %v", alpha, err)
	}
	if _, err := s.Load(alpha); !errors.Is(err, docstore.ErrNotFound) {
		t.Fatalf("Load after delete: err = %v, want ErrNotFound", err)
	}
	if err := s.Delete(alpha); !errors.Is(err, docstore.ErrNotFound) {
		t.Fatalf("Delete twice: err = %v, want ErrNotFound", err)
	}
	if err := s.Save("", docstore.Document{Body: pitchBody}); !errors.Is(err, docstore.ErrEmptyKey) {
		t.Fatalf(`Save(""): err = %v, want ErrEmptyKey`, err)
	}
}

func TestKeysSorted(t *testing.T) {
	s := newStoreWith(t, map[string]string{beta: betaBody, pitch: pitchBody, alpha: alphaBody})
	want := []string{pitch, alpha, beta}
	if got := s.Keys(); !slices.Equal(got, want) {
		t.Fatalf("Keys() = %v, want %v", got, want)
	}
}

func TestStats(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody, beta: betaBody})
	want := docstore.StoreStats{Docs: 2, Bytes: len(alphaBody) + len(betaBody)}
	if got := s.Stats(); got != want {
		t.Fatalf("Stats() = %+v, want %+v", got, want)
	}
}

func TestSnapshotRestoreHealth(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody})
	if err := s.Health(); err != nil {
		t.Fatalf("Health() on a fresh store: %v", err)
	}
	snap := s.Snapshot()
	if err := s.Delete(alpha); err != nil {
		t.Fatalf("Delete(%q) before restore: %v", alpha, err)
	}
	// The snapshot is a copy: deleting from the store did not touch it.
	s.Restore(snap)
	doc, err := s.Load(alpha)
	if err != nil {
		t.Fatalf("Load(%q) after restore: %v", alpha, err)
	}
	if doc.Body != alphaBody {
		t.Fatalf("restored body = %q, want %q", doc.Body, alphaBody)
	}
	// A snapshot nobody validated can smuggle in an empty key. Restore
	// accepts it; Health reports it.
	s.Restore(map[string]docstore.Document{"": {Body: pitchBody}})
	if err := s.Health(); !errors.Is(err, docstore.ErrCorrupt) {
		t.Fatalf("Health() after bad restore: err = %v, want ErrCorrupt", err)
	}
}

func TestArchiveMovesDocument(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody, beta: betaBody})
	if err := docstore.Archive(s, alpha); err != nil {
		t.Fatalf("Archive(%q): %v", alpha, err)
	}
	if _, err := s.Load(alpha); !errors.Is(err, docstore.ErrNotFound) {
		t.Fatalf("original after archive: err = %v, want ErrNotFound", err)
	}
	doc, err := s.Load(docstore.ArchivePrefix + alpha)
	if err != nil {
		t.Fatalf("Load(archived copy): %v", err)
	}
	if doc.Body != alphaBody {
		t.Fatalf("archived body = %q, want %q", doc.Body, alphaBody)
	}
}

func TestArchiveMissing(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody})
	if err := docstore.Archive(s, missing); !errors.Is(err, docstore.ErrNotFound) {
		t.Fatalf("Archive(%q): err = %v, want ErrNotFound", missing, err)
	}
}

// downStore forces chosen operations to fail so the suite can pin what
// the consumers do on the store's bad days. It embeds the real store for
// everything else: the starter's parameter type demands every method a
// store has, so even a fake that exists to break one call must produce
// all of them from somewhere.
type downStore struct {
	*docstore.MemStore
	failSave   bool
	failDelete bool
}

var errStoreDown = errors.New("store down")

func (d *downStore) Save(key string, doc docstore.Document) error {
	if d.failSave {
		return errStoreDown
	}
	if err := d.MemStore.Save(key, doc); err != nil {
		return fmt.Errorf("downStore save: %w", err)
	}
	return nil
}

func (d *downStore) Delete(key string) error {
	if d.failDelete {
		return errStoreDown
	}
	if err := d.MemStore.Delete(key); err != nil {
		return fmt.Errorf("downStore delete: %w", err)
	}
	return nil
}

func TestArchiveKeepsOriginalWhenSaveFails(t *testing.T) {
	d := &downStore{MemStore: newStoreWith(t, map[string]string{alpha: alphaBody}), failSave: true}
	if err := docstore.Archive(d, alpha); !errors.Is(err, errStoreDown) {
		t.Fatalf("Archive with failing save: err = %v, want errStoreDown", err)
	}
	if _, err := d.Load(alpha); err != nil {
		t.Fatalf("original must survive a failed archive: %v", err)
	}
}

func TestArchiveReportsFailedDelete(t *testing.T) {
	d := &downStore{MemStore: newStoreWith(t, map[string]string{alpha: alphaBody}), failDelete: true}
	if err := docstore.Archive(d, alpha); !errors.Is(err, errStoreDown) {
		t.Fatalf("Archive with failing delete: err = %v, want errStoreDown", err)
	}
	if _, err := d.Load(docstore.ArchivePrefix + alpha); err != nil {
		t.Fatalf("archived copy should exist even though delete failed: %v", err)
	}
}

func TestSummarize(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody, beta: betaBody})
	got, err := docstore.Summarize(s)
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}
	if want := "2 documents, 7 words"; got != want {
		t.Fatalf("Summarize = %q, want %q", got, want)
	}
}

func TestSummarizeEmpty(t *testing.T) {
	got, err := docstore.Summarize(docstore.NewMemStore())
	if err != nil {
		t.Fatalf("Summarize on empty store: %v", err)
	}
	if want := "0 documents, 0 words"; got != want {
		t.Fatalf("Summarize = %q, want %q", got, want)
	}
}

func TestPurge(t *testing.T) {
	s := newStoreWith(t, map[string]string{alpha: alphaBody, beta: betaBody, pitch: pitchBody})
	removed, err := docstore.Purge(s, notesPrefix)
	if err != nil {
		t.Fatalf("Purge: %v", err)
	}
	if removed != 2 {
		t.Fatalf("Purge removed %d, want 2", removed)
	}
	if got, want := s.Keys(), []string{pitch}; !slices.Equal(got, want) {
		t.Fatalf("Keys() after purge = %v, want %v", got, want)
	}
	removed, err = docstore.Purge(s, notesPrefix)
	if err != nil {
		t.Fatalf("second Purge: %v", err)
	}
	if removed != 0 {
		t.Fatalf("second Purge removed %d, want 0", removed)
	}
}

func TestPurgeStopsOnFailure(t *testing.T) {
	d := &downStore{MemStore: newStoreWith(t, map[string]string{alpha: alphaBody, beta: betaBody}), failDelete: true}
	removed, err := docstore.Purge(d, notesPrefix)
	if !errors.Is(err, errStoreDown) {
		t.Fatalf("Purge on a down store: err = %v, want errStoreDown", err)
	}
	if removed != 0 {
		t.Fatalf("Purge on a down store removed %d, want 0", removed)
	}
}
