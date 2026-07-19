import { Concept } from "../../content"

export const errorsJoin: Concept = {
	slug: "errors-join",
	name: "Joining errors",
	tagline:
		"Before Go 1.20 an error had one cause. errors.Join gives it several, and the errors.Is you already use walks the whole tree.",
	summary:
		"A wrapped error is a chain: each layer holds exactly one cause via <code>Unwrap() error</code>. <code>errors.Join(errs...)</code> (Go 1.20) builds something different, one error that holds <em>several</em> children via <code>Unwrap() []error</code>, so the error graph becomes a tree. The same <code>errors.Is</code> and <code>errors.As</code> you already call traverse that tree depth-first, matching a sibling they were never told about. Join exists because real operations fail in more than one way at once (validate every field, close every file, run every task), and before it you had to pick one failure to return or <code>Sprintf</code> the rest into a string and lose every one as a matchable value.",
	mentalModel:
		"Two shapes, one set of tools. A <code>%w</code> chain is a linked list: node, one cause, one cause under that, a line you read top to bottom as \"this failed because that failed\". A joined error is a node with a <em>slice</em> of children, siblings that all happened independently and none of which caused the others. <code>errors.Is</code> and <code>errors.As</code> do not care which shape they are handed: at every node they try <code>Unwrap() error</code> and <code>Unwrap() []error</code>, and for the slice form they recurse into each branch, so one call walks the entire tree. Pick the shape by the truth you are recording: <code>%w</code> when there is a single cause you want to add context to, <code>errors.Join</code> when several failures are equally real and you want to keep all of them.",
	retrievalPrompts: [
		"You accumulate failures into a []error, some entries nil, and return errors.Join(errs...). When everything succeeded and every entry is nil, callers still get a non-nil error to check. True or false, and what is the mechanism? || False. errors.Join drops every nil element, and when nothing is left it returns nil, so errors.Join(nil, nil) is literally == nil. That is deliberate: you can append to a []error unconditionally and hand the whole slice to Join without a separate \"was there any error\" guard, because an all-nil batch collapses to the nil error. The flip side is that return errors.Join(a, b) is not a guaranteed-failure path: when a and b are both nil it succeeds, so never use Join to manufacture an error you assume is non-nil.",
		"A joined error holds three sibling errors, one of them ErrTimeout. err == ErrTimeout is false, and a hand-written loop calling errors.Unwrap never finds it either, yet errors.Is(err, ErrTimeout) is true. Why do the first two miss it and Is not? || Because a joined error implements Unwrap() []error, not Unwrap() error. == only ever compares the outer value. The classic unwrap loop calls errors.Unwrap, which looks for the single-error form; a joinError does not have it, so Unwrap returns nil and the loop stops after one step having seen only the wrapper. errors.Is and errors.As are the walkers that know both Unwrap shapes: at each node they try the error form and the []error form, and for the slice they recurse into every branch. So Is does a depth-first walk of exactly the tree Join built, which is how it reaches a sibling the other two cannot.",
		"You want a caller to test for two independent failures that both happened, so you write fmt.Errorf(\"%v; %v\", errA, errB). It reads perfectly in the log. What did you throw away, and what were the two correct tools? || Both errors' identity. %v formats each to its text and copies the string, leaving no Unwrap link, so errors.Is(err, errA) and errors.Is(err, errB) both return false even though the message names them. The log line is a decoy: complete-looking, matchable by nothing. Two failures that both happened are siblings, so errors.Join(errA, errB) is the tool, or fmt.Errorf(\"context: %w; %w\", errA, errB) when you also want a wrapping message, because Go 1.20 let fmt.Errorf take more than one %w. Both keep every error matchable; %v keeps none.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
)

// Two sentinels: independent reasons a field can be rejected.
var (
	ErrEmpty   = errors.New("must not be empty")
	ErrTooLong = errors.New("must be at most 3 chars")
)

// A typed error carrying data, to prove errors.As reaches into a join too.
type RangeError struct {
	Field string
	Max   int
}

func (e *RangeError) Error() string {
	return fmt.Sprintf("%s out of range (max %d)", e.Field, e.Max)
}

// validate accumulates EVERY problem instead of returning at the first one.
func validate(name string, age int) error {
	var errs []error
	if name == "" {
		errs = append(errs, fmt.Errorf("name: %w", ErrEmpty))
	}
	if len(name) > 3 {
		errs = append(errs, fmt.Errorf("name: %w", ErrTooLong))
	}
	if age > 120 {
		errs = append(errs, &RangeError{Field: "age", Max: 120})
	}
	return errors.Join(errs...) // nil when errs is empty
}

func main() {
	// A value that is wrong in two independent ways at once.
	err := validate("Bartholomew", 200)

	// 1. Error() joins the children with newlines, one per line.
	fmt.Println("--- err.Error() ---")
	fmt.Println(err)

	// 2. errors.Is walks the whole TREE, not just one chain, so it finds a
	//    sentinel that is a sibling of the other errors.
	fmt.Println("--- errors.Is over the tree ---")
	fmt.Println("Is(ErrTooLong):", errors.Is(err, ErrTooLong))
	fmt.Println("Is(ErrEmpty)  :", errors.Is(err, ErrEmpty)) // name was not empty

	// 3. errors.As pulls the typed error out of the same join.
	var re *RangeError
	if errors.As(err, &re) {
		fmt.Printf("As(*RangeError): field=%s max=%d\\n", re.Field, re.Max)
	}

	// 4. Join drops nil elements, and returns nil when every element is nil.
	fmt.Println("--- nil handling ---")
	fmt.Println("Join(nil, nil) == nil:", errors.Join(nil, nil) == nil)
	partial := errors.Join(nil, ErrEmpty, nil)
	fmt.Printf("Join(nil, ErrEmpty, nil) = %q\\n", partial)

	// 5. A single fmt.Errorf can wrap MORE THAN ONE error (Go 1.20+), and
	//    both underlying errors stay matchable.
	multi := fmt.Errorf("save profile: %w; %w", ErrEmpty, ErrTooLong)
	fmt.Println("--- fmt.Errorf with two %w ---")
	fmt.Println(multi)
	fmt.Println("Is(ErrEmpty):", errors.Is(multi, ErrEmpty),
		"Is(ErrTooLong):", errors.Is(multi, ErrTooLong))
}`,
	codeExplanation:
		"Running this on go1.22.1 prints:<br><br><code>--- err.Error() ---</code><br><code>name: must be at most 3 chars</code><br><code>age out of range (max 120)</code><br><code>--- errors.Is over the tree ---</code><br><code>Is(ErrTooLong): true</code><br><code>Is(ErrEmpty)  : false</code><br><code>As(*RangeError): field=age max=120</code><br><code>--- nil handling ---</code><br><code>Join(nil, nil) == nil: true</code><br><code>Join(nil, ErrEmpty, nil) = \"must not be empty\"</code><br><code>--- fmt.Errorf with two %w ---</code><br><code>save profile: must not be empty; must be at most 3 chars</code><br><code>Is(ErrEmpty): true Is(ErrTooLong): true</code><br><br>Read it as five beats. <strong>One:</strong> <code>err.Error()</code> is two lines because <code>joinError.Error()</code> hardcodes a newline between children. That is one error printing as two lines, not two errors, and you cannot change the separator. <strong>Two:</strong> the join holds two siblings, the wrapped <code>ErrTooLong</code> and the <code>*RangeError</code>. <code>Is(ErrTooLong)</code> is <code>true</code> because <code>errors.Is</code> descends into every branch of the join and then down each <code>%w</code> chain, finding the sentinel two levels deep (join &rarr; wrapError &rarr; <code>ErrTooLong</code>). <code>Is(ErrEmpty)</code> is <code>false</code> because that sentinel is simply not in the tree: the name was non-empty, so that branch was never appended. One <code>Is</code> call, correct over a shape it was never told. <strong>Three:</strong> <code>errors.As</code> on the same value reaches the <code>*RangeError</code> sibling and fills <code>re</code>, so you read <code>field=age max=120</code>, data a sentinel could never carry, pulled out of a multi-error. <strong>Four:</strong> <code>Join(nil, nil)</code> is not an empty error, it is the <code>nil</code> error, so <code>== nil</code> is <code>true</code>; and <code>Join(nil, ErrEmpty, nil)</code> dropped both nils, so its message is the single line <code>\"must not be empty\"</code>. <strong>Five:</strong> one <code>fmt.Errorf</code> with two <code>%w</code> produces one message, and both <code>ErrEmpty</code> and <code>ErrTooLong</code> stay matchable, because Go 1.20 made multi-<code>%w</code> return an error whose <code>Unwrap()</code> yields <code>[]error</code>, the same shape <code>errors.Join</code> builds.",
	designRationale:
		"For Go's first decade an error wrapped at most one other error. The standard <code>Unwrap() error</code> returned a single cause, <code>github.com/pkg/errors</code> modelled the same single <code>Cause</code>, and a linked list was the whole vocabulary. That is fine for a cause chain (open failed, because stat failed, because the path was bad) and wrong for the many real operations that fail several ways at once: a form with three bad fields, a fan-out where four of ten goroutines error, a cleanup that closes five files and two <code>Close</code> calls fail. Before 1.20 you returned the first failure and hid the rest, or you <code>fmt.Sprintf</code>'d them into one string and destroyed every one as a value <code>errors.Is</code> could match. Go 1.20 fixed the shape gap with three additions that are really one idea: <code>errors.Join</code>, multiple <code>%w</code> in <code>fmt.Errorf</code>, and a second unwrap form, <code>Unwrap() []error</code>. That last method is the keystone. <code>errors.Is</code> and <code>errors.As</code> were taught to try both unwrap shapes at every node, so an error stopped being a list and became a tree, and every existing caller's <code>Is</code> and <code>As</code> traversed it with no code change. The design holds the through-line from wrapping generally: no new keyword, no interface callers must implement, just a function and a documented method shape, so your own type can implement <code>Unwrap() []error</code> and the standard machinery walks it. The one policy baked in is cosmetic and worth reading as a signal: <code>joinError.Error()</code> separates children with a newline and offers no hook to change it, because Join's job is to preserve the errors for matching, not to format a report. If you want a custom rendering, range the errors yourself.",
	commonMistakes: [
		{
			title: "Concatenating error text instead of joining the values",
			body: "<code>fmt.Errorf(\"%v; %v\", a, b)</code>, or <code>strings.Join</code> over <code>.Error()</code> strings, produces a message that names both errors and matches neither. The mechanism is the same as the <code>%w</code> vs <code>%v</code> trap: <code>%v</code> copies the text and leaves no unwrap link, so <code>errors.Is(err, a)</code> returns <code>false</code> while the log line looks complete. Use <code>errors.Join(a, b)</code>, or <code>%w</code> (now allowed more than once) when you also want a prefix.",
		},
		{
			title: "Expecting == or a single-Unwrap loop to find a joined child",
			body: "A joinError implements <code>Unwrap() []error</code>, not <code>Unwrap() error</code>, so <code>errors.Unwrap(join)</code> returns <code>nil</code> and the classic <code>for err != nil { err = errors.Unwrap(err) }</code> loop stops after one step, and <code>==</code> only ever saw the outer wrapper. Only <code>errors.Is</code> and <code>errors.As</code> know the <code>[]error</code> form. Reach for them on anything that might be joined; a raw unwrap loop silently walks past every sibling.",
		},
		{
			title: "Assuming errors.As fills in every matching sibling",
			body: "<code>errors.As</code> returns on the <em>first</em> match in its depth-first walk. It is a find-first, not a collect-all, so a join holding two <code>*RangeError</code> values hands you the first and never mentions the second. When you need all of them, type-assert the <code>interface{ Unwrap() []error }</code> and iterate the slice yourself, calling <code>errors.As</code> on each branch.",
		},
		{
			title: "Treating errors.Join(errs...) as an always-non-nil error",
			body: "Join drops nil elements and returns <code>nil</code> when they are all nil. That is the feature that lets you accumulate without a guard, but it means <code>return errors.Join(a, b)</code> succeeds when <code>a</code> and <code>b</code> are nil. Do not use Join to fabricate a guaranteed failure, and do not skip the <code>if err != nil</code> check on its result because \"there were some in the slice\": some of them may have been nil.",
		},
		{
			title: "Joining a cause chain, or wrapping independent siblings",
			body: "Join makes its arguments siblings, each equally \"the failure\" and each listed in <code>Error()</code>; <code>%w</code> makes one the context of another, \"this failed because that did\". <code>errors.Is</code> matches either way, so a wrong choice is silent, but your messages and any <code>Unwrap</code>-based tooling read the wrong structure. Use <code>%w</code> for a single cause with context, <code>Join</code> for several independent failures. And the API caution from wrapping still applies: joining an internal error publishes it, so translate at package boundaries rather than joining a driver error into your public surface.",
		},
	],
	relatedSlugs: ["sentinel-errors", "error-handling", "interfaces", "defer"],
}
