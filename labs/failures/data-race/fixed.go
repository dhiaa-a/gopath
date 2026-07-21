//go:build fixed

// The fix: the counter is written by eight goroutines at once, so the
// increment itself has to be indivisible. atomic.Int64 makes each Add one
// uninterruptible hardware operation; the WaitGroup still provides the
// happens-before edge that makes the final Load safe to print. For a bare
// counter this is the right tool. A sync.Mutex would also be correct, and
// becomes necessary the moment the critical section grows beyond a single
// number.
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

const (
	workers       = 8
	hitsPerWorker = 125000
)

func main() {
	var hits atomic.Int64
	var wg sync.WaitGroup

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < hitsPerWorker; i++ {
				hits.Add(1)
			}
		}()
	}
	wg.Wait()

	want := int64(workers * hitsPerWorker)
	got := hits.Load()
	fmt.Printf("counted %d of %d hits\n", got, want)
	fmt.Printf("lost: %d\n", want-got)
}
