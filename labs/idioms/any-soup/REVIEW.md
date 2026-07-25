# Review: any-soup

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first, and this one has no single home country. Python, Ruby,
JavaScript, and PHP all hand you a dictionary that holds anything, and in
those languages a registry like this one is not a hack, it is the obvious
design. `d["cpu.total"]` costs nothing to write, the shape of the value is
whatever the last writer put there, and the check that it is the shape you
expected happens at the moment you use it, in production, every time. Java
reaches the same place by a different road: generics erase, so
`Map<String, Object>` plus a cast is the standard escape hatch when the
values are heterogeneous. All of these languages make the schema a promise
between programmers.

Go moved that check to compile time and gave you no way to opt out except
one: `interface{}`. Every `.(T)` in this file is you re-implementing the
dynamic language's runtime type check by hand. The difference is that
Python raises a `TypeError` with a message naming both types and a
traceback pointing at the line, and it is an ordinary exception the caller
can catch. The naked Go assertion panics, and unless someone up the stack
recovered, the process is gone. You took on the dynamic language's cost and
skipped its safety net.

## 1. Four assertions, four panics you did not write

```
metrics.go:54:2: type assertion must be checked (forcetypeassert)
	total := r.data[name+totalSuffix].(float64)
metrics.go:65:9: type assertion must be checked (forcetypeassert)
	return v.(float64)
metrics.go:85:2: type assertion must be checked (forcetypeassert)
	top := samples[0].(float64)
```

`forcetypeassert` is in the shared config for a reason worth stating out
loud. Look at what else that config forbids:

```yaml
forbidigo:
  forbid:
    - pattern: ^panic$
      msg: panic is not an error strategy; return a wrapped error instead
```

An unchecked `v.(T)` is that same `panic`, with the call site hidden. It
compiles to a check and a `runtime.panicdottypeE` on the failing branch;
you did not write the word, but you wrote the statement. Banning explicit
`panic` while allowing naked assertions would be banning the honest spelling
of the thing and permitting the quiet one. The two rules are siblings.

The fourth finding has a different message, and it is the interesting one:

```
metrics.go:87:3: right hand must be only type assertion (forcetypeassert)
		top = max(top, s.(float64))
```

`forcetypeassert` is not being fussy about style here, it is telling you
that the comma-ok form is unreachable from where you put the assertion.
`v, ok := x.(T)` is a special form of assignment, not an expression that
returns a pair you can pass around. Bury the assertion inside a call
argument and there is no syntax left that can catch its failure. The
language is telling you something through the grammar: the checked form has
to be the whole right-hand side, so an assertion you cannot check is an
assertion you have to restructure.

Worth knowing before you start counting: `golangci-lint` reports at most
one finding per line and caps repeated findings per message, so the four
`forcetypeassert` lines you see stand for eight assertions in the file. The
count will sit still for a while as you work. That is normal.

## 2. The trap: `any` is not a fix

```
metrics.go:33:18: use-any: since Go 1.18 'interface{}' can be replaced by 'any' (revive)
```

Do the obvious thing with this finding and watch what happens. Replace
every `interface{}` with `any`, then run both gates:

```
golangci-lint run    # 7 issues -> 4 issues
go test ./...        # still green
```

Three findings cleared, tests green, and the design is byte-for-byte the
same design. `any` is declared in the universe block as `type any =
interface{}`, an **alias**, not a new type. Not a wrapper, not a subtype,
not a distinct type with the same method set. The two spellings name one
type, `go/types` cannot tell them apart, and no runtime behavior anywhere
in this package changes.

So `use-any` is a spelling rule. Follow it, because consistency in a
codebase is worth having for free, but notice how little it bought and how
much it felt like progress. That gap is the whole point of this exercise.
A linter finding tells you a line is wrong. It does not tell you the design
is wrong, and clearing findings is not the same activity as fixing code.
The four assertions are still there after the rename because they were
never about how you spell the empty interface. They are about the fact that
this package does not know the shape of its own data.

## 3. The schema that is not a type

```go
const (
	totalSuffix = ".total"
	metaSuffix  = ".meta"
	unitKey     = "unit"
)

type Registry struct {
	data map[string]interface{}
}
```

No linter flags this block, and it is the actual defect. Read what the
compiler sees when it type-checks `r.data`: a map from string to anything.
That is the sum total of what it knows. Now read what is actually in there:
for a series named `"cpu"` there are three entries, at `"cpu"`,
`"cpu.total"`, and `"cpu.meta"`, holding a `[]interface{}`, a `float64`,
and a `map[string]interface{}`. Four shapes, one declared type, and the
mapping between key and shape is a doc comment.

The invariant "every series has all three of its entries" is likewise not a
type. It is a promise `Record` keeps in its first branch:

```go
r.data[name] = []interface{}{value}
r.data[name+totalSuffix] = value
r.data[name+metaSuffix] = map[string]interface{}{unitKey: ""}
```

Nothing enforces it. A future edit that creates a series down some other
path, or that deletes one key and forgets the siblings, produces a registry
that is two thirds of a series, and the failure surfaces later, somewhere
else, as a panic in a reader.

The reference gives the compiler the shape:

```go
type series struct {
	samples []float64
	total   float64
	unit    string
}

type Registry struct {
	series map[string]*series
}
```

Count what that one declaration bought. Every field access is checked at
compile time, so there is no assertion left to write and nothing to
`forcetypeassert`. `samples` is `[]float64`, so `slices.Max` works directly
and the per-element assertion in the old `Max` loop disappears. A series is
one value, so "two thirds of a series" is not a state the program can
represent: you cannot have a total without a samples slice any more than
you can have half a struct. The invariant stopped being a promise and
became a shape.

This is what "give the compiler something it can defend" means concretely.
It is not about pleasing a linter. It is about moving a class of bug from
runtime to compile time, and the way you do that in Go is almost always by
declaring a type.

## 4. What the naming convention costs at the edges

```go
r.data[to] = r.data[from]
r.data[to+totalSuffix] = r.data[from+totalSuffix]
r.data[to+metaSuffix] = r.data[from+metaSuffix]
delete(r.data, from)
delete(r.data, from+totalSuffix)
delete(r.data, from+metaSuffix)
```

Six map operations, against two in the reference:

```go
r.series[to] = s
delete(r.series, from)
```

The line count is the small part. The real cost is that `Rename` has to
know the schema. So does `Record`, so does `Total`, so does `Unit`, so does
`Names`. The schema is not written down in one place, it is smeared across
every function that touches the map, and the compiler cannot check any copy
of it against any other.

Play it forward. Add a fourth per-series field, say a sample timestamp.
In the reference you add a struct field and the compiler walks you to
everything that needs to change. In the starter you add a fourth key
suffix, update `Record`, and then you have to *remember* `Rename`. Forget
it and the new field silently fails to follow a renamed series. Nothing
fails to compile, no existing test goes red, and the bug ships. That is not
a hypothetical class of mistake, it is the specific one this shape invites,
and it gets more likely with every field and every developer.

## 5. Names, and the reader that has to guess

```go
for key, value := range r.data {
	if _, ok := value.([]interface{}); ok {
		names = append(names, key)
	}
}
```

This one is honest about the comma-ok, so `forcetypeassert` stays quiet,
and it is still the most revealing function in the file. To answer "what
series exist", the package inspects the runtime type of every value in the
map, because that is the only way left to distinguish a series from the
bookkeeping riding along with it. The data structure has no list of series.
It has a pile of keys, and membership is recovered by type-sniffing at read
time.

In the reference the question is not asked, because the map is already
keyed by exactly the thing being listed:

```go
return slices.Sorted(maps.Keys(r.series))
```

When a lookup needs reflection or type-sniffing to answer a question the
data structure should already know, that is the signal that the structure
is wrong. Go gives you `maps.Keys` and `slices.Sorted` here (both Go 1.23),
and the reason they fit in one line is that the reference chose a map whose
keys mean one thing.

## The reference, structurally

`solution.go` keeps every exported signature and every sentinel. Behind
them: one `series` struct, one `map[string]*series`, no `const` block, no
assertions, and two new imports (`maps`, `slices`) doing work that used to
be hand-written. `Record` appends and adds. `Max` calls `slices.Max`.
`Rename` moves a pointer. It is shorter than the starter, but the length is
a side effect. The change is that the compiler now knows what a series is.

One thing worth stealing from the suite: it drives only the public API and
asserts on observable outcomes, never on the storage. That is what made it
legal to delete the entire internal representation and keep the tests
untouched. Tests that pin structure would have made this refactor a
test-rewriting exercise.

## The smell the linter cannot see: the key convention is not injective

Every finding above is about how the code handles its data. This one is
about the schema itself, and it is a live bug in the starter that no linter
in the config can reach.

The convention says series `s` owns the keys `s`, `s.total`, and `s.meta`.
Nothing forbids a caller from naming a series `"cpu.total"`. The map is
keyed by string, `Record` takes a string, and the public API has no opinion
about which strings are allowed. So two ordinary calls collide:

```go
r := metrics.New()
r.Record("cpu", 1)        // creates "cpu", "cpu.total", "cpu.meta"
r.Record("cpu.total", 5)  // "cpu.total" already exists, holding a float64
```

The second `Record` finds `"cpu.total"` present, takes the "series already
exists" branch, and asserts the value is a sample list. It is a `float64`,
the total belonging to `"cpu"`:

```
panic: interface conversion: interface {} is float64, not []interface {}
	.../metrics.go:51
```

Drop that into the exercise directory as `collide_test.go` and run it both
ways:

```go
// collide_test.go: temporary, delete after running.
package metrics_test

import (
	"testing"

	metrics "gopath.dev/labs/idioms/any-soup"
)

func TestNameCollision(t *testing.T) {
	r := metrics.New()
	r.Record("cpu", 1)
	r.Record("cpu.total", 5)
	if got := r.Count("cpu.total"); got != 1 {
		t.Fatalf("Count(cpu.total) = %d, want 1", got)
	}
	if got := r.Total("cpu.total"); got != 5 {
		t.Fatalf("Total(cpu.total) = %v, want 5", got)
	}
}
```

```
go test -run TestNameCollision ./...                  # starter: panics
go test -tags solution -run TestNameCollision ./...   # reference: passes
```

The reference passes without anyone having thought about collisions,
because in a `map[string]*series` a name is just a key and `"cpu.total"` is
an unremarkable one. The bug was never a missing validation. It was the
decision to encode structure in string keys, which requires the key space
to be partitioned and the code to enforce the partition, and it enforced
nothing.

Notice what could not have caught this. `forcetypeassert` pointed straight
at line 51, the exact line that panics, and told you to check the
assertion. Take that advice literally and you would add a comma-ok, return
early, and ship a registry that silently drops samples instead of panicking.
The finding was correct and the fix it suggests is worse than the bug: a
loud failure becomes a quiet one. No linter can tell you the schema is
ambiguous, because no linter knows that `.total` means something. That
judgment was always yours.

And that is the general lesson under this exercise. `interface{}` does not
just defer type checking to runtime. It hides design errors, because a map
that accepts every shape cannot object to a schema that does not work. The
compiler had no opinion about this bug for exactly the same reason it had
no opinion about the four assertions: you never told it what a series was.

## What this trained

- `interface{}` as an escape hatch, and the four naked assertions that
  always follow it. An unchecked `v.(T)` is a `panic` you did not spell.
- Why `forcetypeassert` is a sibling of the config's `panic` ban, and why
  the comma-ok form has to own the whole right-hand side.
- `any` is an alias for `interface{}`, so renaming clears three findings
  and changes nothing. Clearing findings is not the same as fixing code.
- Schema-as-key-convention versus schema-as-struct: what the compiler can
  check, what it cannot, and how an invariant stops being a promise.
- Type-sniffing to answer a question the data structure should already
  know, as the signal that the structure is wrong.
- Key-space collisions, the bug the linter pointed at and could not name,
  where following the finding literally would have made things worse.
