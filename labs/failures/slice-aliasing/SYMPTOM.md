# Symptom

> Reported by: compliance review, week 29 audit
>
> The permanent archive is corrupted. Archive entries are required to be
> stored verbatim, but the last export went in masked:
>
> ```
> archived original: [user=*** action=login ip=*** user=*** action=export ip=*** user=*** action=delete ip=***]
> ```
>
> The renderer does the right things in the right order: it redacts a copy
> for the support dashboard, then archives the original `entries` variable,
> which is never reassigned anywhere. `redact` even returns its own slice
> and we keep that in a separate variable. There is no concurrency, no
> error, and the exit code is 0. It corrupts identically on every run and
> every machine.

## Reproduce

From this directory:

```
go run .
```

The dashboard block is supposed to be masked, and is. The archive line is
supposed to be verbatim, and is not. The output never varies: whatever
this is, it is not timing.

## Before you open the site page

Try to answer from the source and the output alone:

1. The archive line prints **after** `redact` returns. List every
   statement between building `entries` and archiving it that could have
   written to it. How long is that list?
2. `redact` takes a `[]string` and returns a `[]string`. What exactly is
   copied at that call boundary, and how big is it?
3. If `view` and `entries` were truly independent, what one-line print
   would prove it? What do you expect that print to show here?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/slice-aliasing
