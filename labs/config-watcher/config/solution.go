//go:build solution

// Reference implementations. Do not open this file until go test ./... is
// green against your own store.go; it exists so CI can prove the suite and
// the gate are passable.
package config

import (
	"sync"
	"sync/atomic"
)

// Store keeps the current *Config in an atomic.Value. Both fields of the
// contract from step 03 are visible here: the constructor stores before
// anyone can load (the first Load on an empty atomic.Value would panic on
// the type assertion), and only *Config pointers ever go in, so the type
// assertion in Load always holds.
type Store struct {
	v atomic.Value
}

func NewStore(initial *Config) *Store {
	s := &Store{}
	s.v.Store(initial)
	return s
}

// Load is the whole point of the design: one atomic pointer read and a type
// assertion. No lock word is written, so parallel readers never invalidate
// each other's cache lines.
func (s *Store) Load() *Config {
	return s.v.Load().(*Config)
}

func (s *Store) store(c *Config) {
	s.v.Store(c)
}

// MutexStore is the same contract behind a sync.RWMutex. Correct, and the
// right default for most shared state; the benchmarks show what it costs on
// a read path hit from every request.
type MutexStore struct {
	mu  sync.RWMutex
	cfg *Config
}

func NewMutexStore(initial *Config) *MutexStore {
	return &MutexStore{cfg: initial}
}

// Load copies the pointer out under the read lock and unlocks before
// returning. No defer: the critical section is two instructions and this is
// the path being benchmarked, so it should not carry avoidable overhead.
func (s *MutexStore) Load() *Config {
	s.mu.RLock()
	cfg := s.cfg
	s.mu.RUnlock()
	return cfg
}

func (s *MutexStore) store(c *Config) {
	s.mu.Lock()
	s.cfg = c
	s.mu.Unlock()
}
