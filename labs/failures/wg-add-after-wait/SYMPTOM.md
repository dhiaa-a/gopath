# Symptom

> Reported by: fulfillment on-call, 07:20, before coffee
>
> The overnight notification batch "finishes" instantly and sends almost
> nothing. The run report says it flat out: dispatched 100, completed 0,
> 100 unaccounted. Exit code 0, no errors, no panics; the process is gone
> before the work starts.
>
> We put a WaitGroup in exactly so this could not happen: every worker
> does Add(1) as its first act and Done when it finishes, and main waits
> on the group before reconciling. The counter math looks airtight in
> review. And yet Wait comes back in microseconds with a hundred jobs
> outstanding.

## Reproduce

From this directory:

```
go run .
```

Every run reports the same reconciliation and exits 0:

```
dispatched 100 jobs
completed 0 of 100 jobs (100 unaccounted)
```

## Before you open the site page

Commit to answers first:

1. Write down the sequence of values the WaitGroup counter takes if
   every Add(1) happens inside the spawned goroutines. What is the
   counter at the instant Wait first reads it?
2. Wait returned almost immediately. Did it malfunction, or did it do
   exactly what its contract promises for the counter value it saw?
3. Would go vet catch this? Would the race detector? Sketch what each
   tool actually checks before you answer, then try them.

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/wg-add-after-wait
