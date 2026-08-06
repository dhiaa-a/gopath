// Command slo holds a capstone submission to its service level objectives.
//
// It builds -target, seeds it with links, and runs a mixed workload of
// redirects and API calls at a fixed concurrency for a fixed time. Four
// numbers come out, and all four have to clear their threshold: error rate,
// p99 latency, throughput, and goroutine growth.
//
// The per-token rate limit is raised for the run. The limiter is a correctness
// requirement checked by the suite, not the thing being measured here, and
// leaving it at 100 would mean measuring how fast the service can say no.
//
//	go run ./slo -target ./mine
//	go run ./slo -target ./mine -scale 2     halve the bar on a loaded machine
package main

import (
	"flag"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"gopath.dev/labs/capstone/internal/harness"
)

// Thresholds at -scale 1. These are set from measurement on an ordinary
// laptop with room to spare, not from what looked like a nice round number:
// the point is to fail a service that holds a global lock across a disk write
// or leaks a goroutine per request, not to rank fast machines.
const (
	maxP99         = 50 * time.Millisecond
	minThroughput  = 1500.0 // requests per second
	maxGoroutineUp = 40
)

func main() {
	target := flag.String("target", "./reference", "package directory to build and measure")
	duration := flag.Duration("duration", 10*time.Second, "how long to hold the load")
	concurrency := flag.Int("concurrency", 50, "concurrent clients")
	scale := flag.Float64("scale", 1, "relax every threshold by this factor")
	flag.Parse()

	if *scale < 1 {
		fmt.Fprintln(os.Stderr, "slo: -scale below 1 would tighten the bar; use 1 or more")
		os.Exit(1)
	}

	fmt.Printf("── service level objectives: %s\n", *target)
	if *scale != 1 {
		fmt.Printf("   thresholds relaxed by %gx. Passing with -scale is not passing.\n", *scale)
	}
	if tick := clockGranularity(); tick > 50*time.Microsecond {
		fmt.Printf("   note: this machine's monotonic clock ticks every %v, so anything\n", tick.Round(time.Microsecond))
		fmt.Printf("   faster than that measures as 0. The low percentiles are quantised;\n")
		fmt.Printf("   p99 is far above the tick and is the objective that carries weight.\n")
	}

	if err := measure(*target, *duration, *concurrency, *scale); err != nil {
		fmt.Fprintf(os.Stderr, "\n%v\n", err)
		os.Exit(1)
	}
}

func measure(target string, duration time.Duration, concurrency int, scale float64) error {
	built, err := harness.Build(target)
	if err != nil {
		return err
	}

	dir, err := os.MkdirTemp("", "linkd-slo-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)

	tokens, err := harness.WriteTokens(dir, map[string]string{"tok_load": "load"})
	if err != nil {
		return err
	}

	p, err := built.Start(harness.Options{
		Data:   filepath.Join(dir, "store.json"),
		Tokens: tokens,
		Rate:   1e7, // the limiter is not what is being measured
	})
	if err != nil {
		return err
	}
	defer p.Kill()

	codes, err := seedLinks(p, 50)
	if err != nil {
		return err
	}

	// Warm up, then take the goroutine baseline once it has stopped moving.
	// A baseline taken cold charges the target for goroutines that were
	// always going to exist.
	if _, err := runLoad(p, codes, 2*time.Second, concurrency); err != nil {
		return err
	}
	p.HTTP().CloseIdleConnections()
	base, ok := settledGoroutines(p)
	if !ok {
		return fmt.Errorf("goroutine count never settled before the run; nothing can be measured against it")
	}

	fmt.Printf("   %d clients, %s, 90%% redirects / 10%% API, from a %d goroutine baseline\n",
		concurrency, duration, base)

	res, err := runLoad(p, codes, duration, concurrency)
	if err != nil {
		return err
	}
	p.HTTP().CloseIdleConnections()
	after, settled := settledGoroutines(p)

	return report(res, base, after, settled, scale)
}

type result struct {
	latencies []time.Duration
	errors    int
	firstErr  string
	elapsed   time.Duration
}

func (r *result) rps() float64 {
	if r.elapsed <= 0 {
		return 0
	}
	return float64(len(r.latencies)+r.errors) / r.elapsed.Seconds()
}

func seedLinks(p *harness.Proc, n int) ([]string, error) {
	codes := make([]string, 0, n)
	for i := 0; i < n; i++ {
		r, err := p.Do("POST", "/api/links", "tok_load", map[string]any{
			"url": fmt.Sprintf("https://example.com/seed/%d", i),
		})
		if err != nil {
			return nil, fmt.Errorf("seeding links: %w", err)
		}
		if r.Status != http.StatusCreated {
			return nil, fmt.Errorf("seeding links: POST /api/links returned %d, want 201", r.Status)
		}
		var l harness.Link
		if err := r.JSON(&l); err != nil {
			return nil, fmt.Errorf("seeding links: %w", err)
		}
		codes = append(codes, l.Code)
	}
	return codes, nil
}

func runLoad(p *harness.Proc, codes []string, duration time.Duration, concurrency int) (*result, error) {
	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		all     []time.Duration
		errors  int
		firstEr string
	)

	deadline := time.Now().Add(duration)
	start := time.Now()

	for w := 0; w < concurrency; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(int64(w)*7919 + 1))
			local := make([]time.Duration, 0, 4096)
			localErrs := 0
			localFirst := ""

			for time.Now().Before(deadline) {
				op := rng.Intn(100)
				began := time.Now()
				var (
					status int
					want   int
					err    error
				)

				switch {
				case op < 90: // redirect
					var r *harness.Resp
					r, err = p.Do("GET", "/"+codes[rng.Intn(len(codes))], "", nil)
					want = http.StatusFound
					if r != nil {
						status = r.Status
					}
				case op < 98: // read one link's stats
					var r *harness.Resp
					r, err = p.Do("GET", "/api/links/"+codes[rng.Intn(len(codes))], "tok_load", nil)
					want = http.StatusOK
					if r != nil {
						status = r.Status
					}
				default: // create
					var r *harness.Resp
					r, err = p.Do("POST", "/api/links", "tok_load", map[string]any{
						"url": fmt.Sprintf("https://example.com/load/%d/%d", w, len(local)),
					})
					want = http.StatusCreated
					if r != nil {
						status = r.Status
					}
				}

				took := time.Since(began)
				switch {
				case err != nil:
					localErrs++
					if localFirst == "" {
						localFirst = err.Error()
					}
				case status != want:
					localErrs++
					if localFirst == "" {
						localFirst = fmt.Sprintf("status %d, want %d", status, want)
					}
				default:
					local = append(local, took)
				}
			}

			mu.Lock()
			all = append(all, local...)
			errors += localErrs
			if firstEr == "" {
				firstEr = localFirst
			}
			mu.Unlock()
		}(w)
	}
	wg.Wait()

	res := &result{latencies: all, errors: errors, firstErr: firstEr, elapsed: time.Since(start)}
	if len(res.latencies) == 0 {
		return nil, fmt.Errorf("not one request succeeded in %s: %s", duration, res.firstErr)
	}
	return res, nil
}

func settledGoroutines(p *harness.Proc) (int, bool) {
	last, stable := -1, 0
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		m, err := p.Metrics()
		if err != nil {
			return last, false
		}
		if m.Goroutines == last {
			if stable++; stable >= 3 {
				return m.Goroutines, true
			}
		} else {
			last, stable = m.Goroutines, 0
		}
		time.Sleep(150 * time.Millisecond)
	}
	return last, false
}

// clockGranularity measures the smallest gap this machine's monotonic clock
// can actually report, by reading it back to back until two reads differ.
//
// It is here because on some systems, Windows among them, that gap is around
// half a millisecond. Latencies below it come back as exactly zero, which
// looks like a suspiciously fast service rather than a clock that cannot see
// that far. Better to measure the instrument and say so than to print a p50 of
// 0s and let somebody believe it.
func clockGranularity() time.Duration {
	best := time.Hour
	for i := 0; i < 50000; i++ {
		a := time.Now()
		b := time.Now()
		if d := b.Sub(a); d > 0 && d < best {
			best = d
		}
	}
	if best == time.Hour {
		return 0
	}
	return best
}

func percentile(sorted []time.Duration, q float64) time.Duration {
	if len(sorted) == 0 {
		return 0
	}
	i := int(q * float64(len(sorted)))
	if i >= len(sorted) {
		i = len(sorted) - 1
	}
	return sorted[i]
}

func report(res *result, base, after int, settled bool, scale float64) error {
	sort.Slice(res.latencies, func(i, j int) bool { return res.latencies[i] < res.latencies[j] })

	p50 := percentile(res.latencies, 0.50)
	p99 := percentile(res.latencies, 0.99)
	rps := res.rps()
	growth := after - base

	wantP99 := time.Duration(float64(maxP99) * scale)
	wantRPS := minThroughput / scale
	wantGrowth := int(float64(maxGoroutineUp) * scale)

	fmt.Println()
	failed := 0
	line := func(ok bool, name, got, want string) {
		mark := "ok  "
		if !ok {
			mark = "FAIL"
			failed++
		}
		fmt.Printf("  %s  %-18s %-16s (%s)\n", mark, name, got, want)
	}

	line(res.errors == 0, "error rate",
		fmt.Sprintf("%d of %d", res.errors, len(res.latencies)+res.errors),
		"want 0")
	line(p99 <= wantP99, "p99 latency", p99.Round(time.Microsecond).String(),
		"want at or under "+wantP99.String())
	line(rps >= wantRPS, "throughput", fmt.Sprintf("%.0f req/s", rps),
		fmt.Sprintf("want at least %.0f req/s", wantRPS))
	line(settled && growth <= wantGrowth, "goroutine growth", fmt.Sprintf("%d to %d", base, after),
		fmt.Sprintf("want at most +%d", wantGrowth))

	fmt.Printf("\n   %d requests in %s. min %s, p50 %s, p90 %s, p99 %s, p99.9 %s, max %s\n",
		len(res.latencies)+res.errors, res.elapsed.Round(time.Millisecond),
		res.latencies[0].Round(time.Microsecond),
		p50.Round(time.Microsecond),
		percentile(res.latencies, 0.90).Round(time.Microsecond),
		p99.Round(time.Microsecond),
		percentile(res.latencies, 0.999).Round(time.Microsecond),
		res.latencies[len(res.latencies)-1].Round(time.Microsecond))

	if res.errors > 0 {
		fmt.Printf("   first error: %s\n", res.firstErr)
	}
	if !settled {
		fmt.Println("   the goroutine count was still moving 10s after the load stopped")
	}

	fmt.Println()
	if failed > 0 {
		return fmt.Errorf("slo: %d of 4 objective(s) missed", failed)
	}
	fmt.Println("slo: ok — 4 of 4 objectives met")
	return nil
}
