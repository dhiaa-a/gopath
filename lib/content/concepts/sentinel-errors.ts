import { Concept } from "../../content"

export const sentinelErrors: Concept = {
	slug: "sentinel-errors",
	name: "Sentinel, typed, and wrapped errors",
	tagline:
		"== on a wrapped error returns false, which is the entire reason errors.Is exists, and choosing which error kind to expose is an API decision you cannot take back.",
	summary:
		"There are three ways to carry a failure in Go and they are not interchangeable. A <b>sentinel</b> (<code>var ErrNotFound = errors.New(...)</code>) is a singleton you compare against. A <b>typed</b> error (a struct implementing <code>error</code>) carries data. A <b>wrapped</b> error (<code>fmt.Errorf(\"...: %w\", err)</code>) nests one inside another for context. The moment you wrap, <code>==</code> stops working, because the outer error is a new value: <code>errors.Is</code> exists precisely to walk the <code>%w</code> chain that <code>==</code> cannot see. This page is about which of the three to <b>expose</b>, which is the harder question, and it goes past <a>error-handling</a>, which covers the basics of returning and checking.",
	mentalModel:
		"Ask what the caller needs to do with the failure, then pick the smallest error kind that lets them. If they only need to branch (\"was this a not-found?\"), a sentinel is enough and <code>errors.Is</code> is the check. If they need a field from the failure (\"which field failed validation?\"), you need a typed error and <code>errors.As</code> to pull it out. Wrapping is orthogonal to both: it is how you add context on the way up without destroying the caller's ability to run either check, as long as you use <code>%w</code> and not <code>%v</code>. And every sentinel and every exported error field is API: the day you publish <code>ErrNotFound</code>, someone writes <code>errors.Is(err, yourpkg.ErrNotFound)</code>, and you can never remove it.",
	retrievalPrompts: [
		"You wrap a sentinel: return fmt.Errorf(\"get user %d: %w\", id, ErrNotFound). A caller does if err == ErrNotFound. It compiles, runs, and never matches. Why, and does switching %w to %v fix it? || fmt.Errorf returns a brand new *fmt.wrapError whose identity is not ErrNotFound, so == compares the wrapper to the sentinel and gets false. That is the whole reason errors.Is exists: it unwraps the chain looking for the sentinel. Switching to %v makes it strictly worse, not better: %v formats the sentinel's text into the message and drops the link, so even errors.Is can no longer find it. The two messages are byte-identical (\"get user 42: not found\" either way), so nothing in the output warns you. %w keeps the chain, %v severs it, and only errors.Is reads the chain.",
		"A handler does var pe *net.ParseError; errors.As(err, &pe) and it panics or vets red. What is the shape mistake, and why does the compiler help here but not with errors.Is? || errors.As needs a pointer to the target: a *ParseError value is found by passing **ParseError, so the argument is &pe where pe is already *net.ParseError. Pass a non-pointer or the wrong pointer type and go vet flags it statically and errors.As panics at runtime, because As uses reflection and can check the target's type. errors.Is takes an error and an error, so any two errors typecheck: there is nothing for the compiler to reject, which is exactly why the wrapped-== bug is silent while the As bug is loud.",
		"You are designing a package. You want callers to distinguish 'not found' from other failures but you are not sure whether to ship a sentinel ErrNotFound or a typed NotFoundError. What tips the decision, and what have you committed to either way? || Ship the sentinel if 'not found' carries no data the caller needs; ship the typed error if it carries something (the key, the table, a retry-after). Either way you have committed to it forever: it is now in your public API, callers write errors.Is or errors.As against it, and removing it or changing the wrapping is a breaking change even though nothing in your function signature mentions it. The conservative move is to expose the smaller surface first, a sentinel, because widening later (sentinel to typed) is easier than removing a field callers now depend on.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
)

// A sentinel: identity is the whole value, it carries no data.
var ErrNotFound = errors.New("not found")

// A typed error: same "kind" of failure, but it carries a number.
type QuotaError struct{ Limit int }

func (e *QuotaError) Error() string { return fmt.Sprintf("quota of %d exceeded", e.Limit) }

func main() {
	// 1. Wrapping with %w keeps the chain. == compares the OUTER error only.
	wrapped := fmt.Errorf("get user 42: %w", ErrNotFound)
	fmt.Println("wrapped == ErrNotFound    :", wrapped == ErrNotFound)
	fmt.Println("errors.Is(wrapped, ErrNF) :", errors.Is(wrapped, ErrNotFound))

	// 2. %v formats the text and severs the chain. Same message, no match.
	severed := fmt.Errorf("get user 42: %v", ErrNotFound)
	fmt.Printf("severed message          : %q\\n", severed)
	fmt.Println("errors.Is(severed, ErrNF) :", errors.Is(severed, ErrNotFound))

	// 3. errors.As finds a type in the chain and hands you the value.
	var qe *QuotaError
	err := fmt.Errorf("create user: %w", &QuotaError{Limit: 100})
	fmt.Println("errors.As(err, &qe)       :", errors.As(err, &qe), "-> Limit =", qe.Limit)

	// 4. errors.Join (Go 1.20): one error, several independent matches.
	joined := errors.Join(ErrNotFound, &QuotaError{Limit: 5})
	var qe2 *QuotaError
	fmt.Println("joined Is(ErrNF)          :", errors.Is(joined, ErrNotFound))
	fmt.Println("joined As(&qe2)           :", errors.As(joined, &qe2), "-> Limit =", qe2.Limit)

	// 5. Two sentinels with identical text are still different errors.
	a, b := errors.New("not found"), errors.New("not found")
	fmt.Println("a == b (same text)        :", a == b)
}`,
	codeExplanation:
		"The output is the argument. Line 1 prints <code>wrapped == ErrNotFound : false</code> next to <code>errors.Is(wrapped, ErrNF) : true</code>: the exact same error, one check blind to it and one not, because <code>fmt.Errorf</code> returned a new wrapper and <code>==</code> compares identities while <code>errors.Is</code> unwraps. Line 2 is the trap that looks like a fix: the <code>%v</code> version's message is <code>\"get user 42: not found\"</code>, character for character what <code>%w</code> produced, yet <code>errors.Is</code> now returns <code>false</code> because <code>%v</code> copied the text and threw away the link. You cannot tell <code>%w</code> from <code>%v</code> by reading the log line, only by running the check. Line 3 shows the other axis: <code>errors.As</code> reaches through the wrapper, finds the <code>*QuotaError</code>, and populates <code>qe</code> so you can read <code>Limit = 100</code>, which a sentinel could never give you. Line 4 is <code>errors.Join</code> from Go 1.20, one error that satisfies <b>both</b> an <code>Is</code> and an <code>As</code> because it holds a tree rather than a chain. Line 5 nails identity: two sentinels with the exact text <code>\"not found\"</code> compare <code>false</code>, because a sentinel's meaning is its pointer, not its message. This runs identically on the Go Playground, no clock or timing involved.",
	designRationale:
		"For Go's first six years there was no wrapping in the standard library. <code>errors.New</code> and a comparison against a package-level sentinel was the whole vocabulary, which is why <code>io.EOF</code> is a sentinel and why so much code still does <code>if err == io.EOF</code>. That worked until people wanted context, at which point the community grew <code>github.com/pkg/errors</code> with <code>Wrap</code> and <code>Cause</code>, and the ecosystem split between libraries that wrapped and libraries that did not, so <code>err == ErrNotFound</code> worked or silently failed depending on whose code you called. Go 1.13 absorbed the idea into the standard library deliberately: <code>%w</code>, <code>errors.Is</code>, and <code>errors.As</code>, with <code>Is</code> and <code>As</code> designed so that a wrapped error and a bare error are checked the same way, so callers stop caring whether the layer above them wrapped. The split between <code>Is</code> and <code>As</code> mirrors the split between sentinel and typed: <code>Is</code> answers an identity question and takes two errors, so anything typechecks and the compiler cannot help you; <code>As</code> answers a type question and takes a pointer target, so <code>go vet</code> and a runtime panic both police the shape. That asymmetry is not an accident, it falls out of what each check can know. <code>errors.Join</code> arrived in Go 1.20 for the case the chain could not express: a batch that fails in three independent ways, where you want all three preserved rather than a single cause, which is why <code>Unwrap</code> gained an <code>[]error</code> form alongside the single-<code>error</code> one. The through-line is that Go added expressiveness without adding a keyword: errors are still ordinary values, and every one of these is a function in a package rather than a language feature, which is why you can implement <code>Is</code> or <code>Unwrap</code> on your own type and the standard machinery just uses it.",
	commonMistakes: [
		{
			title: "Comparing a possibly-wrapped error with ==",
			body: "<code>if err == ErrNotFound</code> works right up until someone in the call chain adds context with <code>%w</code>, at which point the wrapper's identity is not the sentinel's and the branch silently stops firing. Nothing warns you, because <code>==</code> on two errors always typechecks. Use <code>errors.Is(err, ErrNotFound)</code>, which is correct whether or not anyone wrapped, and reserve <code>==</code> for the rare sentinel you own and know is never wrapped.",
		},
		{
			title: "Reaching for %v when you meant %w",
			body: "<code>fmt.Errorf(\"...: %v\", err)</code> produces a message identical to the <code>%w</code> version, so tests that assert on the string pass, but it flattens the error to text and severs the chain, so every downstream <code>errors.Is</code> and <code>errors.As</code> goes blind. The failure surfaces far from the typo, in some caller's matching logic. If you ever want the caller to match the underlying error, <code>%w</code>. Use <code>%v</code> only when you are deliberately hiding an internal error from the caller's inspection.",
		},
		{
			title: "Passing the wrong pointer depth to errors.As",
			body: "<code>errors.As</code> wants a pointer to the target, so to find a <code>*QuotaError</code> you pass <code>&qe</code> where <code>qe</code> is already <code>*QuotaError</code>. Pass a non-pointer, or a pointer to a type that does not implement <code>error</code>, and it panics at runtime with <code>*target must be interface or implement error</code>. <code>go vet</code> catches this one statically, so a clean vet run is the cheap guard, but the runtime panic is what you get if you ignore it.",
		},
		{
			title: "Exposing a sentinel you will want to enrich later",
			body: "A sentinel is a permanent, dataless promise. Ship <code>ErrRateLimited</code> and the day you need to also tell callers the retry-after duration, you cannot add it: the sentinel has no fields, and changing it to a typed error breaks every <code>errors.Is(err, ErrRateLimited)</code> that used <code>==</code>. Decide up front whether the failure carries data. If there is any chance it will, ship a typed error whose zero value is still matchable, and callers use <code>errors.As</code> from day one.",
		},
		{
			title: "Wrapping an internal error into your public API by reflex",
			body: "<code>%w</code> is a contract: it promises callers that the wrapped error is part of your API and they may match on it. Wrap a <code>database/sql</code> or driver error with <code>%w</code> and you have published your storage layer, so a caller can now write <code>errors.Is(err, sql.ErrNoRows)</code> against you and you can never swap databases without breaking them. At an API boundary, translate: map the internal error to your own sentinel or typed error and wrap <b>that</b>, keeping the original with <code>%v</code> for the log but out of the chain.",
		},
	],
	relatedSlugs: ["error-handling", "interfaces", "packages", "context"],
}
