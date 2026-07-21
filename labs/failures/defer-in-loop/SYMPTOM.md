# Symptom

> Reported by: data-platform on-call, third night in a row
>
> The nightly reportgen job fails every run:
>
> ```
> verified: 0 of 40 reports complete (40 empty)
> re-check from main: 40 of 40 reports complete
> reportgen: verification failed: 0 of 40 reports complete (40 empty)
> exit status 1
> ```
>
> Here is the part I cannot explain. The verify step inside exportAll says
> every report is empty. But whenever I inspected the staging directory by
> hand after the job died, the reports were all there, full contents,
> footer and all. So I added a second count in main, right after exportAll
> returns. Same helper function, same directory. You can see it in the
> output above: it reports 40 of 40 in the same run that reported 0 of 40.
> Two calls to the same counting code disagree about the same files. I no
> longer trust the verifier.

## Reproduce

From this directory:

```
go run .
```

It exits 1 with exactly those numbers on every run and every OS. A
deterministic failure that contradicts itself is still deterministic, and
the contradiction is the clue.

## Before you open the site page

Try to answer from the output and the source alone:

1. The same counting function walked the same directory twice and returned
   0, then 40. The code did not change between the calls. What did?
2. The write loop registers `defer w.Flush()` and `defer f.Close()` for
   every report. At the moment the first count runs, how many of those 80
   deferred calls have executed?
3. How many files does this process have open at that same moment? What
   happens to this program at 5,000 users instead of 40?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/defer-in-loop
