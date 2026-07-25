# Review: interface-bloat

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first, and this one is not really Java's fault. In Java, C#,
Swift, and Rust, an interface (or protocol, or trait) is satisfied
*nominally*: the implementing type has to say so, with `implements`, with
`:`, with `impl Trait for Type`. That one requirement decides everything
downstream. Because the implementor declares the relationship, the
interface has to exist before the implementor compiles, which means it has
to be written by whoever writes the implementation, which means it can only
describe what the implementation offers, because at that moment no consumer
exists yet to describe what anyone needs. So `Storage` lists all eight
things `MemStore` can do. There was nowhere else for that list to come
from.

Go removed the requirement. A Go type satisfies an interface by having the
methods, full stop: no declaration, no keyword, no import of the interface,
no knowledge that the interface exists. Satisfaction is checked at the
assignment, not at the definition, and it works retroactively on types that
shipped years ago. That single change moves the interface from the producer
to the consumer, and every piece of Go interface advice you have heard,
including "accept interfaces, return structs", is downstream of it. This
exercise is that move, performed once.

## 1. Eight methods, and the linter that counts them

```
docstore.go:12:14: the interface has more than 5 methods: 8 (interfacebloat)
```

```go
type Storage interface {
	Save(key string, doc Document) error
	Load(key string) (Document, error)
	Delete(key string) error
	Keys() []string
	Stats() StoreStats
	Snapshot() map[string]Document
	Restore(snap map[string]Document)
	Health() error
}
```

Five is the threshold in `../.golangci.yml`, and the number is a proxy for
the real question, which the linter cannot ask: does any single consumer
use the whole thing? Count it yourself. `Archive` calls three methods.
`Summarize` calls two. `Purge` calls two. Nothing in this package uses
`Stats`, `Snapshot`, `Restore`, or `Health` through `Storage` at all; those
four are in the interface purely because `MemStore` has them.

That is the tell. `Storage` is not a description of a requirement, it is an
inventory of an implementation. Reading a signature is supposed to tell you
what a function touches, and `func Archive(s Storage, key string) error`
tells you it might touch anything, might snapshot, might restore, might
report health. It does none of those. Every signature in the file
overstates its own coupling, and overstated coupling is not a cosmetic
problem: it is what you have to reason about before you can safely change
anything.

Compare the standard library, which is where this idea was worked out.
`io.Reader` has one method. `io.Writer` has one. `io.ReadWriteCloser`,
which is already a composition of three, has three. `fmt.Stringer` has one.
The most reused abstractions in Go are the smallest ones, and that is not a
coincidence: the fewer methods an interface has, the more types satisfy it
by accident, and satisfying by accident is the entire point of implicit
satisfaction.

## 2. Where the interface belongs, and why Go can put it there

The fix is not to shrink `Storage`. It is to move it, three times:

```go
// loadSaveDeleter is what Archive needs: read one document, write one,
// remove one.
type loadSaveDeleter interface {
	Load(key string) (Document, error)
	Save(key string, doc Document) error
	Delete(key string) error
}

func Archive(s loadSaveDeleter, key string) error {
```

Now read what did *not* have to happen for that to work. `MemStore` was not
edited. `memstore.go` does not import anything new, does not mention
`loadSaveDeleter`, and does not know it exists. There is no registration,
no `implements`, no adapter, no wrapper. `*MemStore` has the three methods,
so `*MemStore` is a `loadSaveDeleter`, and it became one the instant the
interface was declared. In a nominal language you would have to write
something at this point: an `implements` clause on the store, or an adapter
type that forwards three calls, or in Rust an `impl` block for the new
trait. Go asks for nothing, and that is exactly why nominal languages grow
provider-side interfaces and Go does not have to.

Three consequences worth holding onto:

**The interface can be unexported and still work across the package
boundary.** `loadSaveDeleter` is lowercase, yet `docstore_test.go`, a
different package, calls `docstore.Archive(s, alpha)` and compiles. Callers
never name a parameter's type; they name a value, and the compiler checks
satisfaction at the call. An unexported interface in a parameter position
is a completely ordinary thing in Go and it keeps the concept out of your
public API, where it would otherwise be a compatibility promise you did not
mean to make.

**"Accept interfaces, return structs" now has a reason.** Accept
interfaces, because you are describing what you need and the caller
supplies anything that fits. Return structs, because the caller can define
whatever interface it wants over your concrete type later, without your
cooperation, so returning an interface only takes options away. (That is
the same principle the `iface` linter's `opaque` check enforces in the
getters-and-factories exercise.)

**Define the interface at the point of use, not in advance.** You do not
need to predict which abstractions will be useful. When a second
implementation shows up, or a consumer needs something narrower, the
interface is one declaration next to the function that needs it, and every
existing type is retroactively eligible.

## 3. What the fat interface did to the tests

This is the part that makes the design error concrete, and it is already
sitting in the suite. `TestArchiveKeepsOriginalWhenSaveFails` needs one
thing: a store whose `Save` fails. Here is what the starter forced the
suite to write:

```go
type downStore struct {
	*docstore.MemStore
	failSave   bool
	failDelete bool
}
```

The embedded `*MemStore` is not there because the test wants a working
store inside its fake. It is there because `Archive` demands a `Storage`,
`Storage` demands eight methods, and embedding is the cheapest way to
conjure six methods the test will never call. Embedding is a real Go
feature and this is a legitimate use of it, but notice what it costs: the
fake is now entangled with a real implementation. Its `Delete` failure is
simulated while its `Load` is genuine, so the test is exercising a hybrid,
and if `Storage` ever gains a ninth method the fake silently inherits a
real implementation of it rather than failing to compile.

Now try the version that does not embed. Against the reference, a
standalone three-method stub with no `MemStore` anywhere in it compiles and
runs:

```go
type stub struct{ saved string }

func (s *stub) Load(string) (docstore.Document, error) { ... }
func (s *stub) Save(key string, _ docstore.Document) error { ... }
func (s *stub) Delete(string) error { return errors.New("boom") }
```

Point the same file at the starter and the compiler explains the whole
lesson in one line:

```
cannot use f (variable of type *stub) as docstore.Storage value in argument
to docstore.Archive: *stub does not implement docstore.Storage (missing
method Health)
```

`Health`. A fake for a function that calls three methods cannot compile
until it also produces a health check, a stats report, a snapshot, and a
restore. That is the bloated interface's real bill, and it is charged to
every test, every mock, and every alternative backend anyone ever writes.

## 4. Errors relayed naked through the plumbing

```
docstore.go:29:10: error returned from interface method should be wrapped:
  sig: func (gopath.dev/labs/idioms/interface-bloat.Storage).Load(key string)
  (gopath.dev/labs/idioms/interface-bloat.Document, error) (wrapcheck)
```

Five of those, one per naked `return err`: lines 29 and 44 for `Load`, 32
for `Save`, 34 and 60 for `Delete`. They differ only in the method named in
`sig:`, so the other four are left off here for width.

Read what `wrapcheck` is actually pointing at: the signature of the
*interface* method. That is deliberate. An error crossing
an interface boundary is the case where naked relaying hurts most, because
the interface is precisely the place where you do not know who produced the
error. `MemStore.Load` returns `load "notes/x": document not found`, which
happens to be informative. The next implementation might return `EOF`, or
`connection reset by peer`, or a bare `context.DeadlineExceeded`, and
`Archive` will hand that up untouched to a caller who now knows a deadline
expired somewhere in the program.

The starter's `Archive` also relays three different failures
indistinguishably. Load failed, save failed, and delete failed all arrive
at the caller looking the same, and only one of the three leaves the store
in an odd state. The reference says which:

```go
return fmt.Errorf("archive %q: load: %w", key, err)
return fmt.Errorf("archive %q: save copy: %w", key, err)
return fmt.Errorf("archive %q: delete original: %w", key, err)
```

Three costs, all small. One `fmt.Errorf` per return, `%w` so
`errors.Is(err, ErrNotFound)` still reaches the sentinel through the wrap
(the suite depends on exactly this in `TestArchiveMissing`), and the key
named once per site so an operator reading a log gets the document and the
step without opening the source.

Note that `Purge` keeps `return removed, fmt.Errorf(...)`: the count stays
meaningful on the error path, so the caller learns both that it failed and
how far it got. Wrapping does not mean discarding your other return values.

## A note on the count

Six issues, and they do not fall in a straight line. The two linters here
are measuring independent axes, so fixing one does nothing for the other:
adopt the three small interfaces and delete `Storage`, and `wrapcheck` is
still sitting on all five naked returns, because a naked return is a naked
return no matter how many methods the interface has.

Worse, the natural first move raises the count. Declare the small
interfaces before you have switched any signature over to them, which is
how most people would do it, and:

```
golangci-lint run    # 6 issues -> 9 issues
```

`unused` adds one finding per interface nobody references yet, and
`interfacebloat` is still there because `Storage` still is. Nothing went
wrong; you are mid-edit and the linter is describing the mid-edit state
accurately. Judge by what is left in the file, not by the number.

## The reference, structurally

`solution.go` is 80 lines against the starter's 65. The three function
bodies are nearly identical to what they were, `memstore.go` is untouched,
and the additions are three small interface declarations and five error
wraps. `Storage` is gone entirely: no type in the reference lists more than
three methods, and the exported surface of the package lost a name it never
should have exported.

What actually shrank is not lines, it is obligation. An implementation owed
`Archive` eight methods and now owes three. It owed `Summarize` eight and
now owes two. That number is the one that decides whether anyone can write
a second backend, a fake, a decorator, or a metrics wrapper without
dragging the whole store along.

## The smell the linter cannot see: `Archive` can leave two copies

The doc comment tells you half of it, and the half it tells is true:

```go
// Archive moves the document at key under the archive/ prefix: the copy
// is written first, so a failure can lose the operation but never the
// document.
```

The document is never lost. What it does not say is that the document can
end up in two places at once. `Archive` is save-then-delete against a store
with no transaction, so when the delete fails the copy has already
committed. See it for yourself: add one line to the end of
`TestArchiveReportsFailedDelete`,

```go
t.Logf("keys after a failed archive: %v", d.Keys())
```

then `go test -v -run TestArchiveReportsFailedDelete ./...`:

```
keys after a failed archive: [archive/notes/alpha notes/alpha]
```

The suite pins this. `TestArchiveReportsFailedDelete` asserts that the
archived copy exists after a failed delete, which means the duplicate is
not a bug that slipped through, it is behavior somebody decided on and then
under-documented. Run it against the reference and you get the same two
keys, because the reference does not fix this either. It reports it better
(`archive %q: delete original`), and better reporting is what a caller
needs to compensate, but the operation is still not atomic.

No linter will ever find this. It requires knowing that "move" implies
exactly-one-copy, that the store has no transaction, and that nobody
compensates on the error path. The fix, if this were production, is either
a store that can do both writes atomically or an idempotent archive that a
retry can safely re-run, and either way it is a design conversation, not a
finding.

A second one in the same family, and it gets *more* dangerous after the
refactor, which is worth sitting with. `Summarize` calls `Keys()` and then
`Load()` on every key, and treats a failed load as a failure of the whole
summary. Against `MemStore` that assumption holds, because nothing can
change between the two calls. But the entire point of `loadLister` is that
other implementations are now welcome, and a store backed by a network, a
file system, or another goroutine can absolutely lose a key between the
listing and the read. Making an interface smaller widens the set of types
that can satisfy it, which means your implicit assumptions about the
implementation quietly become contract debt. Consumer-defined interfaces
are the right call, and they oblige you to write down what you actually
require of anything that fits.

## What this trained

- Implicit satisfaction as the language feature underneath every Go
  interface rule: no `implements`, satisfaction checked at the assignment,
  so the consumer can define the interface and existing types qualify
  retroactively.
- Provider-side interfaces as an inventory of an implementation, versus
  consumer-side interfaces as a statement of a requirement.
- Unexported interfaces in parameter positions, and why "accept
  interfaces, return structs" follows from implicit satisfaction rather
  than from taste.
- What a fat interface costs a test suite: a fake that owes eight methods
  to exercise one, and the embedding trick people reach for to pay it.
- `wrapcheck` on interface method calls, and why the interface boundary is
  where naked error relaying hurts most.
- Non-atomic multi-step operations and implementation assumptions baked
  into a consumer, neither of which any linter can see, and the second of
  which the refactor itself makes more consequential.
