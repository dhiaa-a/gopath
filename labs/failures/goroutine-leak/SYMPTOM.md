# Symptom

> Reported by: quote-service on-call, week two of the ticket
>
> The quote service leaks. RSS climbs all day and the goroutine gauge
> climbs with it, in a nearly straight line: up roughly one goroutine per
> timed-out upstream call. Restarting resets both, so we restart it every
> night now, which nobody wants to call a fix.
>
> Here is the maddening part: there are no errors. Nothing crashes, p99
> is fine, the timeout fallback serves the cached price like it should,
> the logs are clean. By every signal we have, the service is healthy,
> except the two that keep going up.

## Reproduce

From this directory:

```
go run .
```

The lab compresses the incident into one run: 100 requests with a 5ms
budget against an upstream that takes 50ms, then the same telemetry the
real dashboard shows. Every run prints the same thing and exits 0:

```
goroutines at start: 1
handled 100 requests: 0 fresh, 100 from cache
goroutines now: 101
```

One hundred requests handled, one hundred goroutines that never went
home.

## Before you open the site page

Commit to answers first:

1. Each of those 100 goroutines is parked on one specific line of this
   program, waiting for one specific event. Which line, and what event?
2. The program was completely done with those goroutines the moment each
   timeout fired. Why does the runtime not collect a goroutine that can
   never make progress again?
3. The deadlock lab crashed with "all goroutines are asleep". Here 100
   goroutines are asleep forever and nothing crashes. What condition is
   that detector checking that this program never meets?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/goroutine-leak
