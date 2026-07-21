# Symptom

> Reported by: warehouse-systems on-call, 06:05
>
> The overnight pick tally died again, third shift in a row:
>
> ```
> fatal error: concurrent map writes
> fatal error: concurrent map writes
> fatal error: concurrent map writes
>
> goroutine 8 [running]:
> main.picker({{0x0, 0x0}, 0xc000020180}, {0xc000032100, 0x4, 0x0?}, ...)
>         .../mutex-by-value/main.go:40 +0x16d
> created by main.main in goroutine 1
>         .../mutex-by-value/main.go:52 +0xf1
> exit status 2
> ```
>
> I know what the error means, that is the annoying part. Two goroutines
> wrote the map at the same moment. But look at the code: every single
> write to that map sits between mu.Lock() and mu.Unlock(). The mutex was
> added for exactly this reason and review signed off on it. Wrapping the
> workers in recover() does nothing, it dies anyway.
>
> It is not a rare interleaving either. It crashes nearly every run here.

## Reproduce

From this directory:

```
go run .
```

On the machine this lab was built on it threw on ten out of ten runs. The
fatal line can print two or three times before the goroutine dump; that is
normal, several workers hit the throw within the same instant.

## Before you open the site page

Commit to answers first:

1. The runtime says two writers were inside the map at once. Every write
   is between Lock and Unlock. What must be true about the locks for both
   statements to hold at the same time?
2. Read picker's signature, then the `go picker(store, ...)` call. What
   exactly gets copied at that call, and which part of a copied Store
   still points at shared memory?
3. There is a standard Go command that flags this bug without running the
   program at all. Which one, and why can it see the problem statically?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/mutex-by-value
