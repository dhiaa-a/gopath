// Black-box suite for the middleware package: it imports the package and
// exercises only the exported API, exactly like a caller in server.go
// would. How you structure the inside is your call.
//
// Run it with the race detector on: go test -race ./...
// The rate limit test hits the limiter from concurrent goroutines, the
// same way a real server does; unsynchronized access to the bucket map
// shows up here as a detected race, not as flaky behavior in production.
package middleware_test

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"gopath.dev/labs/http-server/middleware"
)

// TestAuth covers the three auth cases: no header, invalid token, valid
// token. The suite is table-driven, the same shape you have written since
// Tier 1 P3.
func TestAuth(t *testing.T) {
	tokens := map[string]string{"s3cr3t-token": "ada"}

	tests := []struct {
		name       string
		header     string
		wantStatus int
		wantUser   string
	}{
		{
			name:       "no Authorization header",
			header:     "",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid token",
			header:     "Bearer wrong-token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "valid token",
			header:     "Bearer s3cr3t-token",
			wantStatus: http.StatusOK,
			wantUser:   "ada",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var handlerRan bool
			var gotUser string
			var gotOK bool
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handlerRan = true
				gotUser, gotOK = middleware.UserFromContext(r.Context())
				w.WriteHeader(http.StatusOK)
			})
			h := middleware.Chain(next, middleware.AuthMiddleware(tokens))

			req := httptest.NewRequest(http.MethodGet, "/users", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantStatus != http.StatusOK {
				if handlerRan {
					t.Fatal("the next handler ran for a request auth must reject")
				}
				return
			}
			if !gotOK {
				t.Fatal("UserFromContext found no user; auth must store the identity in the request context")
			}
			if gotUser != tt.wantUser {
				t.Fatalf("UserFromContext = %q, want %q", gotUser, tt.wantUser)
			}
		})
	}
}

// TestChainOrder pins the one thing every other case misses because each of
// them composes a single middleware: the direction Chain wraps in. Two
// middleware each append their name to a shared slice before calling next,
// so the slice records the order the request actually traverses them. Per
// step 01, Chain(h, mwA, mwB) must make mwA the outermost wrapper, so mwA
// runs before mwB. A Chain that iterates the slice front-to-back makes the
// last middleware outermost and reverses the observed order; a single
// middleware can never reveal that, two can. The request runs on one
// goroutine, so the shared slice needs no lock.
func TestChainOrder(t *testing.T) {
	var order []string
	record := func(name string) middleware.Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}

	var reached bool
	final := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
	})

	h := middleware.Chain(final, record("A"), record("B"))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if !reached {
		t.Fatal("the chain never reached the final handler; Chain must call through to h")
	}
	if got := strings.Join(order, ","); got != "A,B" {
		t.Fatalf("middleware ran in order %q, want %q: Chain's first argument is the outermost wrapper and must run first", got, "A,B")
	}
}

const limit = 5

func rateLimitRequest() *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/posts", nil)
	req.RemoteAddr = "203.0.113.9:52412"
	return req
}

// TestRateLimitWithinLimit sends the first N requests concurrently, the
// way a real server delivers them: one goroutine per request. All N must
// pass. Run with -race and any unsynchronized access to the shared bucket
// map is reported as a data race.
func TestRateLimitWithinLimit(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := middleware.Chain(next, middleware.RateLimitMiddleware(limit))

	codes := make([]int, limit)
	var wg sync.WaitGroup
	for i := 0; i < limit; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, rateLimitRequest())
			codes[i] = rec.Code
		}(i)
	}
	wg.Wait()

	for i, code := range codes {
		if code != http.StatusOK {
			t.Fatalf("request %d of %d: status = %d, want %d", i+1, limit, code, http.StatusOK)
		}
	}
}

// TestRateLimitOverLimit exhausts the budget with N requests, then asserts
// request N+1 gets 429.
func TestRateLimitOverLimit(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := middleware.Chain(next, middleware.RateLimitMiddleware(limit))

	for i := 0; i < limit; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, rateLimitRequest())
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d of %d: status = %d, want %d", i+1, limit, rec.Code, http.StatusOK)
		}
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, rateLimitRequest())
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("request %d: status = %d, want %d", limit+1, rec.Code, http.StatusTooManyRequests)
	}
}

// TestRateLimitRefill proves the limiter is a real token bucket that refills
// over time, not a fixed "allow N forever, then always 429" counter, which
// passes TestRateLimitOverLimit. It spends the whole burst, confirms the
// bucket is empty (429), then sleeps past the time one token takes to
// refill and asserts the next request is allowed again.
//
// The rate is `limit` tokens per second, so one token refills in
// 1/limit seconds. time.Sleep guarantees a lower bound on the wait, so
// elapsed*rate >= 1 token holds on any machine no matter how loaded; that
// is what keeps this machine-independent rather than flaky.
func TestRateLimitRefill(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := middleware.Chain(next, middleware.RateLimitMiddleware(limit))

	for i := 0; i < limit; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, rateLimitRequest())
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d of %d: status = %d, want %d", i+1, limit, rec.Code, http.StatusOK)
		}
	}

	// Budget spent: the immediate next request must be refused, or there
	// was never anything to refill and the rest of the test proves nothing.
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, rateLimitRequest())
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("request %d immediately after the burst: status = %d, want %d", limit+1, rec.Code, http.StatusTooManyRequests)
	}

	// One token refills in time.Second/limit; wait comfortably past that.
	time.Sleep(time.Second/limit + 150*time.Millisecond)

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, rateLimitRequest())
	if rec.Code != http.StatusOK {
		t.Fatalf("after waiting for the bucket to refill, status = %d, want %d: tokens must refill over time, not stay spent", rec.Code, http.StatusOK)
	}
}

// TestLogging404 routes a request through the logging middleware to an
// empty mux, which 404s everything, and asserts the status made it into
// the slog output. The logger writes into a plain bytes.Buffer: slog does
// not care where its output goes, which is exactly what makes it testable.
func TestLogging404(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	mux := http.NewServeMux()
	h := middleware.Chain(mux, middleware.LoggingMiddleware(logger))

	req := httptest.NewRequest(http.MethodGet, "/missing", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d (logging must pass the request through)", rec.Code, http.StatusNotFound)
	}
	// Assert the slog key=value attributes, not a bare "404" that could come
	// from anywhere in the line (a duration, a byte count, a timestamp). The
	// contract in step 02 is method, path, and the captured status, so pin
	// all three in their key=value form.
	out := buf.String()
	if !strings.Contains(out, "status=404") {
		t.Fatalf("slog output must record the captured status as status=404, not just the digits somewhere; wrap the ResponseWriter to read the code back.\nlog output: %q", out)
	}
	if !strings.Contains(out, "method=GET") {
		t.Fatalf("slog output must record the request method as method=GET.\nlog output: %q", out)
	}
	if !strings.Contains(out, "path=/missing") {
		t.Fatalf("slog output must record the request path as path=/missing.\nlog output: %q", out)
	}
}
