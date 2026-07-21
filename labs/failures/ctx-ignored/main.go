//go:build !fixed

// exportrun drains one batch of report exports. A batch can be abandoned
// mid-run (a deploy is starting, or the user gave up waiting), so the
// worker takes a context, and after the run main reconciles the work
// against the cancellation timestamp. The re-queue job depends on those
// numbers being right.
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// A record notes one finished export and when its work began, measured
// from batch start, so the reconciler can line it up against the cancel.
type record struct {
	name      string
	startedAt time.Duration
}

// process exports the items in order and returns a record for each one.
// It takes ctx so a caller can abandon the batch partway through.
func process(ctx context.Context, items []string, start time.Time) []record {
	var log []record
	for _, item := range items {
		startedAt := time.Since(start)
		export(item)
		log = append(log, record{name: item, startedAt: startedAt})
	}
	return log
}

// export stands in for the real work: about 10ms of render and upload.
func export(item string) {
	time.Sleep(10 * time.Millisecond)
}

func main() {
	items := make([]string, 20)
	for i := range items {
		items[i] = fmt.Sprintf("report-%02d", i+1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	start := time.Now()

	var wg sync.WaitGroup
	var log []record
	wg.Add(1)
	go func() {
		defer wg.Done()
		log = process(ctx, items, start)
	}()

	// 45ms in, the deploy window opens: abandon the batch.
	time.Sleep(45 * time.Millisecond)
	cancel()
	cancelAt := time.Since(start)
	fmt.Printf("cancel sent at %dms\n", cancelAt.Milliseconds())

	wg.Wait()

	late := 0
	for _, r := range log {
		if r.startedAt > cancelAt {
			late++
		}
	}
	fmt.Printf("worker returned at %dms\n", time.Since(start).Milliseconds())
	fmt.Printf("processed %d/%d items, cancelled=true, obeyed=%t\n", len(log), len(items), late == 0)
	fmt.Printf("items started after cancel: %d\n", late)
}
