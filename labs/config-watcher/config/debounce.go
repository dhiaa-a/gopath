//go:build !solution

// This file is yours, like store.go. Port your step 02 debounce loop into it,
// or build it here first and copy it back into your project. The stub
// compiles and does nothing, so the failing tests, not the compiler, tell you
// what is left.
package config

import (
	"context"
	"time"
)

// Debounce collapses a burst of events into one call to fire.
//
// An editor saving a file does not produce one file system event. It produces
// a burst: truncate, write, chmod, rename, often five or more within a few
// milliseconds. Reloading on each one parses the same file five times, and
// worse, parses it while it is still half written.
//
// The contract:
//
//   - Every event restarts the clock. fire runs only once the events have
//     been quiet for a full window.
//   - A burst of any length produces exactly one fire.
//   - When ctx is cancelled, Debounce returns and no pending fire runs after
//     it. A reload landing after shutdown writes config into a store nobody
//     is reading any more.
//   - Debounce blocks until ctx is cancelled or events is closed. The caller
//     runs it in a goroutine.
//
// fire runs on the timer's own goroutine, not on this one. time.AfterFunc
// spawns it. That is why fire must be safe to call while this loop is still
// receiving events, and why store(*Config) has to be concurrency-safe rather
// than merely correct in a single goroutine.
func Debounce(ctx context.Context, events <-chan struct{}, window time.Duration, fire func()) {
	// TODO: loop forever, selecting over ctx.Done() and events.
	//
	// On ctx.Done(): stop any pending timer, then return.
	// On an event: stop any pending timer, then start a new one with
	// time.AfterFunc(window, fire).
	//
	// The zero value of *time.Timer is nil, so guard the Stop calls until
	// the first event has armed one.
}
