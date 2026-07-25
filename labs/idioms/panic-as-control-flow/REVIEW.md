# Review: panic-as-control-flow

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. In Python, exceptions are the main road and not the
shoulder. `raise` is how a function says no, the standard library raises
for a missing dict key and a bad int literal alike, and the community has a
name for the style: easier to ask forgiveness than permission. The reason
it works is that a Python exception is a typed object carrying a traceback
the runtime assembled for free. `except ValueError` picks that object out
of the air three frames up, no intermediate function had to agree to carry
it, and `raise ... from err` chains causes when you want them.

Go took the other side of that trade on purpose. There is no exception
type, no `throws` clause, and no traceback attached to a failure. An error
is an ordinary value in an ordinary result position, and the whole
`errors.Is` / `errors.As` / `%w` apparatus exists to hand back, explicitly,
the two things exceptions gave you for free: identity, and a chain of
causes. `panic` is in the language for a different job, which is ending a
goroutine that has discovered the program itself is broken. The starter
uses it as `raise`. It compiles, the suite is green, and all six
distinctions it believes it is carrying are gone by the time a caller sees
them.

## 1. Six panics, and the identity they burn

```go
panic("insufficient funds in " + account)
panic("expected account,kind,amount,memo: " + line)
panic("empty account name in line: " + line)
panic("unknown entry kind: " + kind)
panic("amount must look like 12.34 or 12: " + raw)
panic("bad amount: " + raw)
```

The linter's line, once per site:

```
ledger.go:52:4: use of `panic` forbidden because "panic is not an error
  strategy; return a wrapped error instead" (forbidigo)
```

Six named failure modes go in. Here is the funnel they come out of:

```go
defer func() {
	if r := recover(); r != nil {
		err = fmt.Errorf("ledger: %v", r)
	}
}()
```

`recover()` returns `any`. Confirm it with a deferred `t.Logf("%T", r)` and
you get `string`, because that is what was thrown. `%v` then renders it,
and what `Post` returns is an error whose entire content is prose. Not one
of the six kinds is a value any more.

Run the four broken lines through the starter and print `errors.Unwrap` on
each result:

```
ledger: bad amount: ten                       unwrap: <nil>
ledger: insufficient funds in checking        unwrap: <nil>
ledger: unknown entry kind: transfer          unwrap: <nil>
ledger: empty account name in line: ,depo...  unwrap: <nil>
```

Four distinct causes, four chains of length one. Now the concrete question,
because "error identity" is worth exactly as much as what a caller can do
with it. A billing service posting a batch wants to retry the overdrafts
tonight and reject the malformed lines permanently. Against the reference
that is:

```go
switch {
case errors.Is(err, ledger.ErrInsufficientFunds):
	retryTonight(line)
case err != nil:
	rejectPermanently(line, err)
}
```

Against the starter it is `strings.Contains(err.Error(), "insufficient
funds")`, and that branch goes quiet the day somebody rewords the message,
with no compile error and no failing test. Which is the polite version of
the problem. The blunt version is that the starter exports no sentinels at
all, so drop the reference's `switch` into a test beside the starter and it
does not compile:

```
./seed_test.go:17:28: undefined: ledger.ErrInsufficientFunds
./seed_test.go:20:27: undefined: ledger.ErrBadAmount
```

There is nothing to match on. A caller cannot branch on a distinction the
package never gave a name to, and `panic("insufficient funds in " +
account)` is a distinction with no name.

## 2. The frames that never got to speak

A panic does not walk the call stack, it unwinds it. Deferred functions
run, frames are discarded, and control lands at the recover. `parseCents`
is three frames below `Post`, and between them sits `parseLine`, the only
code in the file that has both the raw amount and the whole line in scope.
It never gets asked.

You can read the consequence straight off the error text. The starter, on
`"checking,deposit,ten,spelled out"`:

```
ledger: bad amount: ten
```

The line is gone. Not truncated, never added: the frame holding it was
unwound past. Now the reference, same input:

```
post "checking,deposit,ten,spelled out": amount "ten": bad amount
```

Three segments, each added by the frame that owned that fact. `parseCents`
knows the amount and says `amount "ten"`. `Post` knows the line and says
`post "..."`. `ErrBadAmount` is the sentinel underneath, still reachable
because every join used `%w`:

```go
return 0, fmt.Errorf("amount %q: %w", raw, ErrBadAmount)
```

This is the structural cost of `panic` as a return channel, and it is
separate from the identity cost in section 1. `if err != nil` is not
ceremony you tolerate on the way to the happy path. It is the only moment a
function gets to say what it knows, and a panic skips every one of them by
design, because skipping frames is the entire point of unwinding.

## 3. `recover()` is not `except`

The deferred recover looks like a `try/except` wrapped around the body of
`Post`, and the resemblance is close enough to be dangerous. Four places it
breaks, all of them checkable in ten lines.

**There is no type to select on.** `except ValueError` matches a class.
`recover()` hands you an `any` and the matching is yours to write, which
here means no matching happens at all: `%v` accepts every value equally, so
a bad amount and an overdraft take the same branch, which is no branch.

**It only fires one frame deep.** `recover` returns non-nil only when
called directly by a deferred function. Move it into a helper the deferred
function calls, which reads identically, and the panic goes straight past:

```go
// Called by the deferred func, not deferred itself. recover() returns nil.
func indirectRecover() {
	if r := recover(); r != nil { ... }
}
```

The process still dies. Python has no equivalent trap, because `except` is
a statement bound to a block rather than a function call with a rule about
its caller.

**It does not cross goroutines.** A `recover` in `main` cannot catch a
panic raised in a goroutine `main` started, and the panic takes the whole
process with it:

```go
defer func() { fmt.Println("main recovered:", recover()) }()
go func() { panic("failure in a worker") }()
```

```
panic: failure in a worker
exit status 1
```

In Python an unhandled exception in a `threading.Thread` ends that thread
and the interpreter carries on. In Go an unrecovered panic anywhere ends
everything. If this ledger ever posts lines concurrently, the recover in
`Post` stops protecting anything the moment the panic happens on a
goroutine `Post` did not personally defer into.

**The cost is not symmetric with Python's.** CPython's exception machinery
is tuned because idiomatic code leans on it. Go's is not, and the deferred
recover charges the happy path too. A minimal analogue of this shape,
benchmarked both ways:

```
BenchmarkFailViaPanic-8   108.7 ns/op   16 B/op   1 allocs/op
BenchmarkFailViaError-8     0.4896 ns/op  0 B/op   0 allocs/op
BenchmarkOKViaPanic-8       3.922 ns/op   0 B/op   0 allocs/op
BenchmarkOKViaError-8       0.4830 ns/op  0 B/op   0 allocs/op
```

Two things in there. The failing path is roughly two hundred times more
expensive, and it allocates, because the panic value is boxed into an `any`
that escapes. And the succeeding path costs about 3.4ns more than it needs
to, forever, because the deferred closure has to be registered and run on
every single call whether anything panics or not.

Now the honest part: 3.4ns per posted line is nothing, and if the design
were right you would keep it without a second thought. Do not refactor this
file for the nanoseconds. Refactor it for sections 1 and 2. The benchmark
is here so you know the size of the thing you are trading away, which is
small, rather than guessing that it is large.

## 4. `else` after a return, and the shape `if err != nil` was built for

```
ledger.go:50:9:  indent-error-flow: if block ends with a return statement,
  so drop this else and outdent its block (revive)
ledger.go:64:9:  indent-error-flow: ... same, in Balance
ledger.go:102:10: superfluous-else: if block ends with a continue
  statement, so drop this else and outdent its block (revive)
```

Three instances of one habit. Python's `if/else` and `try/except/else` both
push the alternative into a block, and there is no cost to it there because
Python does not have a competing convention for the same shape. Go does,
and the convention exists because of `panic`'s absence from normal error
handling.

Look at `Balance`:

```go
if ok {
	return cents, nil
} else {
	return 0, errors.New("ledger: unknown account: " + account)
}
```

and the reference:

```go
if !ok {
	return 0, fmt.Errorf("balance %q: %w", account, ErrUnknownAccount)
}
return cents, nil
```

Same two outcomes, different reading contract. In the second, everything at
the function's base indentation is the success path, and every indented
block is an exit. You can read a 200-line Go function by skimming the left
margin, and that only works if the convention holds everywhere: errors go
in, the happy path stays flat. Once you accept that a Go function will
check and return five or six times, the `else` is not just redundant, it is
actively lying about where the code goes next.

`parseCents` shows the version one level down:

```go
if r >= '0' && r <= '9' {
	cents = cents*10 + int64(r-'0')
	continue
} else {
	panic("bad amount: " + raw)
}
```

Inverting the condition puts the failure in the indented block and the
arithmetic on the margin, which is what the reference does:

```go
if r < '0' || r > '9' {
	return 0, fmt.Errorf("amount %q: %w", raw, ErrBadAmount)
}
cents = cents*10 + int64(r-'0')
```

The `continue` also disappears, because it was only ever there to jump over
the `else`.

## Where panic is still the right answer

Do not leave this exercise believing Go has no `panic`. It has one, the
standard library calls it, and the config's `^panic$` ban is a rule for
this file's problem, not a universal law. Three places it is correct:

- **The program is broken, not the input.** An impossible switch default, a
  violated invariant, a state that can only exist if the code above you has
  a bug. `panic` here is the right call because there is no sensible value
  to return and continuing would corrupt something. The stack trace is the
  feature.
- **`MustXxx` at initialization.** `regexp.MustCompile`, `template.Must`,
  `netip.MustParseAddr`. The pattern is always the same: a thin wrapper
  around a function that returns `(T, error)`, for arguments fixed at
  compile time, called while the package initializes, where there is no
  caller to hand an error to and failing at startup beats failing at
  request time. The naming convention does the work of the warning, and
  every one of those packages also exports the error-returning version,
  which is the one you use on anything a user typed.
- **Across a boundary you control, briefly.** A recursive-descent parser
  may panic internally to abort a deep parse and recover at its own
  exported entry point, rather than thread an error through forty return
  sites. `encoding/json` has done this. Four rules make it legitimate:
  panic with a private type, recover in the same package, convert to an
  error before returning, and re-panic anything that is not yours. The
  starter honors two of them and breaks the other two. It panics with plain
  strings, so there is no private type to recognize, and it re-panics
  nothing, which is the subject of the last section below. It also has no
  deep recursion to unwind, which is the thing that would have justified
  the pattern in the first place.

The line is whether the failure is expected. A user typing `ten` where a
number goes is expected, and expected failures are values.

## A note on the count

Six issues on the first run and nine findings underneath them.
golangci-lint caps repeats of an identical message at three
(`max-same-issues`, default 3), and all six panic sites share one forbidigo
message, so three of them are queued out of sight. Confirm it with
`golangci-lint run --max-same-issues=0` and the run reports 9.

The practical consequence is that your first fix appears to do nothing:

```
golangci-lint run    # 6 issues
# convert exactly one panic to a return
golangci-lint run    # 6 issues
```

Five panics left, three still displayed, three revive findings unchanged.
Nothing is wrong; you drained one item off a queue that refills.

That first panic, the overdraft check in `Post`, is also the only one you
can convert on its own, because `Post` already returns an error. Every
other panic sits in a helper whose signature has to change first, so the
rest of this refactor arrives in two lumps rather than six steps. Measured
through that path, the count goes:

```
6    starter
6    the overdraft panic becomes a return
5    parseCents returns (int64, error)
2    parseLine returns an error, every panic gone
0    both else blocks dropped
```

It stalls once and then drops by three. Judge by what is left in the file
rather than by the number, and note that the last step is worth two on the
board while the first is worth nothing.

## The reference, structurally

`solution.go` is 126 lines against the starter's 107, and the growth is
entirely the six sentinel declarations with their doc comments at the top.
The functions themselves shrank. `Post` lost the deferred recover and the
`else`, and gained two guarded returns. `parseLine` gained an error result
and stopped returning four loose values, returning a normalized `Entry`
instead, which is what moved the deposit/withdraw sign decision out of
`Post` and into the one function that already knew the kind.

That last change was not requested by any linter. It fell out of the error
refactor: once `parseLine` returns `(Entry, error)` instead of
`(string, string, int64, string)`, keeping the sign logic in `Post` means
`Post` has to re-derive `kind`, and it no longer has it. Signature changes
propagate taste. This is normal, and it is one of the reasons the suite
here pins only the public surface.

Notice what `Post` looks like now:

```go
e, err := parseLine(line)
if err != nil {
	return Entry{}, fmt.Errorf("post %q: %w", line, err)
}
if l.balances[e.Account]+e.Cents < 0 {
	return Entry{}, fmt.Errorf("post %q: %w", line, ErrInsufficientFunds)
}
l.balances[e.Account] += e.Cents
return e, nil
```

Four statements at the base indentation, in order, with the two exits
indented beside them. The overdraft check also got simpler, because signed
cents let one comparison cover both directions instead of a separate branch
per kind.

## The smell the linter cannot see: the recover that survives to zero

Do the refactor in the obvious order. Convert `parseCents`, convert
`parseLine`, thread the errors up through `Post`, drop both `else` blocks.
Then leave the deferred recover exactly where it is and run the loop:

```
go test ./...        ok
golangci-lint run    0 issues.
```

Both gates pass with this still at the top of `Post`:

```go
defer func() {
	if r := recover(); r != nil {
		err = fmt.Errorf("ledger: %v", r)
	}
}()
```

Nothing in the config has a check for "a recover that no longer catches
anything you throw", and no reasonable linter would, because it cannot know
which panics are yours. So it stays, and it is worse than dead code,
because it is still live for everything you did not write.

Build a `Ledger` the way a caller eventually will, with a composite literal
instead of `NewLedger`, and post a valid line:

```go
l := &ledger.Ledger{}                          // balances is nil
entry, err := l.Post("checking,deposit,10.00,opening")
```

The starter returns:

```
entry = {Account: Cents:0 Memo:}
err   = ledger: assignment to entry in nil map
```

A nil map assignment is a `runtime.Error`. It is a bug in the caller, and
it has just been handed back through the same channel, in the same shape,
as "your amount field was malformed". The caller's error handling logs it
next to the bad lines and moves on. In a batch job this is how you get a
report saying nine thousand lines were rejected as invalid when in truth
the ledger was never initialized.

The reference, same call:

```
panic: assignment to entry in nil map
gopath.dev/labs/idioms/panic-as-control-flow.(*Ledger).Post(...)
	solution.go:70
exit status 1
```

Loud, immediate, and pointed at the exact line. That is what you want a
programmer error to do, and it is the first bullet above made concrete.
The blanket recover was never only converting your six panics; it was
converting every runtime failure in everything `Post` calls, forever, into
something indistinguishable from bad user input. Deleting it is the actual
fix, and the linter will never once ask you for it.

Worth knowing: `forbidigo`'s pattern is `^panic$`, so a recover that
inspects the value and re-panics what it does not recognize is also
unavailable in this config. That is a deliberate narrowing for the
exercise, not a claim that the pattern is always wrong.

## What this trained

- `panic` as a return channel, and the two separate things it destroys:
  error identity at the boundary, and every intermediate frame's chance to
  add the one fact it owned.
- What a caller can actually do with `errors.Is` against an exported
  sentinel, versus what it is reduced to when the package exports none.
- The four ways `recover()` is not `except`: no type selection, valid only
  one frame deep, no reach across goroutines, and a cost the happy path
  pays on every call.
- `indent-error-flow` and `superfluous-else`, and why the flat happy path
  is a reading contract rather than a style preference.
- Where `panic` is correct in real Go: broken invariants, `MustXxx` at
  init, and the recover-at-your-own-boundary pattern with its four rules.
- A queued linter count that does not move for three fixes, and a blanket
  `recover` that reaches zero issues while still relabelling every runtime
  bug as a validation error.
