import { Project } from "../../content"

export const httpServer: Project = {
	slug: "http-server",
	name: "HTTP server with middleware",
	tagline:
		"Build a composable HTTP server (auth, logging, rate limiting) from the stdlib alone.",
	code: "SRV",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "4–5 hours",
	tags: ["net/http", "middleware", "context", "httptest", "interfaces"],
	mentalModels: [
		"handler composition over configuration",
		"context as request-scoped state",
		"interface-driven testability",
		"middleware ordering matters",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Every request passes through a chain of middleware functions before reaching a route handler. Each middleware wraps the next one. The chain is assembled explicitly in main, not by a framework. You learned http.Client in T1; now you implement the server side of the same interface.",
			},
		},
		{
			type: "code",
			value: `request → LoggingMW → AuthMW → RateLimitMW → handler → response`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `middleware/
 ├── logging.go
 ├── auth.go
 └── ratelimit.go
handlers/
 ├── users.go
 └── posts.go
server.go   — Chain(), http.Server
server_test.go`,
		},
	],
	steps: [
		{
			n: "01",
			heading: {
				en: "The http.Handler interface and middleware type",
			},
			uses: ["interfaces","http-handler"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Define type Middleware func(http.Handler) http.Handler. Write Chain(h http.Handler, mws ...Middleware) http.Handler that applies middlewares in order. The first middleware in the list must be the outermost wrapper (first to run, last to return).",
					},
					why: {
						en: "http.Handler is the single interface powering Go's entire HTTP stack. A middleware is just a function that wraps one Handler in another. There is no magic, no reflection, no framework. Chain lets you compose them cleanly: Chain(mux, logging, auth) instead of logging(auth(mux)).",
					},
					stdlibHint:
						"net/http: http.Handler, http.HandlerFunc, http.ResponseWriter, *http.Request",
					complexSnippet: `// HandlerFunc converts a plain function into an http.Handler
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // pre-processing
    next.ServeHTTP(w, r)
    // post-processing (e.g. log elapsed time)
})`,
				},
			],
		},
		{
			n: "02",
			heading: { en: "Logging middleware with response capture" },
			uses: ["interfaces"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write LoggingMiddleware that logs method, path, status code, response bytes, and duration for every request using log/slog.",
					},
					why: {
						en: "http.ResponseWriter does not expose the status code after it has been written; the interface has no StatusCode() method. The standard Go solution is a wrapper struct that embeds http.ResponseWriter and overrides WriteHeader to capture the code. You used an identical pattern in T1 when you wrapped bufio.Scanner to count lines.",
					},
					stdlibHint: "net/http, log/slog, time",
					hints: [
						{
							label: "response wrapper",
							value: "type responseWriter struct { http.ResponseWriter; status, size int }. Override WriteHeader to capture status. Override Write to accumulate size.",
						},
					],
				},
			],
		},
		{
			n: "03",
			heading: { en: "Auth middleware with context" },
			uses: ["context"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write AuthMiddleware that reads a Bearer token from the Authorization header, validates it, and stores the user identity in the request context. Return 401 for missing or invalid tokens. Expose UserFromContext(ctx) (string, bool) for handlers.",
					},
					why: {
						en: "context.WithValue threads request-scoped values through the call stack without changing function signatures. The context key must be an unexported type (never a bare string or int) to prevent collisions between packages. You attached config values to a context in T1's config watcher; the pattern is identical here.",
					},
					stdlibHint: "context, net/http, strings",
					hints: [
						{
							label: "context key",
							value: 'type contextKey string; const userKey contextKey = "user". The unexported type means no other package can accidentally read or overwrite your key.',
						},
						{
							label: "r.WithContext",
							value: "Returns a new *http.Request with the updated context. Pass this to next.ServeHTTP, not the original r.",
						},
					],
				},
			],
		},
		{
			n: "04",
			heading: { en: "Token bucket rate limiter" },
			uses: ["maps","goroutines"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write RateLimitMiddleware with per-IP limiting: N requests per second. Requests beyond the limit receive 429. A background goroutine must evict stale IP entries periodically.",
					},
					why: {
						en: "Per-IP rate limiting requires a map keyed by IP protected by a mutex; concurrent requests from different IPs hit the map simultaneously. You built a mutex-protected map in the config watcher's MutexStore. The token bucket is the standard algorithm: each IP gets N tokens, one consumed per request, tokens refill at rate R/s. Stale entry eviction prevents unbounded memory growth.",
					},
					stdlibHint: "net, sync, time",
					thirdPartyHint:
						"golang.org/x/time/rate: ready-made token bucket Limiter, one per IP",
					hints: [
						{
							label: "IP from RemoteAddr",
							value: 'r.RemoteAddr is "ip:port". Use net.SplitHostPort to extract just the IP. Behind a proxy, check X-Forwarded-For.',
						},
					],
				},
			],
		},
		{
			n: "05",
			heading: { en: "Test with httptest" },
			uses: ["interfaces"],
			blocks: [
				{
					type: "requirement",
					what: {
						en: "Write table-driven tests for each middleware using httptest.NewRecorder and httptest.NewRequest. Run with -race. No real TCP connections.",
					},
					why: {
						en: "httptest.NewRecorder is an http.ResponseWriter that captures status, headers, and body. httptest.NewRequest builds an *http.Request without a network round-trip. Calling ServeHTTP directly tests the middleware in isolation, no server needed. You wrote table-driven tests in T1; apply the same pattern here.",
					},
					stdlibHint: "net/http/httptest",
				},
				{
					type: "assessment",
					assessment: {
						kind: "integration",
						title: "Middleware test suite",
						description:
							"go test -race ./... must pass with zero data races.",
						testCases: [
							{
								description:
									"Auth: no Authorization header",
								expected: "HTTP 401",
							},
							{
								description: "Auth: invalid token",
								expected: "HTTP 401",
							},
							{
								description: "Auth: valid token",
								expected:
									"HTTP 200, user stored in context",
							},
							{
								description: "RateLimit: requests 1–N",
								expected: "HTTP 200",
							},
							{
								description: "RateLimit: request N+1",
								expected: "HTTP 429",
							},
							{
								description:
									"Logging: request returning 404",
								expected: 'slog output contains "404"',
							},
						],
						desiredOutput: "ok  \tyourmodule/middleware\nPASS",
						hints: [
							{
								label: "-race",
								value: "go test -race ./... runs the Go race detector. Any unsynchronised concurrent map access will be reported as a data race and fail the test.",
							},
						],
					},
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built composable middleware from one interface, applied the context-key pattern from T1, and tested everything without a real server. The rate limiter's mutex-protected map is the same pattern as MutexStore from the config watcher; you recognised it and applied it.",
			},
		},
	],
}
