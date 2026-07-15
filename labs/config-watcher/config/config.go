// Package config is the store slice of the live config reloader: the two
// implementations of "hold the current *Config so that readers never block",
// one behind sync/atomic.Value and one behind sync.RWMutex. The suite in
// this package grades both; the benchmarks and the gate settle which one
// belongs on the hot path.
package config

// Config is the parsed configuration the rest of the program reads. The
// watcher replaces the whole value on every reload; nothing ever mutates a
// Config after it has been stored. That contract is what makes the atomic
// pointer swap safe.
type Config struct {
	Port     int
	LogLevel string
}
