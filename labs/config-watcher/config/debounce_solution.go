//go:build solution

// Reference implementation. Do not open this file until go test ./... is
// green against your own debounce.go; it exists so CI can prove the suite is
// passable.
package config

import (
	"context"
	"time"
)

// Debounce is the step 02 loop. See debounce.go for the contract.
//
// The whole pattern is three lines: stop the old timer, start a new one, and
// let the last event standing win. Everything else here is shutdown.
func Debounce(ctx context.Context, events <-chan struct{}, window time.Duration, fire func()) {
	var timer *time.Timer

	// The pending timer is the one thing this loop owns that outlives it: it
	// holds a goroutine scheduled to run fire at some point in the future,
	// and returning does not cancel it. Stopping on the way out is what keeps
	// a reload from landing after shutdown.
	defer func() {
		if timer != nil {
			timer.Stop()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case _, ok := <-events:
			if !ok {
				// The producer closed the channel. A closed channel is
				// receive-ready forever, so without this the select would spin
				// on it at full speed.
				return
			}
			if timer != nil {
				// Stop reports false if this timer had already fired, meaning
				// a reload is already running. Harmless here: the callback
				// reads the file as it is now, and the next event will arm a
				// fresh timer anyway. It matters only if fire is expensive or
				// not safe to overlap with itself.
				timer.Stop()
			}
			timer = time.AfterFunc(window, fire)
		}
	}
}
