# Review: package-sprawl

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first. Splitting a program into `model`, `util` and `validate`
is not a mistake in the language it came from, it is free. In Java the unit
of encapsulation is the class: `private` hides a field from every other
class, including classes sitting in the same package, so moving a class
into a new package costs you no privacy at all. Packages are folders with
namespaces attached, and organizing by layer is the default advice in most
Java and Python projects because it costs nothing to undo. In Python it is
cheaper still: nothing is private, a module is a file, and
`from myapp.validate import validate_snippet` is one line.

Go priced it differently. The package is the unit of encapsulation *and*
the unit of naming, and both halves of that bill land in this module.

The encapsulation half: an identifier is visible outside its package only
if it is exported, and exported means public, to everyone, at every version
you ship afterwards. So every boundary you draw converts some private
detail into public API. `MaxBodyRunes` is a number this program made up.
`UtilFirstLine` is four lines of string handling. Both are public API of
`gopath.dev/labs/idioms/package-sprawl` right now, and the only reason is
that somebody put them behind a directory wall and then needed them on the
other side.

The naming half: the package qualifier is part of every call site. Nobody
inside `util` reads `UtilTruncate` and hears a stutter. The people who hear
it are in another file typing `util.UtilTruncate(...)`, which is the only
place the name is ever spoken in full. Effective Go's own example is that
the buffered reader in `bufio` is `Reader` and not `BufReader`, because the
reader you actually see is `bufio.Reader`. The package name is the first
half of the name.

Six findings in this module are that second half arriving.

## 1. The stutter, and why renaming does not fix it

```
model/model.go:11:6: exported: type name will be used as model.ModelSnippet
  by other packages, and that stutters; consider calling this Snippet (revive)
util/util.go:11:6:  ... util.UtilFirstLine  ... consider calling this FirstLine
util/util.go:18:6:  ... util.UtilTruncate   ... consider calling this Truncate
util/util.go:26:6:  ... util.UtilWordCount  ... consider calling this WordCount
validate/validate.go:26:6: ... validate.ValidateID ... consider calling this ID
validate/validate.go:38:6: ... validate.ValidateSnippet ... consider calling this Snippet
```

Six findings, one habit, and `revive` is telling you to delete a prefix.
Do exactly that and the six go away. The tests stay green. The module still
has four packages.

So look harder at the two suggestions at the bottom of that list, because
they are the exercise. `revive` wants `ValidateID` to be called `ID`. The
call site becomes:

```go
if err := validate.ID(id); err != nil {
```

Read that out loud. `validate.ID` is a noun phrase. It looks like an
identifier belonging to the validate package, not a function that checks
one, and the next reader has to open the file to find out which. Its
sibling gets worse: `ValidateSnippet` becomes `validate.Snippet`, which now
reads exactly like a type. The good name and the non-stuttering name are
different names, and no third option is hiding.

That is what a premature boundary does to vocabulary. `validate` is a verb
used as a package name, so everything inside it either repeats the verb or
loses it. There is no arrangement of these symbols that reads well while
the directory exists, and there is exactly one that reads well after it
does not:

```go
if err := snip.valid(); err != nil {
```

The stutter was never a naming problem. Renaming is what you do when you
have decided to keep the boundary, and keeping the boundary is the thing
under review.

## 2. Exports that exist only to cross a wall

Three symbols in this module are exported for one reason: something on the
other side of a directory needs them.

- `model.MaxBodyRunes`, because `validate` enforces it.
- `validate.ValidateID`, because the service layer calls it directly from
  `Get`.
- `util.UtilFirstLine` and `util.UtilTruncate`, because `Preview` calls
  them.

In the reference every one of these is unexported, and not because
unexported is tidier. An exported identifier is a promise. It shows up in
godoc, it is what someone's `go get` pins, and the compiler will not tell
you when you break it. This module currently promises the world that it
will keep computing word counts and truncating strings on request, and it
made that promise by accident, as a side effect of a folder.

Go's answer is that the package boundary is where you *want* that
conversion to happen, which is why the boundary should sit where a real
consumer sits. Inside one package there is no wall, so `truncate`,
`firstLine` and `validID` stay private, and you may change or delete them
this afternoon.

## 3. The dead function the linter could only insult by name

`UtilWordCount` is called by nothing. Not by `snippets.go`, not by the
tests, not by anything in this module or outside it. It is what `util`
packages fill up with.

Here is the linter's entire opinion of it:

```
util/util.go:26:6: exported: func name will be used as util.UtilWordCount
  by other packages, and that stutters; consider calling this WordCount (revive)
```

The name. Not one word about the function being dead, because `unused` has
no opinion here at all: `UtilWordCount` is exported, and an exported
function might have callers the analysis will never see. Rename it to
`WordCount` and the whole run goes silent with the corpse still in the
file.

Now move the same function into the collapsed package as `wordCount` and
run again:

```
func wordCount is unused (unused)
```

Same code, same linter, same config. The difference is that it stopped
being public API. This is the part of package sprawl that costs you
something every day rather than once: every boundary you draw is a region
your dead-code analysis, and your compiler, and your IDE's rename, all stop
being able to reason about. Splitting a program into layers does not just
add directories, it blinds your tools.

## 4. A boundary drawn in advance

```
model/model.go:19:6: unused: interface 'SnippetStore' is declared but not
  used within the package (iface)
```

```go
// SnippetStore is the storage contract the service layer satisfies. It is
// declared next to the entity so a future HTTP or CLI layer can depend on
// the model package and nothing else.
type SnippetStore interface { ... }
```

Read the comment: every word of it is about a program that does not exist.
An interface is a boundary, and this one was drawn for the same reason the
directories were, which is that boundaries feel like architecture.

In a language where interfaces must be declared by their implementers, you
have to guess early: if `Store` does not say `implements SnippetStore`
today, no consumer can accept it tomorrow without editing `Store`. Go
deleted that constraint. Interface satisfaction is structural and
retroactive, so the HTTP layer that shows up next year can declare the
three methods it actually uses, in its own package, next to the code that
consumes them, and `*Store` will satisfy it without knowing the interface
exists. Which means the correct time to write this interface is the day a
second implementation or a second consumer appears, and the correct place
is that consumer.

Delete it. The refactor loses nothing, because there was nothing there.

## 5. The error tax

```
snippets.go:52:10: error returned from external package is unwrapped:
  sig: func validate.ValidateSnippet(s model.ModelSnippet) error (wrapcheck)
        return err
snippets.go:64:14: ... same, for validate.ValidateID
```

`wrapcheck` is right on its own terms. An error crossing into your package
from someone else's arrives in their vocabulary, and relaying it silently
is how a caller ends up holding a message with no idea which of your
functions produced it. The `errors-without-context` exercise is entirely
about paying that correctly.

So pay it here and watch what you get:

```go
if err := validate.ValidateSnippet(m); err != nil {
    return fmt.Errorf("add %q: %w", id, err)
}
```

What did the caller learn? They called `Add(id, body)`. They already had
the id, in a variable, on the previous line. The validate package already
said which rule failed and why. The wrap adds a word the caller typed
themselves.

That is the tell. Wrapping is worth its keep when a layer knows something
the layer above cannot reconstruct: a line number, a filename, which of two
files this was. These "layers" all know the same three facts, because they
were carved out of one function, and a boundary between two pieces of code
that share all of their context is not a boundary. It is a wall through the
middle of a room. `wrapcheck` cannot tell the difference between a real
boundary and a decorative one, so it charges you for both, and the finding
you should read here is not "wrap this" but "why is this crossing anything".

In the reference, `Add` calls `snip.valid()` and returns the error bare.
The linter has no opinion, because there is no boundary to cross.

## 6. Two things the linter cannot see

**You can reach zero without deleting a package.** Try it before you
believe it. Rename the six stuttering symbols, which is genuinely a
find-and-replace and takes the whole `revive` column with it. Delete
`SnippetStore`. Wrap the two errors. Three edits, and:

```
0 issues.
```

with `model/`, `util/` and `validate/` still on disk, still exporting a
snippet type and a truncation helper to the world, still turning every
validation failure into a cross-package error. Green tests too.

That run is the most useful thing in this exercise. Every linter finding
you just cleared was a *symptom* of the sprawl, and symptoms can be treated
one at a time. No linter has an opinion about how many packages a program
should have, and none ever will, because that judgment needs to know what
the program is for. Mechanical review is a floor. The number of packages in
your repository is decided above it, by somebody reading.

**`util` is not a package name.** Nothing in the config will ever say so.
A Go package is supposed to name a purpose, so that the qualifier at the
call site carries meaning: `http.Get`, `strconv.Atoi`, `sort.Slice`. Name
one after a *category of code* instead, and the qualifier stops carrying
anything, which is exactly why `util.UtilTruncate` needed the prefix
repeated to be readable. `util`, `common`, `helpers`, `shared` and `misc`
share one property: nobody can tell you what does not belong in them, so
everything ends up there, and the package grows until it imports half the
repository and cannot be imported by any of it. The standard library has no
`util`. It has `strings`, `strconv`, `sort`, `slices`, `maps`: every one of
them named for what it is about.

## The reference, structurally

One package, one file, four sentinel errors, one struct with two fields,
one `Store`, three unexported helpers and one unexported method. The
starter's 188 lines of Go become 133, and the deletions are almost all
plumbing: three package clauses, three import blocks, the re-export block
that existed so callers would not have to import `validate`, the interface,
the dead helper.

Two details worth stealing.

`Snippet` stayed exported and `valid` did not. That pairing is the whole
lesson in miniature: the type is the noun this package is about and belongs
in its documentation, while the checking is internal policy that callers
reach through `Add`. Before the collapse you did not get to make that
choice, because everything `snippets.go` touched had to be public for
mechanical reasons. Unexporting `Snippet` as well is a defensible call, as
nothing outside the package can obtain one today.

`truncate` lost its `width` parameter. In `util` it needed one, because a
package of general helpers cannot know your preview width. In a package
that owns `previewWidth`, the parameter is a knob with one setting, and
every call site has to repeat a constant that was never in question.
Generality is what you write when you do not know the caller. The collapse
is the moment you find out you were the caller all along.

## What this trained

- The two prices Go puts on a package boundary: everything crossing it must
  be exported, and the package name is glued to the front of every name
  inside.
- Stutter as a symptom rather than a naming bug, including the case where
  the non-stuttering name is the worse name and the honest fix is deleting
  the package.
- What exporting costs when nothing outside needs it, including the way it
  hides dead code from `unused` and blinds the rest of your tooling.
- Interfaces as boundaries, why Go's structural satisfaction means you can
  wait, and where the interface belongs when it finally earns itself.
- Error wrapping as evidence: if you cannot name what your layer adds, the
  layer is the thing to question.
- The limit of mechanical review, demonstrated rather than asserted: a
  lint-clean, test-green version of this module that is still wrong.
