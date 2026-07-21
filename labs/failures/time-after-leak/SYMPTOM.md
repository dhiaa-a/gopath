# Symptom

> Reported by: ingest on-call, 14:20
>
> The feed drainer's memory grows with every burst it processes and never
> comes back down between bursts. I cut the service down to the smallest
> loop that still shows it, with a before/after measurement and a forced
> GC. Even the minimal version keeps fifty megabytes alive after doing
> nothing but drain and drop 200,000 events:
>
> ```
> drained 200000 events
> heap retained 50.9 MB after GC
> ```
>
> The loop stores nothing. No slice, no map, no accumulation: it receives
> an event, counts it, moves on. A heap profile says the retained memory
> is timers, which makes no sense, because we never keep a timer anywhere.
> The truly confusing part: the orders service has this exact loop shape
> and does not leak. I diffed the two projects for an hour. The only
> difference I can defend is their go.mod files.

## Reproduce

From this directory:

```
go run .
```

Exit code 0, every run, in about a second. The retained figure lands
within a few hundred kilobytes of 50 MB each time. Before you blame an
old Go install: the toolchain here is 1.23, and it reproduces anyway.
Open this module's go.mod before deciding what that proves.

## Before you open the site page

Commit to answers first:

1. After a forced GC, retained memory is reachable memory. The loop keeps
   no variables alive across iterations, so what else in a Go process can
   still hold a reference to allocations your code made?
2. Count the values a single pass through the select creates. Which of
   them outlives the iteration, and who decides when it dies?
3. Why could the go directive in go.mod change how much memory the same
   source code retains on the same toolchain?

Then check your diagnosis against the fixed variant, which runs clean on
this same go 1.22 module:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/time-after-leak
