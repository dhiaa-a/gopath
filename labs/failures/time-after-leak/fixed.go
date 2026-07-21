//go:build fixed

// The fix that works on every Go version: one timer for the whole loop,
// re-armed with Reset before each wait, stopped when the loop is done.
// time.After creates a fresh timer per call and nothing can stop it before
// it fires, so under the pre-1.23 timer implementation every iteration
// parks another one-hour timer in the runtime's timer heap. A single
// NewTimer allocates once, and Reset re-arms that same runtime timer for
// free. (The other fix is one line in go.mod: declare go 1.23 or newer and
// time.After stops leaking on its own. This module keeps the 1.22 pin so
// the broken variant stays reproducible.)
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

	watchdog := time.NewTimer(time.Hour)
	defer watchdog.Stop()

	handled := 0
	for i := 0; i < events; i++ {
		watchdog.Reset(time.Hour)
		select {
		case <-queue:
			handled++
		case <-watchdog.C:
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
