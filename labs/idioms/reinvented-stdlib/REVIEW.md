# Review: reinvented-stdlib

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first, and it is worth being fair to it. C's standard library is
small on purpose, and the parts of it that touch strings are the parts
everyone tells you not to use. `<string.h>` gives you `strstr`, `memcpy`,
and a family of functions that have caused so many buffer overflows that
half of them are banned by style guides. There is no `min` or `max` for
arbitrary types, only macros that evaluate their arguments twice and bite
you the first time you write `MAX(i++, n)`. There is no growable string, so
building one means owning a `malloc` and a length. In that world, "I need a
substring search, so I will write a substring search" is not laziness or
arrogance. It is nine lines against a dependency, an unfamiliar contract,
and possibly a portability problem, and nine lines wins.

Go changed every term of that trade. The standard library is large,
versioned, covered by the compatibility promise, fuzzed continuously by the
Go team, and already linked into your binary: `strings` and `slices` cost
you an import line and no bytes you were not already paying for. `min`,
`max`, `copy`, and `len` are builtins the compiler understands. The C habit
survives here because nothing punishes it. This package is the result. It
is correct, it is tested, it passes, and thirty lines of it should not
exist.

Because the starter is not buggy, "but it works" is the defense you will
reach for, and it needs answering before any individual finding matters.
Three answers, in order of how much they cost you:

- **A named call is verified by its name.** A reader who sees
  `strings.TrimPrefix(line, agentPrefix)` is done. A reader who sees an `if`
  and a reslice has to check the bound, check the branch, and decide whether
  the author meant "one prefix" or "all of them". You wrote the loop once;
  everyone who reviews this file reads it forever.
- **Your version is tested by you.** `strings.Contains` is exercised by the
  Go team's tests, by a fuzzer, and by every Go program ever written.
  `HasMarker` is exercised by eight table rows in `logline_test.go`.
- **Edge cases you did not enumerate are already handled.** Two below, in
  `max` and in `copy`. In both, the hand-rolled version is correct here only
  because of a fact about the current types and the current caller.

## 1. You re-typed the standard library's body

```go
func TrimAgent(line string) string {
	if strings.HasPrefix(line, agentPrefix) {
		line = line[len(agentPrefix):]
	}
	return line
}
```

```
logline.go:21:2: S1017: should replace this if statement with an
  unconditional strings.TrimPrefix (staticcheck)
```

Now open the standard library and read `TrimPrefix`. On Go 1.23, which is
what these labs build with, `strings.TrimPrefix` is a one-line delegation
to `internal/stringslite`, and that is the whole implementation:

```go
func TrimPrefix(s, prefix string) string {
	if HasPrefix(s, prefix) {
		return s[len(prefix):]
	}
	return s
}
```

That is the same three lines. This is not a case where the stdlib is
cleverer than you; the point is stronger than that. The two are
character-for-character the same algorithm, so every argument for the
hand-rolled version has to be an argument for typing out an identical body
in order to lose its name.

The name is the whole product. `strings.TrimPrefix` has a doc comment, a
signature you can grep for across every Go repository on earth, and a
meaning that does not change between this file and the next one. The
starter's version has an `if` whose semantics a reader has to infer, and
the inference is not trivial: the suite pins that only one layer comes off
(`TestTrimAgent`, "only one layer comes off"), which is a real design
decision, invisible in the loop, and stated in `TrimPrefix`'s documentation.

## 2. `slices.Contains`, and an argument you should not make

```go
for _, known := range severities {
	if known == sev {
		return true
	}
}
return false
```

```
logline.go:30:2: slicescontains: Loop can be simplified using
  slices.Contains (modernize)
```

Start with the claim you have probably heard and should not repeat, because
it is false here. `slices.Contains` is not faster. Measured against the
starter's own loop over the same five-element slice, with the miss case
(`"FATAL"`, so both scan the whole thing):

```
BenchmarkKnownHandRolled-8       11.65 ns/op   0 B/op   0 allocs/op
BenchmarkKnownSlicesContains-8   11.93 ns/op   0 B/op   0 allocs/op
```

Same linear scan, same comparisons, and the generic version is a hair
slower inside the noise. If you refactor this for speed you have refactored
it for nothing.

What you get is the thing section 1 was about, at a slightly larger scale.
`slices.Contains(severities, sev)` states an intent in one line that a
reader confirms by reading a name. The five-line loop states the same
intent in a shape that is *nearly* identical to several other shapes:
find-first-index, count-matching, all-match, none-match. Those loops differ
from this one by one keyword or one negation, and a reader has to run the
loop in their head to tell which one they are looking at. The failure mode
is not that they get it wrong today. It is that the next person to edit
this function, adding a case-insensitive match or a prefix rule, is editing
a loop instead of replacing a call, and loops accrete.

There is a real second-order win. `slices.Contains` is generic over any
comparable element type, so the day `severities` becomes `[]Severity` (see
the `stringly-typed` exercise in this track) the call site does not change
at all.

## 3. `HasMarker`: the rebuild with no finding, and it is the expensive one

```go
for i := range len(line) - len(marker) + 1 {
	if line[i:i+len(marker)] == marker {
		return true
	}
}
```

No linter says anything about this. `staticcheck` has no pattern for
"naive substring search", `modernize` recognizes specific loop shapes and
this is not one of them, and no reasonable tool is going to prove that an
arbitrary scan is equivalent to `strings.Contains`. The README told you two
rebuilds were invisible; this is the first, and finding it is the exercise.

It is also correct. Checked exhaustively over every pair drawn from a small
alphabet, 121 haystack/needle combinations, the starter's `HasMarker` and
`strings.Contains` agree on every one, including the empty marker and the
marker-longer-than-line guard that the author correctly wrote by hand.

And it is very slow:

```
BenchmarkContainsHandRolled-8    875.3 ns/op     (319-byte line)
BenchmarkContainsStdlib-8         12.81 ns/op
BenchmarkContainsHandRolledShort-8   59.64 ns/op (23-byte line)
BenchmarkContainsStdlibShort-8        6.958 ns/op
```

Sixty-eight times slower on a realistic log line, and still eight times
slower on a short one. That gap is not a micro-optimization, and the reason
is worth reading in the source rather than taking on faith. The hand-rolled
loop does one string comparison per offset: about three hundred calls to
`runtime.memequal` to find a three-byte marker, every one of them starting
from scratch.

`strings.Contains` calls `strings.Index`, which is not a scan at all. Open
`internal/stringslite/strings.go` and read it. It special-cases the
one-byte needle into `IndexByte`, which is hand-written SIMD assembly on
amd64. For anything longer it uses `IndexByte` to jump directly to the next
position where the needle's *first* byte even occurs, checks the second
byte before committing to a full comparison, counts how often that
heuristic wastes work, and escalates: to `internal/bytealg.IndexString`
(more assembly, for needles up to 31 bytes, or 63 with AVX2) when the false
positives pile up, and to a Rabin-Karp rolling hash when the needle is
longer than the assembly kernel handles.

That is three algorithms, an adaptive switch between them, and a hand-tuned
kernel, behind one call. You are not going to write it, and nobody on your
team is going to write it. It is in the standard library because it was
worth one person's month once, for everybody, forever, and the whole value
of a standard library is that you collect that by typing a name.

The adversarial case is worth seeing too, because it shows the naive
algorithm's complexity rather than its constant factor. Search 64 `a`s
followed by a `b` inside 4096 `a`s followed by a `b`:

```
BenchmarkContainsHandRolledEvil-8   14738 ns/op
BenchmarkContainsStdlibEvil-8        5149 ns/op
```

Under three times, because `strings.Index` is genuinely working here too.
Note the direction though. The stdlib's worst case is bounded by an
algorithm somebody chose on purpose; yours is bounded by the input.

## 4. The mask that grows quadratically

```go
mask := ""
for range len(secret) {
	mask += "*"
}
```

```
logline.go:64:4: stringsbuilder: using string += string in a loop is
  inefficient (modernize)
```

Go strings are immutable. `mask += "*"` cannot append; it allocates a new
string of length n+1, copies the old n bytes in, writes one byte, and drops
the previous one on the floor for the collector. Do that n times and you
have copied 1+2+...+n bytes to produce n. The measurement, against
`strings.Repeat`:

```
BenchmarkMaskLoop16-8       379.3 ns/op     160 B/op    15 allocs/op
BenchmarkMaskRepeat16-8      38.09 ns/op     16 B/op     1 allocs/op
BenchmarkMaskLoop256-8    12186 ns/op     34656 B/op   255 allocs/op
BenchmarkMaskRepeat256-8     83.10 ns/op    256 B/op     1 allocs/op
```

Read the byte column, not the time column. Producing a 256-byte mask
allocates 34,656 bytes. That is the quadratic, in garbage rather than in
seconds, and it lands on a function that runs once per secret per line
across an entire fleet's log stream.

Now the part worth slowing down for, because it is the clearest example on
this track of the linter being a floor. `modernize`'s message names
`strings.Builder`. Take the suggestion literally:

```go
var b strings.Builder
for range len(secret) {
	b.WriteString("*")
}
mask := b.String()
```

The finding goes away. The run is green. And it is five times slower than
the right answer:

```
BenchmarkMaskBuilder256-8    463.6 ns/op    504 B/op    6 allocs/op
BenchmarkMaskRepeat256-8      90.57 ns/op   256 B/op    1 allocs/op
```

A `Builder` is the correct tool for assembling a string from parts you
discover as you go, and it grows its buffer by doubling, which is why six
allocations instead of 255. But this loop is not discovering anything. It
knows the final length before it starts. `strings.Repeat("*", len(secret))`
allocates exactly once, at exactly the right size, and says what the code
means in a way neither loop does:

```go
line = strings.ReplaceAll(line, secret, strings.Repeat("*", len(secret)))
```

The linter matched a syntactic pattern (`+=` in a loop) and offered the
general remedy for that pattern. It did not read the loop body and notice
the value being appended is constant. That judgment was yours, and clearing
the finding was never the same thing as making the call.

## 5. `fmt.Sprintf` where `strconv.Itoa` is the entire job

```go
return line + " (x" + fmt.Sprintf("%d", count) + ")"
```

```
logline.go:98:24: integer-format: fmt.Sprintf can be replaced with faster
  strconv.Itoa (perfsprint)
```

```
BenchmarkSprintfSmall-8   45.98 ns/op    2 B/op   1 allocs/op   (n = 12)
BenchmarkItoaSmall-8       1.958 ns/op   0 B/op   0 allocs/op
BenchmarkSprintfBig-8     51.46 ns/op    8 B/op   1 allocs/op   (n = 1234567)
BenchmarkItoaBig-8        22.92 ns/op    8 B/op   1 allocs/op
```

Twenty-three times at a repeat count of twelve, and be precise about where
that number comes from, because two separate effects are stacked in it.

The constant is the honest one: about 29ns of fixed overhead, visible in
the big case where both functions are doing the same digit work. Here is
what `fmt.Sprintf("%d", count)` does that `strconv.Itoa(count)` does not.
The `int` is boxed into an `any`, which means a heap word unless the value
happens to sit in the runtime's small-integer cache. The variadic call
builds an `[]any` that escapes. `fmt` then takes a printer off a
`sync.Pool`, walks the format string byte by byte at run time looking for
verbs, type-switches on the boxed argument to find out it is an `int`,
formats the digits into a pooled buffer, copies that buffer into a fresh
string, and returns the printer to the pool. `strconv.Itoa` does the digit
step and stops.

One correction to a story you will hear: for an `int`, `fmt` does not go
through `reflect`. Its `printArg` type-switches on the concrete types it
knows, and reflection is the fallback for types the switch does not
recognize. The cost above is boxing, pooling, and parsing a format string
at run time to learn something you knew when you typed it.

The other effect is the reason the small case is 23x and the big case only
2x: `strconv.Itoa` returns a slice of a precomputed digit string for values
under 100, so it allocates nothing at all for a repeat count. Which is
exactly the range this function operates in.

A general formatter is the right tool when you are formatting several
values with layout between them. `%d` alone, with one integer, is that tool
being asked to do the one job the specific function is named after.

## 6. `max` and `min`: one flagged, one invisible, and a caveat

Two clamps, the same idea, and only one of them gets a finding. `Fit`:

```
logline.go:120:5: minmax: if statement can be modernized using min
  (modernize)
```

`Widest`, which nothing flags:

```go
if len(line) > widest {
	widest = len(line)
}
```

This is the second invisible rebuild the README warned you about.
`modernize` catches `Fit` because a single conditional assignment is a
pattern it can rewrite mechanically, and stays silent on `Widest` because a
running reduction across a loop is not that pattern.

```go
widest = max(widest, len(line))        // Widest
return line[:min(len(line), width)]    // Fit
```

Here is the caveat, because at `int` these really are equivalent and it is
worth knowing exactly why that sentence needs the qualifier. `max` and
`min` became builtins in Go 1.21 with defined behavior on floats that a
comparison does not reproduce:

```
max(1.0, NaN)          = NaN     if b > a { return b }; return a  ->  1
max(-0.0, 0.0) signbit = false   the same hand-rolled version     ->  -0
```

The builtin propagates NaN and treats `+0` as greater than `-0`, both by
specification. The `if` does neither, silently. This file works on `int`
lengths so the difference cannot bite here, and that is precisely the
problem with leaving the hand-rolled version in: its correctness is a fact
about the current element type, re-derived by every reader, and it changes
without warning the day the type does.

## 7. `copy`, argued honestly

```go
out := make([]string, len(tail))
for i, line := range tail {
	out[i] = line
}
```

```
logline.go:139:2: S1001: should use copy(to, from) instead of a loop
  (staticcheck)
```

Do not oversell this one:

```
BenchmarkCopyLoop-8      2774 ns/op   18432 B/op   1 allocs/op   (1024 strings)
BenchmarkCopyBuiltin-8   2085 ns/op   18432 B/op   1 allocs/op
```

About a third faster, same allocation, and for the handful of lines `Tail`
usually returns the difference is unmeasurable. You can see where the third
comes from. Compile both shapes and read the calls:

```
go tool compile -S main.go

main.Copy   CALL runtime.typedslicecopy
main.Loop   CALL runtime.gcWriteBarrier2
            CALL runtime.panicIndex
```

`copy` is one call for the whole slice. The loop pays a write barrier per
element, because every `string` header contains a pointer the garbage
collector has to be told about, and carries a bounds check on the store.
That is the least interesting thing about this finding.

The interesting thing is overlap. `copy` has `memmove` semantics: source
and destination may share memory and the result is still the shift you
asked for. A forward element loop does not:

```go
a := []string{"0", "1", "2", "3", "4"}
copy(a[1:], a[:4])           // [0 0 1 2 3]

b := []string{"0", "1", "2", "3", "4"}
dst, src := b[1:], b[:4]
for i, v := range src {      // [0 0 0 0 0]
	dst[i] = v
}
```

The loop overwrites each element before it reads it. Here that can never
happen, because `out` was allocated two lines up and shares nothing with
`tail`, which is exactly the point: the loop is correct because of a fact
about its caller rather than a property of the operation. Hoist those four
lines into a helper someday, pass it two slices from the same array, and
the bug arrives with no warning from the compiler and none from the linter.
`copy` is correct under conditions the loop is not, and it is shorter.

## A note on the count

Six issues, and there are seven findings. golangci-lint deduplicates by
line (`issues.uniq-by-line`, on by default), and line 64 has two:

```
logline.go:64:4: stringsbuilder: using string += string in a loop is
  inefficient (modernize)
logline.go:64:4: concat-loop: string concatenation in a loop (perfsprint)
```

Only the first is printed. Confirm the second with
`golangci-lint run --uniq-by-line=false` and the run reports 7.

Unlike some exercises on this track, that hiding does not cost you
anything, and it is worth knowing why rather than just being told. Both
findings are cured by the same edit, whichever way you make it:
`strings.Repeat` removes the concatenation and the loop together, and even
the `strings.Builder` version from section 4 clears both, because neither
linter can still see a `+=`. So the count here falls without ever rising.
Working top to bottom through the file, one function per step:

```
6 -> 5 -> 4 -> 4 -> 3 -> 2 -> 2 -> 1 -> 0
```

Two of those eight edits move it not at all, and they are `HasMarker` and
`Widest`, the two rebuilds nothing flags. Do them last instead and the
count hits zero with two refactors still outstanding. That is the exercise
in one line: zero issues is where the linter runs out of opinions, not
where the file is finished.

## The reference, structurally

`solution.go` is 113 lines against the starter's 143, and the deletions are
not distributed evenly. `Dedupe` is untouched, because a run-length collapse
is real logic that nothing in the library does for you. `Tail`'s guards and
its slicing arithmetic are untouched, because deciding what a negative
`keep` means is a design decision, not a loop. `diff` the two files and what
left is four `for` loops, seven `if` statements, and one `fmt.Sprintf`.
Every one of them had a name already.

The import block is the summary of the whole exercise:

```
starter          reference
-------          ---------
fmt              slices
strings          strconv
                 strings
```

`fmt` left entirely, which is the tell: this package never needed a general
formatter, it needed one integer converted. The two arrivals add nothing to
the binary you were not already carrying, and between them they deleted
about thirty lines that nobody now has to review, test, or benchmark again.

## The smell the linter cannot see: `Redact` depends on the order of its secrets

Nothing above touches this, the reference does not fix it, and it is the
worst thing in the file.

`Redact` masks its secrets in slice order, and each pass runs over the
output of the last one. So overlapping secrets interfere, and the result
depends on which order the caller happened to build the slice in:

```go
line := "Authorization: Bearer tok-88f1c2"

Redact(line, []string{"tok-88f1c2", "Bearer tok-88f1c2"})
// "Authorization: Bearer **********"

Redact(line, []string{"Bearer tok-88f1c2", "tok-88f1c2"})
// "Authorization: *****************"
```

Same line, same two secrets, different output. In the first ordering the
token is masked first, so the longer secret no longer matches anything and
the word `Bearer` ships to the status screen. That is a redaction function
leaking, and the deciding factor is the order of a slice literal somebody
wrote in a config file.

It gets slightly worse, because a mask can manufacture a match:

```go
Redact("id=ab cd", []string{"ab", "** cd"})
// "id=*****"
```

Nothing was secret about `cd`. The first substitution created the text the
second one matched.

No linter is going to find this. There is no syntactic pattern here; the
loop is clean, the calls are the right calls, and the bug is entirely in
what the composition of two correct operations means. The suite does not
find it either, because `TestRedact` only ever passes disjoint secrets, and
a test suite that only feeds a function inputs its author had in mind is a
test suite that pins the author's assumptions rather than the contract.

The reference leaves it alone deliberately: this exercise's contract is
that the public surface and its behavior do not change, and fixing it means
choosing a policy (longest secret first? a single pass with a combined
matcher? reject overlapping secrets at the boundary?). That is a design
decision, not a refactor, and it belongs in a commit with the reasoning
attached. If you want to see the shape of the real fix, sort the secrets
by descending length before the loop and then work out why that is a
mitigation rather than a solution.

There is a smaller one in the same neighborhood, and it is at least
documented. `Fit` slices by bytes, and the doc comment says why: "The fleet
logs ASCII, so bytes are columns." That is a real constraint honestly
stated, and it is not enforced anywhere:

```go
Fit("héllo", 2)  ->  "h\xc3"   utf8.ValidString: false
```

One invalid UTF-8 byte, straight onto a status screen. `Widest` has the
same assumption baked into `len`. Documented assumptions are much better
than undocumented ones, and they are still assumptions: the day one agent
in the fleet logs a UTF-8 error message, the constraint is violated by
someone who never read that comment.

## What this trained

- The "but it works" defense, answered three ways: verification cost for
  every future reader, who tested it, and edge cases you did not enumerate.
- `strings.TrimPrefix`, whose body is character-for-character the code you
  wrote, so the entire product is the name.
- `slices.Contains` argued honestly: measurably not faster, and worth doing
  anyway for legibility and for the generic call site.
- The two rebuilds with no finding: a naive substring scan 68x slower than
  `strings.Index`, whose adaptive three-algorithm implementation is worth
  reading, and a running maximum that `max` says in one line.
- Quadratic string building, and the case where the linter's suggested fix
  (`strings.Builder`) is five times worse than the library's right answer
  (`strings.Repeat`).
- What `fmt.Sprintf` actually costs against `strconv.Itoa`: boxing, a
  pooled printer, and a run-time format-string scan, with the small-integer
  fast path explaining the rest of the gap. Not reflection.
- `copy` over an element loop, argued on overlap semantics rather than the
  33% that would not have justified it.
- A finding hidden behind another on the same line that costs nothing, and
  two smells nothing mechanical can reach: an order-dependent redaction and
  a byte-width assumption nobody enforces.
