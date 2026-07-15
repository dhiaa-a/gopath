# json-fetcher lab

Tier 1, project 2. Your program fetches current weather as JSON over HTTP,
decodes it into a typed struct, and prints two formatted lines. This lab
verifies that whole path on your machine without touching the internet.

There is no test suite here, deliberately: graded `go test` suites start at
Tier 1 project 3. What you get instead is a mirror. A check program runs your
binary and shows what it printed next to what it should have printed.

## Layout

    starter/    your program; edit starter/main.go
    solution/   the reference; do not open it until your check run is green
    check/      the check program; run it, do not edit it
    testdata/   fixture JSON, one file per city, same shape Open-Meteo returns

## Run it

From this directory:

    go run ./check

The check builds `./starter`, starts an HTTP server on 127.0.0.1 that serves
the fixtures, and runs your binary against it five times:

1. `--city london`, `--city paris`, `--city baghdad`: the server replies with
   fixture JSON and the check compares your stdout against the expected two
   lines. Temperature keeps one decimal place, wind speed is a whole number:

       Temperature: 18.3 C
       Wind speed: 15 km/h

2. A server that answers `500 Internal Server Error`: your program must exit
   non-zero and say what status it got, instead of decoding the error body
   into zeroes.

3. A server that sends truncated JSON: the decode error must reach `main` and
   produce a non-zero exit, not a silent zero-value print.

Done looks like:

    self-check passed: 5 of 5 scenarios. This part of the project is done.

The check accepts `-target` to point at a different package; that is how the
repo's CI proves the reference passes: `go run ./check -target ./solution`.

## What the check can't see

The check reads only stdout and exit codes, so it never notices whether
`fetch` gives its `http.Client` a timeout, whether you `defer resp.Body.Close()`,
or whether your struct even names the `latitude` and `longitude` fields, because
none of that changes what prints. Getting those right is on you: a missing
timeout hangs forever on a slow or dead server and an unclosed body leaks its
connection, and both get exercised for real in the Tier 2 networking labs.

## Why your program takes --base-url

Your binary defaults to the real Open-Meteo endpoint, but every scenario here
passes `--base-url http://127.0.0.1:<port>/...`. A program that can only talk
to one hardcoded URL cannot be verified without the live internet and someone
else's uptime. The flag is the seam that makes an HTTP client checkable, and
the same seam is how real services get tested. The check refuses to pass any
scenario where your binary never contacted the local server, so a hardcoded
URL fails fast instead of silently fetching live data.
