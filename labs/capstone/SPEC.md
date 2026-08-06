# linkd

A link shortener with API-key auth, per-key rate limiting, durable storage, and
metrics.

You get a spec and a test suite. You do not get steps, hints, starter functions,
or a suggested package layout. That is the point. Everything below is a
requirement, and every requirement is checked.

```
go run ./suite -target ./yourdir     conformance
go run ./slo   -target ./yourdir     service level objectives
```

Both must pass. The suite proves it does what it says; the SLO harness proves it
does it fast enough and without leaking. Neither reads your source. They build
your package, run the binary, and talk to it over HTTP, which is the only
interface that matters here.

---

## 1. Process contract

Your package must build to a binary with `go build`. It takes four flags:

| Flag | Default | Meaning |
| --- | --- | --- |
| `-addr` | `127.0.0.1:8080` | listen address. `:0` or `127.0.0.1:0` means "any free port" |
| `-data` | `linkd.json` | path to the durable store. Created if absent |
| `-tokens` | none, required | path to the token file |
| `-rate` | `100` | requests per second allowed per token |

Once the listener is accepting connections, and before serving any request, the
process must write exactly one line to **stdout**:

```
listening on 127.0.0.1:54321
```

The address must be the real one it bound, with the real port, even when `-addr`
asked for port `0`. Nothing else may be written to stdout before that line. This
is how the harness finds you, and it is how you would find yourself in a
container.

`-tokens` points at a JSON object mapping token to owner name:

```json
{ "tok_alice": "alice", "tok_bob": "bob" }
```

A missing or unreadable `-tokens` file is a startup failure: write a message to
stderr and exit non-zero. Do not start a server that authenticates nobody.

On `SIGINT` or `SIGTERM` the process must stop accepting new connections, finish
the requests already in flight, flush the store, and exit `0` within **5
seconds**. On Windows the harness sends `os.Interrupt` where the platform allows
it and kills the process otherwise, so the shutdown path is checked on Unix and
your store must be crash safe everywhere. See section 5.

## 2. Authentication

Every route under `/api/` requires `Authorization: Bearer <token>`.

| Situation | Status |
| --- | --- |
| header absent | `401` |
| header malformed (not `Bearer <token>`) | `401` |
| token not in the token file | `401` |
| token valid | proceed as that token's owner |

A `401` must include `WWW-Authenticate: Bearer`.

Links belong to the owner who created them. An owner may only see, count, or
delete their own links. A request for a link owned by somebody else returns
`404`, not `403`: the existence of another owner's code is not yours to learn.

`GET /{code}`, `GET /healthz`, and `GET /metrics` are public.

## 3. Routes

All request and response bodies are JSON with `Content-Type: application/json`.
All timestamps are RFC 3339 in UTC.

### `POST /api/links`

Request:

```json
{ "url": "https://example.com/some/page", "alias": "optional", "expires_in": 3600 }
```

- `url` is required. It must parse, and its scheme must be `http` or `https`.
  Anything else is `400`.
- `alias` is optional. If given, it is the code. Between 1 and 32 **characters**
  (not bytes), each of which must be a letter, a digit, `-`, or `_`. Anything
  else is `400`. An alias already in use is `409`.
- `expires_in` is optional, in seconds, and must be positive if present.
  Omitted or `0` means the link never expires.

If no alias is given, generate a code of exactly 7 characters from
`[A-Za-z0-9]`. Codes must be unique across all owners.

Response `201`:

```json
{
  "code": "aB3xY9z",
  "short_url": "http://127.0.0.1:54321/aB3xY9z",
  "url": "https://example.com/some/page",
  "owner": "alice",
  "clicks": 0,
  "created_at": "2026-08-06T12:00:00Z",
  "expires_at": "2026-08-06T13:00:00Z"
}
```

`expires_at` is `null` when the link does not expire. `short_url` is built from
the request's `Host` header.

### `GET /{code}`

Public. `302` with a `Location` header holding the target URL, and one click
recorded.

| Situation | Status |
| --- | --- |
| code exists and is live | `302` |
| code unknown | `404` |
| code expired | `410` |

An expired link is not deleted, and it does not record clicks. `410` is a
different fact from `404` and the suite checks that you keep them apart.

Click counting is exact. If 200 clients redirect the same code concurrently, the
count afterwards is 200. Not 199, not "about 200".

### `GET /api/links`

The caller's links, newest first, as a JSON array of the same object shape as
`POST` returns. Never another owner's links. An owner with no links gets `[]`,
not `null`.

### `GET /api/links/{code}`

One link, same shape. `404` if unknown, expired, or not yours. An expired link
that is yours returns `404` here and `410` on redirect.

### `DELETE /api/links/{code}`

`204` and the code stops resolving. `404` if unknown or not yours. Deleting
twice gives `204` then `404`.

### `GET /healthz`

Public. `200` and `{"status":"ok"}`.

### `GET /metrics`

Public. `200` and exactly these fields:

```json
{
  "goroutines": 11,
  "requests_total": 4210,
  "requests_in_flight": 1,
  "redirects_total": 3800,
  "rate_limited_total": 12,
  "links_total": 40,
  "uptime_seconds": 31.416
}
```

- `goroutines` is `runtime.NumGoroutine()` read at the moment of the request.
  Report it honestly. A service that cannot see its own goroutine count cannot
  be operated, and the SLO harness uses this number to decide whether you leak.
- `requests_total` counts every HTTP request the server handled, this one
  included.
- `requests_in_flight` counts requests currently being handled, this one
  included, so the smallest truthful value is `1`.
- `redirects_total` counts `302` responses only.
- `rate_limited_total` counts `429` responses only.
- `links_total` is the number of links in the store, expired ones included.
- `uptime_seconds` is a float, seconds since start.

Counters are monotonic and survive nothing: they reset on restart. The store
does not.

## 4. Rate limiting

Per token, not per IP, and only on `/api/` routes. A token bucket of capacity
`-rate` refilling at `-rate` per second.

A request that finds the bucket empty gets `429` with a `Retry-After` header
holding whole seconds, minimum `1`. It does not reach a handler and does not
change the store.

Redirects are not rate limited. One token exhausting its bucket must not affect
another token: buckets are independent, and the suite checks that by draining
one and then using the other.

## 5. Durability

The store at `-data` holds every link and its click count. The suite kills the
process outright, with no signal and no chance to clean up, restarts it on the
same file, and checks what survived. Two different promises are being made here,
and production systems make them differently on purpose:

**Structural changes are write-through.** By the time `POST` returns `201` or
`DELETE` returns `204`, that change is already on disk. Killing the process one
microsecond later loses nothing. You acknowledged it, so you own it.

**Click counts may be batched**, because writing the whole store on every
redirect would put a disk flush in the hot path and section 7 will not forgive
that. Flush them at least once a second and on shutdown. An abrupt kill may lose
up to a second of clicks and no more. The suite waits out that second before
killing, then holds you to the exact count.

That split is the whole trade. Money is write-through, analytics are batched, and
knowing which is which is most of what durability engineering is.

A store file that exists but is corrupt is a startup failure: message on stderr,
non-zero exit. Silently starting empty would throw away a customer's links, and
the suite hands you a truncated file to make sure you refuse it.

Writing the file must be atomic. A reader that opens the path at any moment sees
either the old contents or the new contents, never a half written file. Write a
temporary file next to the target and rename it over.

On `SIGINT` or `SIGTERM`, drain and flush as section 1 says. The suite checks
this where the platform can deliver those signals and prints that it skipped
otherwise, because Windows cannot. A skipped check is announced, never silent.

## 6. Concurrency

The server handles concurrent requests. Correctness under concurrency is a
requirement, not a nice to have, and most of it is invisible until it is a bug
report. Each of these is checked:

- Click counts are exact, as above.
- `links_total` matches the number of links that exist.
- Two concurrent `POST`s with the same alias: exactly one `201`, one `409`.
- Concurrent create and delete of the same code never panics, and no code
  resolves after its `204`.
- Generated codes are unique when many are created at once. Two clients that
  both `POST` with no alias never receive the same code.
- `requests_in_flight` is back to `1` once a load run is over, that one being
  the `/metrics` request asking.
- Goroutines do not accumulate. The count on `/metrics` after a load run settles
  back near where it started.

Run your own tests with `-race`. The suite cannot see a race directly. It only
sees the wrong numbers a race eventually produces, and "eventually" is doing a
lot of work in that sentence. Passing this suite is evidence, not proof, and the
distinction is worth carrying to your next job.

## 7. Service level objectives

`go run ./slo -target ./yourdir` runs a mixed workload and holds you to four
numbers. They are printed with the measurement so you can see the margin.

| Objective | Threshold |
| --- | --- |
| error rate | `0`. No 5xx, no connection failure, no malformed body |
| p99 latency | at or under the ceiling the harness prints |
| throughput | at or above the floor the harness prints |
| goroutine growth | at or under the ceiling, measured after the load settles |

The thresholds are deliberately loose enough to pass on a laptop and tight
enough that a leak or a global lock fails them. `-scale` relaxes them
proportionally on a slow or loaded machine, and prints that it did. Passing with
`-scale` is not passing.

## 8. What is not specified

Package layout, file names, the store format, whether you use a map with a mutex
or a channel-owned goroutine, how you generate codes, your logging. None of it
is checked and none of it is graded. Make the calls you would make at work.

---

## Done

```
go run ./suite -target ./yourdir
go run ./slo   -target ./yourdir
```

Green on both means the thing you built holds up to the same treatment a
reviewer would give it: it does what it says, it says what it is doing, it stays
correct when hit from many directions at once, and it does not leak. That is the
claim, and it is yours to make once these pass.
