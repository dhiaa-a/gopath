# Symptom

> Reported by: support triage, 11:05
>
> French users keep sending screenshots of a garbled pickup notification.
> The title reads `Commande pr`, then a replacement-character diamond,
> then the ellipsis. English notifications are perfect, every time.
> Nothing is crashing: the sender exits 0 on every run and has never
> logged an error for these pushes.
>
> The payload log makes it weirder, not clearer. For the garbled push:
>
> ```
> display: Commande pr�…
> payload: "Commande pr\xc3…"
> ```
>
> None of us typed a backslash-x-c-3 anywhere, and grepping the code for
> it finds nothing. Grepping the logs for the diamond in the screenshots
> also finds nothing.

## Reproduce

From this directory:

```
go run .
```

Exits 0 every time. The corruption is in the output, not the exit code:
the last notification is mangled on every run, on every machine, and
nothing in the program calls it an error.

## Before you open the site page

Try to answer from the two log lines alone:

1. The log shows `\xc3` where the user's screen shows a diamond. Which of
   the two is actually in the string, and who manufactures the other one?
2. `len("Commande prête à retirer")` is 26, but you can count 24
   characters on the screen. Which of those two numbers does `title[:12]`
   care about?
3. The cut kept exactly one byte of something. One byte of what, and
   where did the rest of it go?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/bytes-vs-runes
