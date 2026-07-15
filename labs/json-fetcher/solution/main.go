// Command json-fetcher (reference solution). Do not read this until your
// check run is green; it exists so the check itself stays honest.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"
)

// WeatherResponse mirrors the Open-Meteo /v1/forecast response. Unknown
// JSON keys are ignored by encoding/json, so the struct only names the
// fields the program actually uses.
type WeatherResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Current   struct {
		Temperature float64 `json:"temperature_2m"`
		WindSpeed   float64 `json:"wind_speed_10m"`
	} `json:"current"`
}

var (
	city    = flag.String("city", "", `city to fetch: "london", "paris", or "baghdad"`)
	baseURL = flag.String("base-url", "https://api.open-meteo.com/v1/forecast", "weather API endpoint; the lab check points this at a local server")
)

// cities maps the supported names to hardcoded coordinates. The user never
// types coordinates.
var cities = map[string][2]float64{
	"london":  {51.5, -0.1},
	"paris":   {48.85, 2.35},
	"baghdad": {33.31, 44.37},
}

func buildURL(city string) (string, error) {
	coords, ok := cities[city]
	if !ok {
		return "", fmt.Errorf("unknown city %q (want london, paris, or baghdad)", city)
	}
	return fmt.Sprintf("%s?latitude=%g&longitude=%g&current=temperature_2m,wind_speed_10m",
		*baseURL, coords[0], coords[1]), nil
}

func fetch(url string) (*WeatherResponse, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("get: %w", err)
	}
	defer resp.Body.Close() // always runs, even if a later step fails

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %s", resp.Status)
	}

	var w WeatherResponse
	if err := json.NewDecoder(resp.Body).Decode(&w); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return &w, nil
}

func printResult(w *WeatherResponse) {
	fmt.Printf("Temperature: %.1f C\n", w.Current.Temperature)
	fmt.Printf("Wind speed: %.0f km/h\n", w.Current.WindSpeed)
}

func main() {
	flag.Parse()

	url, err := buildURL(*city)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	w, err := fetch(url)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	printResult(w)
}
