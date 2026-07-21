# Symptom

> Reported by: platform on-call, right after the Tuesday deploy
>
> Cancellation does not work. During the deploy we cancelled the running
> export batch, the log dutifully says "cancel sent", and then the worker
> just kept going: exports were still starting more than 150ms after the
> cancel, and the batch ran to completion as if nobody had said a word.
>
> The confusing part is that the code looks right. The worker takes a
> context, main calls cancel(), a WaitGroup joins them at the end.
> Textbook. Nothing errors, nothing hangs, exit 0. It just ignores us.

## Reproduce

From this directory:

```
go run .
```

Main cancels the batch about 45ms in, then reconciles what the worker
did against the cancellation timestamp:

```
cancel sent at 45ms
worker returned at 209ms
processed 20/20 items, cancelled=true, obeyed=false
items started after cancel: 15
```

Fifteen exports began after the caller said stop. Every run.

## Before you open the site page

Commit to answers first:

1. What does calling cancel() actually do, mechanically? Name the one
   concrete thing that changes in the program's state.
2. Whose job is it to notice that change: the runtime, the scheduler, or
   the worker's own code? What would noticing look like, and where in
   this worker would it live?
3. Suppose Go could kill the worker at the cancel instant, mid-item.
   What state would that leave behind? Why might cooperative
   cancellation be a design rather than an oversight?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/ctx-ignored
