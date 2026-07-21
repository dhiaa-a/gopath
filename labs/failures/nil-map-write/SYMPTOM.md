# Symptom

> Reported by: digest pipeline on-call, 08:40
>
> The weekly word digest panics every run now. It is not dead on arrival,
> it gets through the header and the first progress line, then:
>
> ```
> report: weekly word digest
> tracking "config": seen 0 times so far
> release-notes: 11 words, 0 distinct so far
> panic: assignment to entry in nil map
>
> goroutine 1 [running]:
> main.(*Stats).Count(...)
>         .../nil-map-write/main.go:21
> main.main()
>         .../nil-map-write/main.go:55 +0x4bf
> exit status 2
> ```
>
> Two things make no sense to me. Nobody assigns nil to anything in this
> file, search it, the word only appears in my terminal. And the two lines
> right above the panic read from those same stats and printed zeros just
> fine, so the stats were working right up until the moment they were not.

## Reproduce

From this directory:

```
go run .
```

Panics identically on every run, on every machine, always at the same
line. The successful lines above the panic are part of the evidence, not
noise.

## Before you open the site page

Try to answer from the panic text and the lines above it:

1. To the runtime, what is different between reading a map and writing to
   one? The zeros above the panic prove one of them works on this map.
2. `s.counts[w]++` is a read and then a write. Which half panicked?
3. The trace names where the write happened. Where was this map born, and
   what was its value at that moment? Find the line, not just the
   function.

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/nil-map-write
