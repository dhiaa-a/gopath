# Symptom

> Reported by: batch-pipeline on-call, 02:14
>
> The checksum job died on the first run of the night. It doesn't hang, it
> crashes instantly, every time, with this:
>
> ```
> fatal error: all goroutines are asleep - deadlock!
>
> goroutine 1 [chan send]:
> main.main()
>         .../deadlock/main.go:29 +0x2ad
> exit status 2
> ```
>
> Nothing about the inputs changed. Last week's version printed the report
> inline and worked fine; the only diff since is "make the reporting
> concurrent". Rolling back fixes it, so it's something about the channel.

## Reproduce

From this directory:

```
go run .
```

It fails the same way on every run, on every machine. That is a gift:
deterministic crashes are the easy kind, and this one even names the line.

## Before you open the site page

Try to answer from the crash text alone:

1. What is goroutine 1 waiting **for**? The `[chan send]` bracket is the
   runtime telling you its exact wait reason.
2. Who was supposed to be on the other end of that channel, and where in
   this program would they have to be standing?
3. Why is the runtime allowed to call this a deadlock rather than just a
   slow program?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/deadlock
