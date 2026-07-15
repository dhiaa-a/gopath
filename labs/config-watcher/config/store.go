//go:build !solution

// This file is yours. Port your step 03 and step 04 implementations into it,
// or build them here first and copy them back into your project. The stubs
// compile and return zero values, so the failing tests, not the compiler,
// tell you what is left.
package config

import (
	"sync"
	"sync/atomic"
)

// Store holds the current *Config in a sync/atomic.Value. Load is one atomic
// pointer read: no mutex, no contention, never blocked by a reload.
//
// The atomic.Value rules from step 03 apply: always store the same concrete
// type, and store the pointer (*Config), never the value (Config).
type Store struct {
	v atomic.Value
}

// NewStore returns a Store already holding initial. The first Load must
// never run before the first Store on the inner atomic.Value (it would
// panic on the type assertion), so the constructor does that store.
func NewStore(initial *Config) *Store {
	// TODO: put initial into s.v before anyone can call Load.
	return &Store{}
}

// Load returns the current config. Called on every request; this is the hot
// path the benchmarks measure.
func (s *Store) Load() *Config {
	// TODO: one atomic read, one type assertion.
	return nil
}

// store replaces the current config. Called by reload() after a successful
// parse; rare compared to Load.
func (s *Store) store(c *Config) {
	// TODO: one atomic write.
}

// MutexStore is the same API guarded by a sync.RWMutex, built in step 04 as
// the comparison point. Readers take RLock, the writer takes Lock.
type MutexStore struct {
	mu  sync.RWMutex
	cfg *Config
}

// NewMutexStore returns a MutexStore already holding initial.
func NewMutexStore(initial *Config) *MutexStore {
	// TODO: set cfg to initial.
	return &MutexStore{}
}

// Load returns the current config under a read lock.
func (s *MutexStore) Load() *Config {
	// TODO: RLock, read, RUnlock. Do not return while still holding the lock
	// unless you use defer.
	return nil
}

// store replaces the current config under the write lock.
func (s *MutexStore) store(c *Config) {
	// TODO: Lock, write, Unlock.
}
