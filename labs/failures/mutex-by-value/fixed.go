//go:build fixed

// The fix: pickers take *Store, so every goroutine locks the same mutex
// that guards the same map. A sync.Mutex is state, not decoration; copying
// a struct that contains one forks the lock while the map header inside
// keeps pointing at the shared storage. Passing the pointer keeps lock and
// data travelling together, which is the only arrangement under which
// "lock, write, unlock" means anything.
package main

import (
	"fmt"
	"sync"
)

const (
	pickers        = 8
	picksPerPicker = 50000
)

// Store is the shared tally: a mutex and the map it guards.
type Store struct {
	mu     sync.Mutex
	counts map[string]int
}

func (s *Store) total() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	sum := 0
	for _, n := range s.counts {
		sum += n
	}
	return sum
}

func picker(s *Store, items []string, wg *sync.WaitGroup) {
	defer wg.Done()
	for i := 0; i < picksPerPicker; i++ {
		item := items[i%len(items)]
		s.mu.Lock()
		s.counts[item]++
		s.mu.Unlock()
	}
}

func main() {
	store := Store{counts: make(map[string]int)}
	items := []string{"widget", "gadget", "sprocket", "flange"}

	var wg sync.WaitGroup
	for p := 0; p < pickers; p++ {
		wg.Add(1)
		go picker(&store, items, &wg)
	}
	wg.Wait()

	fmt.Printf("recorded %d of %d picks\n", store.total(), pickers*picksPerPicker)
}
