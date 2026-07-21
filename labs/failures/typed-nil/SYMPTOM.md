# Symptom

> Reported by: deploy on-call, 07:52
>
> The new build will not start. Every pod aborts immediately with:
>
> ```
> startup aborted: <nil>
> exit status 1
> ```
>
> The config it is rejecting is byte-identical to the one the current
> build is running with right now, I diffed them. And look at the message:
> aborted because of... nothing? No field, no reason, just `<nil>`. The
> only change in this build is the validation refactor that added
> structured errors so the log could name the bad field. The first time it
> fires, it names nothing. Reverting the refactor fixes startup.

## Reproduce

From this directory:

```
go run .
```

Aborts with exit code 1 on every run, on every machine, over a config the
program itself considers valid. Read that sentence again before moving on.

## Before you open the site page

Try to answer from the log line alone:

1. The abort branch only runs when `err != nil` is true. The print says
   `<nil>`. Write down a value of `err` that makes both of those happen
   at once.
2. What would `fmt.Printf("%T", err)` print on the line above the exit?
   Commit to a guess before you add it and check.
3. `validate` returns `*ValidationError`, and on this config it returns
   nil. At which exact line does that nil stop being nil?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/typed-nil
