//go:build fixed

// The fix: give the reply channel capacity 1. The worker's send now
// completes whether or not anyone is still listening, so when the budget
// expires and fetchQuote walks away with the cached quote, the abandoned
// worker finishes its call, deposits the result in the buffer, and exits.
// Once the goroutine is gone nothing references the channel, and the GC
// collects the buffer, unread quote and all.
package main

import (
	"fmt"
	"runtime"
	"time"
)

type quote struct {
	symbol string
	cents  int
}

// fetchQuote asks the upstream for a fresh price but never waits past
// budget: when the deadline hits, the caller gets the cached quote.
func fetchQuote(symbol string, budget time.Duration) (quote, bool) {
	ch := make(chan quote, 1)
	go func() {
		ch <- queryUpstream(symbol)
	}()
	select {
	case q := <-ch:
		return q, true
	case <-time.After(budget):
		return cachedQuote(symbol), false
	}
}

// queryUpstream stands in for the real HTTP call. Tonight the upstream
// is degraded: every call takes about 50ms, far over any request budget.
func queryUpstream(symbol string) quote {
	time.Sleep(50 * time.Millisecond)
	return quote{symbol: symbol, cents: 10218}
}

// cachedQuote is the fallback served when the upstream misses the budget.
func cachedQuote(symbol string) quote {
	return quote{symbol: symbol, cents: 10195}
}

func main() {
	const requests = 100
	const budget = 5 * time.Millisecond

	fmt.Printf("goroutines at start: %d\n", runtime.NumGoroutine())

	fresh, fromCache := 0, 0
	for i := 0; i < requests; i++ {
		if _, ok := fetchQuote("GOPH", budget); ok {
			fresh++
		} else {
			fromCache++
		}
	}

	// Drain window before the final telemetry read, mirroring the grace
	// period the real service gives in-flight upstream calls on shutdown.
	time.Sleep(2 * time.Second)

	fmt.Printf("handled %d requests: %d fresh, %d from cache\n", requests, fresh, fromCache)
	fmt.Printf("goroutines now: %d\n", runtime.NumGoroutine())
}
