# Review: index-juggling

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. C has no `range`, no iterator, and no bounds check.
`for (i = 0; i < n; i++)` is not one style among several, it is the loop,
and `a[i]` is address arithmetic that will happily read whatever sits past
the end of the array. In that language the discipline is load-bearing: you
carry the bound yourself because nothing else will, you write the
increment yourself because nothing else will, and a careful C programmer
develops real muscle memory for getting all three clauses right. C also has
no protected names to speak of, so `len` is a free identifier and `min` and
`max` are macros you define yourself in some header.

Go kept the C-family syntax and changed everything underneath it. Slices
know their own length, indexing is bounds-checked, `range` exists, and
`min`, `max`, and `len` are builtins. The three-clause loop still compiles,
which is why this file exists: the habit transfers cleanly and the reasons
for it do not.

## 1. What `range` actually buys, and what it does not

```go
for i := 0; i < len(samples); i++ {
	total += int(samples[i])
}
```

The linter's line:

```
frame.go:20:2: for loop can be changed to use an integer range (Go 1.22+) (intrange)
```

Start with the argument you have probably heard and should not repeat,
because it is false. `range` is not faster here. Ask the compiler:

```
go build -gcflags="-d=ssa/check_bce/debug=1" ./...
./frame.go:103:27: Found IsInBounds
./frame.go:103:56: Found IsInBounds

go build -tags solution -gcflags="-d=ssa/check_bce/debug=1" ./...
./solution.go:81:15: Found IsInBounds
./solution.go:82:16: Found IsInBounds
```

Two remaining bounds checks in the starter, two in the reference, and in
both cases they are in `Smooth`, on the accesses whose index is computed
rather than iterated. Every plain `samples[i]` in every three-clause loop
in the starter is already bounds-check-eliminated: the prover reads
`i < len(samples)` off the loop condition and discharges the check. The
canonical C-style loop is a shape the Go compiler knows by heart. Rewriting
it as `range` moves no instructions.

So the case for `range` is not performance. It is who owns the index.

In the three-clause form, `i` is yours. You wrote the start, the bound, and
the step, and you can write to `i` in the body. The invariant that keeps
`samples[i]` in range is a property of code you typed, reconstructed
afterwards by an optimizer, and it holds because you got three independent
clauses right. Every one of them is a place to be wrong: `<=` for `<`, a
stale bound after the slice is reassigned, an `i++` inside the body on top
of the one in the header, a second loop that copy-pastes the header and
keeps the old variable name.

In `for i := range samples`, none of those exist. The range expression is
evaluated once, before the first iteration, by specification. The iteration
variable is produced by the loop, and the compiler guarantees it stays
inside `[0, len)` because it is the thing generating the values. There is
no bound to typo because you did not write a bound. And in the form the
reference mostly uses,

```go
for _, v := range samples {
	total += int(v)
}
```

there is no index at all. An off-by-one is not a bug you avoided by being
careful, it is a statement you cannot write. That is the difference worth
internalizing: the C loop is correct because it was reviewed, the range
loop is correct because it was not expressible otherwise. Go's designers
did not add `range` to save keystrokes; they added it so the bookkeeping
belongs to the compiler, which never has an off day.

`Smooth` shows the same idea for a counted loop:

```go
for p := 0; p < passes; p++    // starter
for range passes              // reference
```

`p` was never read in the body. It existed only to count. `for range n`
over an integer (Go 1.22) says exactly that and nothing more. If you
worried about `passes` being negative, the spec has you covered: for `n <=
0` the loop runs zero times, the same as the C form, and the suite's
"negative passes copies" case pins it.

## 2. Shadowing a builtin: legal, and still wrong

```go
len := len(samples)
```

```
frame.go:32:2: variable len has same name as predeclared identifier (predeclared)
```

This compiles, and it is worth understanding why, because the reason is a
deliberate design choice rather than an oversight. Go has 25 keywords and
`len` is not one of them. `len`, `cap`, `min`, `max`, `new`, `byte`, `int`,
`error`, `true`, and `nil` are ordinary identifiers declared in the
**universe block**, the scope that encloses every package in every program.
An ordinary declaration in an inner scope shadows them the way any inner
declaration shadows an outer one. Nothing special is happening here at all,
which is the point.

That rule buys the language something concrete: builtins can be added
without breaking existing programs. When Go 1.21 introduced `min` and `max`
as builtins, every program in the world with a local variable named `min`
kept compiling, because a user declaration simply shadows the new universe
name. Reserving those words instead would have made a minor release a
breaking one. The compatibility promise is paid for, in part, by exactly
the permissiveness that lets you write this line.

Now the cost, which the same function pays two lines later:

```go
return byte(int(total) / len), nil
```

`len` is an `int` in this scope, so the builtin is unreachable. Not
discouraged, unreachable. If you wanted the length of anything else in this
function you could not ask for it. The starter's `Bounds` makes the trap
visible; try to reach for the builtin there and the compiler says so:

```
invalid operation: cannot call non-function min (variable of type byte)
```

That is the shadowing bill. `Bounds` is a running minimum and a running
maximum, the exact computation Go 1.21 added builtins for, written in a
scope where those builtins have been made inaccessible by the names of the
variables holding the results. The reference renames them and the tools
come back:

```go
lo, hi := samples[0], samples[0]
for _, v := range samples[1:] {
	lo = min(lo, v)
	hi = max(hi, v)
}
```

Note that no linter asked for this. `modernize` flags the `if lo < 0 { lo =
0 }` shape in `Smooth`, because that is a single conditional assignment it
can rewrite mechanically, but it does not recognize a running reduction
across a loop and it stayed silent on `Bounds` both before and after the
rename. Reaching for `min` and `max` here was a judgment call. The linter
only made it possible by getting the names out of the way.

The reader's cost is smaller but constant. In Go, `len` at a call site
means one thing everywhere, and that reliability is most of why the builtin
is worth having. A local named `len` suspends it for a scope, so anyone
reading the function has to carry "except here" the whole way down.

## 3. Conversions the type system already performs

```
frame.go:37:17: unnecessary conversion (unconvert)
	return byte(int(total) / len), nil
frame.go:75:10: unnecessary conversion (unconvert)
		if byte(samples[i]) > threshold {
```

`total` is already `int`. `samples[i]` is already `byte`. Both conversions
are no-ops the compiler folds away, so neither costs an instruction. They
cost something else.

The habit comes from a language where casts are load-bearing in a way they
never are in Go. C converts implicitly and constantly: integer promotion
turns your `char` into an `int` mid-expression, mixed signedness has
conversion rules most people cannot recite, and truncation on assignment is
silent. In that world a defensive cast is not noise, it is you pinning down
an expression whose type the language was about to decide for you. Writing
`(unsigned char)x` when `x` is already an unsigned char is cheap insurance
against the promotion rules.

Go has no implicit numeric conversion at all. None. `int` and `int64` are
distinct types that will not mix even where they have identical layout, and
every conversion in a Go program is one somebody typed. That removes the
danger the C habit was defending against, and it changes what a conversion
communicates. In Go, `T(x)` says "x is not a T, make it one." So a
conversion where `x` is already a `T` says something about the author
rather than the code: they did not know what type the expression had, or
they did not trust it. It is a comment reading "I was unsure here,"
compiled in.

The real damage is to the conversions that matter, and this file has a
line where you can see it happen:

```go
return byte(int(total) / len), nil
```

The inner `int(total)` is a no-op. The outer `byte(...)` is load-bearing
and lossy: it truncates an `int` to eight bits, and the fact that it cannot
overflow here is a fact about the input domain, not about the types. One
statement, two conversions, opposite significance, identical appearance.
`Sum` has the same pattern in reverse: `total += int(v)` is required, and
required for a reason worth seeing, since without the widening you would be
accumulating into a `byte` and wrapping past 255.

Conversions are how a Go reader finds the places where data changes shape,
loses precision, or crosses a domain boundary. Write ones that do nothing
and you have devalued the ones that do. The reference keeps `int(v)` and
the final `byte(...)`, and drops the other two, so every remaining
conversion in the file is a place where something actually happens.

## 4. The dead sentinel seed

```go
min := byte(0xFF)
max := byte(0x00)
min = samples[0]
max = samples[0]
```

```
frame.go:46:2: ineffectual assignment to min (ineffassign)
frame.go:47:2: ineffectual assignment to max (ineffassign)
```

Two correct C idioms, run into each other. Seeding a scan with the type's
extremes is a real technique, and so is seeding from the first element and
scanning the rest. The author wrote both, so the first pair never survives
to be read.

The reference keeps the second, and not just because it is the one that
happens to be alive. Seeding from `samples[0]` and ranging over
`samples[1:]` needs no knowledge of the element type's range, so it
generalizes to any ordered type, including ones with no nameable extreme.
`byte(0xFF)` is a fact about `byte` hardcoded into an algorithm that is not
about `byte`. Change the sample type to `int16` later and the extremes
approach is silently, catastrophically wrong, while the first-element
approach just keeps working.

The empty case is already handled by the guard at the top of the function,
which is what makes `samples[0]` safe to reach for at all. Worth noticing:
that guard is also what lets the reference's `Mean` divide without checking
again.

## 5. `Smooth`, and a copy loop with a name

```go
out := make([]byte, len(samples))
for i := 0; i < len(samples); i++ {
	out[i] = samples[i]
}
```

That is `copy(out, samples)`. `staticcheck` knows it (`S1001: should use
copy(to, from) instead of a loop`), though at default settings the finding
is masked by another on the same line, so you may never see it. `copy` is a
builtin that lowers to a `memmove`, handles overlap, and returns the number
of elements moved. The hand-rolled version is the same operation with the
name removed.

The bounds arithmetic in the filter is the other half:

```go
lo := i - 1
if lo < 0 {
	lo = 0
}
hi := i + 1
if hi > len(out)-1 {
	hi = len(out) - 1
}
```

```
frame.go:96:7: minmax: if statement can be modernized using max (modernize)
frame.go:100:7: minmax: if statement can be modernized using min (modernize)
```

Clamping is what `min` and `max` are for, and the reference says it in the
subscript:

```go
left := out[max(i-1, 0)]
right := out[min(i+1, len(out)-1)]
```

Eight lines become two, and the intent, "clamp to the ends", is now
readable at a glance rather than reconstructed from two comparisons. This
is also the payoff for section 2: these builtins were available in `Bounds`
too, and only the variable names stood in the way.

## The reference, structurally

`solution.go` keeps every exported signature, the sentinel, and the
package doc. Inside: every loop is a `range` loop, no local shadows a
builtin, the copy loop is `copy`, the clamps are `min` and `max`, and the
only conversions left are the ones that change something. It is about
twenty lines shorter than the starter and there is no cleverness in it. The
lines that went were bookkeeping the compiler was willing to do.

## The smell the linter cannot see: `Mean` reimplements `Sum`

```go
func Mean(samples []byte) (byte, error) {
	// ...
	len := len(samples)
	total := 0
	for i := 0; i < len; i++ {
		total += int(samples[i])
	}
	return byte(int(total) / len), nil
}
```

Every finding above is about this loop's shape. Nothing in the config has
an opinion about the fact that it should not exist. `Sum` is fourteen lines
up in the same file, exported, and computes exactly this. The reference
deletes the loop:

```go
return byte(Sum(samples) / len(samples)), nil
```

No linter in the config flags this, and no reasonable linter would.
`dupl` would not fire on a loop this small, `staticcheck` has no check for
"an exported function in this package already does that", and none of them
can know that `Sum` and this loop are meant to stay the same computation.
That last part is the actual cost. Right now there are two places in this
file that decide how a frame is totalled. The day one of them needs to
change, say to saturate rather than wrap, or to skip a sentinel sample
value, nothing makes the other one follow. They will not disagree loudly;
they will disagree by a little, in a statistic, in production.

Duplication is not primarily about line count. It is about how many places
have to be edited in step, and that number is invisible to every mechanical
tool you can run. Working out that `Mean` is `Sum` divided by length is a
thing a human does by reading two functions and noticing they are the same
shape.

One more the linter will not raise, and this one survives into the
reference: `Smooth` allocates a fresh `next` slice on every pass, so
smoothing with 100 passes allocates 101 slices and throws away 100 of them.
Two buffers swapped back and forth would do it in two allocations, forever.
At this exercise's sizes that is not worth the extra variable, and the
reference is right to stay simple, but you should be able to see the cliff
from here. No linter counts allocations, because no linter knows your input
sizes. The linter is a floor, not a ceiling.

## What this trained

- `range` versus the three-clause loop, argued honestly: the bounds checks
  are identical, and the win is that the compiler owns the index so an
  off-by-one becomes inexpressible rather than merely unlikely.
- `for range n` for counted loops, including its zero-iteration behavior
  for `n <= 0`.
- Why shadowing a predeclared identifier is legal (the universe block, and
  the compatibility it buys), and what it costs: the builtin becomes
  unreachable in the scope that most wanted it.
- Redundant conversions as a signal about the author's model of the type
  system, and the way they devalue the conversions that truly convert.
- Dead sentinel seeding, and why seeding from the first element generalizes
  where hardcoded type extremes do not.
- `copy` and the `min`/`max` clamp idiom, replacing loops and conditionals
  that had names all along.
- Duplicated computation and unnecessary allocation: two smells no linter
  in this config can reach, one of which the reference still has.
