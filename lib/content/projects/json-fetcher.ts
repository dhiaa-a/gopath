import { Project } from "../../content"

export const jsonFetcher: Project = {
	slug: "json-fetcher",
	name: "JSON API fetcher",
	tagline: "Fetch, decode, and display typed data from a live JSON API.",
	code: "JFT",
	tier: 1,
	tierLabel: "FOUNDATIONS",
	estimatedTime: "2–3 hours",
	tags: ["net/http", "encoding/json", "structs", "defer"],
	lab: {
		path: "labs/json-fetcher",
		command: "go run ./check",
		summary: {
			en: "A check program runs your binary against a local server serving fixture JSON and shows your output next to the expected output, including the 500 and broken-JSON paths; a self-check, not a graded suite.",
		},
	},
	mentalModels: [
		"type-safe decoding at the boundary",
		"resource cleanup with defer",
		"struct tags as a contract",
		"explicit status code handling",
	],
	systemOverview: [
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
 ├── buildURL(city string) (string, error)
 ├── fetch(url string) (*WeatherResponse, error)
 │    ├── client.Get → defer body.Close()
 │    ├── check resp.StatusCode
 │    └── json.NewDecoder.Decode
 └── printResult(w *WeatherResponse)`,
		},
	],
	steps: [
		{
			n: "01",
			heading: { en: "Model the API response with struct tags" },
			uses: ["json-decode","structs"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: 'encoding/json maps JSON keys to struct fields using struct tags. The field must be exported (start with an uppercase letter) or json silently ignores it. The tag controls the JSON key name, whether to omit the field when empty (omitempty), and whether to skip it entirely (json:"-"). Unexported fields are always ignored; no tag needed.',
					},
					pattern: `type Record struct {
    ID    int    \`json:"id"\`
    Name  string \`json:"full_name"\`
    Score float64 \`json:"score,omitempty"\`
    cache string  // unexported — never in JSON
}`,
					example: {
						en: 'A GitHub API client defines a Repository struct: json:"full_name" maps the API\'s snake_case key to a Go field, json:"stargazers_count" maps star count, and json:"-" on an internal etag field ensures it never appears in serialised output.',
					},
					task: {
						en: 'Look at the Open-Meteo API response with curl: curl "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.1&current=temperature_2m,wind_speed_10m". Define WeatherResponse with Latitude, Longitude float64 and a nested Current struct with Temperature (temperature_2m) and WindSpeed (wind_speed_10m). Tags must match the exact JSON keys the API returns.',
					},
					hints: [
						{
							label: "nested structs",
							value: "A nested JSON object maps to a nested Go struct. The outer struct holds a field of the inner type, tagged with the JSON key of the nested object.",
						},
					],
				},
			],
		},
		{
			n: "02",
			heading: { en: "Make an HTTP request with a timeout" },
			uses: ["defer","error-handling"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "The default http.Client has no timeout; it waits forever for slow or dead servers. Always set an explicit Timeout. The response Body is an io.ReadCloser: if you don't close it, the underlying TCP connection leaks and cannot be reused. Defer body.Close() immediately after a successful Get (before any other error check) so it always runs.",
					},
					pattern: `client := &http.Client{Timeout: 10 * time.Second}

resp, err := client.Get(url)
if err != nil {
    return nil, fmt.Errorf("get: %w", err)
}
defer resp.Body.Close() // always runs, even if decode fails

if resp.StatusCode != http.StatusOK {
    return nil, fmt.Errorf("unexpected status: %s", resp.Status)
}`,
					example: {
						en: "A currency rate fetcher sets a 5-second timeout, defers body close, checks for HTTP 200, and only then decodes, so a 429 Too Many Requests returns a clear error rather than a confusing JSON decode failure.",
					},
					task: {
						en: "Write fetch(url string) (*WeatherResponse, error). Use &http.Client{Timeout: 10 * time.Second}. Defer body close immediately after checking the Get error. Check the status code before decoding. Return a wrapped, descriptive error at each failure point.",
					},
				},
			],
		},
		{
			n: "03",
			heading: { en: "Decode the response and format output" },
			uses: ["json-decode"],
			blocks: [
				{
					type: "pattern",
					concept: {
						en: "json.NewDecoder wraps an io.Reader and decodes directly from it; no need to buffer the entire body into a []byte first. Pass a pointer to your struct: Decode needs to write into it. A non-nil error from Decode means the JSON was malformed or didn't match the struct shape.",
					},
					pattern: `var result MyStruct
if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
    return nil, fmt.Errorf("decode: %w", err)
}`,
					example: {
						en: "A Stripe webhook handler decodes the request body directly into an Event struct using json.NewDecoder(r.Body). It never calls io.ReadAll first; for large payloads this would buffer megabytes unnecessarily.",
					},
					task: {
						en: 'Complete fetch() with json.NewDecoder decoding. Then write printResult(*WeatherResponse) that prints exactly two lines, "Temperature: 18.3 C" and "Wind speed: 15 km/h" (your values will differ): temperature to one decimal place, wind speed rounded to the nearest integer. Add a --city flag accepting "london", "paris", or "baghdad" mapped to hardcoded lat/lon; the user should never type coordinates. Add a --base-url flag defaulting to the real Open-Meteo endpoint: the lab check points it at a local server, which is how an HTTP client gets verified without the live internet.',
					},
				},
			],
		},
	],
	recap: [
		{
			type: "text",
			value: {
				en: "You learned the complete HTTP + JSON cycle: typed client, defer-based resource cleanup, status code checking before decoding, struct-tag contracts. Every API client you write from here follows this exact shape.",
			},
		},
	],
}
