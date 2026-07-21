# Symptom

> Reported by: billing on-call, after a finance escalation
>
> Finance reconciled the month and found partner invoices posted to the
> ledger at 0.00 EUR. Forty-one of them. The importer's logs for every one
> of those runs are green:
>
> ```
> imported invoice: acme 0 EUR
> import ok (0 errors)
> ```
>
> There is nothing to roll back: it has imported zeros since the day the
> feed importer shipped. No errors, no warnings, exit code 0. I pulled the
> payload for one of the zeroed invoices straight off the feed and the
> money is right there: `"amount_cents":12500`. The JSON is valid,
> Unmarshal returns nil, and the amount still comes out 0.

## Reproduce

From this directory:

```
go run .
```

It prints the zero and exits 0, every run, on every machine. Nothing
crashes, nothing errors. That is the hard part: this failure's signature
is the absence of one.

## Before you open the site page

Try to answer from the output and the payload alone:

1. `json.Unmarshal` returned `nil`. Write down precisely what that `nil`
   promises. Does it say anything at all about the fields of your struct?
2. The payload says `"amount_cents":12500` and the struct ends up with
   `AmountCents:0`. Those are two separate events: what did the decoder do
   with that wire key, and what did it do with that struct field?
3. Unmarshal falls back to case-insensitive name matching. Why does that
   fallback not rescue this program?

Then check your diagnosis against the fixed variant:

```
go run -tags fixed .
```

The site page for this lab walks the full diagnostic path:
gopath.dev/failures/json-silent-zero
