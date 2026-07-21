//go:build fixed

// The fix is one rule applied twice: every wg.Add must happen before
// wg.Wait starts. So Add(1) moves out of the worker and in front of the
// go statement, and dispatch moves back onto main instead of running as
// a background goroutine, because a dispatcher that races Wait breaks
// the rule the same way the workers did. When Wait finally runs, the
// counter already holds the whole batch.
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

// dispatch fans one worker goroutine out per order, registering each job
// with the wait group before its goroutine starts.
func dispatch(orders []int, wg *sync.WaitGroup) {
	for _, order := range orders {
		wg.Add(1)
		go func() {
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

	// Dispatch, wait for the group, then reconcile.
	var wg sync.WaitGroup
	dispatch(orders, &wg)
	wg.Wait()

	done := completed.Load()
	fmt.Printf("dispatched %d jobs\n", jobs)
	fmt.Printf("completed %d of %d jobs (%d unaccounted)\n", done, jobs, int64(jobs)-done)
}
