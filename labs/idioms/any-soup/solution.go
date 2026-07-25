//go:build solution

// Package metrics is a small in-memory registry of named series: record
// float64 samples under a name, then ask for totals, counts, and peaks.
package metrics

import (
	"errors"
	"fmt"
	"maps"
	"slices"
)

// Sentinel errors callers can test with errors.Is.
var (
	// ErrNotFound is returned when a series name is not in the registry.
	ErrNotFound = errors.New("series not found")
	// ErrExists is returned when a rename would overwrite a series.
	ErrExists = errors.New("series already exists")
)

// series is everything the registry knows about one name. What the
// starter spread across three differently shaped map entries is one
// struct the compiler checks on every access.
type series struct {
	samples []float64
	total   float64
	unit    string
}

// Registry is an in-memory store of named metric series.
type Registry struct {
	series map[string]*series
}

// New returns an empty registry ready for use.
func New() *Registry {
	return &Registry{series: make(map[string]*series)}
}

// Record appends one sample to the named series, creating the series on
// first use.
func (r *Registry) Record(name string, value float64) {
	s, ok := r.series[name]
	if !ok {
		s = &series{}
		r.series[name] = s
	}
	s.samples = append(s.samples, value)
	s.total += value
}

// Total reports the sum of every sample recorded under name. A name that
// was never recorded totals zero.
func (r *Registry) Total(name string) float64 {
	s, ok := r.series[name]
	if !ok {
		return 0
	}
	return s.total
}

// Count reports how many samples have been recorded under name.
func (r *Registry) Count(name string) int {
	s, ok := r.series[name]
	if !ok {
		return 0
	}
	return len(s.samples)
}

// Max reports the largest sample recorded under name, or zero if name
// was never recorded. A series always holds at least one sample, so
// slices.Max never sees an empty slice.
func (r *Registry) Max(name string) float64 {
	s, ok := r.series[name]
	if !ok {
		return 0
	}
	return slices.Max(s.samples)
}

// Rename moves the series at from to the name to. It fails if from does
// not exist or to already does.
func (r *Registry) Rename(from, to string) error {
	s, ok := r.series[from]
	if !ok {
		return fmt.Errorf("rename %q: %w", from, ErrNotFound)
	}
	if _, ok := r.series[to]; ok {
		return fmt.Errorf("rename %q to %q: %w", from, to, ErrExists)
	}
	r.series[to] = s
	delete(r.series, from)
	return nil
}

// SetUnit attaches a display unit (say "ms" or "bytes") to an existing
// series.
func (r *Registry) SetUnit(name, unit string) error {
	s, ok := r.series[name]
	if !ok {
		return fmt.Errorf("set unit for %q: %w", name, ErrNotFound)
	}
	s.unit = unit
	return nil
}

// Unit reports the display unit attached to name, or "" if none is set.
func (r *Registry) Unit(name string) string {
	s, ok := r.series[name]
	if !ok {
		return ""
	}
	return s.unit
}

// Names lists every recorded series name, sorted.
func (r *Registry) Names() []string {
	return slices.Sorted(maps.Keys(r.series))
}
