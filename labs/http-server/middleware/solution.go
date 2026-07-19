//go:build solution

// Package middleware: reference implementation. Compiled only with
// -tags solution; go test without the tag never sees this file. Do not
// read it until your own run is green.
package middleware

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Middleware wraps one http.Handler in another.
type Middleware func(http.Handler) http.Handler

// Chain applies mws to h, first middleware outermost.
func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// statusRecorder captures what the handler wrote, because
// http.ResponseWriter has no way to read the status back.
type statusRecorder struct {
	http.ResponseWriter
	status int
	size   int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	n, err := r.ResponseWriter.Write(b)
	r.size += n
	return n, err
}

// LoggingMiddleware logs one slog line per request: method, path, status,
// response bytes, duration.
func LoggingMiddleware(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			start := time.Now()
			next.ServeHTTP(rec, r)
			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"bytes", rec.size,
				"duration", time.Since(start),
			)
		})
	}
}

// contextKey is unexported so no other package can collide with our
// context values: context lookup is by type and value, and nobody outside
// this package can construct this type.
type contextKey string

const userKey contextKey = "user"

// AuthMiddleware validates "Authorization: Bearer <token>" against tokens
// (token to user identity) and stores the user in the request context.
func AuthMiddleware(tokens map[string]string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !ok {
				http.Error(w, "missing or malformed Authorization header", http.StatusUnauthorized)
				return
			}
			user, ok := tokens[token]
			if !ok {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), userKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserFromContext returns the identity AuthMiddleware stored, if any.
func UserFromContext(ctx context.Context) (string, bool) {
	user, ok := ctx.Value(userKey).(string)
	return user, ok
}

// bucket is one client's token bucket. tokens is fractional on purpose:
// refill is continuous (elapsed seconds times rate), and fractions must
// accumulate between requests or slow refills would never add up.
type bucket struct {
	tokens   float64
	lastSeen time.Time
}

// RateLimitMiddleware allows each client IP a burst of n requests, then n
// per second, and answers 429 when the bucket is empty. Buckets live in a
// map guarded by a mutex: requests from different connections run on
// different goroutines, so every access to shared state must be
// synchronized or the race detector will call it out. A background
// goroutine evicts IPs idle for over three minutes.
func RateLimitMiddleware(n int) Middleware {
	var (
		mu      sync.Mutex
		buckets = make(map[string]*bucket)
	)
	rate := float64(n)

	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			mu.Lock()
			for ip, b := range buckets {
				if time.Since(b.lastSeen) > 3*time.Minute {
					delete(buckets, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}

			now := time.Now()
			mu.Lock()
			b, ok := buckets[ip]
			if !ok {
				b = &bucket{tokens: rate}
				buckets[ip] = b
			} else {
				b.tokens = min(rate, b.tokens+now.Sub(b.lastSeen).Seconds()*rate)
			}
			b.lastSeen = now
			allowed := b.tokens >= 1
			if allowed {
				b.tokens--
			}
			mu.Unlock()

			if !allowed {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
