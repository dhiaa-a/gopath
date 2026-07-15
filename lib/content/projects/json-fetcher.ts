import { Project } from "../../content"

export const jsonFetcher: Project = {
	slug: "json-fetcher",
	name: "JSON API fetcher",
	tagline: "Fetch, decode, and display typed data from a live JSON API.",
	code: "JFT",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "7–9 hours",
	tags: ["net/http", "encoding/json", "structs", "defer", "error-handling"],
	lab: {
		path: "labs/json-fetcher",
		command: "go run ./check",
		summary: {
			en: "A check program runs your binary against a local server serving fixture JSON and shows your output next to the expected output, including the 500, the broken JSON, and the server that never answers; a self-check, not a graded suite.",
		},
	},
	mentalModels: [
		"type-safe decoding at the boundary",
		"resource cleanup with defer",
		"struct tags as a contract",
		"explicit status code handling",
		"a missing deadline is not a missing feature",
	],
	systemOverview: [
		{
			type: "text",
			value: {
				en: "Seven scenarios check this program, and only three of them are it working. The other four are a city your program has never heard of, a server that answers 500 with a perfectly well-formed JSON body, a server that sends half an object, and a server that accepts your connection and then says nothing at all. That ratio is the job. An API client is not a function that returns data. It is a function that decides, several times over, whether to believe what it just received, and every one of those decisions is a line you have to write, because nothing underneath you will write it for you.",
			},
		},
		{
			type: "text",
			value: {
				en: "An http.Client sends a GET request. The status code is checked before any decoding. The response body is decoded into a typed struct using json.Decoder. The body is always closed (even on error paths) using defer. The result is formatted and printed to stdout.",
			},
		},
		{
			type: "code",
			value: `flag → buildURL → http.Client.Get → check status → json.Decode → format → stdout`,
		},
	],
	architecture: [
		{
			type: "code",
			value: `main.go
 ├── buildURL(city string) (string, error)     // map lookup, comma-ok
 ├── fetch(url string) (*WeatherResponse, error)
 │    ├── &http.Client{Timeout: 10 * time.Second}
 │    ├── client.Get → defer resp.Body.Close()
 │    ├── resp.StatusCode != 200 → error
 │    └── json.NewDecoder(resp.Body).Decode(&w)
 └── printResult(w *WeatherResponse)           // %.1f, %.0f`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Turn a city into a URL, and refuse the ones you cannot" },
			uses: ["maps", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Your user types london. The API has never heard of london: it speaks decimal degrees, and it will answer for any pair of numbers you send it, including the wrong ones. Something has to do that translation, and that something is the only part of the program that knows the translation can fail. Let it fail later, after a socket is open, and you have paid for a round trip across the internet to learn a fact you already had before the program started.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A Go map read for a missing key does not fail. It returns the zero value of the value type, silently, and there is no second signal anywhere. The comma-ok form, v, ok := m[k], is the only thing that separates absent from present-and-zero. For a lookup that must succeed, take the ok and turn a false into an error at the boundary: the same shape the renamer used for --dir, which is check everything before any work starts, then trust it forever after.",
					},
					pattern: `var cities = map[string][2]float64{
    "london": {51.5, -0.1},
    "paris":  {48.85, 2.35},
}

func buildURL(city string) (string, error) {
    coords, ok := cities[city]
    if !ok {
        return "", fmt.Errorf("unknown city %q (want london or paris)", city)
    }
    return fmt.Sprintf("%s?latitude=%g&longitude=%g&current=temperature_2m",
        *baseURL, coords[0], coords[1]), nil
}`,
					example: {
						en: 'A feature-flag client looks a flag name up in a map. If a typo\'d name returned the zero value, false, every misspelled flag would read as "disabled", and the bug would be indistinguishable from a flag someone turned off on purpose. So the API returns (value, ok) and makes the caller decide what a missing flag means.',
					},
					task: {
						en: "Fill in buildURL(city string) (string, error). Map london, paris, and baghdad to hardcoded coordinates; the user never types numbers. Use the comma-ok form: an unknown city is an error, not a panic and not a zero. Build the URL from *baseURL plus three query parameters: latitude, longitude, and current=temperature_2m,wind_speed_10m.",
					},
					hints: [
						{
							label: "why the current parameter is not optional",
							value: "Open-Meteo returns only the fields you ask for. Leave current out and the response has no current object in it at all, your struct decodes to zeroes, and nothing errors anywhere. The lab's server enforces this: ask for the wrong fields and it tells you so in a note under the failure.",
						},
						{
							label: "%g, not %f",
							value: "fmt's %g prints 51.5 as 51.5; %f prints it as 51.500000. Both parse back to the same float64, so the API does not care and neither does the lab's server. It is worth noticing which you picked, because %v on a float is %g, and that is the same decision that bites in step 04.",
						},
						{
							label: "hand-built query strings",
							value: "Sprintf is fine here because every value in this URL comes from a map you wrote, not from the user. The moment a user-supplied string reaches a query parameter, reach for net/url instead: url.Values{}.Encode() escapes &, =, and spaces, and Sprintf does not. That is the same class of bug as SQL injection, one layer up the stack.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check",
					expect: {
						en: 'Scenario 4, "unknown city is refused", now says ok: your program rejected atlantis, exited non-zero, and never sent a request. The other six still fail, because fetch is still a stub that errors out before any HTTP happens. That is the expected shape of progress here, not a failure.',
					},
					labPath: "labs/json-fetcher/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Drop the ok. Write coords := cities[city] and return the URL with a nil error. Then look at what it builds for a city you never mapped: add fmt.Println(buildURL("atlantis")) at the top of main and run go run ./starter --city london.',
					},
					observe: {
						en: "It prints a perfectly well-formed URL carrying latitude=0&longitude=0, and <nil> where the error should have been. Nothing anywhere complains.",
					},
					why: {
						en: "A map read for a missing key returns the zero value of the value type, always, with nothing attached to say it was missing. For [2]float64 that zero is {0, 0}, and latitude 0, longitude 0 is a real place: a point in the Gulf of Guinea, a few hundred kilometres south of Ghana, in open ocean. Send those coordinates to the live API and it answers with HTTP 200 and valid JSON reporting a real sea-surface temperature. So your program prints the ocean's weather, calls it Atlantis, and exits 0. Not one layer of that stack has anything to complain about: the map did what maps do, the API answered a well-formed question, and the decoder got well-formed JSON. This is the failure the comma-ok form exists to prevent, and it is not a crash. It is a confident wrong answer. Go makes you ask for ok because the zero value is otherwise indistinguishable from a real one.",
					},
				},
			],
			retrievalPrompt:
				'cities["atlantis"] does not panic and does not return an error. What does it give you, and why is that worse than a panic? || The zero value of the map\'s value type, here [2]float64{0, 0}, with no signal that anything was absent. It is worse than a panic because {0, 0} is a valid coordinate the API will happily answer for, so the bug survives all the way to a printed weather report instead of stopping the program. The comma-ok form is the only thing that separates absent from present-and-zero.',
		},
		{
			n: "02",
			heading: { en: "Model the response, and find out what a wrong tag costs" },
			uses: ["structs", "json-decode"],
			blocks: [
				{
					type: "text",
					value: {
						en: "The API's reply carries twelve top-level keys and you need three of them. Nothing forces you to name them correctly. encoding/json will take whatever struct you hand it, match what it can, discard the rest, and report success. A typo in a tag is not a compile error, not a runtime error, and not a warning. It is a zero.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "encoding/json matches JSON keys to struct fields by tag first, then by field name, case-insensitively. Only exported fields participate: an unexported field is invisible to the decoder no matter what tag you hang on it. Two things are deliberately not errors. A JSON key with no matching field is discarded, and a struct field with no matching key is left at its zero value. Both are design decisions, and good ones: an API that adds a field should not break every client compiled before that field existed, and a client should not have to name all forty keys it ignores.",
					},
					pattern: `type Record struct {
    ID    int    \`json:"id"\`
    Name  string \`json:"full_name"\`
    Inner struct {
        Value float64 \`json:"value_2m"\`
    } \`json:"inner"\`
    cache string // unexported: json never sees it, tag or no tag
}`,
					example: {
						en: "A GitHub API client names full_name and stargazers_count and says nothing about the other forty keys a repository object carries. When GitHub adds the forty-first, the client keeps compiling and keeps working, because an unmatched key is not an error. That is the same rule that will cost you a temperature below.",
					},
					task: {
						en: "Fill in WeatherResponse: Latitude and Longitude as float64, and a nested Current struct with Temperature (JSON key temperature_2m) and WindSpeed (JSON key wind_speed_10m). The fixture at labs/json-fetcher/testdata/london.json is the exact shape the real API returns. Read it and match the keys character for character.",
					},
					hints: [
						{
							label: "nested objects",
							value: 'A nested JSON object maps to a nested struct. Declare it inline (Current struct { ... } `json:"current"`) or give it its own named type. Inline is fine while nothing else needs the type; name it the moment a second function takes it as a parameter.',
						},
						{
							label: "the tag is a string literal, and it is picky",
							value: 'The tag is `json:"temperature_2m"`: backticks, and no space after the colon. Write `json: "temperature_2m"` with a space and it silently stops parsing as a json tag, so the field falls back to matching by name and you spend an hour staring at it. You do not have to: go vet catches this one. Run go vet ./starter and it reports "not compatible with reflect.StructTag.Get: bad syntax for struct tag value".',
						},
						{
							label: "putting the raw bytes in front of your eyes",
							value: "When a field decodes to zero and you cannot tell whether your tag is wrong or the server never sent the key, stop guessing and look: json.NewDecoder(io.TeeReader(resp.Body, os.Stdout)).Decode(&w) decodes and prints the raw body at the same time, because TeeReader takes a Reader and returns a Reader and the decoder cannot tell the difference. Delete it once you have looked.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: `// temporarily, at the top of main() (you will need "encoding/json" imported):
data, err := os.ReadFile("testdata/london.json")
if err != nil {
    panic(err)
}
var probe WeatherResponse
fmt.Println(json.Unmarshal(data, &probe), probe)

// then, from the lab root:
go run ./starter --city london`,
					expect: {
						en: "<nil> {51.5 -0.1 {18.34 14.7}} printed first, then the usual fetch: not implemented error, which is fine. Every number is the one in the fixture, and the error is nil. If any number is 0, that field's tag does not match the key in the file. Notice what a wrong tag did not get you: an error. Delete the probe once you have seen it.",
					},
					labPath: "labs/json-fetcher/testdata/london.json",
					note: {
						en: "The struct is the one piece of this program you can check without a server, a socket, or the rest of the code existing. Unmarshal on a fixture takes four lines and answers the question directly.",
					},
				},
				{
					type: "breakIt",
					change: {
						en: 'Misspell exactly one tag: change `json:"temperature_2m"` to `json:"temperature2m"`, dropping the underscore. Leave wind speed alone. Rerun the probe.',
					},
					observe: {
						en: "<nil> {51.5 -0.1 {0 14.7}}. Temperature is 0. Wind speed, whose tag you did not touch, is still 14.7. The error is still nil.",
					},
					why: {
						en: "The decoder walks the JSON object one key at a time. For temperature_2m it looks for a field tagged temperature_2m, then for a field named temperature_2m case-insensitively. Your struct now has neither, so that key is dropped on the floor. Your Temperature field is never visited, so it keeps the value it was born with: 0. Two separate non-events, and encoding/json considers neither of them a problem, because both are things a healthy client does every day: ignoring keys it has no use for, and leaving fields the server did not send at their zero value. The price of that design is that a typo is indistinguishable from a field the API stopped sending, and 0.0 is a perfectly plausible temperature in January. Decoder.DisallowUnknownFields would have caught this particular one, by complaining about the key nobody claimed, but it would also break your client the next time the API adds a field. Nothing catches the other half, a field nobody filled. Either check that the values make sense, or generate the struct from the API's schema instead of typing it by hand.",
					},
				},
			],
			retrievalPrompt:
				'A field decoded to 0 and Unmarshal returned nil. Name the two different things that could have happened. || Either the JSON never carried a matching key (the server did not send it, or you asked for the wrong fields), or your tag does not match the key the server did send. encoding/json treats both as normal: an unmatched key is discarded, an unfilled field keeps its zero value, and neither is an error. Nothing in the type system distinguishes "absent" from "zero" here, which is why you go and look at the raw bytes.',
		},
		{
			n: "03",
			heading: { en: "Send the request, and close what you opened" },
			uses: ["defer", "interfaces", "error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "Everything so far has been a string and a struct, and both of them were yours. This step opens a socket to a machine you do not own. A response body is not data: it is a live TCP connection with bytes still arriving on it, dressed up as something you can read. That is why it arrives with a Close method, and why what comes back from a Get is not a []byte. Treat it like data and it will behave like data, right up until the thing doing the treating is a server instead of a CLI, and it runs out of file descriptors.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "client.Get returns a *http.Response whose Body is an io.ReadCloser: a stream, still wired to the server, that you have to close. Closing is what hands the connection back to the client's pool for reuse; not closing pins it out of that pool for the life of the process. The defer goes immediately after the error check on Get and before anything else, because that is the only position that covers every return path in the function, including the ones you have not written yet. And because Body is an io.Reader, json.NewDecoder takes it directly. There is no ReadAll step: the decoder pulls bytes off the socket as it needs them.",
					},
					pattern: `client := &http.Client{} // step 06 fixes this: no Timeout means no limit

resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("get %s: %w", url, err)
}
defer resp.Body.Close() // first thing after the error check, always

var w WeatherResponse
if err := json.NewDecoder(resp.Body).Decode(&w); err != nil {
    return nil, fmt.Errorf("decode: %w", err)
}
return &w, nil`,
					example: {
						en: "Every database driver has this shape. sql.Rows is not a result set, it is a cursor holding a connection, and rows.Close() is what gives it back. The Go that forgets it looks exactly like the Go that does not, until the pool is empty and every request is queuing behind nothing at all.",
					},
					task: {
						en: "Fill in fetch(url string) (*WeatherResponse, error). Make an http.Client, Get the URL, wrap a Get error with %w, defer the body close immediately after that error check, and decode the body into a WeatherResponse with json.NewDecoder. Return a pointer to it. Do not read the body into a []byte first. Two things are deliberately missing and you will add them in steps 05 and 06.",
					},
					hints: [
						{
							label: "resp.Body is never nil, and that is why the defer sits where it sits",
							value: "Even on a 500, even on a 404, even on a response with no body at all, the Client and Transport guarantee a non-nil Body. The one case where resp itself is nil is err != nil, which is exactly why the defer goes after that check and not before it: resp.Body.Close() on a nil resp is a nil pointer dereference.",
						},
						{
							label: "why not io.ReadAll then json.Unmarshal",
							value: "Both work and both are correct here, because the fixture is 400 bytes. The difference is that ReadAll allocates the whole body before the decoder sees a single byte of it, so the memory your process needs is chosen by whoever wrote the server. json.Decoder pulls from the stream instead. For a 400-byte weather report that difference is nothing. For a response you did not size, it is the difference between a decode and an OOM kill.",
						},
						{
							label: "why not http.Get(url)",
							value: "http.Get is a method on http.DefaultClient, a package-level client with no timeout that every library in your binary shares. It is fine for a five-line script. It is also how a dependency you did not write ends up holding your connections open with settings you cannot change, because you do not own the client. Make your own.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check",
					expect: {
						en: 'Scenario 6, "server sends broken JSON", now says ok: the decoder ran off the end of a truncated object, returned an error, and your program exited non-zero. Scenarios 1 to 3 still fail, but look at how they fail now. Under "your stdout" the check prints (nothing): you are fetching and decoding real numbers and then printing none of them, because printResult is still empty. Scenario 7 will now sit for thirteen seconds before it fails, which is step 06 waiting to happen.',
					},
					labPath: "labs/json-fetcher/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Move defer resp.Body.Close() down to the last line of fetch, after the decode, where it reads more tidily. Rerun the check.",
					},
					observe: {
						en: "Nothing changes. Every scenario that passed still passes, including the broken-JSON one, where the body is now never closed at all: the decode error returns before your tidier line is ever reached.",
					},
					why: {
						en: "This program makes one request and exits, so the leak has no time to matter. The process dies, the kernel reclaims the socket, and nothing observable from outside is different. That is precisely why this bug ships. Put the same fetch inside an HTTP handler running a thousand times a minute and every un-closed body pins its connection out of the client's pool. The pool grows, the file descriptors run out, and the stack trace you finally get names accept, or a DNS lookup, or anything at all except the decoder that forgot. The defer goes immediately after the Get error check because that position is the only one that covers every return between there and the end of the function, and steps 05 and 06 are both about to add returns above your tidier line.",
					},
				},
			],
			retrievalPrompt:
				"defer resp.Body.Close() goes immediately after the Get error check. Why not before it, and why not at the end of the function? || Not before, because when Get returns an error resp is nil and resp.Body.Close() panics; the non-nil Body guarantee only holds once err is nil. Not at the end, because every return between Get and that line skips it, and a function grows returns over time. Immediately after the check is the only spot that also covers the returns you have not written yet.",
		},
		{
			n: "04",
			heading: { en: "Print numbers a person can read" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "The fixture says the temperature is 18.34 and the wind is 14.7. A weather report that says 18.34 is a machine reading its own memory out loud. Nobody has ever wanted two decimal places of air temperature, and the second one is not even a measurement, it is model output. How much of a float64 to show is a decision, it is yours, and the compiler will never remind you that you have one to make.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "A float64 is a number; the string on the terminal is a decision. Go's fmt forces you to make it, because there is no default precision, no locale, and no rounding rule hidden in the runtime. %.1f formats to exactly one digit after the point, rounding rather than truncating. %.0f rounds to a whole number and prints no point. %v on a float64 is %g: the shortest string that reads back as the identical float64, which is why 18.34 stays 18.34 and 21.0 comes out as 21. That is the right default when a program is reading it back and the wrong one when a person is.",
					},
					pattern: `func printResult(w *WeatherResponse) {
    fmt.Printf("Temperature: %.1f C\\n", w.Current.Temperature)
    fmt.Printf("Wind speed: %.0f km/h\\n", w.Current.WindSpeed)
}`,
					example: {
						en: "A payments API that formats an amount with %v prints 10 for ten dollars and 10.5 for ten fifty. Money gets an explicit precision for the same reason a temperature does: the number and its presentation are different things, and only one of them is arithmetic.",
					},
					task: {
						en: 'Fill in printResult. Exactly two lines: "Temperature: 18.3 C" and "Wind speed: 15 km/h" for the london fixture. Temperature keeps one decimal place, wind speed rounds to a whole number, both on stdout.',
					},
					hints: [
						{
							label: "%.1f rounds, it does not truncate",
							value: "18.34 prints as 18.3 and 18.36 prints as 18.4. If you were reaching for math.Round first, you do not need it: formatting already rounds, and rounding twice is how 18.349 becomes 18.4.",
						},
						{
							label: "ties go to even, not up",
							value: 'fmt.Printf("%.0f", 2.5) prints 2, not 3. So does 1.5 print 2, and 3.5 prints 4, and 0.5 prints 0. Go formats floats with correct rounding, and for an exact tie that means round-half-to-even, the IEEE-754 default, not the round-half-up you were taught at school. It surprises everyone exactly once. No fixture in this lab lands on a tie, so run those four yourself if you want to watch it happen.',
						},
						{
							label: "the units are hardcoded, and that is a bet",
							value: 'The fixture also carries current_units: {"temperature_2m": "°C", "wind_speed_10m": "km/h"}. Your program never reads it. It prints C and km/h because the URL it built in step 01 asked for the defaults, and that is correct exactly as long as those two facts stay in sync. Add a --fahrenheit flag that changes the request and forgets the label, and the program prints "Temperature: 65.0 C" with total confidence. The API tells you the unit in the response for a reason.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check",
					expect: {
						en: "Scenarios 1, 2, and 3 now say ok, five of seven. Look at what each one is actually proving: london rounds 18.34 down to 18.3, baghdad rounds 43.86 up to 43.9 and 3.6 up to 4, and paris prints 21.0 rather than 21, because %.1f emits exactly one digit after the point whether or not that digit carries any information.",
					},
					labPath: "labs/json-fetcher/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Swap both verbs for %v: fmt.Printf("Temperature: %v C\\n", ...) and the same for wind speed. Rerun the check.',
					},
					observe: {
						en: "All three city scenarios fail, and they fail differently. London prints 18.34 C, keeping a decimal you never asked for. Paris prints 21 C, losing one you did. Baghdad prints 43.86 and 3.6.",
					},
					why: {
						en: "%v on a float64 is %g, which prints the shortest decimal string that parses back to the identical float64. For 18.34 that is \"18.34\". For 21.0 it is \"21\", because \"21\" and \"21.0\" read back as the same float64 and the shorter one wins. %g is optimising for round-tripping, which is exactly right when the reader is a program and exactly wrong when the reader is a person: it drops your decimal point the instant the value happens to be round. So the bug only appears for some inputs. That is why paris is in this lab. London on its own would never have caught it, and neither would you.",
					},
				},
			],
			retrievalPrompt:
				'Why does paris print "21.0 C" under %.1f but "21 C" under %v? || %.1f asks for exactly one digit after the point, always. %v on a float64 is %g, the shortest string that reads back as the same float64, and "21" reads back as 21.0, so the point gets dropped as redundant. %g is optimising for a program parsing it again; you are writing for a person. fmt refuses to guess which one you are, which is why the verb is your decision.',
		},
		{
			n: "05",
			heading: { en: "Check the status before you believe the body" },
			uses: ["error-handling"],
			blocks: [
				{
					type: "text",
					value: {
						en: "A 500 has a body. It is well-formed JSON, it arrives with Content-Type: application/json, and json.Decoder will parse it into your WeatherResponse without a word of complaint. What you get back is a struct full of zeroes, and your program will print that as a temperature.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "An HTTP error is not a Go error. client.Get returns a non-nil error only when it could not get a response at all: DNS failed, the connection was refused, the timeout fired. A 404, a 429, a 500 are all successful round trips, and Go hands you the response with err == nil, because from the transport's point of view it worked perfectly. The status code is data the server sent you. Deciding whether that data means success is the caller's job, and it has to happen before anything downstream starts treating the body as the thing you asked for.",
					},
					pattern: `resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("get %s: %w", url, err)
}
defer resp.Body.Close()

if resp.StatusCode != http.StatusOK {
    return nil, fmt.Errorf("unexpected status: %s", resp.Status)
}
// only now is the body worth decoding`,
					example: {
						en: 'An S3 client that decodes before it checks turns a 403 AccessDenied, which arrives as a perfectly good XML document, into an empty object listing. Downstream that reads as "the bucket is empty". The two states are one status code apart and identical by the time anyone looks at them.',
					},
					task: {
						en: "Add the status check to fetch, between the defer and the decode. Anything that is not 200 is an error, and resp.Status has to be in the message so the failure is diagnosable from a log line alone. Return before decoding.",
					},
					hints: [
						{
							label: "resp.Status vs resp.StatusCode",
							value: 'StatusCode is the int, 500. Status is the string, "500 Internal Server Error", already assembled for you by the transport. Put Status in the message: the words cost you nothing, and the person reading the log at 3am has not memorised the RFC.',
						},
						{
							label: "why != 200 and not >= 400",
							value: "For this API 200 is the only success. A client that waves 204 No Content or 304 Not Modified through has to have something sensible to do with an empty body, and this one does not. Being strict at the boundary is cheap. Guessing what a 204 means for a weather report is not.",
						},
						{
							label: "the body you are throwing away",
							value: 'The 500 in this lab carries {"error":true,"reason":"the server fell over"}, which is considerably more useful than "500 Internal Server Error". Reading it means an io.ReadAll on a body you have already decided is an error, bounded with io.LimitReader so a broken server cannot hand you a gigabyte of apology. That is worth doing in a service. It is not worth doing here, and knowing which situation you are in is the whole point.',
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check",
					expect: {
						en: 'Scenario 5, "server answers 500", now says ok. Six of seven. The one left is the timeout, and it is the reason the run still pauses for thirteen seconds at the end before telling you so.',
					},
					labPath: "labs/json-fetcher/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Delete the status check and rerun. You do not have to construct anything: scenario 5 already points a 500 at you, and the check prints what your program did with it.",
					},
					observe: {
						en: 'Scenario 5 fails, and read what sits under "your stdout": Temperature: 0.0 C and Wind speed: 0 km/h. Your program fetched a 500, decoded the error body, printed a temperature, and exited 0.',
					},
					why: {
						en: 'The 500 body is {"error":true,"reason":"the server fell over"}. That is valid JSON and a valid object, so the decoder does exactly what it did to you in step 02: it walks the keys, finds no field tagged error or reason, discards both, never visits Temperature or WindSpeed, and returns nil. Every layer did its job. The transport got a response, so err was nil. The decoder got a well-formed object, so err was nil. The formatter got a float64, so it printed one. Zero is what a struct is born with, and nobody on that path had any reason to suspect it was not the answer. The status check is the only place in the entire program that knows the difference between a weather report and an apology.',
					},
				},
			],
			retrievalPrompt:
				"client.Get returned err == nil and the server said 500. Why is that not a contradiction? || Because a 500 is a successful HTTP round trip: the request went out, a response came back, and the transport has nothing to complain about. Get returns an error only when there is no response at all, like a refused connection or a fired timeout. The status code is data the server sent you, and deciding whether that data means success is the caller's job, not the transport's.",
		},
		{
			n: "06",
			heading: { en: "Give the client a deadline" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "A server that refuses your connection fails in a millisecond, and you will find that bug the first time you run the program. A server that accepts your connection and then says nothing does not fail at all. It just holds the line open. A zero-value http.Client will wait for it until one of the two of you is restarted, and yours is the one with a person watching a blank terminal.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "http.Client has no deadline of its own. The zero value's Timeout is 0, and for that field 0 means no limit, not no time. There are TCP timeouts underneath, but they are measured in minutes and they only fire when the connection actually breaks; a healthy connection with a silent peer on the far end is, at the socket level, working perfectly. Client.Timeout is a wall-clock budget for the whole operation: dial, TLS handshake, request, response headers, and reading the body. When it fires, Get returns an error and the connection is closed.",
					},
					pattern: `// Timeout covers everything: dial, TLS, request, headers, and body.
// It is not a connect timeout.
client := &http.Client{Timeout: 10 * time.Second}`,
					example: {
						en: "This is the failure underneath most of the incidents that get written up as \"the service just stopped responding\". A dependency goes silent rather than down. Every handler that calls it parks on a client with no timeout. The goroutines pile up, each holding its request, its context, and its share of the connection pool, and the service dies of what looks like a memory leak. Nothing crashed. Nothing errored. It waited.",
					},
					task: {
						en: "Give your client a Timeout of 10 seconds. Then think about the number rather than copying it. The API answers in well under a second, so ten seconds is not a guess about the network: it is a statement that after ten seconds you would rather have an error than an answer. For a CLI with a person watching, that is about right. For a background sync of a large file it would be absurd. The number is a product decision. Having one is not.",
					},
					hints: [
						{
							label: "why the client and not the request",
							value: "Client.Timeout applies to every request the client makes, which is what you want for a client you own and point at one API. When different calls need different budgets, or when a caller upstream needs to cancel yours, the tool is http.NewRequestWithContext and a context deadline. That is a Tier 2 subject. The field is enough here, and it is what an enormous amount of production Go actually uses.",
						},
						{
							label: "what the clock covers",
							value: "It starts when Get is called and it includes reading the body, which is why a fetch that returns the still-open body to its caller and lets them read it later is subtly wrong: the caller's read can hit a deadline that started before they existed. This program decodes inside fetch, so the budget covers the whole operation and there is nothing left dangling.",
						},
						{
							label: "zero means forever, and that is a Go-wide pattern",
							value: "Look at http.Server: ReadTimeout, WriteTimeout, IdleTimeout, all zero by default, all meaning no limit. The standard library will not pick a number for you, because it cannot know your workload and a wrong default would be worse than an obvious absence. The cost of that honesty is that the safe configuration is never the one you get for free.",
						},
					],
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check",
					expect: {
						en: 'Scenario 7, "server never answers", now says ok, and the run ends with "self-check passed: 7 of 7 scenarios. This part of the project is done." That scenario takes about ten seconds and it should: those ten seconds are your Timeout firing in real time against a server that accepted the connection and then went quiet forever. Watch the clock on it once, because that is the exact interval a user would have spent staring at nothing.',
					},
					labPath: "labs/json-fetcher/check/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: "Take the Timeout back out: client := &http.Client{}. Rerun the check.",
					},
					observe: {
						en: 'Scenario 7 sits there for thirteen seconds and then fails with "your program ran for 13s without finishing, so the check killed it". The thirteen seconds is the check giving up on you. Your program had no intention of giving up on anything.',
					},
					why: {
						en: 'The server accepted the TCP connection and never wrote a byte. Nothing is broken: there is no RST for the kernel to report, no EOF for the transport to notice, no data for anything to be impatient about. Your program is blocked in a read on a socket that is, by every measure the operating system has, perfectly healthy. With Timeout unset there is no clock anywhere in that picture that will ever fire. The only reason your terminal came back is that a different program killed yours. In a service nothing kills it: the goroutine parks there holding its request and its connection, and it does that once more for every request that arrives, until the process dies of exhaustion. This is why "always set a Timeout" is not advice about tidiness. It is the only thing standing between you and a program with no way to stop.',
					},
				},
			],
			retrievalPrompt:
				"Your program is blocked reading from a server that accepted your connection and then went silent. What breaks it out? || Nothing, unless you put it there. There is no error to report: the socket is healthy and the peer is merely quiet, so the kernel and the transport both have nothing to say. http.Client's zero Timeout means no limit, not no time. The only clock in that picture is the one you set.",
		},
		{
			n: "07",
			heading: { en: "Run the whole self-check, then read the reference" },
			uses: [],
			blocks: [
				{
					type: "text",
					value: {
						en: "You have been reading the check one scenario at a time. Run it now as the thing it actually is: seven statements about how an HTTP client behaves, written before you started, four of them about the ways it goes wrong. Green means your program agrees with all seven. Then the useful part starts, which is finding out where somebody else disagreed with you.",
					},
				},
				{
					type: "pattern",
					concept: {
						en: "Read the reference after your check is green, not before, and the reason is not discipline. Once you have made the decisions yourself, every line of someone else's version is a question: not what does this do, but why did they put it there when I put it here. Before you have written it, the same file reads as obvious and teaches you nothing at all.",
					},
					pattern: `go run ./check                    // checks ./starter, which is your code
go run ./check -target ./solution // proves the check itself is passable`,
					example: {
						en: "Code review works this way and for this reason. The reviewer who has already thought about the problem catches design decisions. Everyone else catches typos.",
					},
					task: {
						en: "Get all 7 scenarios to match. Then open labs/json-fetcher/solution/main.go and compare three specific things against your version: whether buildURL reaches for *baseURL itself or takes it as an argument, whether the status check lives inside fetch or up in main, and what fetch wraps its errors with. Where you differ, decide which you prefer and say why out loud. Some of your choices are better. The reference is one person's answer to the same seven scenarios, not the answer.",
					},
				},
				{
					type: "verify",
					where: "labs/json-fetcher",
					command: "go run ./check\ngo run ./check -target ./solution",
					expect: {
						en: 'Both runs end with "self-check passed: 7 of 7 scenarios." The second one is not grading you. It is the check proving it is passable, which is the only reason you have to believe it when it says your program is wrong.',
					},
					labPath: "labs/json-fetcher/solution/main.go",
				},
				{
					type: "breakIt",
					change: {
						en: 'Run go run ./check -target ./solution, then break one thing in solution/main.go: drop the underscore from the temperature_2m tag again. Rerun. Then put it back with git checkout labs/json-fetcher/solution/main.go.',
					},
					observe: {
						en: 'The reference fails scenarios 1, 2, and 3, printing "Temperature: 0.0 C" for all three while the wind speed stays correct. Scenarios 4 through 7 still pass. The check does not know or care which file it is looking at.',
					},
					why: {
						en: "The check builds whatever package -target names and compares what comes out of it. It has no privileged knowledge of the reference, which is what makes it a description of the spec rather than a diff against one answer, and it is why the lab ships the reference behind the same seven scenarios instead of as prose: an unverified reference is just an opinion. Now notice which scenarios survived. The three that broke are the ones that read a number. The four failure-path scenarios passed, because a program can be completely wrong about the weather and still be right about a 500, a truncated body, an unknown city, and a silent server. Checks only ever see what they look at, and this one is telling you the truth about a program that is broken.",
					},
				},
			],
			retrievalPrompt:
				'The reference solution is known to be correct. Why does the lab run the same check against it? || Because that is what makes the check evidence instead of a guess. A set of scenarios nobody has ever passed proves nothing when it fails you. Running it against a real implementation is the only thing that separates "your program is wrong" from "the check is wrong".',
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You built the shape every API client in Go has: translate input into a request at one boundary, refuse what you cannot translate, get a response, decide whether to believe it, decode it into types you named yourself, and format it for whoever is reading. The steps that mattered were the ones about not believing things: the status before the body, the tag that has to match the key, the deadline on a server that owes you nothing.",
			},
		},
		{
			type: "text",
			value: {
				en: "Four of this program's seven scenarios are failures, and that ratio is not padding. Look back at what each one actually taught. A missing map key is a coordinate in the Gulf of Guinea that the real API will answer for. A 500 is a well-formed JSON object that decodes cleanly into a temperature of zero. A wrong struct tag is a zero with no error attached to it. A silent server is a program that never returns. None of them crash, none of them are caught by reading the code, and every one of them ends in a plausible number printed with total confidence. That is the only kind of bug that survives long enough to reach production.",
			},
		},
	],
}
