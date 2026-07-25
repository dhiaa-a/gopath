# Review: stringly-typed

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. In Python a state is a `str`, because `str` is the
currency the whole language is denominated in: dict keys, JSON fields,
CSV cells, and function arguments are all the same thing, and a value that
looks right is right. Python is not helpless here (`enum.StrEnum`,
`typing.Literal`, `typing.NewType` all exist), but every one of them is
opt-in, and two of the three are erased before the program runs: they
describe your intent to a type checker you have to remember to install,
configure, and keep green in CI. So the working habit stays raw strings
plus a membership test, and the check that matters happens at runtime, at
the call site, one call at a time. Go changes the economics. A named
string type is one line, is byte-for-byte identical to `string` at
runtime, and is enforced by the same compiler that produces the binary.
There is no separate tool and no opt-in. That is the shift this exercise
is about: moving the check from a runtime comparison you wrote to a
compile error you cannot ship past.

## 1. Twenty-five literals, any one of them a typo

```
order.go:26:19: string `pending` has 5 occurrences, make it a constant (goconst)
order.go:27:13: string `picking` has 6 occurrences, make it a constant (goconst)
order.go:28:13: string `shipped` has 4 occurrences, make it a constant (goconst)
order.go:29:13: string `delivered` has 5 occurrences, make it a constant (goconst)
order.go:30:13: string `cancelled` has 5 occurrences, make it a constant (goconst)
```

Twenty-five literals in 83 lines. `goconst` is making the weakest version
of the argument: a repeated string should be a constant so you can spell it
in one place. True, and not the interesting part. The interesting part is
what happens when one of the twenty-five is wrong.

```go
} else if s == "shipepd" {
	return "delivered", nil
```

That compiles, and `go vet` is clean:

```
Advance("shipped") = "", err = advance from "shipped": unknown status
IsValid("shipped") = true
```

One transposition, and orders can never leave `shipped`. The package
reports that `"shipped"` is not a status it recognizes while `IsValid`,
twenty lines up in the same file, insists that it is. Nothing in the
language, the toolchain, or the test suite is positioned to notice,
because as far as the compiler is concerned you compared two strings and
got `false`, which is exactly what comparing two strings is for. Everyone
who reads the condition afterward will see the word they expected to see.

Constants fix the typo. They do not fix the category: a `string` constant
is still a `string`, and `IsValid(someOtherString)` still compiles. That
takes finding 3.

## 2. The if-else chain, and the finding behind it

```
order.go:47:2: ifElseChain: rewrite if-else to switch statement (gocritic)
```

```go
if s == "pending" {
    return "picking", nil
} else if s == "picking" {
    return "shipped", nil
} else if s == "shipped" {
```

Every arm compares the same operand against a different constant, which is
the definition of a switch. Go's `switch` is not C's: no fallthrough by
default, no break, cases can be expressions or lists, and the whole
construct reads as one decision about one value instead of four
independent boolean questions that happen to be nested.

There is a second finding on this exact line that you will never see:

```
order.go:47:2: QF1003: could use tagged switch on s (staticcheck)
```

`golangci-lint` reports one finding per line by default, `gocritic` got
there first, and the edit that satisfies one satisfies the other, so
QF1003 goes from invisible to fixed without ever being printed. Worth
knowing when you are reading CI output on a real team: a clean line is not
proof it was only ever wrong once.

Rewriting this as a `switch` is a real improvement and it is also a local
one. The chain is a symptom. The disease is that this function owns a
private copy of the lifecycle, which is finding 5.

## 3. `type Status string`: what the compiler starts refusing

```go
type Status string

const (
	Pending   Status = "pending"
	Picking   Status = "picking"
	Shipped   Status = "shipped"
	Delivered Status = "delivered"
	Cancelled Status = "cancelled"
)
```

No linter asks for this. It is the design call the exercise exists for, so
here is the call, stated precisely, because the usual version of this
advice overclaims.

`Status` has the same representation as `string`. Same bytes, same length,
same indexing, same `==`. It is a different *type* to the compiler and
nothing else, and it costs zero instructions. What changes is which
assignments the compiler will accept. Against the reference:

```go
order.Advance("shipped")                 // compiles: untyped constant
order.Advance(order.Status("misplaced")) // compiles: you asked for it
order.Advance(fromRequest)               // does NOT compile
```

where `fromRequest` is a plain `string` variable. The compiler's exact
words:

```
cannot use fromRequest (variable of type string) as order.Status value in
argument to order.Advance
```

So the named type does not outlaw bad values, and it never claimed to.
`Status("misplaced")` is a legal `Status` and the table refuses it at
runtime, which is where value checks belong. What the named type outlaws
is **accidental flow**. A string that arrived from a request body, a CSV
cell, an environment variable, or another subsystem cannot reach any of
these six functions by drifting there. It has to pass through a conversion
somebody typed on purpose, and the only conversion this package endorses
is `Parse`. That is the boundary, and the compiler now guards it on every
build, in every branch, including the ones your tests never reach. Review
used to guard it, and review only sees the diff.

## 4. Why the suite survived you changing every signature

This is the mechanism that makes the whole exercise possible, and it is
worth more than the refactor. Look at the top of `order_test.go`:

```go
const (
	pending   = "pending"
	picking   = "picking"
	...
)
```

No type on any of them. These are **untyped constants**, and an untyped
constant in Go has a *default* type but no fixed one: it stays an untyped
string constant until a context demands a specific type, at which point it
converts implicitly, at compile time, for free. Passed
to `Advance(status string)` it becomes a `string`. Passed to
`Advance(status Status)` it becomes a `Status`. Compared against a
returned `Status` with `!=`, it becomes a `Status`. One test file,
unchanged, compiling against two different public APIs.

Prove it to yourself by breaking it. Put a type on those constants:

```go
const (
	pending   string = "pending"
	...
)
```

The starter still passes. The reference stops compiling:

```
order_test.go:28:28: cannot use pending (constant "pending" of type string)
  as order.Status value in argument to order.Advance
order_test.go:32:12: invalid operation: got != picking (mismatched types
  order.Status and string)
```

Ten of those before the compiler stops counting, and not one of them is
about behavior. That single keyword is the difference between a suite that
lets you migrate and a suite that pins you to the type you had on day one.

The lesson generalizes past this exercise. When you write constants that
other code compares against, leave them untyped unless you have a reason
not to, and you keep the freedom to introduce a named type later without
touching a caller. This is also why the standard library declares things
like `time.Nanosecond` as typed and `math.MaxInt64` as untyped: typed when
the type is the point, untyped when the value is.

## 5. Six opinions, one table

The starter answers "what is a status and what can it do" in six separate
places: the `||` chain in `IsValid`, a second `||` chain inlined in
`Parse`, the if-else chain in `Advance`, and one comparison each in
`Cancel`, `CanCancel`, and `IsTerminal`. The reference answers it once:

```go
var lifecycle = map[Status]struct {
	next        Status
	cancellable bool
}{
	Pending:   {next: Picking, cancellable: true},
	Picking:   {next: Shipped, cancellable: true},
	Shipped:   {next: Delivered},
	Delivered: {},
	Cancelled: {},
}
```

Membership is validity, the zero `next` is terminality, and every function
becomes a lookup. Test the difference by adding a status. In the reference
it is one constant and one row, and all six functions agree immediately:
`IsValid` true, `Parse` accepts, `Advance` reports `ErrTerminal`, `Cancel`
reports `ErrCannotCancel`, `IsTerminal` true. In the starter, add
`"refunded"` to `IsValid` and forget the other five sites, which is the
realistic outcome, and the package now holds three contradictory opinions
at once:

```
IsValid("refunded")    = true
Parse("refunded")      err = parse status "refunded": unknown status
Advance("refunded")    err = advance from "refunded": unknown status
Cancel("refunded")     err = cancel "refunded": order can no longer be cancelled
```

`Cancel` believes it is a real status that cannot be cancelled. `Parse`
believes it does not exist. `IsValid` believes it is fine. All three are
reporting faithfully, from three different copies of the truth. The
linter's count does not move: no linter in this config, or any config,
knows that these six functions are supposed to agree.

One consequence to notice, because it is a deliberate behavior change and
not an accident. The starter calls `strings.ToLower` in five functions.
The reference calls it in one:

```
Advance("PENDING")  // starter:   "picking", nil
Advance("PENDING")  // reference: ErrUnknownStatus
```

The interior got *less* tolerant on purpose. Once `Status` exists, a value
of that type can only have come from `Parse` or from a constant, and both
are already canonical, so re-normalizing in `Advance` is defending against
something the type system now prevents. Normalization is a boundary
concern. Doing it five times is not five times as safe; it is five places
that can disagree about what canonical means. The suite permits this
change because it only ever feeds mixed case to `Parse`, which is the
function whose job it is.

## 6. The method a plain string can never grow

```go
func (s *Status) UnmarshalText(text []byte) error {
	parsed, err := Parse(string(text))
	if err != nil {
		return fmt.Errorf("unmarshal status: %w", err)
	}
	*s = parsed
	return nil
}
```

This is the part that pays for the named type outside the package. You
cannot define a method on `string`: Go only allows methods on types
declared in the same package, and `string` is not one of yours. Once
`Status` exists it is your type, so it can satisfy interfaces, and
`encoding.TextUnmarshaler` is the one that matters here. A struct field of
type `Status` filled by `encoding/json`, a config loader, or anything else
built on `encoding.TextUnmarshaler` is now validated **while it is
decoded**, not in some validation pass afterward that someone has to
remember to call. Six lines, and the invalid state stops being
representable at the point of entry.

The same door opens for `String()`, `MarshalText`, `Scan`, `Value`, and
whatever else the type ought to know how to do. A `string` gets none of
them.

## The reference, structurally

`solution.go` is longer than the starter, 121 lines against 83, and the
extra lines are the type, the constants, the table, and
`UnmarshalText`. Every function body got shorter; there are no `||`
chains and no branching on string content anywhere. Idiomatic Go is not
always shorter. What shrank is the number of places that encode a rule,
from six to one, and the number of places that normalize input, from five
to one. Those are the numbers that predict how this file ages.

Worth stealing from the suite: it drives
behavior through exported functions and asserts on returned values. It
never names the type of a parameter, never constructs an internal value,
and never checks an error message string. That is what made a
whole-signature migration a compile-and-run rather than a test rewrite.

## The smell the linter cannot see: `Parse` re-spells `IsValid`

```go
func IsValid(status string) bool {
	return status == "pending" ||
		status == "picking" ||
		...
}

func Parse(raw string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "pending" || s == "picking" || s == "shipped" || s == "delivered" || s == "cancelled" {
```

`Parse` writes out the entire membership test a second time, on line 37,
six lines below the closing brace of an exported function that does exactly
that and is already in scope. Not a variation, not a subset: the same five
comparisons in the same order. `goconst` flags the strings on both lines
and says nothing
about the duplication, because no linter in this config, or any linter you
could reasonably add, knows that two predicates are meant to stay in sync.
`dupl` would need them to be longer and more similar; `staticcheck` has no
check for "you already wrote this function".

This is the one to internalize, because it is the mechanism behind the
divergence in finding 5 and it is invisible from inside a code review that
is only looking at one function. When you catch yourself writing a
condition, stop and ask whether the package already answers this question.
If it does, call it. If calling it is awkward, that is information about
your API, not a reason to copy the condition. Linters find repeated
tokens. Only you find repeated decisions.

## What this trained

- Named types over raw strings: identical at runtime, distinct to the
  compiler, and precise about what they refuse (accidental flow, not bad
  literals).
- Untyped constants in test suites as the thing that makes a signature
  migration safe, with the compile errors that show what typing them
  costs.
- One table as the single source of the state machine, versus six
  functions each holding a private copy that drifts.
- Normalization as a boundary concern, done once in `Parse`, and why the
  interior getting stricter is the point.
- Methods on a named type: `UnmarshalText` validating at decode time,
  which a `string` can never do.
- Duplicated predicates, the smell no linter counts, and the divergence
  it produces the first time somebody adds a state.
