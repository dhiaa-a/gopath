package main

import (
	"runtime"
	"sync/atomic"
	"time"
)

// metrics are the numbers /metrics reports. Plain atomics: a mutex here would
// put every handler in line behind every other handler for the sake of some
// counters, which is a fine way to build a service whose instrumentation is
// slower than its work.
type metrics struct {
	requestsTotal    atomic.Int64
	requestsInFlight atomic.Int64
	redirectsTotal   atomic.Int64
	rateLimitedTotal atomic.Int64
	start            time.Time
}

func newMetrics() *metrics { return &metrics{start: time.Now()} }

// snapshot is the JSON body of /metrics. linksTotal comes from the store
// rather than a counter, so it cannot drift away from what is actually there.
type snapshot struct {
	Goroutines       int     `json:"goroutines"`
	RequestsTotal    int64   `json:"requests_total"`
	RequestsInFlight int64   `json:"requests_in_flight"`
	RedirectsTotal   int64   `json:"redirects_total"`
	RateLimitedTotal int64   `json:"rate_limited_total"`
	LinksTotal       int     `json:"links_total"`
	UptimeSeconds    float64 `json:"uptime_seconds"`
}

func (m *metrics) snapshot(links int) snapshot {
	return snapshot{
		Goroutines:       runtime.NumGoroutine(),
		RequestsTotal:    m.requestsTotal.Load(),
		RequestsInFlight: m.requestsInFlight.Load(),
		RedirectsTotal:   m.redirectsTotal.Load(),
		RateLimitedTotal: m.rateLimitedTotal.Load(),
		LinksTotal:       links,
		UptimeSeconds:    time.Since(m.start).Seconds(),
	}
}
