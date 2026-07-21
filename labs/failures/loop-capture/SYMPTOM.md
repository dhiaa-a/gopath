# Symptom

> Reported by: teammate, during menu-registry review
>
> Every registered handler claims to be the last menu entry. On my checkout
> and in CI:
>
> ```
> 2: quit
> 2: quit
> 2: quit
> ```
>
> I pasted the byte-identical file into a fresh scratch module at home and
> it prints what it should:
>
> ```
> 0: start
> 1: save
> 2: quit
> ```
>
> Same Go installed in all three places (go1.23). `go vet` is silent in
> both. The source diffs empty. The only file that differs between the two
> checkouts is go.mod.

## Reproduce

From this directory:

```
go run .
```

Three identical lines, every run, on any recent toolchain. The
scratch-module result is just as reproducible, and the site page shows
how to flip between the two behaviors without touching main.go.

## Before you open the site page

Try to answer from the source and the output alone:

1. Three different closures print identical output, and the value they
   agree on is the **last** entry. What single fact about how closures
   capture explains that exact shape?
2. How many variables named `i` does this loop declare across its three
   iterations: one, or three? What decides the answer, the installed
   toolchain or something in this directory?
3. Which one line in this repo would change the program's output without
   touching main.go at all?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/loop-capture
