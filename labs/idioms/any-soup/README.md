# any-soup

**Accent: Any language.** This package works and its tests pass. It is also
not Go: it is a Python dict, a JavaScript object, a Java `Map<String,
Object>` transliterated into Go syntax. One map holds every shape the
package knows about, and the schema that says which shape lives behind
which key is a comment.

The exact mistakes this exercise trains against:

1. `map[string]interface{}` as a type-system escape hatch: sample lists,
   running totals, and metadata maps all crammed into one map value type.
2. Naked type assertions with no comma-ok (`v.(float64)`,
   `v.([]interface{})`), each one a panic you did not write.
3. Structure the compiler cannot see and cannot defend: the schema is a
   key-naming convention (`"s"`, `"s.total"`, `"s.meta"`) that exists only
   in the heads of the writers.
4. Renaming `interface{}` to `any` and calling that a fix.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 7 issues now, must reach zero
```

Refactor `metrics.go` until both are true at once. The suite pins behavior
through the public surface (`New`, `Record`, `Total`, `Count`, `Max`,
`Rename`, `SetUnit`, `Unit`, `Names`) and never looks at the storage
underneath, so everything behind that surface is yours to reshape. Expect
the shape to change more than the line count: in the reference the `const`
block of key suffixes is gone entirely, `Rename` is two map operations
instead of six, and `Names` is one line.

### A warning about the count

Three of the seven findings are `revive`'s `use-any`. Find-and-replace
`interface{}` with `any` and the count drops to 4, the tests stay green,
and you have changed nothing: the map still holds four different shapes,
the schema is still a naming convention, and the assertions can still
panic. `any` **is** `interface{}`, an alias declared in the universe block,
not a different type. If your count fell to 4 in ten seconds, you have not
started yet. That is mistake 4 on the list above, and it is on the list
because it is the comfortable place to stop.

The remaining four are `forcetypeassert`, and they are the real work. They
will not go away by being spelled differently.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including one smell the linter cannot see. Read
it after your run is green, or when you are stuck on what a finding means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
