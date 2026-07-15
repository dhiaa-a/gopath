package config

import (
	"fmt"
	"strconv"
	"sync"
	"testing"
)

// Both stores promise the same contract, so the suite is a table over both:
// Load returns the exact *Config most recently stored, a replace swaps the
// pointer without touching the old value, and concurrent readers never see
// nil or a half-written config.
//
// The suite lives in the package (not an external _test package) because the
// project deliberately keeps the writer side private: only reload() calls
// store(*Config), so it is lowercase. In-package tests are how the suite
// reaches it while your program keeps the narrow surface.

type configStore interface {
	Load() *Config
	store(*Config)
}

var stores = []struct {
	name    string
	factory func(*Config) configStore
}{
	{"atomic", func(c *Config) configStore { return NewStore(c) }},
	{"rwmutex", func(c *Config) configStore { return NewMutexStore(c) }},
}

// snapshot builds a Config whose two fields are derived from the same n, so
// a reader can tell a whole config from a torn one: if Port and LogLevel
// ever disagree, the reader saw parts of two different snapshots, which the
// pointer-swap design makes impossible.
func snapshot(n int) *Config {
	return &Config{Port: n, LogLevel: "v" + strconv.Itoa(n)}
}

func TestLoadReturnsInitialConfig(t *testing.T) {
	for _, tc := range stores {
		t.Run(tc.name, func(t *testing.T) {
			initial := &Config{Port: 8080, LogLevel: "info"}
			s := tc.factory(initial)
			got := s.Load()
			if got == nil {
				t.Fatal("Load returned nil: the constructor must store the initial config before anyone can call Load")
			}
			if got != initial {
				t.Errorf("Load returned %+v, want the exact *Config passed to the constructor (%+v)", got, initial)
			}
		})
	}
}

func TestStoreReplacesConfig(t *testing.T) {
	for _, tc := range stores {
		t.Run(tc.name, func(t *testing.T) {
			first := &Config{Port: 8080, LogLevel: "info"}
			second := &Config{Port: 9090, LogLevel: "debug"}
			s := tc.factory(first)

			s.store(second)

			if got := s.Load(); got != second {
				t.Errorf("after store(second), Load returned %+v, want %+v", got, second)
			}
			// A reload swaps the pointer; it never writes into the old
			// value. A reader that grabbed the old snapshot before the
			// reload is still using it and must see it intact.
			if first.Port != 8080 || first.LogLevel != "info" {
				t.Errorf("store mutated the previous config in place: %+v", first)
			}
		})
	}
}

// TestConcurrentLoadStore hammers Load from several goroutines while the
// writer replaces the config a thousand times, exactly the shape of the real
// program: HTTP handlers loading on every request, reload() storing rarely.
// It fails if any reader sees nil or a torn config. Run it with -race where
// cgo is available; both implementations must stay clean under it.
func TestConcurrentLoadStore(t *testing.T) {
	for _, tc := range stores {
		t.Run(tc.name, func(t *testing.T) {
			const (
				readers = 8
				writes  = 1000
			)
			s := tc.factory(snapshot(0))

			var wg sync.WaitGroup
			stop := make(chan struct{})
			errs := make(chan string, readers)

			for i := 0; i < readers; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for {
						select {
						case <-stop:
							return
						default:
						}
						cfg := s.Load()
						if cfg == nil {
							errs <- "Load returned nil while stores were in flight"
							return
						}
						if want := "v" + strconv.Itoa(cfg.Port); cfg.LogLevel != want {
							errs <- fmt.Sprintf("torn read: Port=%d but LogLevel=%q; a config was mutated instead of swapped", cfg.Port, cfg.LogLevel)
							return
						}
					}
				}()
			}

			for i := 1; i <= writes; i++ {
				s.store(snapshot(i))
			}
			close(stop)
			wg.Wait()
			close(errs)

			for msg := range errs {
				t.Error(msg)
			}
			if got := s.Load(); got == nil || got.Port != writes {
				t.Errorf("after the last store, Load returned %+v, want Port=%d", got, writes)
			}
		})
	}
}
