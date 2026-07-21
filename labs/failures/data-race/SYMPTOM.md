# Symptom

> Reported by: analytics on-call, 09:40
>
> Finance reconciles the hit counter against the CDN logs every morning and
> the numbers have never matched. Today I ran the counter job twice in a
> row, same binary, same input:
>
> ```
> counted 402183 of 1000000 hits
> lost: 597817
> ```
>
> and then:
>
> ```
> counted 333704 of 1000000 hits
> lost: 666296
> ```
>
> No errors, no crash, exit code 0 every time. On my laptop it once printed
> the full million and I nearly closed the ticket. The WaitGroup is doing
> its job: the total never prints before all eight workers finish. And the
> workers share nothing with each other except the counter itself.

## Reproduce

From this directory:

```
go run .
```

Run it more than once. The total moves between runs. On a fast, idle
machine some runs may even come out exactly right; that is part of the
bug, not evidence against it.

## Before you open the site page

Commit to answers from the output alone:

1. The program exits 0 and prints a different total each run. What class
   of bug produces different results from identical input, and what is the
   only thing that varies between these runs?
2. `hits++` looks like one operation. Is it? Write down what the machine
   must actually do to increment a variable that lives in memory.
3. If one run prints `counted 1000000 of 1000000 hits`, what exactly has
   been proven?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/data-race
