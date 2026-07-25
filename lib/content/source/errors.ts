import { SourceWalkthrough } from "../../content"

export const errorsPackage: SourceWalkthrough = {
	slug: "errors",
	name: "the errors package",
	pkg: "errors",
	order: 1,
	unlockTier: 1,
	tagline:
		"Three files, 296 lines, and no data structure anywhere. The error tree everyone talks about is two method shapes checked at run time, and this is the package where you learn to see that.",

	why: `<p>Start here. You have already used every function in this package, which is exactly the point: nothing in the source can confuse you about intent, so everything you find is mechanism.</p>
<p>And there is more mechanism than the API suggests. There is no <code>Wrapper</code> interface. There is no tree type, no registry, no node. The whole structure the documentation calls a tree is assembled at run time out of two method signatures, using a trick most Go programmers can read but few would think to write.</p>
<p>The skill this file trains is <strong>reading a guard clause as a contract</strong>. Almost every interesting line in this package is a check placed in front of the real work: a nil test, a comparability test, a panic. Each is defending against something specific, and you can find out what by asking one small question over and over: <em>what would the very next line do if this check were deleted?</em> Ask it four times here and you will turn up a surprising return value, a latent panic that only fires in production, and a rule the docs state that the compiler cannot enforce.</p>`,

	entryFile: "src/errors/errors.go",
	openCommand: 'less "$(go env GOROOT)/src/errors/errors.go"',

	orientation: `<p>Three files. Their sizes tell you where the work is before you read a line:</p>
<ul>
<li><strong><code>errors.go</code>, 87 lines.</strong> Fifty-two of them are the package doc comment. The code is <code>New</code>, a one-field struct, one method, and one sentinel. Two minutes.</li>
<li><strong><code>wrap.go</code>, 147 lines.</strong> Everything difficult lives here: <code>Unwrap</code>, <code>Is</code>, <code>As</code>, and the two unexported workers that do the walking.</li>
<li><strong><code>join.go</code>, 62 lines.</strong> A constructor, a type, two methods.</li>
</ul>
<p>Before anything else, read the three copyright headers. <code>errors.go</code> says 2011, <code>wrap.go</code> says 2018, <code>join.go</code> says 2022. That is not trivia, it is the shape of the package: what you import as one API is three designs layered over eleven years, and it explains a gotcha you will meet in the second excerpt. Copyright years are the cheapest archaeology in the standard library and almost nobody looks at them.</p>
<p>Now read the package doc in <code>errors.go</code> slowly, as a specification rather than as prose. In fifty-two lines it defines the verb "wraps", names the exact two method signatures that count, fixes the traversal order as pre-order depth-first, and declares one input invalid that the compiler will happily let you produce. Everything in <code>wrap.go</code> is an implementation of that comment.</p>
<p>Then notice the shape <code>wrap.go</code> is built in, because it recurs throughout the standard library: <strong>an exported function that validates, and a lowercase twin that loops.</strong> <code>Is</code> calls <code>is</code>. <code>As</code> calls <code>as</code>. The exported half runs the checks that only need to happen once and would be pure overhead inside a loop; the unexported half assumes those checks passed and is free to be a tight recursion. Whenever a stdlib function looks too short to do its job, look immediately below it for the lowercase version.</p>
<p>Safe to skip on a first pass: the doc comment on <code>ErrUnsupported</code> at the foot of <code>errors.go</code> is API etiquette rather than mechanism, and <code>errorType</code> on the last line of <code>wrap.go</code> is a cached reflection value with nothing to teach until you reach <code>As</code>.</p>
<p>If you would rather stay in the terminal, <code>go doc -src errors.Is</code> prints the source of a single function without opening the file.</p>`,

	excerpts: [
		{
			file: "src/errors/errors.go",
			title: "Read the return statement, not the function name",
			startLine: 59,
			code: `// New returns an error that formats as the given text.
// Each call to New returns a distinct error value even if the text is identical.
func New(text string) error {
	return &errorString{text}
}

// errorString is a trivial implementation of error.
type errorString struct {
	s string
}

func (e *errorString) Error() string {
	return e.s
}`,
			notice: `<p><code>New</code> returns <code>&amp;errorString{text}</code>. A <em>pointer</em>. And <code>Error</code> is declared on <code>*errorString</code>, not on <code>errorString</code>, so the pointer is the only thing here that satisfies <code>error</code> at all. The compiler is explicit if you try the value: <code>errorString does not implement error (method Error has pointer receiver)</code>.</p>
<p>That single <code>&amp;</code> is the entire sentinel mechanism. Two pointers are equal only when they are the same allocation, so <code>err == ErrNotFound</code> compares identity and never text. The doc comment says so in a line that reads like a footnote and is not one: <em>"Each call to New returns a distinct error value even if the text is identical."</em> Measured on go1.23.12:</p>
<pre><code>a := errors.New("boom")
b := errors.New("boom")
a == b                 // false
a.Error() == b.Error() // true
errors.Is(a, b)        // false</code></pre>
<p>Two things follow. A sentinel has to be a package-level <code>var</code> evaluated once, because <code>errors.New</code> called inside a function mints a fresh, unmatchable error on every call. And comparing error <em>strings</em> is not a rough approximation of comparing errors, it is a different comparison that sometimes agrees: those two values have identical text and are not equal. Notice also that <code>errorString</code> is unexported with an unexported field, so the value handed back is opaque by construction. You cannot type-assert your way into it. Compare it or print it, and nothing else.</p>`,
		},
		{
			file: "src/errors/wrap.go",
			title: "The chain is a method shape, not a type",
			startLine: 15,
			code: `// Unwrap only calls a method of the form "Unwrap() error".
// In particular Unwrap does not unwrap errors returned by [Join].
func Unwrap(err error) error {
	u, ok := err.(interface {
		Unwrap() error
	})
	if !ok {
		return nil
	}
	return u.Unwrap()
}`,
			notice: `<p>Look for the interface declaration this asserts against. There isn't one. The interface is written inline, anonymously, at the point of use: <code>err.(interface { Unwrap() error })</code>. Any type with a method of that exact shape joins the error chain whether or not it has ever heard of this package. Your type does not implement an interface; it simply has the method, and this assertion goes looking for it. Once you can read that construct you can read most of <code>io</code>, <code>fmt</code>, and <code>net/http</code>, all of which probe for optional methods the same way.</p>
<p>Now read the two comment lines above the function, because they are the only warning you get, and the copyright headers explain them. <code>Unwrap</code> was written in 2018 and understands one of the two shapes the package doc lists. <code>Join</code> arrived in 2022 with the other one. Hand a joined error to the older function and the assertion simply fails:</p>
<pre><code>errors.Unwrap(errors.Join(a, b)) // &lt;nil&gt;
errors.Is(errors.Join(a, b), b)  // true</code></pre>
<p>So the package ships a function that does not understand half of its own data model, deliberately, and returns <code>nil</code> rather than an error to say so. This is the concrete reason to prefer <code>errors.Is</code> and <code>errors.As</code> over a hand-rolled <code>for e := err; e != nil; e = errors.Unwrap(e)</code> loop. That loop terminates at the first joined error and never sees its children, and the failure mode is a match you silently never find rather than a crash you can debug.</p>`,
		},
		{
			file: "src/errors/wrap.go",
			title: "One reflection call at the top of the hottest function",
			startLine: 44,
			code: `func Is(err, target error) bool {
	if err == nil || target == nil {
		return err == target
	}

	isComparable := reflectlite.TypeOf(target).Comparable()
	return is(err, target, isComparable)
}`,
			notice: `<p>Six lines of body, and two of them repay a stop.</p>
<p><code>if err == nil || target == nil { return err == target }</code> reads like a redundant guard and is actually a definition: it makes <code>errors.Is(nil, nil)</code> return <strong>true</strong>. That is what lets a helper call <code>errors.Is(err, target)</code> without special-casing the happy path, since a nil error genuinely does match a nil target. Measured: <code>errors.Is(nil, nil)</code> is <code>true</code>, while <code>errors.Is(err, nil)</code> and <code>errors.Is(nil, err)</code> are both <code>false</code>.</p>
<p>The other line is the one to interrogate. A call into the reflect machinery at the entrance to this package's hottest function is never decoration, so ask the question: what would happen if it were deleted and the walk just ran <code>err == target</code> every time? Comparing two interface values that hold the same non-comparable dynamic type is a runtime panic, not a <code>false</code>. So comparability is computed once here, before the walk, and threaded down so the loop never has to think about it again. Measured with an error type holding a slice field:</p>
<pre><code>var e error = multiErr{[]string{"a", "b"}}
var same error = e
e == same          // panic: runtime error: comparing uncomparable type main.multiErr
errors.Is(e, same) // false</code></pre>
<p>Read that second result again. <code>errors.Is(e, e)</code> is <code>false</code>. The library refuses to panic on your behalf, so it declines to compare at all, falls through to the rest of the walk, finds no <code>Is</code> method and nothing to unwrap, and reports no match. An error type with a slice, map, or function field can never be found by identity, and nothing anywhere warns you. This is the cost of the design choice, and you only learn it from this line.</p>`,
		},
		{
			file: "src/errors/wrap.go",
			title: "The walk: chains iterate, trees recurse",
			startLine: 53,
			code: `func is(err, target error, targetComparable bool) bool {
	for {
		if targetComparable && err == target {
			return true
		}
		if x, ok := err.(interface{ Is(error) bool }); ok && x.Is(target) {
			return true
		}
		switch x := err.(type) {
		case interface{ Unwrap() error }:
			err = x.Unwrap()
			if err == nil {
				return false
			}
		case interface{ Unwrap() []error }:
			for _, err := range x.Unwrap() {
				if is(err, target, targetComparable) {
					return true
				}
			}
			return false
		default:
			return false
		}
	}
}`,
			notice: `<p>This is the whole traversal, and its shape answers a question the docs raise without settling: the package doc says successive unwrapping creates a <em>tree</em>, so where is the tree code? It is one <code>case</code>. The two arms of that type switch are not two spellings of the same thing.</p>
<p>The <code>Unwrap() error</code> arm <strong>assigns</strong> to <code>err</code> and falls off the bottom of the switch back into the <code>for</code>: a linear chain is a loop, one stack frame, however deep it goes. The <code>Unwrap() []error</code> arm <strong>calls <code>is</code> again</strong>, once per child, then returns unconditionally: a branching tree is recursion, one frame per level. Same function, two very different costs. Measured with 200,000 levels and the stack ceiling turned down to 1 MiB via <code>debug.SetMaxStack</code>:</p>
<pre><code>chain (Unwrap() error)   errors.Is -&gt; true
tree  (Unwrap() []error) fatal error: stack overflow
                         errors.is(...)
                         errors.is(...)   [repeating to the limit]</code></pre>
<p>The arms look like they need a precedence rule and do not: Go has no method overloading, so no type can carry both signatures. Writing both is a compile error, <code>method both.Unwrap already declared</code>, which is why the order of the cases is free.</p>
<p>Two more details while you are in here. The <code>Is(error) bool</code> probe runs at <em>every</em> node rather than only the top, so a custom <code>Is</code> method three wrappers down still gets asked. And <code>if err == nil { return false }</code> after the assignment is the doc comment made executable: an <code>Unwrap</code> returning nil means "I wrap nothing", and the walk stops there instead of treating nil as a node.</p>`,
		},
		{
			file: "src/errors/wrap.go",
			title: "Three panics, and the guard that hides them",
			startLine: 97,
			code: `func As(err error, target any) bool {
	if err == nil {
		return false
	}
	if target == nil {
		panic("errors: target cannot be nil")
	}
	val := reflectlite.ValueOf(target)
	typ := val.Type()
	if typ.Kind() != reflectlite.Ptr || val.IsNil() {
		panic("errors: target must be a non-nil pointer")
	}
	targetType := typ.Elem()
	if targetType.Kind() != reflectlite.Interface && !targetType.Implements(errorType) {
		panic("errors: *target must be interface or implement error")
	}
	return as(err, target, val, targetType)
}`,
			notice: `<p><code>As</code> is doing at run time what a compiler would do at compile time if the signature could express it. <code>target any</code> throws away every type guarantee, so the checks that follow are the type system rebuilt in reflection and enforced with panics. Read them as the signature this function wishes it had: a non-nil pointer to either an interface or something that implements <code>error</code>.</p>
<p>Then read the <em>order</em>, because the order is the finding. <code>if err == nil { return false }</code> sits <strong>above</strong> every one of those panics. So the validation of your target does not run when your code is behaving and no error occurred. It runs only when an error is actually present. Same target, two different days:</p>
<pre><code>var s string
errors.As(nil, &amp;s)                 // false, no panic
errors.As(errors.New("boom"), &amp;s)  // panic: errors: *target must be interface or implement error
errors.As(nil, nil)                // false, no panic
errors.As(errors.New("boom"), nil) // panic: errors: target cannot be nil</code></pre>
<p>A wrong <code>errors.As</code> target is therefore a latent panic that waits for your <em>sad</em> path: the branch that runs in production, under load, during the incident, and that a happy-path test never enters. If you add an <code>errors.As</code> call, the test worth writing is the one that feeds it a real error. Generalize the habit: whenever a cheap early return sits above a block of validation, the validation is conditional, and the question to ask is which of your tests actually reach it.</p>`,
		},
		{
			file: "src/errors/join.go",
			title: "Two comments that are proofs",
			startLine: 44,
			code: `func (e *joinError) Error() string {
	// Since Join returns nil if every value in errs is nil,
	// e.errs cannot be empty.
	if len(e.errs) == 1 {
		return e.errs[0].Error()
	}

	b := []byte(e.errs[0].Error())
	for _, err := range e.errs[1:] {
		b = append(b, '\\n')
		b = append(b, err.Error()...)
	}
	// At this point, b has at least one byte '\\n'.
	return unsafe.String(&b[0], len(b))
}`,
			notice: `<p>Fifteen lines with two comments, and neither is describing what the code does. Each one discharges a proof obligation for a line that would otherwise be a bug. When a comment argues instead of narrating, slow down: it is marking the spot where the author knew something you do not yet.</p>
<p>The first proves the empty case away <em>using a fact about a different function</em>. <code>Join</code> returns a plain <code>nil</code> when every input is nil, so a <code>joinError</code> with an empty slice cannot exist, so <code>e.errs[0]</code> below is safe. Verified: <code>errors.Join(nil, nil) == nil</code> is <code>true</code>. Note which kind of nil that is. <code>Join</code>'s result type is the <code>error</code> interface and it returns the untyped <code>nil</code> literal, so callers get a genuinely nil interface. Return a <code>*joinError</code> that merely happens to be nil and you have written the <code>typed-nil</code> failure lab instead.</p>
<p>The second comment licenses the last line. <code>unsafe.String(&amp;b[0], len(b))</code> builds a string over the byte slice with no copy, which needs two things to hold: <code>b</code> must be non-empty or <code>&amp;b[0]</code> indexes out of range, and nothing may ever mutate <code>b</code> again or the string changes under its owner. The comment asserts the first. The second is enforced by scope, since <code>b</code> is a local that dies at the <code>return</code>. Verified that no copy happens: <code>unsafe.StringData</code> of the result is the same address as <code>&amp;b[0]</code>.</p>
<p>And one thing neither comment mentions, which the code makes obvious once you go looking: nothing is cached. Every call rebuilds the string. The one-error fast path really is free, <strong>0 allocations</strong> under <code>testing.AllocsPerRun</code>, because it returns the child's own string and never reaches the loop. Past that, resist the urge to count allocations per error. Look at what the loop actually does: it <code>append</code>s into <code>b</code>, so the cost tracks how many times that slice has to grow, which is a function of total length rather than of how many errors you joined. Joining ten errors measures 3 allocations when every message is one byte and 5 when every message is twenty. Cheap either way, but not free, and a large joined error logged in a hot loop pays it on every call.</p>`,
		},
	],

	exercise: {
		question:
			"is and as in wrap.go are near-identical twins: same loop, same type switch, same two cases, with only As and its doc comment between them. Diff them. Inside the Unwrap() []error branch, as does one thing is does not. Find that line, then answer the real question: why does only one of the two functions need it? The package doc in errors.go has already declared the input it guards against invalid, which makes the question sharper rather than easier.",
		command: 'grep -n "err == nil" "$(go env GOROOT)/src/errors/wrap.go"',
		answer: `<p>Five hits on go1.23.12: lines 45, 64, 98, 128 and 133. The last is the odd one out. It lives in <code>as</code>, in the multi-error branch, and has no counterpart in <code>is</code>:</p>
<pre><code>		case interface{ Unwrap() []error }:
			for _, err := range x.Unwrap() {
				if err == nil {
					continue
				}</code></pre>
<p><code>is</code> walks the same children with no such check. So why does <code>as</code> need it?</p>
<p>Compare the first statement each function runs against a child. <code>is</code> opens with <code>targetComparable &amp;&amp; err == target</code> and a type assertion, and its switch ends in <code>default</code>. Every one of those is well defined on a nil interface: the comparison is false, the assertion fails, the switch falls to <code>default</code>, and the function returns false. A nil child costs <code>is</code> nothing at all.</p>
<p><code>as</code> opens with <code>reflectlite.TypeOf(err).AssignableTo(targetType)</code>. <code>TypeOf</code> of a nil interface returns a nil <code>Type</code>, and calling a method on that dereferences nothing:</p>
<pre><code>var nilErr error
reflect.TypeOf(nilErr)                       // &lt;nil&gt;
reflect.TypeOf(nilErr).AssignableTo(errType) // panic: runtime error: invalid
                                             // memory address or nil pointer dereference</code></pre>
<p>Without that <code>continue</code>, a single nil inside one <code>Unwrap() []error</code> would turn <code>errors.As</code> into a panic. And the package doc in <code>errors.go</code> already forbids that input: <em>"It is invalid for an Unwrap method to return an []error containing a nil error value."</em> The library hardens against it anyway, because it has no way to enforce the rule and someone will eventually break it.</p>
<p>The general lesson is about how to read two functions that look the same. <strong>When near-duplicate code differs by one line, that line is the whole reason to read both</strong>, and the explanation is nearly always in the first statement that touches the value. Reflection is the usual culprit: a type assertion tolerates nil, a type <em>descriptor</em> does not.</p>
<p>Then notice the asymmetry in what the violation costs. Handed the same illegal input, <code>is</code> quietly returns the right answer while <code>as</code> would crash the process. Identical bug in the caller, wildly different blast radius, which is exactly why the guard exists in one function and not the other. Defensive code in the standard library is not applied evenly; it is applied where the consequence is worst.</p>`,
		answerAnchor: {
			file: "src/errors/wrap.go",
			needle: `			for _, err := range x.Unwrap() {
				if err == nil {
					continue
				}`,
		},
	},

	takeaway:
		"There is no error tree type: the whole structure is two method shapes checked at run time, and every surprise in this package is a guard clause defending the line beneath it.",

	relatedConcepts: [
		"error-handling",
		"sentinel-errors",
		"errors-join",
		"interfaces",
		"typed-nil",
		"reflection",
	],
	relatedProjects: ["cli-renamer", "db-api"],
	relatedFailures: ["typed-nil"],
}
