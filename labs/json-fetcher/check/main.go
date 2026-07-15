// Command check verifies a json-fetcher build without touching the internet.
//
// It builds the target package (default ./starter), starts an HTTP server on
// 127.0.0.1 that serves the same JSON shapes the Open-Meteo API returns
// (fixtures in testdata/), points the binary at that server through its
// --base-url flag, and shows what the binary printed next to what was
// expected. This is a self-check, not an exam: it tells you where your
// program and the expected behavior disagree, then gets out of the way.
//
// Run it from the lab root: go run ./check
package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// cityBox is a loose bounding box. Any sane coordinates for the city fall
// inside it, so the check does not care which exact lat/lon you hardcoded.
type cityBox struct {
	name           string
	minLat, maxLat float64
	minLon, maxLon float64
}

var boxes = []cityBox{
	{"london", 51.0, 52.0, -1.0, 0.5},
	{"paris", 48.0, 49.5, 1.5, 3.5},
	{"baghdad", 33.0, 34.0, 44.0, 45.0},
}

// fakeAPI mimics the Open-Meteo forecast endpoint from fixture files.
// Requests to /status500/... always fail with HTTP 500 and requests to
// /badjson/... return truncated JSON; everything else is matched to a city
// by its latitude/longitude query parameters.
type fakeAPI struct {
	fixtures map[string][]byte

	mu       sync.Mutex
	note     string // why the last request was rejected, shown on failure
	requests int
}

func (s *fakeAPI) reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.note = ""
	s.requests = 0
}

func (s *fakeAPI) snapshot() (note string, requests int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.note, s.requests
}

func (s *fakeAPI) reject(w http.ResponseWriter, msg string) {
	s.mu.Lock()
	s.note = msg
	s.mu.Unlock()
	http.Error(w, msg, http.StatusBadRequest)
}

func (s *fakeAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.requests++
	s.mu.Unlock()

	switch {
	case strings.HasPrefix(r.URL.Path, "/status500"):
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, `{"error":true,"reason":"the server fell over"}`)
		return
	case strings.HasPrefix(r.URL.Path, "/badjson"):
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"latitude": 51.5, "current": {"temperature_2m":`)
		return
	}

	q := r.URL.Query()
	lat, latErr := strconv.ParseFloat(q.Get("latitude"), 64)
	lon, lonErr := strconv.ParseFloat(q.Get("longitude"), 64)
	if latErr != nil || lonErr != nil {
		s.reject(w, fmt.Sprintf("the request query is %q; buildURL must put numeric latitude and longitude parameters in it", r.URL.RawQuery))
		return
	}
	current := q.Get("current")
	if !strings.Contains(current, "temperature_2m") || !strings.Contains(current, "wind_speed_10m") {
		s.reject(w, fmt.Sprintf("the current query parameter is %q; the real API only returns the fields you ask for, so it must include temperature_2m and wind_speed_10m", current))
		return
	}
	for _, b := range boxes {
		if lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon {
			w.Header().Set("Content-Type", "application/json")
			w.Write(s.fixtures[b.name])
			return
		}
	}
	s.reject(w, fmt.Sprintf("latitude=%v longitude=%v is not london, paris, or baghdad; check the hardcoded coordinates", lat, lon))
}

type scenario struct {
	name    string
	city    string // value passed to --city
	path    string // path the base URL points at on the local server
	wantOut string // exact stdout (LF, no trailing newline) for clean runs
	wantErr bool   // the program must notice a problem and exit non-zero
	needle  string // substring the output must contain on error runs
	hint    string // printed when the scenario fails
}

var scenarios = []scenario{
	{
		name:    "fetch london",
		city:    "london",
		path:    "/v1/forecast",
		wantOut: "Temperature: 18.3 C\nWind speed: 15 km/h",
		hint:    "the fixture sends temperature_2m 18.34 and wind_speed_10m 14.7; print them with %.1f and %.0f",
	},
	{
		name:    "fetch paris",
		city:    "paris",
		path:    "/v1/forecast",
		wantOut: "Temperature: 21.0 C\nWind speed: 8 km/h",
		hint:    "21.0 keeps its decimal: %.1f always prints exactly one digit after the point",
	},
	{
		name:    "fetch baghdad",
		city:    "baghdad",
		path:    "/v1/forecast",
		wantOut: "Temperature: 43.9 C\nWind speed: 4 km/h",
		hint:    "43.86 rounds to 43.9 and 3.6 rounds to 4; formatting rounds, it does not truncate",
	},
	{
		name:    "server answers 500",
		city:    "london",
		path:    "/status500/v1/forecast",
		wantErr: true,
		needle:  "500",
		hint:    "check resp.StatusCode before decoding and put resp.Status in the error; decoding a 500 body gives zeroes, not weather",
	},
	{
		name:    "server sends broken JSON",
		city:    "london",
		path:    "/badjson/v1/forecast",
		wantErr: true,
		hint:    "the json.Decoder error must reach main and turn into a non-zero exit, not get ignored",
	},
}

func main() {
	target := flag.String("target", "./starter", "package to build and check")
	flag.Parse()

	if err := run(*target); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(target string) error {
	fixtures := make(map[string][]byte)
	for _, b := range boxes {
		data, err := os.ReadFile(filepath.Join("testdata", b.name+".json"))
		if err != nil {
			return fmt.Errorf("cannot read fixtures (run the check from the lab root, labs/json-fetcher): %w", err)
		}
		fixtures[b.name] = data
	}

	tmp, err := os.MkdirTemp("", "json-fetcher-check")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)

	exe := filepath.Join(tmp, "fetcher.exe")
	fmt.Printf("building %s ... ", target)
	if out, err := exec.Command("go", "build", "-o", exe, target).CombinedOutput(); err != nil {
		fmt.Println("FAIL")
		fmt.Print(indent(string(out)))
		return fmt.Errorf("the build failed; fix the compile errors above and rerun: go run ./check")
	}
	fmt.Println("ok")

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	defer ln.Close()
	api := &fakeAPI{fixtures: fixtures}
	srv := &http.Server{Handler: api}
	go func() { _ = srv.Serve(ln) }()
	defer srv.Close()
	base := "http://" + ln.Addr().String()

	passed := 0
	for i, sc := range scenarios {
		if runScenario(i+1, len(scenarios), exe, base, api, sc) {
			passed++
		}
	}

	fmt.Println()
	if passed != len(scenarios) {
		return fmt.Errorf("self-check: %d of %d scenarios passed; fix the failures above and rerun: go run ./check", passed, len(scenarios))
	}
	fmt.Printf("self-check passed: %d of %d scenarios. This part of the project is done.\n", passed, len(scenarios))
	return nil
}

func runScenario(i, total int, exe, base string, api *fakeAPI, sc scenario) bool {
	api.reset()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, exe, "--city", sc.city, "--base-url", base+sc.path)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	runErr := cmd.Run()

	note, requests := api.snapshot()
	combined := strings.TrimSpace(stdout.String() + "\n" + stderr.String())

	var problems []string
	if ctx.Err() != nil {
		problems = append(problems, "your program ran for 30 seconds without finishing; it is probably waiting on something that never arrives")
	}
	if sc.wantErr {
		if runErr == nil {
			problems = append(problems, "your program exited 0, but here it must notice the problem and exit non-zero")
		}
		if combined == "" {
			problems = append(problems, "your program printed nothing; an error exit should say what went wrong")
		} else if sc.needle != "" && !strings.Contains(combined, sc.needle) {
			problems = append(problems, fmt.Sprintf("the error output never mentions %q; say what status the server returned so the failure is diagnosable", sc.needle))
		}
	} else {
		if runErr != nil {
			problems = append(problems, "your program exited with an error, but this scenario should succeed")
		} else if normalize(stdout.String()) != sc.wantOut {
			problems = append(problems, "stdout does not match the expected output")
		}
	}
	if requests == 0 {
		problems = append(problems, "the local test server never saw a request from your program; the endpoint must come from the --base-url flag, not a hardcoded URL")
	}

	fmt.Printf("[%d/%d] %s ... ", i, total, sc.name)
	if len(problems) == 0 {
		fmt.Println("ok")
		return true
	}
	fmt.Println("FAIL")
	for _, p := range problems {
		fmt.Println("      - " + p)
	}
	if !sc.wantErr {
		fmt.Println("      expected stdout:")
		fmt.Print(indent(sc.wantOut))
	}
	fmt.Println("      your stdout:")
	fmt.Print(indent(stdout.String()))
	if s := strings.TrimSpace(stderr.String()); s != "" {
		fmt.Println("      your stderr:")
		fmt.Print(indent(s))
	}
	if note != "" {
		fmt.Println("      test server note: " + note)
	}
	if sc.hint != "" {
		fmt.Println("      hint: " + sc.hint)
	}
	return false
}

// normalize makes stdout comparable across platforms: CRLF becomes LF and
// trailing newlines are ignored.
func normalize(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.TrimRight(s, "\n")
}

func indent(s string) string {
	s = normalize(s)
	if s == "" {
		s = "(nothing)"
	}
	return "        " + strings.ReplaceAll(s, "\n", "\n        ") + "\n"
}
