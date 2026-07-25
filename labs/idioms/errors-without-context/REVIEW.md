# Review: errors-without-context

This is the review a senior Go engineer would leave on the starter, finding
by finding. Read it after your own run is green, and compare what you did
against the reasoning, not just the shapes.

The accent first, because this one is not imported from a single language.
It is imported from every language that propagates failures with
exceptions. In Java, Python, C#, Ruby or JavaScript you do not decide
anything at an intermediate frame: you simply do not catch, and the runtime
records the frames for you. The stack trace is the context, it is free, and
it is complete. Go made the opposite trade. An error is an ordinary value,
`if err != nil { return err }` is an ordinary return, and the original
proposal's half that would have attached frames and printed them was
dropped before Go 1.13 shipped. What landed was `%w`, `errors.Is` and
`errors.As`: a way to build a chain of causes by hand. The consequence is
blunt. In an exception language, relaying without adding anything keeps all
the information. In Go, relaying without adding anything is the moment the
information is lost, and nothing warns you, because a value was returned
and a value was returned successfully.

You can watch it happen. Give the starter a profile whose header reads
`version = one` and ask for a credential:

```
strconv.Atoi: parsing "one": invalid syntax
```

That is everything the caller gets. Not which environment, not which of the
two files, not which line, not even that this was a credential lookup.
Three functions saw that error and each one decided that adding what it
knew was somebody else's job.

## 1. The naked relay

```
credstore.go:72:15: error returned from external package is unwrapped:
  sig: func io/fs.ReadFile(fsys io/fs.FS, name string) ([]byte, error) (wrapcheck)
	return nil, err
credstore.go:84:14: ... same, in resolveSecret
credstore.go:109:15: ... same, for strconv.Atoi
```

Three sites, one habit. `wrapcheck` is not asking you to wrap for the sake
of wrapping; the rule it encodes is that an error crossing out of your
package carries the vocabulary of whatever produced it, and your caller
speaks yours. `strconv.Atoi` knows about strings and integers. It does not
know it was reading a profile header, and it never will.

The useful test at every error return is one question: **what does this
layer know that its caller does not?** Answer it, wrap that, and stop.

- `parseEntries` is the only code in the file that knows the line number.
  Nothing upstream can reconstruct it once the bytes are gone, so it wraps
  with `line %d`.
- `loadProfile` is the only code that knows which of the two files this
  was, so it wraps with `profile %s`.
- `Lookup` is the only code that knows the environment and the service.

Add up those three decisions and the same failure reads:

```
credstore prod/postgres: profile profiles/prod.conf: line 2: "postgres" is not key = value: malformed entry
```

The mirror-image mistake is wrapping with what the caller already has.
Watch where the reference does not wrap: `secretRef` returns
`ErrCredentialNotFound` bare, because the only thing it could add is the
service name and `Lookup` is about to say it. Redundant context is not
free; it is what turns real error strings into stuttering paragraphs.

One structural note. In the reference, `Lookup` is a three-line wrapper
around an unexported `lookup`, so `env` and `service` are formatted in one
place instead of once per early return. That is not decoration. Write it
the other way, with the same `fmt.Errorf("credstore %s/%s: %w", ...)` at
each of three returns, and `goconst` will tell you that a string constant
appears three times. Repetition in your wrapping is usually a sign that the
wrapping belongs one layer out.

## 2. `%v` is `%w` with the chain cut

```
credstore.go:63:68: non-wrapping format verb for fmt.Errorf.
  Use `%w` to format errors (errorlint)
credstore.go:167:59: ... same, in decodeToken
```

These two sites do add context, which makes them the dangerous ones: they
look correct. The difference between the verbs is not cosmetic and it is
not about output. `%v` calls the operand's `Error()` method and keeps the
resulting string. `%w` keeps the operand. The value `fmt.Errorf` returns in
the second case has an `Unwrap` method that hands the original error back,
which is the entire mechanism `errors.Is` and `errors.As` walk. Format with
`%v` and the two errors print identically today, while one of them has
quietly become a leaf node.

The suite pins exactly this, in
`TestMissingProfileKeepsFsErrNotExistReachable`. A missing profile has to
leave `errors.Is(err, fs.ErrNotExist)` true at the top. The starter passes
that test by luck, because it relays the `fs` error without touching it.
The instant you improve the code by adding context with `%v`, the test goes
red. That is the lesson compressed into one assertion: adding context must
not cost the caller the cause.

Since Go 1.20 you can also pass more than one `%w` to a single
`fmt.Errorf`, which the reference uses where a failure genuinely has two
answers to "why":

```go
return "", fmt.Errorf("secret %q in %s: %w: %w", name, file, ErrCorruptSecret, err)
```

`errors.Is(err, ErrCorruptSecret)` matches for the caller who wants to
branch, and `errors.As` still reaches `base64.CorruptInputError` for the
caller who wants the byte offset.

## 3. `==` on an error, and the bug already in the file

```
credstore.go:52:5: comparing with == will fail on wrapped errors.
  Use errors.Is to check for a specific error (errorlint)
credstore.go:175:9: ... same, on fs.ErrNotExist
```

`err == CredentialNotFoundError` compares two interface values, so it is
true only when the error is that exact value and nothing has wrapped it.
It is correct today and it is correct precisely until the first time
somebody does the right thing further down. `errors.Is` is the same
comparison plus a walk down the `Unwrap` chain, which is why it costs
nothing to write it from the start.

The interesting part is that this file already demonstrates the failure,
without any wrapping at all. `CredentialNotFoundError` is returned from two
places: `secretRef`, when the profile does not list the service, and
`resolveSecret`, when the secrets file does not hold the secret. `Lookup`
compares against only the first one. Run both:

```
No credential named mailer.
could not load the credential: The credential was not found.
```

One cause, two unrelated messages, because the identity check caught one
path and not the other. Identity comparisons do not scale with the number
of places a sentinel can come from. `errors.Is` does.

## 4. `errors.New(fmt.Sprintf(...))`

```
credstore.go:53:20: errorf: should replace errors.New(fmt.Sprintf(...))
  with fmt.Errorf(...) (revive)
credstore.go:61:21: ... and 82:15
```

The mechanical fix is three characters of net change, and it is the least
interesting thing on this line. Look at what line 53 actually does:

```go
ref, err := secretRef(entries, service)
if err == CredentialNotFoundError {
	return Secret{}, errors.New(fmt.Sprintf("No credential named %s.", service))
}
```

It receives a sentinel, and returns prose. Every caller that wanted to
write `errors.Is(err, ErrCredentialNotFound)` now has to write
`strings.Contains(err.Error(), "No credential named")` instead, and that
caller will be wrong the first time somebody improves the wording. A
sentinel is the machine-readable half of an error, and this function throws
it away in order to add the human-readable half. `fmt.Errorf` with `%w`
exists so you never have to choose.

## 5. Names and messages

```
credstore.go:18:5: error-naming: error var CredentialNotFoundError
  should have name of the form ErrFoo (revive)
credstore.go:105:26: error-strings: error strings should not be
  capitalized or end with punctuation or a newline (revive)
```

`CredentialNotFoundError` is `FooException` word order. Go sentinels read
`ErrCredentialNotFound`, and the prefix earns its place: it sorts the
package's sentinels together in godoc, it greps, and
`errors.Is(err, credstore.ErrCredentialNotFound)` reads as a sentence.

The casing rule is about composition, not taste. `"Malformed entry!"` was
written to stand alone, and it will almost never stand alone:

```
credstore prod/postgres: profile profiles/prod.conf: line 2: Malformed entry!
```

Lower case with no trailing punctuation composes from either side, which is
the only property an error string needs.

Try the rename as a find-and-replace and watch the count. Both
`error-naming` findings disappear and the run still reports 14 issues,
because golangci-lint prints one finding per line and `error-strings` was
queued behind `error-naming` on those same two lines the whole time. This
exercise does not have a mechanical exit.

## 6. The assertion that panics

```
credstore.go:174:13: type assertion on error will fail on wrapped errors.
  Use errors.As to check for specific errors (errorlint)
```

```go
func isMissing(err error) bool {
	pathErr := err.(*fs.PathError)
	return pathErr.Err == fs.ErrNotExist
}
```

Two failures in three lines. The assertion has no comma-ok, so any error
that is not exactly `*fs.PathError` panics: an `fs.FS` implementation is
free to return whatever it likes, and this one has decided that a wrong
guess about somebody else's error type should take the process down. And
even when the assertion succeeds it only ever looks one level deep, so a
`*fs.PathError` that has been wrapped once slips past.

`errors.As` is the version of this that neither panics nor stops at the
top:

```go
var pathErr *fs.PathError
if errors.As(err, &pathErr) { ... }
```

Here the whole helper turns out to be unnecessary. `errors.Is(err,
fs.ErrNotExist)` answers the actual question, and in the reference even
that call disappears, because once `resolveSecret` wraps with `%w` the
caller can ask `errors.Is` directly and the package does not need an
opinion.

Worth knowing when you read CI output: `forcetypeassert` has a finding on
this line too (`type assertion must be checked`), and you will never see
it, because golangci-lint reports one issue per line by default and
`errorlint` got there first. A line with no findings left is not the same
as a line that was only ever wrong once.

## 7. Two the linter cannot see

**The string match.** This is the worst line in the file and no linter says
a word about it:

```go
if strings.Contains(err.Error(), "illegal base64") {
	return Secret{}, errors.New(fmt.Sprintf("The secret for %s is corrupt.", service))
}
```

That is a control-flow decision keyed to the prose of
`base64.CorruptInputError.Error()`. `encoding/base64` never promised that
wording, so it can be reworded in any release, and when it is, this branch
goes quiet: no compile error, no test failure, just a credential that
silently reports the wrong reason forever. This is what sentinels and
`errors.As` are for. Decide at the point of failure, where you still have
the typed error, and wrap the decision into the value:
`fmt.Errorf("...: %w: %w", ErrCorruptSecret, err)`. Then callers match on
your sentinel, which you do promise.

**The missing contract.** The starter exports two sentinels and returns
them from some paths and not others, and never says which. That is not a
formatting problem, it is an undocumented API. What can a caller of
`Lookup` match on? Read the starter and the honest answer is "read the
source, then read it again next release". The reference commits, in the
doc comment on the exported method:

```go
// Every error it returns names the environment and the service, and wraps
// a cause: match it with errors.Is against the sentinels above, or against
// fs.ErrNotExist when a file is the thing that was missing.
```

Your error contract is API surface, as much as your function signatures
are, and it is the part of the API that neither the compiler nor the
linter will keep honest. Only a doc comment and a test will, which is why
the suite has exactly one `errors.Is` assertion in it.

## The reference, structurally

Four sentinels instead of two, because two of the failure modes had no
sentinel at all and were reachable only as prose. `Lookup` is a wrapper
that adds `env` and `service` once and delegates. Below it, each layer adds
one fact and only if it owns that fact: `parseEntries` adds the line
number, `loadProfile` and `resolveSecret` add the file, `secretRef` adds
nothing. `isMissing` is deleted.

One deliberate asymmetry to notice. The reference wraps the `base64` error
with `%w` and drops the `strconv` one:

```go
version, err := strconv.Atoi(raw)
if err != nil {
	return nil, fmt.Errorf("%s header %q: %w", versionKey, raw, ErrUnsupportedVersion)
}
```

Preserving a cause is a decision, not a rule. `strconv`'s error would say
that `"one"` is not a number, and the message already quotes `"one"`;
nothing a caller could act on is lost. The base64 error carries a byte
offset that nothing else in the chain has, so it stays. Wrap what a caller
could use.

## What this trained

- Wrapping as a per-layer decision (what do I know that my caller does
  not) rather than a reflex in either direction.
- `%w` versus `%v`, the `Unwrap` chain, multiple `%w` since Go 1.20, and a
  test that pins the chain instead of the message.
- `errors.Is` and `errors.As` versus `==` and a bare type assertion,
  including the panic the assertion hides.
- `ErrXxx` sentinels, lower-case composable messages, and why
  `errors.New(fmt.Sprintf(...))` loses more than style points.
- Two smells no linter reports: branching on another package's error text,
  and shipping an exported API without a stated error contract.
