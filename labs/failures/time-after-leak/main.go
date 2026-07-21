//go:build !fixed

// drain consumes a burst of queued events, guarding each receive with a
// one-hour watchdog so a stalled producer cannot wedge the loop forever.
// The producer for this run has already finished and closed the queue, so
// every receive is ready immediately: the loop runs at full speed. The
// memory instrumentation exists because the service this loop came from
// kept growing between bursts; the numbers here reproduce that on a small
// scale.
package main

import (
	"fmt"
	"runtime"
	"time"
)

const events = 200000

func main() {
	queue := make(chan int)
	close(queue)

	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)

	handled := 0
	for i := 0; i < events; i++ {
		select {
		case <-queue:
			handled++
		case <-time.After(time.Hour):
			fmt.Println("watchdog: producer stalled")
			return
		}
	}

	runtime.GC()
	runtime.ReadMemStats(&after)

	retained := int64(after.HeapAlloc) - int64(before.HeapAlloc)
	if retained < 0 {
		retained = 0
	}
	fmt.Printf("drained %d events\n", handled)
	fmt.Printf("heap retained %.1f MB after GC\n", float64(retained)/(1<<20))
}
