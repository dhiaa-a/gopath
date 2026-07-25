# package-sprawl

**Accent: any language with a package-per-layer convention.** Java and
Python are the usual sources, but Ruby, C# and PHP teach the same reflex.
This module works and its tests pass. It is also four packages doing the
work of one:

```
snippets.go        the "service" layer
model/             the entity
util/              the string helpers
validate/          the checks
```

150 lines of snippet manager, filed into folders before a single line of it
was hard to find. The names tell you where the habit came from:
`model.ModelSnippet`, `util.UtilTruncate`, `validate.ValidateSnippet`.

The exact mistakes this exercise trains against:

1. Layers as packages: `model`, `util`, `validate`, service. A directory
   layout imported from a language where the compilation unit is the class
   and packages are just namespaces.
2. Names that stutter, because a package qualifier the author never
   pictured now sits in front of every call: `util.UtilTruncate`.
3. Exports that exist only to cross a boundary. `MaxBodyRunes`,
   `ValidateID` and `UtilFirstLine` are public API in this module. Nothing
   outside the module has ever called one.
4. An interface added before anything needed it (`model.SnippetStore`),
   which is a boundary too.
5. Error plumbing that only exists because the boundary exists: every
   validation failure now crosses a package line, and the linter wants it
   wrapped on the way through.

## The loop

From this directory:

```
go test ./...        # green now, must stay green
golangci-lint run    # 9 issues now, must reach zero
```

The refactor is a collapse: **`model`, `util` and `validate` become one
package with `snippets.go`.** Delete the three directories, keep the
behavior. Watch what happens to the names on the way. `ModelSnippet` has
nothing left to disambiguate itself from, so it is `Snippet`.
`UtilTruncate` has one caller in the same file, so it is `truncate`, and
unexported. `ValidateSnippet` takes a snippet and answers a question about
it, so it is a method. None of that is a naming exercise: the stutter is a
symptom, and deleting the boundary is the cure.

The suite pins behavior through the root package's public surface
(`NewStore`, `Add`, `Get`, `Preview`, `List`, and the four `Err` sentinels).
It never mentions `model`, `util` or `validate`, so nothing behind that
surface is protected. Expect the line count to drop by about a third once
the plumbing goes.

Read the note at the top of each `doc.go` before you delete a directory:
those files are build machinery, not accent.

Needs golangci-lint v2 (see ../README.md for the pinned install). The
config is shared by every idiom exercise and lives at `../.golangci.yml`.

## One warning about the linter, specific to this exercise

You can drive `golangci-lint run` to zero **without deleting a single
package.** Rename the stuttering symbols, delete the unused interface, wrap
the two errors that cross a boundary, and the run comes up clean with all
four directories still standing. The tests stay green too.

That is not a bug in the exercise, it is the exercise. No linter can tell
you that a package should not exist. Reach zero the honest way first, by
collapsing, and then read `REVIEW.md`, which walks the dishonest way in
detail and shows you what it leaves behind.

## When you are done

`REVIEW.md` walks the same refactor the way a senior Go reviewer would
comment it, smell by smell, including the ones the linter cannot see. Read
it after your run is green, or when you are stuck on what a finding means.

To compare against the reference afterward: `go test -tags solution ./...`
runs the same suite against `solution.go`, and `golangci-lint run
--build-tags solution` shows it is lint-clean.
