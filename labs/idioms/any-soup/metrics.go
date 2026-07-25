//go:build !solution

// Package metrics is a small in-memory registry of named series: record
// float64 samples under a name, then ask for totals, counts, and peaks.
package metrics

import (
	"errors"
	"fmt"
	"slices"
)

// Sentinel errors callers can test with errors.Is.
var (
	// ErrNotFound is returned when a series name is not in the registry.
	ErrNotFound = errors.New("series not found")
	// ErrExists is returned when a rename would overwrite a series.
	ErrExists = errors.New("series already exists")
)

// The whole registry lives in one map, and the schema is a key-naming
// convention: the sample list for series "s" sits at key "s", its running
// total at "s.total", and its metadata map at "s.meta". Readers know
// which shape lives behind which key because the writers promise it.
const (
	totalSuffix = ".total"
	metaSuffix  = ".meta"
	unitKey     = "unit"
)

// Registry is an in-memory store of named metric series.
type Registry struct {
	data map[string]interface{}
}

// New returns an empty registry ready for use.
func New() *Registry {
	return &Registry{data: make(map[string]interface{})}
}

// Record appends one sample to the named series, creating the series on
// first use. Every series keeps all three of its entries from birth so
// that readers never find a key missing mid-family.
func (r *Registry) Record(name string, value float64) {
	if _, ok := r.data[name]; !ok {
		r.data[name] = []interface{}{value}
		r.data[name+totalSuffix] = value
		r.data[name+metaSuffix] = map[string]interface{}{unitKey: ""}
		return
	}
	samples := r.data[name].([]interface{})
	samples = append(samples, value)
	r.data[name] = samples
	total := r.data[name+totalSuffix].(float64)
	r.data[name+totalSuffix] = total + value
}

// Total reports the sum of every sample recorded under name. A name that
// was never recorded totals zero.
func (r *Registry) Total(name string) float64 {
	v, ok := r.data[name+totalSuffix]
	if !ok {
		return 0
	}
	return v.(float64)
}

// Count reports how many samples have been recorded under name.
func (r *Registry) Count(name string) int {
	v, ok := r.data[name]
	if !ok {
		return 0
	}
	return len(v.([]interface{}))
}

// Max reports the largest sample recorded under name, or zero if name
// was never recorded.
func (r *Registry) Max(name string) float64 {
	v, ok := r.data[name]
	if !ok {
		return 0
	}
	samples := v.([]interface{})
	top := samples[0].(float64)
	for _, s := range samples[1:] {
		top = max(top, s.(float64))
	}
	return top
}

// Rename moves the series at from to the name to. It fails if from does
// not exist or to already does.
func (r *Registry) Rename(from, to string) error {
	if _, ok := r.data[from]; !ok {
		return fmt.Errorf("rename %q: %w", from, ErrNotFound)
	}
	if _, ok := r.data[to]; ok {
		return fmt.Errorf("rename %q to %q: %w", from, to, ErrExists)
	}
	r.data[to] = r.data[from]
	r.data[to+totalSuffix] = r.data[from+totalSuffix]
	r.data[to+metaSuffix] = r.data[from+metaSuffix]
	delete(r.data, from)
	delete(r.data, from+totalSuffix)
	delete(r.data, from+metaSuffix)
	return nil
}

// SetUnit attaches a display unit (say "ms" or "bytes") to an existing
// series.
func (r *Registry) SetUnit(name, unit string) error {
	if _, ok := r.data[name]; !ok {
		return fmt.Errorf("set unit for %q: %w", name, ErrNotFound)
	}
	r.data[name+metaSuffix].(map[string]interface{})[unitKey] = unit
	return nil
}

// Unit reports the display unit attached to name, or "" if none is set.
func (r *Registry) Unit(name string) string {
	v, ok := r.data[name+metaSuffix]
	if !ok {
		return ""
	}
	return v.(map[string]interface{})[unitKey].(string)
}

// Names lists every recorded series name, sorted. A key is a series name
// when its value is a sample list; everything else in the map is the
// bookkeeping that rides along with one.
func (r *Registry) Names() []string {
	var names []string
	for key, value := range r.data {
		if _, ok := value.([]interface{}); ok {
			names = append(names, key)
		}
	}
	slices.Sort(names)
	return names
}
