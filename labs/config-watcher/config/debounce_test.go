package config

import (
	"context"
	"testing"
	"time"
)

// The debounce suite. Both tests assert counts and ordering, never "fired
// within N milliseconds", so they hold on a loaded machine: every deadline
// below is at least an order of magnitude wider than the window it guards.
//
// events is buffered in both tests. A correct Debounce receives every send,
// so the buffer never fills, but a stub that returns immediately would
// deadlock an unbuffered send and hang the suite instead of failing it.

// TestDebounceCollapsesBurst is the reason the debounce exists: one save
// produces a burst of file system events, and the config must be parsed once.
func TestDebounceCollapsesBurst(t *testing.T) {
	const window = 50 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	events := make(chan struct{}, 8)
	fires := make(chan struct{}, 8)
	go Debounce(ctx, events, window, func() { fires <- struct{}{} })

	// One save, five events, roughly the way an editor writes.
	for i := 0; i < 5; i++ {
		events <- struct{}{}
		time.Sleep(window / 10)
	}

	select {
	case <-fires:
	case <-time.After(2 * time.Second):
		t.Fatal("debounce never fired: once the burst goes quiet for a full window, the timer must run fire")
	}

	// Every event has to stop the timer the previous event started. Without
	// the Stop, all five timers survive and fire a window after their own
	// event, so the second fire lands here a few milliseconds after the first.
	select {
	case <-fires:
		t.Fatal("debounce fired more than once for a single burst: each event must stop the pending timer before starting a new one")
	case <-time.After(5 * window):
	}
}

// TestDebounceStopsOnContextCancel covers the shutdown half of the contract.
// The timer is the loop's outstanding obligation: returning does not cancel
// it, so a reload armed just before shutdown otherwise fires into a store
// nobody reads any more.
func TestDebounceStopsOnContextCancel(t *testing.T) {
	const window = 200 * time.Millisecond

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	events := make(chan struct{}, 8)
	fires := make(chan struct{}, 8)
	done := make(chan struct{})
	go func() {
		defer close(done)
		Debounce(ctx, events, window, func() { fires <- struct{}{} })
	}()

	// Prove the loop is alive before testing how it dies, so a Debounce that
	// never starts cannot pass this by doing nothing.
	events <- struct{}{}
	select {
	case <-fires:
	case <-time.After(2 * time.Second):
		t.Fatal("debounce never fired: get TestDebounceCollapsesBurst green first")
	}

	// Arm a fresh timer, then cancel with most of the window still on the
	// clock. The sleep only needs to outlast one channel receive.
	events <- struct{}{}
	time.Sleep(window / 10)
	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Debounce did not return after ctx was cancelled: the loop must select on ctx.Done(), not just on events")
	}

	select {
	case <-fires:
		t.Fatal("a reload fired after shutdown: the pending timer must be stopped on the way out, because returning from Debounce does not cancel it")
	case <-time.After(3 * window):
	}
}
