package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// Link is one shortened URL. This is also the on-disk shape: the store file is
// a JSON object with a version and an array of these.
type Link struct {
	Code      string     `json:"code"`
	URL       string     `json:"url"`
	Owner     string     `json:"owner"`
	Clicks    int64      `json:"clicks"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

func (l *Link) expired(now time.Time) bool {
	return l.ExpiresAt != nil && !now.Before(*l.ExpiresAt)
}

type storeFile struct {
	Version int     `json:"version"`
	Links   []*Link `json:"links"`
}

var errCodeTaken = errors.New("code already in use")

// Store keeps every link in memory and mirrors it to one JSON file.
//
// Two locks, on purpose:
//
//   - mu guards the map. Held for the length of a map operation and never
//     across a disk write, because every redirect needs it.
//   - saveMu serialises the disk writes themselves. Snapshots are taken under
//     mu, marshalled, and only then written, so a slow disk stalls savers
//     rather than readers.
//
// Snapshots carry the sequence number they were taken at, and a save that
// arrives holding an older snapshot than the one already on disk drops it. Two
// savers racing would otherwise be able to land in the wrong order and leave
// stale contents behind, which is the kind of bug that only shows up on the
// one machine with the slow disk.
type Store struct {
	path string

	mu    sync.Mutex
	links map[string]*Link
	seq   uint64 // bumped on every mutation
	saved uint64 // seq of the newest snapshot known to be on disk

	saveMu sync.Mutex
}

// openStore loads path, or starts empty if it does not exist. A file that
// exists but does not parse is an error: starting empty would silently discard
// every link the service ever handed out.
func openStore(path string) (*Store, error) {
	s := &Store{path: path, links: map[string]*Link{}}

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read store: %w", err)
	}

	var f storeFile
	if err := json.Unmarshal(data, &f); err != nil {
		return nil, fmt.Errorf("store %s is corrupt: %w", path, err)
	}
	for _, l := range f.Links {
		if l.Code == "" {
			return nil, fmt.Errorf("store %s is corrupt: a link has no code", path)
		}
		s.links[l.Code] = l
	}
	return s, nil
}

// get returns the link for code, or nil.
func (s *Store) get(code string) *Link {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.links[code]
	if !ok {
		return nil
	}
	c := *l
	return &c
}

// put inserts a link, refusing a code that is already taken. It returns only
// after the change is on disk: a 201 the caller can see is a promise, and the
// promise is kept before it is made.
func (s *Store) put(l *Link) error {
	s.mu.Lock()
	if _, taken := s.links[l.Code]; taken {
		s.mu.Unlock()
		return errCodeTaken
	}
	c := *l
	s.links[l.Code] = &c
	s.seq++
	seq := s.seq
	s.mu.Unlock()

	return s.durable(seq)
}

// del removes a link, write-through like put. Reports whether it was there.
func (s *Store) del(code, owner string) (bool, error) {
	s.mu.Lock()
	l, ok := s.links[code]
	if !ok || l.Owner != owner {
		s.mu.Unlock()
		return false, nil
	}
	delete(s.links, code)
	s.seq++
	seq := s.seq
	s.mu.Unlock()

	return true, s.durable(seq)
}

// click records one hit and returns the link as it now stands. The write is
// not flushed here: clicks are batched by the flusher, because putting a disk
// write on the redirect path is how a shortener stops being fast.
func (s *Store) click(code string, now time.Time) *Link {
	s.mu.Lock()
	defer s.mu.Unlock()

	l, ok := s.links[code]
	if !ok || l.expired(now) {
		return nil
	}
	l.Clicks++
	s.seq++
	c := *l
	return &c
}

// listOwned returns one owner's links, newest first.
func (s *Store) listOwned(owner string) []*Link {
	s.mu.Lock()
	out := make([]*Link, 0, len(s.links))
	for _, l := range s.links {
		if l.Owner != owner {
			continue
		}
		c := *l
		out = append(out, &c)
	}
	s.mu.Unlock()

	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].Code < out[j].Code
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

func (s *Store) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.links)
}

// taken reports whether a code is in use. Used by code generation, which
// retries on collision.
func (s *Store) taken(code string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.links[code]
	return ok
}

func (s *Store) snapshotLocked() ([]byte, uint64) {
	f := storeFile{Version: 1, Links: make([]*Link, 0, len(s.links))}
	for _, l := range s.links {
		c := *l
		f.Links = append(f.Links, &c)
	}
	sort.Slice(f.Links, func(i, j int) bool { return f.Links[i].Code < f.Links[j].Code })

	data, err := json.Marshal(f)
	if err != nil {
		// Link has no channels, funcs, or NaNs in it, so this cannot happen.
		panic(fmt.Sprintf("marshal store: %v", err))
	}
	return data, s.seq
}

// flush makes everything written so far durable.
func (s *Store) flush() error {
	s.mu.Lock()
	seq := s.seq
	s.mu.Unlock()
	return s.durable(seq)
}

// durable returns once a snapshot taken at or after sequence want is on disk.
//
// This is group commit, and it is what keeps a write-through store off the
// wrong side of an O(n²). Writing the whole file per create means a burst of
// N creates costs N full rewrites, each one longer than the last, and the tail
// latency goes with it. Here the first caller in takes a snapshot and writes
// it; everyone who mutated before that snapshot was taken finds their sequence
// already saved and returns without writing anything. One disk write can
// therefore satisfy any number of waiting callers, which is exactly the trade
// a database makes when it batches commits into one fsync.
//
// saveMu covers snapshot and write together, so the snapshot on disk is always
// the newest one written: no ordering guard needed, because there is no window
// in which two writers can pass each other.
func (s *Store) durable(want uint64) error {
	s.saveMu.Lock()
	defer s.saveMu.Unlock()

	s.mu.Lock()
	if s.saved >= want {
		s.mu.Unlock()
		return nil // somebody else's write already covered this change
	}
	snap, seq := s.snapshotLocked()
	s.mu.Unlock()

	if err := s.writeFile(snap); err != nil {
		return err
	}

	s.mu.Lock()
	if seq > s.saved {
		s.saved = seq
	}
	s.mu.Unlock()
	return nil
}

// writeFile puts one snapshot on disk atomically: a temp file in the same
// directory, then a rename over the target. A rename within a directory is
// atomic on every platform this runs on, so a reader sees the old file or the
// new one and never a half written one.
func (s *Store) writeFile(snap []byte) error {
	dir := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(dir, ".linkd-*.tmp")
	if err != nil {
		return fmt.Errorf("create temp store: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once the rename succeeds

	if _, err := tmp.Write(snap); err != nil {
		tmp.Close()
		return fmt.Errorf("write temp store: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync temp store: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp store: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		return fmt.Errorf("rename store into place: %w", err)
	}
	return nil
}

// runFlusher batches click writes until ctx is done, then flushes once more so
// a graceful shutdown loses nothing at all.
func (s *Store) runFlusher(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			if err := s.flush(); err != nil {
				logf("final flush: %v", err)
			}
			return
		case <-t.C:
			if err := s.flush(); err != nil {
				logf("flush: %v", err)
			}
		}
	}
}
