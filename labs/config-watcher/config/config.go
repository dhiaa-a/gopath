// Package config is the graded slice of the live config reloader: the part
// that survives without a file system or a third-party dependency.
//
// Two halves. Debounce collapses a burst of file system events into one
// reload, which is the step 02 loop with fsnotify factored out. Store and
// MutexStore are the two implementations of "hold the current *Config so
// that readers never block", one behind sync/atomic.Value and one behind
// sync.RWMutex. The suite grades all three; the benchmarks and the gate
// settle which store belongs on the hot path.
package config

// Config is the parsed configuration the rest of the program reads. The
// watcher replaces the whole value on every reload; nothing ever mutates a
// Config after it has been stored. That contract is what makes the atomic
// pointer swap safe.
type Config struct {
	Port     int
	LogLevel string
}
