//go:build !fixed

// shipnotify sends one shipment notification per order and reconciles the
// batch at the end: jobs completed versus jobs dispatched. A mismatch is
// supposed to show up here, in the run report, not in tomorrow's support
// queue.
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// completed counts deliveries that actually went out.
var completed atomic.Int64

// notify sends one notification: about 5ms of SMTP round trip, then the
// delivery counter.
func notify(order int) {
	time.Sleep(5 * time.Millisecond)
	completed.Add(1)
}

// dispatch fans one worker goroutine out per order. Each worker registers
// itself with the wait group as its first act, so a caller waiting on the
// group covers the whole batch.
func dispatch(orders []int, wg *sync.WaitGroup) {
	for _, order := range orders {
		go func() {
			wg.Add(1)
			defer wg.Done()
			notify(order)
		}()
	}
}

func main() {
	const jobs = 100
	orders := make([]int, jobs)
	for i := range orders {
		orders[i] = 58000 + i
	}

	// Dispatch in the background, wait for the group, then reconcile.
	var wg sync.WaitGroup
	go dispatch(orders, &wg)
	wg.Wait()

	done := completed.Load()
	fmt.Printf("dispatched %d jobs\n", jobs)
	fmt.Printf("completed %d of %d jobs (%d unaccounted)\n", done, jobs, int64(jobs)-done)
}
