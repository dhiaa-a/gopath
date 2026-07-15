// Command json-fetcher fetches current weather from a JSON API, decodes it
// into a typed struct, and prints two formatted lines.
//
// This is your file. The function stubs below map to the project steps;
// main is already wired so the program compiles and runs from the start.
// Check your work from the lab root with: go run ./check
package main

import (
	"flag"
	"fmt"
	"os"
)

// WeatherResponse models the JSON the weather API returns.
//
// Step 01: add Latitude and Longitude float64 fields and a nested Current
// struct with Temperature (JSON key temperature_2m) and WindSpeed (JSON key
// wind_speed_10m). The struct tags must match the exact JSON keys, or
// encoding/json silently leaves the fields at zero.
type WeatherResponse struct {
}

var (
	city    = flag.String("city", "", `city to fetch: "london", "paris", or "baghdad"`)
	baseURL = flag.String("base-url", "https://api.open-meteo.com/v1/forecast", "weather API endpoint; the lab check points this at a local server")
)

// buildURL maps a city name to hardcoded coordinates and returns the full
// request URL: *baseURL plus latitude, longitude, and
// current=temperature_2m,wind_speed_10m as query parameters.
//
// Step 03: implement it. An unknown city is an error, not a panic.
func buildURL(city string) (string, error) {
	return "", fmt.Errorf("buildURL: not implemented")
}

// fetch GETs the URL and decodes the JSON body into a WeatherResponse.
//
// Step 02: use an http.Client with a 10-second timeout, defer the body
// close immediately after checking the Get error, and refuse to decode
// anything that is not HTTP 200 (put resp.Status in the error).
// Step 03: decode with json.NewDecoder straight off resp.Body.
func fetch(url string) (*WeatherResponse, error) {
	return nil, fmt.Errorf("fetch: not implemented")
}

// printResult prints exactly two lines:
//
//	Temperature: 18.3 C
//	Wind speed: 15 km/h
//
// Temperature keeps one decimal place, wind speed rounds to the nearest
// whole number. Step 03.
func printResult(w *WeatherResponse) {
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
