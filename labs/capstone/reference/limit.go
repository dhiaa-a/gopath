package main

import (
	"math"
	"sync"
	"time"
)

// limiter is one token bucket per token, refilling at rate per second with a
// capacity of rate. Buckets are created on first use and are independent: one
// token draining its bucket has no effect on any other.
//
// Refill is computed from the elapsed time rather than driven by a ticker, so
// there is no goroutine per token and an idle service costs nothing. A
// background ticker per bucket is the version of this that leaks.
type limiter struct {
	rate float64
	now  func() time.Time // swappable so the behaviour is testable without sleeping

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newLimiter(rate float64) *limiter {
	return &limiter{rate: rate, now: time.Now, buckets: map[string]*bucket{}}
}

// allow consumes one token for key. When the bucket is empty it reports how
// long the caller should wait, rounded up to whole seconds with a floor of one,
// which is what Retry-After carries.
func (l *limiter) allow(key string) (bool, int) {
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.rate, last: now}
		l.buckets[key] = b
	}

	if elapsed := now.Sub(b.last).Seconds(); elapsed > 0 {
		b.tokens = math.Min(l.rate, b.tokens+elapsed*l.rate)
		b.last = now
	}

	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}

	wait := (1 - b.tokens) / l.rate
	retry := int(math.Ceil(wait))
	if retry < 1 {
		retry = 1
	}
	return false, retry
}
