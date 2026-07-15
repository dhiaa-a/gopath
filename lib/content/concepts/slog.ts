import { Concept } from "../../content"

export const slog: Concept = {
	slug: "slog",
	name: "log/slog",
	tagline: "One line per event, as key/value pairs a machine can query.",
	summary:
		"<code>log/slog</code> is structured logging in the standard library, added in Go 1.21. It splits logging in two: a <code>*slog.Logger</code> that you call, and a <code>slog.Handler</code> that decides what the output looks like and where it goes. The same call site produces <code>key=value</code> text for your terminal or JSON objects your aggregator can index, and you choose which once, in <code>main</code>.",
	mentalModel:
		"A line written with Printf is a sentence. A line written with slog is a record. You can grep a sentence, but you cannot ask it a question, and the questions are the reason you are logging: \"every 5xx on /checkout slower than a second, from this deploy, grouped by user\" needs status to be a field with a value, not a token sitting between two other tokens that also happen to be numbers. Logger is the pen and Handler is the paper. You pick the paper once, in main, and every call site stays the same.",
	retrievalPrompts: [
		"slog.Info and logger.Info differ by one word and both print a correct-looking line. What actually changes? || slog.Info calls the package-level default logger, whose handler writes through the standard log package to stderr, which is why its output carries a log-package date stamp instead of a time= attribute. logger.Info uses the handler you configured. So the package-level call silently ignores your JSON handler, your destination and your level, while looking perfectly right in a terminal, and no test holding a bytes.Buffer will ever see it.",
		"Why must msg be a constant, with everything variable in the attributes? || msg is what an aggregator groups and counts by. logger.Info(fmt.Sprintf(\"request to %s\", path)) gives you as many distinct messages as you have paths, so counting by message becomes meaningless and every dashboard built on it quietly stops working. logger.Info(\"request\", \"path\", path) is one message with a path attribute you can filter and group on.",
		"logger.Info(\"request\", \"method\", \"GET\", \"dangling\") compiles. What does it log? || The variadic args are alternating key/value pairs typed ...any, so an odd count cannot be a compile error. The stray value gets logged under the key !BADKEY at run time. slog.String(\"method\", \"GET\") is the typed form that cannot go wrong, and LogAttrs takes only Attrs plus a context and skips a couple of allocations on the hot path.",
	],
	codeExample: `package main

import (
	"log/slog"
	"os"
	"time"
)

func main() {
	// The Logger is what you call. The Handler decides what the output looks
	// like and where it goes. Swap NewJSONHandler for NewTextHandler and not
	// one call site below changes.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo, // Debug records are dropped by the Handler
		// Drop the timestamp so this example's output is stable. This hook is
		// also where you redact, rename, or reshape attributes.
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				return slog.Attr{}
			}
			return a
		},
	}))

	// msg is a constant. Everything variable is an attribute, because msg is
	// the thing your aggregator groups by.
	logger.Info("request", "method", "GET", "path", "/health", "status", 200)

	// With pre-formats its attrs once and returns a child logger. This is the
	// request-scoped logger you pass down a call stack.
	reqLog := logger.With(slog.String("request_id", "abc123"))
	reqLog.Warn("slow query", slog.Duration("took", 1500*time.Millisecond))

	logger.Debug("never printed") // below Level, so the Handler never sees it
}`,
	codeExplanation:
		"<code>slog.New</code> takes a Handler, and the Handler is the only thing that knows about format or destination: swap <code>NewJSONHandler</code> for <code>NewTextHandler</code> and the three calls below it are untouched. The output is exactly two lines, because <code>Debug</code> is below the handler's <code>Level</code> and is discarded before anything is formatted: <code>{\"level\":\"INFO\",\"msg\":\"request\",\"method\":\"GET\",\"path\":\"/health\",\"status\":200}</code> and <code>{\"level\":\"WARN\",\"msg\":\"slow query\",\"request_id\":\"abc123\",\"took\":1500000000}</code>. Two things are worth noticing in that second line. <code>With</code> bound <code>request_id</code> once and every call on the child logger carries it, which is how a request id reaches code that has never heard of your request. And the duration came out as an integer nanosecond count, because that is how <code>JSONHandler</code> encodes a <code>time.Duration</code>, where <code>TextHandler</code> would have written <code>took=1.5s</code>. <code>ReplaceAttr</code> is only dropping the timestamp here to keep the output stable, but in a service it is where you redact a token or rename a key to match a schema.",
	designRationale:
		"The interesting question is not why Go added structured logging in 1.21, it is why the standard library needed to own it when zap, zerolog and logrus already existed and were faster. The answer is the <code>Handler</code> interface. Before slog, a library that wanted to log had to either pick a logging package and impose it on every application that imported it, or invent its own pluggable logger interface, which is why so much Go code carries a hand-rolled four-method <code>Logger</code> interface that exists purely to avoid choosing. Putting the interface in the standard library makes the ecosystem composable: a library depends on <code>*slog.Logger</code>, an application picks the backend once, and the two never have to agree on a dependency. The rest of the design falls out of having to be adoptable. Levels are plain ints rather than an enum, spaced four apart, so that schemes with extra named levels can sit between them (the docs cite Google Cloud Logging's Notice, and note the gap of 4 matches OpenTelemetry's mapping), and so that <code>LevelInfo</code> can be zero, the default value of an int. The <code>...any</code> alternating-pair API exists for the call sites you write in a hurry, and <code>Attr</code> with <code>LogAttrs</code> exists because slog had to be fast enough to displace zap; without the allocation-free path it would have been a standard library nobody adopted.",
	commonMistakes: [
		{
			title: "Calling slog.Info instead of the logger you were handed",
			body: "The package-level functions use the default logger, not yours. The line looks right in a terminal and goes to stderr through the log package, bypassing the JSON handler and destination <code>main</code> configured, so it is absent from every dashboard built on them and invisible to any test. Take a <code>*slog.Logger</code> as a dependency and call it. Use <code>slog.SetDefault</code> only to catch code you do not own.",
		},
		{
			title: "Putting variables in msg",
			body: "<code>logger.Info(fmt.Sprintf(\"user %d logged in\", id))</code> produces one distinct message per user. msg is the grouping key: keep it a constant and move the variable into an attribute, <code>logger.Info(\"user logged in\", \"user_id\", id)</code>.",
		},
		{
			title: "An odd number of arguments",
			body: "The alternating key/value form takes <code>...any</code>, so a missing value compiles cleanly and shows up at run time as <code>!BADKEY</code>. Nothing fails, you just get a broken record. The typed constructors (<code>slog.String</code>, <code>slog.Int</code>, <code>slog.Duration</code>) make it a compile error instead.",
		},
		{
			title: "Logging whole structs",
			body: "<code>logger.Info(\"login\", \"user\", u)</code> formats every exported field, which is how tokens, password hashes and personal data end up in a log aggregator that a lot of people can read and that keeps things for a year. Log the fields you meant, or implement <code>slog.LogValuer</code> on the type so it decides its own redacted representation everywhere it is ever logged.",
		},
	],
	relatedSlugs: ["interfaces", "http-handler", "context"],
}
