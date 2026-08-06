import type { Capstone } from "../content"

// The capstone is the only thing on this site with no guidance at all. Every
// number below was measured by the harness at labs/capstone, not estimated:
// the objectives table in particular is the reference implementation's own
// output, so the bar on the page is a bar something has actually cleared.
export const capstone: Capstone = {
	slug: "capstone",
	name: "linkd",
	tagline:
		"A link shortener with auth, rate limiting, durable storage and metrics. A spec, a suite, and nothing else.",
	why: `
		<p>Every other lab here hands you a skeleton. This one hands you a
		specification and a way to find out.</p>
		<p>There are no steps, no starter functions, no suggested package layout,
		and no hints. You get the brief a tech lead would give you and a suite
		that never reads your source: it compiles your package, runs the binary,
		and talks to it over HTTP, which is the only interface that matters when
		somebody else is depending on your service.</p>
		<p>That constraint cuts both ways, and it is the honest part. Any layout
		that meets the spec passes. No layout that misses it does. And there are
		bugs the suite genuinely cannot see, which is worth knowing before you
		decide what passing means.</p>
	`,
	labPath: "labs/capstone",
	specPath: "labs/capstone/SPEC.md",
	commands: [
		{ label: "Conformance", command: "go run ./suite -target ./mine" },
		{ label: "Objectives", command: "go run ./slo -target ./mine" },
	],
	checkCount: 34,
	routes: [
		{
			method: "POST",
			path: "/api/links",
			auth: true,
			summary:
				"Create a link. Optional alias and expiry, 409 when an alias is taken.",
		},
		{
			method: "GET",
			path: "/{code}",
			auth: false,
			summary:
				"Redirect and record a click. 404 unknown, 410 expired, and those are different facts.",
		},
		{
			method: "GET",
			path: "/api/links",
			auth: true,
			summary: "The caller's links, newest first. Never anyone else's.",
		},
		{
			method: "GET",
			path: "/api/links/{code}",
			auth: true,
			summary: "One link with its click count. 404 when it is not yours.",
		},
		{
			method: "DELETE",
			path: "/api/links/{code}",
			auth: true,
			summary: "204, then the code stops resolving. 404 the second time.",
		},
		{
			method: "GET",
			path: "/healthz",
			auth: false,
			summary: "Public liveness.",
		},
		{
			method: "GET",
			path: "/metrics",
			auth: false,
			summary:
				"Goroutines, requests, in-flight, redirects, rate limits, links, uptime.",
		},
	],
	requirements: [
		{
			title: "Announce the port you actually bound",
			body: `<p>One line on stdout, <code>listening on 127.0.0.1:54321</code>,
			once the listener is accepting and before the first request is served.
			With <code>-addr :0</code> it must be the real port. This is how the
			harness finds you, and it is how you would find yourself in a
			container.</p>`,
		},
		{
			title: "Owners cannot see each other",
			body: `<p>A request for somebody else's code returns <code>404</code>,
			not <code>403</code>. The existence of another owner's link is not
			yours to learn, and a <code>403</code> hands out exactly that.</p>`,
		},
		{
			title: "Structural writes are durable, clicks are batched",
			body: `<p>By the time <code>POST</code> returns <code>201</code> the
			link is on disk: the suite kills the process outright and restarts it.
			Click counts may be batched, because a disk flush per redirect will
			not survive the objectives, but they must be flushed at least once a
			second. Money is write-through, analytics are batched, and knowing
			which is which is most of what durability engineering is.</p>`,
		},
		{
			title: "Count characters, not bytes",
			body: `<p>An alias is between 1 and 32 characters. A 32 character
			alias that happens to be 64 bytes long is valid, and
			<code>len()</code> will tell you otherwise.</p>`,
		},
		{
			title: "Buckets are per token",
			body: `<p>A token bucket each, independent. One customer draining
			their limit must not throttle anybody else, and the suite checks that
			by draining one and then using the other.</p>`,
		},
		{
			title: "Report your own goroutine count",
			body: `<p><code>/metrics</code> carries
			<code>runtime.NumGoroutine()</code>, read at the moment of the
			request. A service that cannot see its own goroutine count cannot be
			operated, and it is what the load harness uses to decide whether you
			leak.</p>`,
		},
	],
	objectives: [
		{
			name: "Error rate",
			threshold: "zero 5xx, zero dropped connections",
			measured: "0 of 242,144 requests",
		},
		{
			name: "p99 latency",
			threshold: "at or under 50ms",
			measured: "16.0ms",
		},
		{
			name: "Throughput",
			threshold: "at least 1,500 req/s",
			measured: "24,174 req/s",
		},
		{
			name: "Goroutine growth",
			threshold: "at most +40 after the load settles",
			measured: "7 before, 7 after",
		},
	],
	seeds: [
		{
			name: "data-race",
			failureSlug: "data-race",
			why: "the store's map written with no lock held at all",
			caughtBy: ["concurrency/mixed-load-stays-up"],
		},
		{
			name: "goroutine-leak",
			failureSlug: "goroutine-leak",
			why: "a goroutine started per request that nothing ever wakes",
			caughtBy: ["concurrency/no-goroutine-leak"],
		},
		{
			name: "time-after-leak",
			failureSlug: "time-after-leak",
			why: "time.After per request holds a goroutine and a timer until it fires",
			caughtBy: ["concurrency/no-goroutine-leak"],
		},
		{
			name: "nil-map-write",
			failureSlug: "nil-map-write",
			why: "a map that was never made reads fine and panics on the first write",
			caughtBy: ["create/generated-code-shape"],
		},
		{
			name: "json-silent-zero",
			failureSlug: "json-silent-zero",
			why: "a tag that does not match the wire field: the value arrives and is dropped",
			caughtBy: [
				"create/expires-in-honoured",
				"redirect/expired-410",
			],
		},
		{
			name: "typed-nil",
			failureSlug: "typed-nil",
			why: "a nil pointer in an error interface is not nil, so the happy path reports failure",
			caughtBy: ["delete/removes-link"],
		},
		{
			name: "deadlock",
			failureSlug: "deadlock",
			why: "sync.Mutex is not reentrant, so taking it twice parks the request forever",
			caughtBy: ["metrics/counters"],
		},
		{
			name: "bytes-vs-runes",
			failureSlug: "bytes-vs-runes",
			why: "indexing a string walks bytes, so a limit meant for characters rejects valid input",
			caughtBy: ["create/alias-length-counts-runes"],
		},
		{
			name: "append-sharing",
			failureSlug: "append-sharing",
			why: "appending into a buffer shared between calls leaks one caller's rows into the next",
			caughtBy: ["list/only-owner-links"],
		},
		{
			name: "no-write-through",
			failureSlug: null,
			why: "acknowledging a write before it is durable, then losing it to a kill",
			caughtBy: ["durability/writes-survive-kill"],
		},
		{
			name: "shared-rate-bucket",
			failureSlug: null,
			why: "one bucket for every token, so a busy customer throttles everybody else",
			caughtBy: ["ratelimit/buckets-are-per-token"],
		},
	],
	blindSpots: [
		{
			failureSlug: "ctx-ignored",
			reason: `<p>Cancellation needs a request slow enough to abandon
			halfway. Every route in this spec is fast on purpose, so there is no
			window to cancel in.</p>`,
		},
		{
			failureSlug: "defer-in-loop",
			reason: `<p>It leaks file descriptors, and nothing in the spec reports
			descriptor counts. Adding a metric just to catch this would be a
			metric that exists for the test rather than for the operator.</p>`,
		},
		{
			failureSlug: "loop-capture",
			reason: `<p>Largely fixed by the language. Go 1.22 gives each
			iteration its own copy of the loop variable.</p>`,
		},
		{
			failureSlug: "mutex-by-value",
			reason: `<p><code>go vet</code> catches a copied lock before a suite
			ever runs, which is the right place to catch it.</p>`,
		},
		{
			failureSlug: "slice-aliasing",
			reason: `<p>Returning a pointer into your own state is invisible once
			the response has been serialised. The damage shows up later, in a
			caller the suite is not.</p>`,
		},
		{
			failureSlug: "wg-add-after-wait",
			reason: `<p>It needs a shutdown race the process contract already
			covers by requiring a clean exit within five seconds.</p>`,
		},
	],
	relatedConcepts: [
		"sync-mutex",
		"atomic",
		"memory-model",
		"race-detector",
		"graceful-shutdown",
		"rate-limiting",
		"http-handler",
		"server-timeouts",
		"encoding-json",
		"struct-tags",
		"strings-bytes-runes",
		"typed-nil",
		"slice-internals",
		"goroutines",
	],
	relatedProjects: [
		"http-server",
		"tcp-echo",
		"db-api",
		"worker-pool",
		"observability",
		"ship-it",
	],
}
