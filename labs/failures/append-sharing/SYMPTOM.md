# Symptom

> Reported by: platform channel, after the flag refactor landed
>
> Dev deploys went quiet: no verbose logging anywhere since Tuesday.
> `launchcfg --dry-run` shows dev running with prod's flag:
>
> ```
> dev flags:  [--log-level=info --region=eu-west-1 --retries=3 --timeout=30s --quiet]
> prod flags: [--log-level=info --region=eu-west-1 --retries=3 --timeout=30s --quiet]
> ```
>
> `devFlags` is built once and never assigned again. Now the part I refuse
> to believe until someone explains it: delete the `prodFlags` line, which
> runs *after* `devFlags` already exists, and dev comes out correct with
> `--verbose`. A later line is editing an earlier variable. No goroutines,
> exit code 0, identical result on every run.

## Reproduce

From this directory:

```
go run .
```

Deterministic every time. Deleting the `prodFlags` line really does
"fix" dev; putting it back breaks dev again. The bug travels backwards
through the source, or seems to.

## Before you open the site page

Try to answer from the source and the output alone:

1. `devFlags` is never assigned after its `append`. What memory could a
   later `append(base, ...)` possibly write to that `devFlags` can see?
2. `append` sometimes returns a slice of a brand-new array and sometimes
   does not. What single number decides which? What is that number here?
3. Both profiles end up with `len` 5. Where in memory is each one's
   element 4?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/append-sharing
