# Review: getters-and-factories

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. Java's ceremony exists because of Java's constraints:
interfaces must be declared by the implementing class, fields cannot
satisfy an interface, and changing a public field to a method breaks every
caller, so you defensively wrap fields in accessors on day one. Go removed
those constraints. Interfaces are satisfied implicitly, the unit of
encapsulation is the package rather than the class, and inside a package
there is nothing to defend a field from. Ceremony that was load-bearing in
Java is pure weight here. The refactor below deletes about a quarter of the
file, and nothing of value goes with it.

## 1. The interface nobody asked for

```go
type BookRecord interface {
    GetTitle() string
    GetAuthor() string
    IsCheckedOut() bool
    SetCheckedOut(checkedOut bool)
}

func NewBook(title, author string) BookRecord {
```

The linter's line:

```
opaque: 'NewBook' function return 'BookRecord' interface at the 1st result,
abstract a single concrete implementation of '*book' (iface)
```

`BookRecord` has exactly one implementation and exactly one consumer, and
both live in this file. In Java the interface would be the seam that makes
`Catalog` testable; in Go the seam does not need to exist before a second
implementation does, because any future interface is satisfied
retroactively. Define an interface when a consumer needs to accept more
than one concrete type. That day may come (an on-disk catalog, a fake for
someone else's tests), and on that day the interface costs one declaration
at the point of use. Today it costs indirection on every access: a
`BookRecord` value is two words (type, pointer), every call is dispatched
through a method table, and the compiler is denied the trivial inlining it
would do on a struct field read.

Consumer-defined interfaces are also why the factory has nothing to
return. `NewBook` exists to launder `*book` into `BookRecord`; delete the
interface and the function is a struct literal. The reference keeps no
constructor for `book` at all, because only `Catalog.Add` builds one:

```go
c.books[title] = &book{author: author}
```

`CatalogBookFactory` goes with it, and takes the stutter warning
(`catalog.CatalogBookFactory`) along. Package name plus type name is one
sentence in Go; write the sentence once.

## 2. Getters and setters

No single linter line says "delete your getters", and that is worth
noticing: the linter enforces the mechanical consequences (receiver names,
dead fields, the interface) while the design call stays yours. Here is the
call. `book` is owned by `Catalog`. Its fields are unexported, so nothing
outside the package can see them, accessor or not. The only code the
accessors protect `book` from is `Catalog`, its one legitimate reader. So

```go
if b.IsCheckedOut() { ... }
b.SetCheckedOut(true)
```

is this, wearing a costume:

```go
if b.checkedOut { ... }
b.checkedOut = true
```

Effective Go's position is not "never write accessors", it is that
accessors are for package boundaries, and when you do write one the getter
is `Title()`, never `GetTitle()`. The `Get` prefix earns its keep in Java
because tooling and JavaBeans conventions key on it. In Go it is noise on
the call site.

If you kept a `book` type with exported fields instead of unexported ones,
that is also a defensible refactor inside a package this small. What is not
defensible is fields plus a full accessor suite: two ways to say the same
thing, one of them longer.

## 3. Receivers: `this`, and the pointer/value mix

```
receiver-naming: don't use generic names such as "this" or "self" (revive)
ST1016: methods on the same type should have the same receiver name (staticcheck)
the methods of "book" use pointer receiver and non-pointer receiver. (recvcheck)
```

A receiver is a parameter, not a keyword. The convention is a one or two
letter echo of the type (`b *book`), and the same letter on every method,
because the receiver name is the first word of every method body you will
read in this type. `this` imports a semantic that is false in Go: in Java
`this` is always a reference to the object; a Go value receiver is a copy.
Which is the second finding. `GetAuthor` takes `book` by value while its
siblings take `*book`. Call `SetCheckedOut` on a value receiver and you
set a field on a copy that is discarded at return; the program compiles
and the update silently vanishes. The rule that prevents the bug class: if
any method needs a pointer, every method takes a pointer.

## 4. Errors are values with a naming convention

```
error-naming: error var BookNotFoundError should have name of the form ErrFoo (revive)
error-strings: error strings should not be capitalized or end with punctuation (revive)
```

`BookNotFoundError` is Java's `FooException` order. Go sentinels are
`ErrNotFound`, and the prefix is load-bearing: callers grep for `Err`, and
`errors.Is(err, catalog.ErrNotFound)` reads as a sentence. The message
casing rule is about composition, not taste. Error strings get wrapped:

```
checkout "Hild": The requested book was not found.
```

That capital and full stop were written for a sentence standing alone, and
this string will almost never stand alone. Lower-case, no punctuation,
composes from either side. The reference goes one step further and wraps
with context at the point of failure:

```go
return fmt.Errorf("checkout %q: %w", title, ErrCheckedOut)
```

so a caller three layers up still sees which title failed, and
`errors.Is` still matches the sentinel through `%w`.

## 5. Dead ceremony, and the one the linter missed

`unused` caught `timesOut`, a field written by nobody and read by nobody,
kept because a Java `Book` felt underdressed without bookkeeping. It did
not catch `reset()`: methods on a live type are given the benefit of the
doubt, since something could be calling them through an interface. Uncalled
ceremony survives mechanical review all the time. The linter is a floor,
not a ceiling; the last pass over a refactor is you, reading each method
and asking who calls it.

## The reference, structurally

`solution.go` is one struct with two fields, one map, five methods, four
sentinels. The books live in `map[string]*book` keyed by title, which
deletes the linear scans along with the ceremony. Nothing abstracts
`book`, because nothing needed it abstracted: it is a row of data owned by
one type in one package.

One more thing worth stealing: the test suite never called `GetTitle`,
`NewBook`, or the factory. It drives behavior (`Add`, `Checkout`,
`Available`) and asserts observable outcomes. That is what made this
refactor safe to do at all. Tests that pin structure make refactoring a
test-rewriting exercise; tests that pin behavior make it a lint loop.

## What this trained

- Interface-per-struct and factory indirection: deleted, with the
  reasoning for when an interface earns its declaration.
- Getter/setter suites inside a package boundary: replaced by fields.
- `this` receivers, inconsistent receiver names, mixed pointer/value
  receiver sets.
- `XxxError` naming and sentence-case error strings, versus `ErrXxx`
  sentinels, composable messages, and `%w` wrapping.
- Dead ceremony, including the kind `unused` cannot prove dead.
