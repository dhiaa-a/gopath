//go:build !fixed

// hitcount simulates one night of traffic against a page-hit counter: a
// fixed pool of workers each records its share of hits, and main prints
// the total once the WaitGroup says every worker has finished. The "lost"
// line was added while chasing an analytics discrepancy: it compares the
// counted total against the number of hits the workers were given.
package main

import (
	"fmt"
	"sync"
)

const (
	workers       = 8
	hitsPerWorker = 125000
)

func main() {
	var hits int
	var wg sync.WaitGroup

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < hitsPerWorker; i++ {
				hits++
			}
		}()
	}
	wg.Wait()

	want := workers * hitsPerWorker
	fmt.Printf("counted %d of %d hits\n", hits, want)
	fmt.Printf("lost: %d\n", want-hits)
}
