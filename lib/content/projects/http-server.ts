import { Project } from "../../content"

export const httpServer: Project = {
	slug: "http-server",
	name: "HTTP server with middleware",
	tagline:
		"Build a composable HTTP server (auth, logging, rate limiting) from the stdlib alone.",
	code: "SRV",
	tier: 2,
	tierLabel: "SYSTEMS",
	estimatedTime: "14–16 hours",
	tags: ["net/http", "middleware", "context", "httptest", "interfaces", "sync", "time"],
	lab: {
		path: "labs/http-server",
		command: "go test ./...",
		summary: {
			en: "Two black-box suites, fourteen cases. The middleware package is graded on chain order, a 404 and an implicit 200 in the slog output, auth rejection and context identity, and the token bucket's burst, its 429, and its refill. The server package is graded on the four deadlines and on one request that is inside a handler when the stop arrives.",
		},
	},
	mentalModels: [
		"handler composition over configuration",
		"context as request-scoped state",
		"interface-driven testability",
		"middleware ordering matters",
		"a deadline is the only thing that ever ends a connection",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Every framework you have used has a Use() method. This project is what is underneath one, and the answer is nothing: no registry, no reflection, no lifecycle hooks. A middleware is a function that takes a handler and returns a handler, the chain is that function applied a few times, and the entire mechanism is one interface with one method. You will write the whole thing in an afternoon and then spend the rest of the project on the parts that are actually hard, which are not composition.",
			},
		},
		{
			type: "text",
			value: {
				en: "The hard parts are these. A ResponseWriter will not tell you what status your own handler wrote. A context value is invisible to the type system, so getting the key wrong fails silently rather than loudly. A rate limiter is shared mutable state touched by every request on a different goroutine, which is the exact shape of the bugs the race detector exists for. And an http.Server built from its zero value will hold a connection open forever, serve a request while the process is being torn down, and report a clean shutdown as a crash. None of those are composition problems. All of them are graded.",
			},
		},
		{
			type: "code",
			value: `request → Logging → Auth → RateLimit → mux → handler
              ▲                                      │
              └──── status, bytes, duration ─────────┘

server.New(chain, DefaultTimeouts())   ← how long a stranger may hold a socket
server.Run(ctx, srv, ln, grace)        ← what happens to the requests in flight`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `labs/http-server/
 ├── middleware/
 │   ├── middleware.go      - yours: Chain, Logging, Auth, RateLimit (build tag !solution)
 │   ├── solution.go        - the reference (build tag solution)
 │   └── middleware_test.go - the suite: nine cases. Read it, it is the contract.
 └── server/
     ├── server.go          - yours: Timeouts, New, Run (build tag !solution)
     ├── solution.go        - the reference (build tag solution)
     └── server_test.go     - the suite: five cases, two of them raw TCP.`,
		},
	],
	steps: [
		{
			n: "01",
			heading: {
				en: "One interface, and the direction a chain wraps",
			},
			uses: ["interfaces", "http-handler"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Without a Chain you nest by hand: logging(auth(rateLimit(mux))). That expression is read outside-in and executed outside-in, which sounds fine until you notice that the middleware doing the most work sits at the innermost position, furthest from the eye, in the place your brain has been trained by every other language to read as 'first'. Order here is not cosmetic. Put auth outside the rate limiter and an anonymous flood gets validated before it gets counted, so the expensive check runs on exactly the traffic you did not want to spend money on. That decision deserves to be one readable line rather than a nesting depth.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Define type Middleware func(http.Handler) http.Handler. Write Chain(h http.Handler, mws ...Middleware) http.Handler so that the first middleware in the list is the outermost wrapper: first to see the request, last to see the response. Chain(mux, logging, auth) must be exactly logging(auth(mux)).",
					},
					why: {
						en: "http.Handler is one method, ServeHTTP(ResponseWriter, *Request), and it is the only thing Go's HTTP stack knows how to talk to. Because a middleware takes a Handler and returns a Handler, it is itself a Handler factory, and that closure property is the entire reason chaining works: the output of one is a legal input to the next, so composition needs no machinery. Chain is a fold over that. The only real decision is which direction it folds, and it is a decision, not a fact: iterate the slice backwards and the first argument ends up outermost, iterate it forwards and the last one does. Pick one, write it down, and let a test hold you to it, because the two versions are indistinguishable until the day the order matters and by then you are debugging it in production.",
					},
					stdlibHint:
						"net/http: http.Handler, http.HandlerFunc, http.ResponseWriter, *http.Request",
					complexSnippet: `// HandlerFunc is a type conversion, not a constructor. It is defined as
// type HandlerFunc func(ResponseWriter, *Request), with a ServeHTTP method
// that calls the function itself. That is the whole adapter: it exists so a
// plain function can satisfy a one-method interface.
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // before: runs on the way in
    next.ServeHTTP(w, r)
    // after: runs on the way out, innermost handler already done
})`,
					hints: [
						{
							label: "the fold, and its direction",
							value: "for i := len(mws) - 1; i >= 0; i-- { h = mws[i](h) }. Each pass wraps the current h in a new outer layer, so the last one applied ends up outermost. Walk it backwards and the first element of the slice is applied last, which is why it ends up on the outside. This is the whole of Chain: three lines and one loop direction.",
						},
						{
							label: "why not just nest by hand",
							value: "Nothing stops you, and for two middleware it is arguably clearer. It stops scaling at about four, and more importantly the nesting reverses on the page relative to how a reader thinks about a pipeline. Chain(mux, logging, auth, rateLimit) reads in execution order, top to bottom, which means an ordering bug is visible rather than inferable.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -run TestChainOrder ./middleware/",
					expect: {
						en: "Green. The test composes two middleware that each append their name to a shared slice before calling next, so the slice records the order the request actually traversed them, and it requires \"A,B\". Note why the suite needs two: a single middleware can never reveal which direction Chain folds, because with one element both directions produce the same handler. This is the only case in the suite that composes more than one.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Flip the loop in Chain to iterate forwards: for i := 0; i < len(mws); i++ { h = mws[i](h) }. Rerun the test.",
					},
					observe: {
						en: 'It fails with: middleware ran in order "B,A", want "A,B". Nothing else in either suite notices, because every other case composes exactly one middleware.',
					},
					why: {
						en: "Each pass of the loop makes the handler it just built the new inner handler of the next wrap, so the middleware applied last is the one wrapped around everything: outermost, and therefore first to run. Going forwards applies mwA first, which buries it, and mwB ends up on the outside. The mechanism is just closure nesting, and that is exactly why it is dangerous: no type changes, no error, no signature difference, and both versions compile and serve traffic. The only visible symptom is that your rate limiter now runs after your auth check, and that symptom is a bill rather than a stack trace.",
					},
				},
			],
			retrievalPrompt:
				"Chain(mux, logging, auth) has to make logging outermost. Why does the loop have to walk the slice backwards to do that? || Because each iteration wraps whatever it has so far, so the middleware applied last ends up on the outside. Walking backwards applies logging last, which puts it outermost, which makes it first to run. Walk forwards and the last argument wins the outside instead, and the request traverses your chain in reverse.",
		},
		{
			n: "02",
			heading: { en: "Wrap the ResponseWriter, because it will not tell you anything" },
			uses: ["interfaces", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "You want to log the status code of the response your own program just sent. There is no method for it. http.ResponseWriter has exactly three: Header, Write, and WriteHeader. All three are ways to put data in. Nothing on the interface reads anything back, so by the time your middleware regains control after next.ServeHTTP returns, the status your handler wrote is on the wire and gone, and the interface value in your hand knows nothing about it.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Write a small struct that embeds http.ResponseWriter and records what passed through it: the status code from WriteHeader, and the running total of bytes from Write. Pass that struct to next.ServeHTTP instead of the original w, so the handler writes through your recorder. It must report 200 for a handler that never calls WriteHeader at all.",
					},
					why: {
						en: "Embedding an interface in a struct gives you every method of that interface for free, forwarded to the embedded value, which means your struct satisfies http.ResponseWriter the moment you declare it and before you have written a single method. Override one method and only that one changes; the rest still forward. That is the whole pattern, and it is how you get an observation point on an interface you do not own. The trap is what you will not see: WriteHeader is optional. A handler that calls only Write gets its 200 written by net/http, inside its own ResponseWriter, underneath your wrapper, so your override never fires. Your recorder therefore has to already hold 200 before the handler starts, because for most requests on most services nothing will ever tell it.",
					},
					stdlibHint: "net/http: http.ResponseWriter is Header, Write, WriteHeader",
					complexSnippet: `type statusRecorder struct {
    http.ResponseWriter // embedded: every method forwards here by default
    status int
    size   int
}

// Override two. Header() still forwards to the embedded value untouched.
func (r *statusRecorder) WriteHeader(code int) {
    r.status = code
    r.ResponseWriter.WriteHeader(code) // forward, or the response never ships
}`,
					hints: [
						{
							label: "the initializer is the load-bearing line",
							value: "&statusRecorder{ResponseWriter: w, status: http.StatusOK}. Start it at 200, not at the zero value. The 200 case is the one your override cannot observe, so it has to be the default rather than something you record.",
						},
						{
							label: "forward, do not swallow",
							value: "If your WriteHeader records the code and forgets to call r.ResponseWriter.WriteHeader(code), the status never reaches the client. The wrapper is an observer, and the one rule for an observer is that removing it changes nothing.",
						},
						{
							label: "what embedding an interface quietly costs you",
							value: "Your wrapper satisfies http.ResponseWriter and nothing else. The concrete writer net/http hands you also implements http.Flusher and http.Hijacker, and a type assertion for those against your wrapper now fails, so streaming responses and WebSocket upgrades break behind your middleware. The fix is to implement Flush by forwarding it, and the general lesson is that wrapping an interface erases every other interface the concrete value satisfied. This is the single most common bug in real middleware.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command:
						"go test -run TestLoggingCapturesAnImplicit200AndTheByteCount ./middleware/",
					expect: {
						en: "Green, once your logging middleware wraps and logs. The test's handler calls io.WriteString and never calls WriteHeader, which is what a normal handler looks like, and it requires status=200 and bytes=5 in the log line.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
					note: {
						en: "This case and TestLogging404 are deliberately a pair: the 404 is the path where WriteHeader is called for you by the mux, and this one is the path where nobody calls it at all. A wrapper that only handles the first is wrong about almost every request your service will ever serve.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Drop the status from the initializer so it starts at the zero value: &statusRecorder{ResponseWriter: w}. Rerun the test.",
					},
					observe: {
						en: 'It fails, and the log line it prints is: method=GET path=/greet status=0 bytes=5. The byte count is right. The recorder saw the write. The client got a perfectly good HTTP 200 with "hello" in it, and the test confirms rec.Code is 200.',
					},
					why: {
						en: "status=0 is not a status code. It is your struct field, never assigned, because WriteHeader was never called on your wrapper: the handler called Write, and the implicit 200 was generated one layer below you by the ResponseWriter you are wrapping. The bytes came through because Write is the method the handler actually called and the one you actually overrode. So the wrapper is not broken and the response is not broken. The only thing that is wrong is the record of what happened, and it is wrong for every 200 the service serves, which is to say for almost all of it. Log-only bugs have a particular cruelty: nothing pages you, and you find out at 3am when the dashboard you were counting on turns out to have been counting zeroes all year.",
					},
				},
			],
			retrievalPrompt:
				"Your ResponseWriter wrapper overrides WriteHeader and records the code. Why must it still be constructed holding 200? || Because WriteHeader is optional and most handlers never call it. The first Write triggers the implicit 200 inside net/http's own ResponseWriter, below your wrapper, so your override never runs for the most common response your service sends. If 200 is not already the default, you log status=0 for every success.",
		},
		{
			n: "03",
			heading: { en: "One line per request, and make it queryable" },
			uses: ["slog", "interfaces"],
			blocks: [
				{
					type: "text",
					value: {
						en: 'log.Printf("%s %s %d in %v", r.Method, r.URL.Path, status, elapsed) produces "GET /checkout 500 in 1.2s", which is fine, and it is fine right up to the question you will actually be asked, which is "show me every 5xx on /checkout slower than a second, from this deploy, grouped by user". That is a query. What you have is a sentence. You cannot query a sentence, you can only grep it, and grep has no idea which of those tokens was the status and which was the duration.',
					},
				},
				{
					type: "requirement",
					what: {
						en: "Log exactly one line per request with log/slog, carrying method, path, the captured status, the byte count, and the duration as named attributes. Log it on the *slog.Logger that LoggingMiddleware was handed, not on the package-level slog functions.",
					},
					why: {
						en: 'Structured logging means the event stays a set of key/value pairs all the way to whatever stores it, so "status" is a field with a value rather than a substring you hope you can pattern-match later. slog splits that in two: a Logger you call, and a Handler that decides what the output looks like. Same call site, and slog.NewTextHandler gives you key=value for your terminal while slog.NewJSONHandler gives you objects your log aggregator can index, chosen once in main. The second half of the requirement is what makes any of it testable: a logger you accept as a parameter can be pointed at a bytes.Buffer by a test, and the whole question of "did this middleware log the right thing" becomes an assertion instead of a person reading a terminal.',
					},
					stdlibHint: "log/slog: slog.New, slog.NewTextHandler, slog.NewJSONHandler, Logger.Info",
					complexSnippet: `// The Logger is what you call. The Handler is what it looks like.
logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
// time=... level=INFO msg=request method=GET path=/x status=200 bytes=5

logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
// {"time":"...","level":"INFO","msg":"request","method":"GET","status":200}

// Same call site either way:
logger.Info("request", "method", r.Method, "status", rec.status)`,
					hints: [
						{
							label: "msg is a constant, not a sentence",
							value: 'logger.Info("request", ...) and never logger.Info(fmt.Sprintf("request to %s", path)). The msg is what you group by; the moment it contains a variable you have as many distinct messages as you have paths, and every aggregator that counts by message becomes useless. Everything variable is an attribute.',
						},
						{
							label: "the logger is a dependency, and that is the point",
							value: "LoggingMiddleware takes *slog.Logger for the same reason a database handle is passed in: it is a thing that talks to the outside world, and code that reaches out and grabs its own is code you cannot test without the outside world. The suite hands you a logger over a bytes.Buffer and reads the result. Nothing is mocked because nothing needed mocking.",
						},
						{
							label: "the alternating-pair API, and its safer sibling",
							value: 'logger.Info("request", "method", r.Method) takes ...any in alternating key/value pairs, which is compact and unchecked: an odd number of arguments compiles and logs a !BADKEY at runtime. slog.String("method", r.Method) is the typed form, and LogAttrs is the version that takes only attrs and skips a couple of allocations. Use the pairs while learning, and know why the other exists.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -run TestLogging404 ./middleware/",
					expect: {
						en: "Green. The test routes a request through your logging middleware into an empty mux, which 404s everything, and requires status=404, method=GET, and path=/missing in the output. It asserts the key=value form on purpose rather than looking for a bare 404, which could equally be a byte count, a duration, or part of a timestamp.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Log on the package-level function instead of the injected logger: slog.Info(\"request\", ...) rather than logger.Info(\"request\", ...). It compiles, and it is one character of difference at the call site. Rerun the test.",
					},
					observe: {
						en: 'The test fails with log output: "". And your log line is right there in the terminal, above the failure, looking completely correct: 2026/07/15 11:56:33 INFO request method=GET path=/missing status=404 bytes=19 duration=0s.',
					},
					why: {
						en: "The package-level slog functions do not use your logger. They use the default logger, and slog's default handler writes through the standard log package to stderr, which is why that line has a log-package date stamp glued to the front of it instead of the time= attribute a TextHandler would emit. So the middleware logged, and it logged the right values, to a destination nobody chose and no test can see. This is what makes package-level loggers worth avoiding as a rule rather than as a preference: the failure mode is not an error, it is output that appears correct while going somewhere else. In a real service the same mistake means your requests bypass the JSON handler main configured, land on stderr as unparseable text, and are silently absent from every dashboard built on them.",
					},
				},
			],
			retrievalPrompt:
				"slog.Info and logger.Info differ by one word and both print a correct-looking line. What actually changes? || slog.Info uses the package-level default logger, whose default handler writes through the log package to stderr. logger.Info uses the handler you configured. So the package-level call ignores your JSON handler, your destination, and your level, while still looking right in a terminal, and no test holding a bytes.Buffer will ever see it.",
		},
		{
			n: "04",
			heading: { en: "The middleware that refuses to call next" },
			uses: ["http-handler", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Everything you have written so far calls next. Logging calls next, the recorder calls next, and a middleware that always calls next is a decorator: it can watch, it cannot decide. Auth is the first one with an opinion. Its entire value is the case where the request stops, and stopping means doing nothing at all except writing a status and returning, which turns out to be harder to get right than it sounds.",
					},
				},
				{
					type: "requirement",
					what: {
						en: 'Write AuthMiddleware(tokens map[string]string) that reads "Authorization: Bearer <token>". A missing header, a malformed one, or a token not in the map gets 401 and must never reach the next handler. tokens maps each valid token to the identity of the user who owns it.',
					},
					why: {
						en: "The whole security property is one keyword. A middleware rejects by writing a response and returning without calling next, and there is nothing in the type system to enforce that: next is a value in a closure, calling it is an ordinary statement, and forgetting to return after http.Error is a plain control-flow bug that compiles, vets clean, and reads fine. What makes it worse than an ordinary control-flow bug is the second mechanism it collides with. WriteHeader can only fire once per response, and net/http enforces that by ignoring later calls, so a handler that runs after your 401 cannot change the status. The client still sees 401. Your logs still say 401. The handler ran anyway, and whatever it does, it did.",
					},
					stdlibHint: "net/http: http.Error, Header.Get. strings: strings.CutPrefix",
					complexSnippet: `// CutPrefix (Go 1.20) does the split and the check in one step: it
// returns the remainder and whether the prefix was actually there, so a
// missing header and a malformed one collapse into the same branch.
token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
if !ok {
    http.Error(w, "missing or malformed Authorization header", http.StatusUnauthorized)
    return // ← this line is the entire security property
}`,
					hints: [
						{
							label: "Header.Get on a missing header",
							value: 'It returns "", not an error, because http.Header is a map[string][]string and the zero value of a missing key is an empty slice. So an absent header and an empty header are the same thing to you, which is convenient here: CutPrefix("", "Bearer ") returns ok=false and both cases take the same branch.',
						},
						{
							label: "why the map is token to user, not user to token",
							value: "You look up by what the request gives you. The request gives you a token. A map keyed the other way would mean scanning every entry on every request, which is O(n) per request in a hot path and, worse, a comparison loop whose duration depends on where the match is. Constant-time-ish lookup is a happy accident here; the reason is just that you index by the thing you have.",
						},
						{
							label: "what a real one would do differently",
							value: "Nothing about the shape, and everything about the token. A production version validates a signed JWT or calls an introspection endpoint, and it compares secrets with subtle.ConstantTimeCompare rather than == so that response timing does not leak how much of a token was correct. The middleware around it is identical, which is the point of building it this way.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command:
						"go test -run 'TestAuth/no_Authorization_header|TestAuth/invalid_token' ./middleware/",
					expect: {
						en: "Both green. Each case asserts two separate things: that the status is 401, and that a handler which sets a flag when it runs never ran. The second assertion is the one that matters, and it is the one you cannot make from outside the process by looking at the response.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Delete the return after http.Error(w, "invalid token", http.StatusUnauthorized), so the code falls through to next.ServeHTTP. Rerun the same command.',
					},
					observe: {
						en: 'TestAuth/invalid_token fails with: the next handler ran for a request auth must reject. Read what did not fail. The status assertion passed first: the response is still exactly 401.',
					},
					why: {
						en: "The 401 was already committed by http.Error, so when the handler underneath wrote its own status net/http discarded it, because the response line has been sent and there is nowhere to put a second one. The status code is therefore not a report of what your server did. It is a report of what your server said first. Everything after it still ran with the caller's request: the record was deleted, the card was charged, the row was written, and the attacker got a 401 telling them they failed. You cannot see this from the outside, you cannot see it in the access log, and you cannot see it in the metrics, because every one of those is derived from the status code. The only place it is visible is a test that asserts the handler did not run, which is why the suite asserts that separately rather than trusting the 401.",
					},
				},
			],
			retrievalPrompt:
				"Auth writes a 401 with http.Error but forgets to return. The client still receives a 401. What is wrong? || The handler ran anyway and did its work. WriteHeader only takes effect once, so net/http ignored the handler's status and the response is still 401, which means the status code is not evidence that the request was rejected. It only proves what was written first. The work happened, and nothing derived from the status will ever show it.",
		},
		{
			n: "05",
			heading: { en: "Carry the identity, not the header" },
			uses: ["context"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Auth knows who the caller is. The handler, four layers down, needs to know too. You cannot add a parameter, because ServeHTTP's signature is fixed by the interface and that is the whole reason any of this composes. You could stash it in a package-level map keyed by the request pointer, which people do, and which leaks memory and races. What is actually left is the field on *http.Request that exists for precisely this and nothing else.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "On a valid token, put the user identity into the request context and pass the resulting request to next. Expose UserFromContext(ctx) (string, bool) so a handler can read it back. The context key must be a value of an unexported named type, never a bare string.",
					},
					why: {
						en: 'Contexts are immutable, and every operation on one returns a new context wrapping the old. context.WithValue does not modify anything: it returns a child holding your key and value with a pointer to its parent, and a lookup walks that chain outward until something matches. So r.WithContext(ctx) cannot mutate r either, and does not: it returns a shallow copy of the Request with a different ctx field. If you do not pass that copy along, the value you just created is attached to a request nobody will ever see. As for the key, ctx.Value compares interface values, which means it compares type and value together. A bare string key "user" from your package is equal to a bare string key "user" from any other package in the binary, including one in a dependency you have never read, and the loser of that collision is whoever stored first. An unexported named type cannot be constructed outside your package, so the collision becomes unrepresentable rather than unlikely.',
					},
					stdlibHint: "context: context.WithValue, Context.Value. net/http: Request.Context, Request.WithContext",
					complexSnippet: `// The type is the collision proofing. Not the string.
type contextKey string
const userKey contextKey = "user"

// Storing returns a new context, and a new request holding it.
ctx := context.WithValue(r.Context(), userKey, user)
next.ServeHTTP(w, r.WithContext(ctx))

// Reading gives back any, so the assertion is not optional.
user, ok := ctx.Value(userKey).(string)`,
					hints: [
						{
							label: "the comma-ok is the API",
							value: "ctx.Value returns any, and returns nil for a key nobody stored. The type assertion with comma-ok collapses both failure modes, missing and wrong-typed, into ok=false with no panic. This is why UserFromContext returns (string, bool) rather than a bare string: the absence of a value is a real answer and callers have to be able to see it.",
						},
						{
							label: "what context values are for, and what they are not",
							value: "Request-scoped data that crosses API boundaries without being part of the API: identity, request ID, trace span, deadline. Not optional parameters, not configuration, not dependencies. The test is whether the value is meaningless outside this specific request. A database handle fails that test and belongs in a struct field; the identity of the caller passes it.",
						},
						{
							label: "the cost you are accepting",
							value: "You have traded a compile-time check for a runtime one. Nothing tells you at build time that the handler expects a user in the context, and if auth is not in the chain the handler gets ok=false at request time rather than a type error at build time. That is a genuine loss, and it is the price of a fixed interface signature. It is also why UserFromContext lives next to the code that stores the value: the two halves are one contract and separating them across packages is how it rots.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -run 'TestAuth/^valid_token$' ./middleware/",
					expect: {
						en: "Green. The test's handler calls middleware.UserFromContext(r.Context()) and requires the user \"ada\", which is what the token map maps the valid token to. It asserts the identity, not just the 200: a chain that lets the request through without attaching anything still returns 200 and is still broken.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
					note: {
						en: "The anchors are not decoration. -run splits its pattern on / and treats each part as an unanchored regex, so -run 'TestAuth/valid_token' also matches invalid_token, because valid_token is a substring of it. That is a good thing to find out here rather than while you are convinced you have run one test and have actually run two.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Call r.WithContext(ctx) as its own statement and then pass the original request on, the way you would if you thought it mutated the request: keep ctx := context.WithValue(r.Context(), userKey, user), then r.WithContext(ctx) on a line of its own, then next.ServeHTTP(w, r).",
					},
					observe: {
						en: "It compiles. go vet is clean. The request gets its 200. The test fails with: UserFromContext found no user; auth must store the identity in the request context.",
					},
					why: {
						en: "WithContext returned a new *http.Request, with your context in it, and you threw it away. The original r still points at the context it arrived with, which never had a user in it, so ctx.Value walks the chain, finds nothing, returns nil, and the type assertion to string comes back ok=false. Nothing errors because nothing is wrong: asking a context for a key it does not have is a legal question with a legal answer. Notice the shape of the mistake. It is the same one people make with strings.ToUpper(s) as a statement, and it comes from the same place: a value type that returns a modified copy looks exactly like a method that mutates, and Go will not tell you which one you are holding. It is worth knowing that the more obvious version of this bug does not compile: assign ctx and then pass r, and the compiler stops you with \"ctx declared and not used\". This version slips through only because a function call is a legal statement, so discarding the result is something you are allowed to do on purpose.",
					},
				},
			],
			retrievalPrompt:
				"Why must a context key be an unexported named type rather than the string \"user\"? || Because ctx.Value compares interface values, which compares type and value together. Two packages that both use the bare string \"user\" produce equal keys and silently overwrite each other, and one of them may be a dependency you have never read. An unexported type cannot be constructed outside your package, so the collision stops being unlikely and becomes impossible to express.",
		},
		{
			n: "06",
			heading: { en: "A token bucket, not a counter" },
			uses: ["maps", "structs"],
			blocks: [
				{
					type: "text",
					value: {
						en: "One client with a for loop is indistinguishable from success. Your dashboards go up and to the right, your capacity goes to one caller, and everyone else times out. The naive fix is a counter per IP that resets every second, and it is worth understanding exactly why that is wrong before you write the right one: with a fixed window, a client that sends its whole budget at 0.999s and its next whole budget at 1.001s has just sent twice your limit in two milliseconds, entirely within the rules. The window boundary is the vulnerability, and it exists because the counter measures a calendar rather than a rate.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Write RateLimitMiddleware(n int) that gives every client IP its own token bucket: a burst of n requests passes immediately, and tokens refill at n per second thereafter. A request that finds the bucket empty gets 429 and does not reach the handler. The IP is the host half of r.RemoteAddr.",
					},
					why: {
						en: "A token bucket has no boundary because it has no window. Each bucket holds a number of tokens, a request costs one, and tokens accrue continuously at a fixed rate up to a cap. That single design gives you two properties the counter cannot: a burst allowance, which is what makes it usable by real clients that are bursty rather than smooth, and a hard long-run average, because you can never spend faster than the refill for long. The implementation trick worth internalising is that you do not need a ticker per bucket, and a goroutine per client IP would be a denial of service in itself. Instead you store the timestamp of the last look and compute the refill lazily on arrival: tokens += elapsed.Seconds() * rate, capped. The bucket has no idea what time it is between requests, and it does not need to, because nobody is asking.",
					},
					stdlibHint: "net: net.SplitHostPort. time: time.Now, Time.Sub, Duration.Seconds. builtin min (Go 1.21)",
					thirdPartyHint:
						"golang.org/x/time/rate: the standard ready-made token bucket, one rate.Limiter per IP. Reach for it in production and know what is inside it first, which is what this step is for.",
					complexSnippet: `type bucket struct {
    tokens   float64 // fractional on purpose: see below
    lastSeen time.Time
}

// Lazy refill: no ticker, no goroutine, nothing runs between requests.
elapsed := now.Sub(b.lastSeen).Seconds()
b.tokens = min(rate, b.tokens+elapsed*rate)
b.lastSeen = now
if b.tokens < 1 {
    http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
    return
}
b.tokens--`,
					hints: [
						{
							label: "why tokens is a float64 and not an int",
							value: "Refill is continuous. With an int, 30ms of elapsed time at 5 tokens per second computes 0.15 tokens, truncates to 0, and adds nothing; a client sending steadily every 30ms would then never refill at all, because every single increment rounds away. The fractions have to accumulate between requests, which means they have to be storable.",
						},
						{
							label: "IP from RemoteAddr",
							value: 'r.RemoteAddr is "ip:port" and the port is different on every connection, so keying on it directly gives every request its own bucket and limits nobody. net.SplitHostPort gives you the host half. It handles the IPv6 bracket form too, which is the reason not to reach for strings.Split(addr, ":").',
						},
						{
							label: "behind a proxy this is all wrong",
							value: "If anything sits in front of you, every RemoteAddr is the proxy's, so you have built one shared bucket for the entire internet. The fix is X-Forwarded-For, and the trap is that it is a client-supplied header: trusting it blindly lets anyone mint a fresh identity per request and bypass you completely. It is only usable if you count from the right and trust exactly as many hops as you actually operate.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -run TestRateLimit ./middleware/",
					expect: {
						en: "Three green: WithinLimit, OverLimit, and Refill. Refill is the slow one at about 0.36s, because it genuinely waits for a token to come back. The others are instant.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
					note: {
						en: "Refill sleeps for time.Second/limit plus a margin. It is a lower bound on the wait, never an upper bound on the machine, so elapsed*rate >= 1 token holds no matter how loaded the box is. That is the difference between a timing test and a flaky test.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the refill line, so tokens only ever go down: keep the b.tokens-- and remove b.tokens = min(rate, b.tokens+elapsed*rate). You now have the allow-N-then-refuse-forever counter. Rerun the same command.",
					},
					observe: {
						en: "Two of the three still pass. TestRateLimitWithinLimit is green, TestRateLimitOverLimit is green, and only Refill fails: after waiting for the bucket to refill, status = 429, want 200: tokens must refill over time, not stay spent.",
					},
					why: {
						en: "Look at what those two passing tests actually proved: that the first five requests are allowed, and that the sixth is not. A counter that permanently bans every client after five requests satisfies both, forever, and it is not a rate limiter at all, it is a quota with no reset. Two thirds of a suite went green on something that would take your service down within a minute of deploying, because both tests only ever look at one instant. Refill is the only case that lets time pass, and time passing is the entire difference between a rate and a count. This is worth carrying past this project: when a test suite covers a behaviour that is defined over time, the cases that do not wait are not testing that behaviour, no matter how many of them there are.",
					},
				},
			],
			retrievalPrompt:
				"Your rate limiter allows the first N and 429s the rest. Two of the three rate limit tests pass. What is missing, and why is the counter dangerous rather than merely wrong? || The refill. Without it you have a permanent quota: every client is banned forever after N requests, and nothing that measures a single instant can see the difference. A fixed-window counter has the opposite problem, a boundary burst of 2N in an instant. The bucket has neither, because it accrues tokens continuously rather than resetting on a calendar.",
		},
		{
			n: "07",
			heading: { en: "That map is shared. The detector is the only thing that knows." },
			uses: ["sync-mutex", "race-detector", "goroutines", "maps"],
			blocks: [
				{
					type: "text",
					value: {
						en: "net/http serves every connection on its own goroutine. You did not write that go statement, you will never see it in your code, and that is exactly why this is easy to miss: your handler reads like a single-threaded function because from the inside it is one. There are just hundreds of it, at once, and every one of them reaches into the same bucket map you closed over in RateLimitMiddleware.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Guard every access to the bucket map with one mutex, and hold it across the entire read-modify-write: look up the bucket, refill it, test it, spend the token, and only then unlock. Start a background goroutine that takes the same mutex and evicts buckets whose owners have gone quiet, so the map cannot grow without bound. Then run the suite with -race.",
					},
					why: {
						en: "Two separate bugs live here and only one of them is the obvious one. The first is the map: concurrent writes to a Go map are undefined behaviour under the memory model, and the runtime's own guard may or may not catch you. The second is subtler and survives a naive fix. If you lock to read the token count, unlock, decide, and lock again to decrement, two goroutines both read four tokens, both conclude they may proceed, and both write three. You have lost an update, your limiter leaks a request per collision, and every individual map access was perfectly synchronised. Atomicity is a property of the whole operation, not of each access in it. The eviction goroutine is the third thing in the room: without it the map is an unbounded allocation keyed by a value the attacker chooses, which is a memory exhaustion primitive handed out for free, and with it you have a second goroutine touching your map forever, which is one more reason the lock is not optional.",
					},
					stdlibHint: "sync: sync.Mutex. time: time.NewTicker, time.Since",
					complexSnippet: `// One critical section, not three. The decision and the write it is based
// on must not be separable, or two goroutines can both read the same
// count, both decide yes, and both write it back.
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
mu.Unlock() // decide out here; do not hold the lock across next.ServeHTTP

if !allowed {
    http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
    return
}`,
					hints: [
						{
							label: "never hold a lock across next.ServeHTTP",
							value: "Take the decision under the lock, release it, then act. Holding the mutex while the downstream handler runs serialises your entire server behind one lock: throughput collapses to one request at a time, and a single slow handler blocks every other client's rate check. Locks protect data, and the data here is the bucket, not the request.",
						},
						{
							label: "why the goroutine leaks, and why it is tolerable here",
							value: "The evictor's ticker runs for the life of the process and nothing ever stops it, so every call to RateLimitMiddleware leaks one goroutine and one ticker forever. In a server that builds its chain once in main that is a fixed cost of exactly one, which is fine. In a test that constructs the middleware per case, or a library someone calls in a loop, it is a real leak, and the honest fix is a stop channel or a context. Knowing which of those situations you are in is the difference between a shortcut and a bug.",
						},
						{
							label: "sync.Map is not the fix",
							value: "It is built for two specific shapes, caches that are written once and read many times, and disjoint keys per goroutine. Your access pattern is read-modify-write on the same key from many goroutines, which is exactly what it is not for, and you would still need a lock inside each bucket. A plain map with a Mutex is the right answer, and reaching for sync.Map because a map is 'not thread safe' is how people make things slower and buggier at the same time.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -race ./middleware/\n\n# no gcc on Windows? then the detector cannot run at all:\ngo test ./middleware/",
					expect: {
						en: "Green, and with -race, silent. Silence is the entire output of a passing detector run. The three rate limit cases deliver their requests from concurrent goroutines specifically so there is something for it to watch. If -race fails with a cgo error, that is the second command's reason to exist: the detector needs cgo, which on Windows means an installed gcc toolchain. Without it the tests still run and still exercise the concurrency. Nothing is watching, which is what the next block is about.",
					},
					labPath: "labs/http-server/middleware/middleware_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the mu.Lock() and mu.Unlock() around the bucket lookup, leaving the eviction goroutine's pair in place. Then run it thirty times: for i in $(seq 30); do go test -count=1 -run TestRateLimit ./middleware/; done",
					},
					observe: {
						en: "go build is clean. go vet is clean. On a stock go1.22 toolchain with cgo off, thirty runs of that loop gave twenty-seven passes and three crashes. The crash, when it comes, is: fatal error: concurrent map writes, with a stack naming your buckets[ip] = b line and the test goroutine that reached it. Twenty-seven times out of thirty, the suite is green and your rate limiter is broken.",
					},
					why: {
						en: "Two different mechanisms are visible in that number and neither is the race detector. The 27 are the memory model: without a lock there is no happens-before edge between those goroutines, so the compiler and the CPU may reorder and cache as they like, and the program has no defined behaviour at all. It is not that it is usually right. It is that 'usually right' is not a category the spec has, and what you measured is a scheduler that happened not to interleave two writes into the same hash bucket in the same instant. The 3 are the runtime's own map guard: Go's map implementation sets a writing flag on entry and throws if it finds it already set, which is a cheap best-effort check that is always on and needs no cgo. It is not a detector, it is a smoke alarm that fires when the fire reaches it, and it caught one in ten here. That is the case for -race, and it is worth being exact about what the case is: the Go race detector documentation describes it as instrumenting memory accesses and reporting conflicting ones with the stacks of both accesses and of the goroutines that made them, deterministically, on any interleaving it actually observes, rather than only on the unlucky ones. This site cannot show you that output, because this toolchain has cgo off and the detector has never run here. Install gcc and run it yourself. That is not homework, it is the only version of this step where the machine tells you the truth.",
					},
				},
			],
			retrievalPrompt:
				"You take the mutex off the bucket map and go test passes twenty-seven times out of thirty. What did those twenty-seven runs prove? || Nothing. Without synchronisation there is no happens-before edge, so the program has no defined behaviour, and a green run means the scheduler did not happen to interleave two writes this time. The three failures were the runtime's map guard, a best-effort smoke alarm, not a detector. -race is what turns this from a coin flip into a report, and it needs cgo.",
		},
		{
			n: "08",
			heading: { en: "The zero value of http.Server has no deadlines at all" },
			uses: ["server-timeouts"],
			blocks: [
				{
					type: "text",
					value: {
						en: "&http.Server{Handler: mux} has no timeouts. Not generous ones: none. A client can complete a TCP handshake, send one byte of a request header, and hold a goroutine and a file descriptor for as long as it feels like, and it costs the client nothing to open ten thousand more from a laptop on hotel wifi. That is the whole of Slowloris. It needs no bandwidth, no botnet, and no vulnerability, because it is not exploiting a bug. It is using the defaults.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Fill in DefaultTimeouts() with four positive durations, and make New(h, t) apply every one of them to the http.Server it returns. ReadHeader must not be looser than Read.",
					},
					why: {
						en: "Four fields, four different questions, and they are not interchangeable. ReadHeaderTimeout bounds the time a client may take to send its request headers, which is the free one: nothing legitimate is slow at that, so a tight bound costs you nothing and closes the cheapest denial of service there is. ReadTimeout bounds reading the entire request including the body, so it has to be large enough for your slowest honest upload. WriteTimeout is the one to think about rather than copy, because the docs say it is reset whenever a new request's header is read, which means its clock starts before your handler does and it therefore bounds your handler, not just the write: set it to five seconds and every request that legitimately takes six dies, and the client cannot tell that apart from a crash. IdleTimeout bounds a kept-alive connection between requests, which is the half of the connection's life the other three never look at. Then there is the part that makes 'I set a timeout' an unreliable sentence: two of these fall back. ReadHeaderTimeout falls back to ReadTimeout when it is zero, and IdleTimeout falls back to ReadTimeout when it is zero. So a server with only ReadTimeout set has all three, at one value, which is by construction the wrong value for at least two of them.",
					},
					stdlibHint: "net/http: Server.ReadHeaderTimeout, Server.ReadTimeout, Server.WriteTimeout, Server.IdleTimeout",
					complexSnippet: `// All four, explicitly. Every one you leave out is not "the default",
// it is no deadline, or a fallback to a value chosen for another job.
return &http.Server{
    Handler:           h,
    ReadHeaderTimeout: t.ReadHeader, // 5s:   nothing honest is slow here
    ReadTimeout:       t.Read,       // 30s:  must fit your largest upload
    WriteTimeout:      t.Write,      // 30s:  bounds the HANDLER, not the write
    IdleTimeout:       t.Idle,       // 120s: keep-alive between requests
}`,
					hints: [
						{
							label: "the fallbacks, from the source",
							value: "net/http's readHeaderTimeout() returns ReadHeaderTimeout if non-zero and ReadTimeout otherwise; idleTimeout() does the same. Both are in server.go. This is why the suite pins all four fields rather than trusting one: a fallback means the field you forgot is not obviously broken, it is quietly borrowing a number that was chosen to bound something else.",
						},
						{
							label: "why ReadHeader must not exceed Read",
							value: "During the header phase the connection's read deadline is ReadHeaderTimeout alone; ReadTimeout is not applied until the headers are in. So a ReadHeader looser than Read does not get clamped by Read, it overrides it, and a silent client holds the connection for the longer of the two while Read looks like a bound you have and do not.",
						},
						{
							label: "the one these four cannot fix",
							value: "None of them bound the size of a request body, only the time spent reading it. A client on a fast link can stream you gigabytes well inside ReadTimeout. http.MaxBytesReader is the answer, per-handler, and it is worth knowing now that the timeouts you are setting here are the connection's clock and not its budget.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command:
						"go test -run 'TestDefaultTimeoutsAreAllSet|TestNewAppliesEveryTimeout|TestReadHeaderTimeout|TestIdleTimeout' ./server/",
					expect: {
						en: "Four green, in about a second. Read the two behavioural ones rather than just running them: they open a raw TCP connection and then misbehave, one by sending nothing at all and one by going quiet after a perfectly polite request, and both then require the server to hang up within three seconds. Three seconds against a 150ms timeout is not measuring the timeout. It is asking whether any deadline exists, which is the question the zero value answers with no.",
					},
					labPath: "labs/http-server/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "In New, delete the ReadHeaderTimeout line, leaving the other three. Run just the behavioural case: go test -run TestReadHeaderTimeoutHangsUpOnASilentClient ./server/. Then delete the ReadTimeout line as well and run it again.",
					},
					observe: {
						en: "After the first deletion it still passes, in about 0.8s. After the second it fails, after three seconds: the connection was still open and we had not sent a single byte.",
					},
					why: {
						en: "That first green is the fallback doing its job, and it is the reason this step insists on all four fields. With ReadHeaderTimeout zeroed, net/http's readHeaderTimeout() returned ReadTimeout instead, which that test sets to 400ms, so the server still hung up and the test still passed while the field you thought was protecting you was not set at all. Now notice what the fallback actually gave you: the header phase is being bounded by a number chosen to bound an entire upload. Here they are both small and it looks harmless. In DefaultTimeouts, Read is 30 seconds because a real body needs it, so the same fallback silently grants every silent client a thirty second hold on a goroutine and a descriptor. The field is not redundant, and the test passing is not the same as the field being set. That is why the suite has TestNewAppliesEveryTimeout sitting next to the behavioural cases: a behaviour test can be satisfied by a fallback, and only a test that looks at the field can tell you which of the four you actually wired.",
					},
				},
			],
			retrievalPrompt:
				"You set ReadTimeout and skipped ReadHeaderTimeout. Slow-header clients still get hung up on. Is that fine? || No. ReadHeaderTimeout falls back to ReadTimeout, so the header phase is now bounded by the number you chose for a whole upload, typically tens of seconds. You get a hang-up eventually rather than promptly, and every silent connection costs you a goroutine and a descriptor for the length of your upload budget. The fallback hides the missing field; it does not replace it.",
		},
		{
			n: "09",
			heading: { en: "Shutdown waits. Close does not." },
			uses: ["graceful-shutdown", "context", "channels", "select", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Press Ctrl-C on everything you have built so far and the Go runtime's default signal handler kills the process where it stands. Whatever was inside a handler at that instant dies mid-sentence: no response, no error, just a connection that stops. On your laptop that is one request you were making yourself. In production it is every request in flight, times every replica, times however many times a week you deploy.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Write Run(ctx, srv, ln, grace): serve ln, and when ctx is cancelled, stop accepting and give the requests already in flight up to grace to finish. Return nil only when every one of them did. If grace runs out, hang up on what is left and return an error saying so.",
					},
					why: {
						en: "srv.Shutdown closes the listeners, closes idle connections, and then waits for the active ones to go idle. srv.Close does not wait: it hangs up on live connections immediately and the client gets an EOF where its response was going to be. That is the entire difference between the two, and it is one identifier at one call site. Two things around it are just as easy to get wrong. Serve blocks until something stops it, so it has no success return: it always hands back a non-nil error, and after a clean stop that error is the sentinel http.ErrServerClosed, which means you closed it on purpose. And Shutdown needs a context of its own, built from context.Background(), because the ctx that told you to stop is already cancelled, and Shutdown honours the context it is given: hand it the cancelled one and it closes the listener, sees the context is done, and returns instantly having waited for nothing. The last thing worth being certain about is what Shutdown does not do. It does not cancel request contexts. It waits for handlers to return; it never interrupts them. Close is what kills the connection, and killing the connection is what cancels the request context.",
					},
					stdlibHint: "net/http: Server.Shutdown, Server.Close, http.ErrServerClosed. context: context.WithTimeout. errors: errors.Is",
					complexSnippet: `// Three API facts. Assembling them is yours.

// 1. Serve blocks and has no success return. This is the sentinel that
//    means "you stopped me", and it is the only clean outcome:
var ErrServerClosed = errors.New("http: Server closed") // net/http

// 2. Shutdown obeys the context it is handed, so it cannot be handed one
//    that is already done. Background() is the root of a fresh deadline:
context.WithTimeout(context.Background(), grace)

// 3. Serve runs on another goroutine, so its error comes back on a
//    channel. Buffer it: on the path where Run returns early, nobody is
//    left to receive, and an unbuffered send would block that goroutine
//    for the life of the process.
served := make(chan error, 1)`,
					hints: [
						{
							label: "why grace has to exist at all",
							value: "Waiting for in-flight work is the right default and an unbounded wait is not a wait, it is a hang. Something above you has its own timer, and when it runs out you get SIGKILL and no drain whatsoever. Blowing your own deadline and hanging up on a few requests is bad; blowing the supervisor's takes everything still in flight with it.",
						},
						{
							label: "the buffered channel is not a detail",
							value: "Make served unbuffered and the error path leaks a goroutine forever: Shutdown fails, Run returns, and nobody is left to receive, so the sender blocks on a channel with no reader for the life of the process. Capacity one means the send always completes and the goroutine always exits. This is the most common goroutine leak in Go and it is one character.",
						},
						{
							label: "where this goes at Tier 3",
							value: "Everything above is the mechanism. The ordering around it, flipping readiness to 503 before you stop accepting, waiting for the load balancer to notice something nothing will ever tell you it noticed, and what happens to the connections sitting in the kernel's accept queue when the listener closes, is ship-it's whole subject. Get Shutdown right here and that project is about the choreography rather than the API.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -run TestRunWaitsForInFlightRequests -v ./server/",
					expect: {
						en: "Green, in about 0.34s. That number is the point: the test puts one request into a handler that sleeps 300ms, waits until it is genuinely inside, then cancels the context, and requires that the request still comes back with its body intact and that Run then returns nil. The 0.34s is your Run sitting there waiting for work it had already accepted.",
					},
					labPath: "labs/http-server/server/server_test.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Stop recognising the sentinel: delete the errors.Is(err, http.ErrServerClosed) check so Serve's error is returned as-is. Rerun the test.",
					},
					observe: {
						en: 'It fails with: Run = http: Server closed, want nil. And look at the time: 0.34s, unchanged. The in-flight request completed. The body was right. The drain worked perfectly and then reported that it had failed.',
					},
					why: {
						en: "Serve has no way to return success, because it is not supposed to return at all: it loops accepting connections until something breaks or somebody stops it, so every path out of it is an error path. Go's answer is a sentinel, a package-level var ErrServerClosed = errors.New(\"http: Server closed\") that Serve returns after a Shutdown or a Close, and comparing against it with errors.Is is what splits 'the listener broke' from 'you asked me to stop'. Those are opposite facts arriving through the same return value. Get it wrong and main exits non-zero on every clean shutdown, which means every successful deploy logs a failure, which means within a month nobody reads those alerts, which means the day it is a real crash nobody notices either. The bug is not that one exit code is wrong. It is that you have spent the credibility of your own alerting.",
					},
				},
			],
			retrievalPrompt:
				"Your drain calls srv.Shutdown(ctx) with the context SIGTERM cancelled, and it compiles and reads perfectly. Why is it a serious bug? || That context is already cancelled, and Shutdown obeys the context it is given. It closes the listener, sees the context is done, and returns immediately without waiting for a single in-flight request. Run returns, main returns, the process exits on top of live handlers. Shutdown's job starts exactly where that context's job ended, so it needs its own, built from context.Background() with its own deadline.",
		},
		{
			n: "10",
			heading: { en: "Run the whole thing, then read the reference" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been running one test at a time. Now run both suites as the thing they are: a description of a working server, written before you started. When they are green, the interesting part begins, which is comparing your decisions against someone else's for the same spec.",
					},
				},
				{
					type: "requirement",
					what: {
						en: "Get all fourteen cases green, with -race if you have cgo. Then open the two solution.go files and compare four specific things against your version: where the lock is taken and released in the rate limiter, whether your ResponseWriter wrapper starts at 200 or records it, which context the reference hands to Shutdown, and what it does with Serve's error. Where you differ, decide which you prefer and why. Some of your choices will be better.",
					},
					why: {
						en: "Reading a reference after your own is green is worth more than reading it before, and the difference is not willpower. Once you have made the decisions yourself you have a question for every line: not what does this do, but why did they do it there and I did it here. Before you have written it, the same file is prose that looks obvious. This is also why the lab ships the reference behind the same suites rather than as an appendix: an unverified reference is an opinion, and this one is held to the same fourteen cases you are.",
					},
					stdlibHint: "go test -race ./... runs both packages. -tags solution swaps your files for the reference.",
					complexSnippet: `go test -race ./...              # both suites, against your code
go test -tags solution ./...     # the same suites, against the reference`,
					hints: [
						{
							label: "read the suites too, not just the reference",
							value: "middleware_test.go and server_test.go are the only documents here that were written before the answer existed. The comments in them say why each case is shaped the way it is, and two of them explain why a single middleware or a single instant could never have caught the bug they are aimed at.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/http-server",
					command: "go test -race ./...\ngo test -tags solution ./...",
					expect: {
						en: "Both runs print the same two lines: ok for gopath.dev/labs/http-server/middleware at around 0.6s, and ok for gopath.dev/labs/http-server/server at around 1.1s. The second run is not grading you. It is the suite proving it is passable, which is the only reason you should trust it when it says your program is wrong.",
					},
					labPath: "labs/http-server/server/solution.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Run go test -tags solution ./..., then break the reference on purpose: in middleware/solution.go, delete the return after the invalid-token http.Error. Rerun. Then restore it with git checkout.",
					},
					observe: {
						en: "The reference fails exactly the case your code would have, with the same message: the next handler ran for a request auth must reject. The suite has no idea which file it is looking at.",
					},
					why: {
						en: "It compiles whatever the build tags select and asserts observable behaviour through the exported API, so the reference gets no credit for being the reference and your implementation gets no penalty for not matching it line for line. Any AuthMiddleware that rejects without calling next passes, and there are several honest ways to write one. That is what makes it a description of the spec rather than a diff against one answer, and it is the reason a red run is information rather than an opinion.",
					},
				},
				{
					type: "assessment",
					assessment: {
						kind: "integration",
						title: "Middleware test suite",
						description:
							"Machine check: from labs/http-server, go test -race ./... runs fourteen black-box cases across two packages and must pass with zero data races. Both suites call only the exported API stubbed out in middleware/middleware.go and server/server.go, so how you build the insides is your call.",
						labPath: "labs/http-server",
						testCases: [
							{
								description:
									"TestChainOrder: two order-revealing middleware through Chain",
								expected:
									"mwA runs before mwB, since Chain's first argument is the outermost wrapper",
							},
							{
								description: "TestLogging404: request to an unrouted path",
								expected:
									"slog output has status=404, plus method and path, as key=value attributes",
							},
							{
								description:
									"TestLoggingCapturesAnImplicit200AndTheByteCount: a handler that only calls Write",
								expected:
									"slog output has status=200 and bytes=5, though WriteHeader was never called",
							},
							{
								description: "TestAuth/no_Authorization_header",
								expected: "HTTP 401, next handler never runs",
							},
							{
								description: "TestAuth/invalid_token",
								expected: "HTTP 401, next handler never runs",
							},
							{
								description: "TestAuth/valid_token",
								expected:
									"HTTP 200, UserFromContext returns the token's user",
							},
							{
								description:
									"TestRateLimitWithinLimit: first N requests from one IP, delivered concurrently",
								expected: "HTTP 200 for all N",
							},
							{
								description:
									"TestRateLimitOverLimit: request N+1 from the same IP",
								expected: "HTTP 429",
							},
							{
								description:
									"TestRateLimitRefill: exhaust the burst, then wait one token's worth of time",
								expected:
									"the next request gets HTTP 200, proving tokens refilled",
							},
							{
								description: "TestDefaultTimeoutsAreAllSet",
								expected:
									"all four deadlines positive, and ReadHeader no looser than Read",
							},
							{
								description: "TestNewAppliesEveryTimeout",
								expected:
									"each Timeouts field reaches the http.Server field that means it",
							},
							{
								description:
									"TestReadHeaderTimeoutHangsUpOnASilentClient: raw TCP, sends nothing",
								expected: "the server hangs up within three seconds",
							},
							{
								description:
									"TestIdleTimeoutClosesAQuietKeepAliveConnection: raw TCP, one request then silence",
								expected: "the server hangs up within three seconds",
							},
							{
								description:
									"TestRunWaitsForInFlightRequests: one request inside a handler when ctx is cancelled",
								expected:
									"it still gets its full response, and Run then returns nil",
							},
						],
						desiredOutput:
							"ok  \tgopath.dev/labs/http-server/middleware\t0.639s\nok  \tgopath.dev/labs/http-server/server\t1.094s",
						hints: [
							{
								label: "-race",
								value: "go test -race ./... runs the Go race detector, and any unsynchronised concurrent access to the bucket map is reported as a data race and fails the test. -race needs cgo; on Windows without gcc, drop the flag. Do not mistake the green run that follows for evidence: without the mutex, thirty runs of the rate limit cases on a cgo-off toolchain passed twenty-seven times.",
							},
							{
								label: "the pinned API",
								value: "The suites call Chain, LoggingMiddleware(*slog.Logger), AuthMiddleware(map[string]string), UserFromContext(ctx), RateLimitMiddleware(n int), DefaultTimeouts(), New(http.Handler, Timeouts), and Run(ctx, *http.Server, net.Listener, time.Duration). The exact signatures are already stubbed in middleware/middleware.go and server/server.go.",
							},
							{
								label: "the two slow cases are slow on purpose",
								value: "TestRateLimitRefill sleeps for a token to come back and the two raw-TCP deadline cases wait to be hung up on. About 1.7s total across both packages is the shape of a healthy run, not a problem to optimise.",
							},
						],
					},
				},
			],
			retrievalPrompt:
				"The lab runs the same suites against its own reference solution, which is already known to be correct. What is that for? || It is what proves the suite is passable. A suite nobody has ever passed is a guess, not evidence. Because it goes green against a real implementation and red the moment that implementation is broken, you can trust it when it tells you your program is wrong. It asserts behaviour through the exported API and has no idea which file it is looking at.",
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "The composition was the easy part, and it was over by step 01: one interface with one method, a function that takes a handler and returns a handler, and a loop that folds in the right direction. Everything after that was the parts a framework's Use() method hides from you rather than solves for you. A ResponseWriter that will not tell you what you wrote. A context value that is invisible to the type system in both directions. Shared mutable state on goroutines you never spawned. A server whose zero value will hold a socket forever and call a clean shutdown a crash.",
			},
		},
		{
			type: "text",
			value: {
				en: "The break-it steps had a shape in common, and it is the shape worth taking with you. Almost none of these bugs crash. A missing return sends a 401 and does the work anyway, so the status code, the access log, and every metric derived from it all agree on something that did not happen. A wrapper that starts at zero logs status=0 for every success on the service and is invisible until the dashboard you trusted turns out to have been counting nothing. slog.Info instead of logger.Info prints a perfect line to a place nobody chose. A rate limiter with no refill passes two of its three tests. A ReadHeaderTimeout you never set is covered for you by a fallback holding a number picked for uploads. Every one of them reports success.",
			},
		},
		{
			type: "text",
			value: {
				en: "And then the mutex, which deserves the last word. Twenty-seven green runs out of thirty, on code that go build and go vet both signed off on. Not a flaky test: a program with no defined behaviour that happened to get away with it, twenty-seven times, in front of you. That is the argument for -race, and it is the argument for every tool that looks at what the machine is actually allowed to do rather than at what it did this afternoon. Tier 3 assumes you have internalised it.",
			},
		},
	],
}
