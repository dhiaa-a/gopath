//go:build fixed

// The fix: an unbuffered channel needs both sides live at once, so the
// producer gets its own goroutine and the consumer stays on main. The
// producer owns the channel: it is the only sender, so it is the one that
// closes (see the channel-ownership concept).
package main

import (
	"fmt"
	"hash/crc32"
)

type result struct {
	name string
	sum  uint32
}

func main() {
	inputs := map[string][]byte{
		"invoice.pdf": []byte("fake pdf bytes"),
		"photo.jpg":   []byte("fake jpg bytes"),
		"notes.txt":   []byte("plain text"),
	}

	results := make(chan result)

	// Produce on a separate goroutine, so a receiver exists while we send.
	go func() {
		for name, data := range inputs {
			results <- result{name: name, sum: crc32.ChecksumIEEE(data)}
		}
		close(results)
	}()

	// Consume: drain the channel and print the report.
	for r := range results {
		fmt.Printf("%-12s %08x\n", r.name, r.sum)
	}
}
