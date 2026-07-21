//go:build !fixed

// checksummer reports a CRC-32 for every input, one line each. The channel
// is there so the checksumming and the reporting are decoupled: producers
// put results on the channel, the report loop drains it.
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

	// Produce: checksum every input onto the channel.
	for name, data := range inputs {
		results <- result{name: name, sum: crc32.ChecksumIEEE(data)}
	}
	close(results)

	// Consume: drain the channel and print the report.
	for r := range results {
		fmt.Printf("%-12s %08x\n", r.name, r.sum)
	}
}
