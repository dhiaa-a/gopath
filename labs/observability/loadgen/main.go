// Command loadgen fires concurrent GET requests at the service so a CPU
// profile has real samples to work with. It exists so this lab needs no
// external load tool; if you have hey or ab installed, they do the same job.
//
//	go run ./loadgen -n 10000 -c 50
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	url := flag.String("url", "http://127.0.0.1:8080/process", "target URL")
	n := flag.Int("n", 10000, "total requests")
	c := flag.Int("c", 50, "concurrent workers")
	flag.Parse()
	if *n < 1 || *c < 1 {
		log.Fatalf("-n and -c must be >= 1, got -n %d -c %d", *n, *c)
	}

	var (
		wg     sync.WaitGroup
		failed atomic.Int64
		jobs   = make(chan struct{})
	)
	client := &http.Client{Timeout: 30 * time.Second}

	start := time.Now()
	for i := 0; i < *c; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				resp, err := client.Get(*url)
				if err != nil {
					failed.Add(1)
					continue
				}
				// Drain the body so the connection is reused; a dropped body
				// forces a new TCP connection per request and skews the load.
				_, _ = io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					failed.Add(1)
				}
			}
		}()
	}
	for i := 0; i < *n; i++ {
		jobs <- struct{}{}
	}
	close(jobs)
	wg.Wait()
	elapsed := time.Since(start)

	if f := failed.Load(); f > 0 {
		log.Fatalf("%d of %d requests failed; is the service running on %s?", f, *n, *url)
	}
	fmt.Printf("%d requests in %s (%.0f req/s)\n", *n, elapsed.Round(time.Millisecond), float64(*n)/elapsed.Seconds())
}
