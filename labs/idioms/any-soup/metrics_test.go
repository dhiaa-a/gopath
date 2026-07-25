// The suite pins behavior, not structure: it drives the registry only
// through its public surface (New, Record, Total, Count, Max, Rename,
// SetUnit, Unit, Names), never through the storage underneath. That is
// what makes the refactor safe: any internal shape that keeps these
// observable outcomes is a valid registry.
package metrics_test

import (
	"slices"
	"testing"

	metrics "gopath.dev/labs/idioms/any-soup"
)

const (
	reqLatency = "request.latency"
	dbQueries  = "db.queries"
	cacheHits  = "cache.hits"
	unknown    = "no.such.series"
)

func newRegistryWith(t *testing.T, samples map[string][]float64) *metrics.Registry {
	t.Helper()
	r := metrics.New()
	for name, values := range samples {
		for _, v := range values {
			r.Record(name, v)
		}
	}
	return r
}

func TestTotalAndCount(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{
		reqLatency: {1.5, 2.25, 4},
		dbQueries:  {10},
	})
	tests := []struct {
		name      string
		series    string
		wantTotal float64
		wantCount int
	}{
		{"samples accumulate", reqLatency, 7.75, 3},
		{"single sample", dbQueries, 10, 1},
		{"never recorded", unknown, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := r.Total(tt.series); got != tt.wantTotal {
				t.Errorf("Total(%q) = %v, want %v", tt.series, got, tt.wantTotal)
			}
			if got := r.Count(tt.series); got != tt.wantCount {
				t.Errorf("Count(%q) = %v, want %v", tt.series, got, tt.wantCount)
			}
		})
	}
}

func TestMax(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{
		reqLatency: {2.5, 9, 3.25},
		dbQueries:  {-8, -2.5, -4},
	})
	if got := r.Max(reqLatency); got != 9 {
		t.Errorf("Max(%q) = %v, want 9", reqLatency, got)
	}
	if got := r.Max(dbQueries); got != -2.5 {
		t.Errorf("Max(%q) = %v, want -2.5 (an all-negative series must not report zero)", dbQueries, got)
	}
	if got := r.Max(unknown); got != 0 {
		t.Errorf("Max(%q) = %v, want 0", unknown, got)
	}
}

func TestNamesSorted(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{
		reqLatency: {1},
		dbQueries:  {2},
		cacheHits:  {3},
	})
	want := []string{cacheHits, dbQueries, reqLatency}
	if got := r.Names(); !slices.Equal(got, want) {
		t.Fatalf("Names() = %v, want %v", got, want)
	}
}

func TestRenameMovesEverything(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{reqLatency: {1.5, 4}})
	if err := r.SetUnit(reqLatency, "ms"); err != nil {
		t.Fatalf("SetUnit(%q): %v", reqLatency, err)
	}
	if err := r.Rename(reqLatency, dbQueries); err != nil {
		t.Fatalf("Rename(%q, %q): %v", reqLatency, dbQueries, err)
	}
	if got := r.Total(dbQueries); got != 5.5 {
		t.Errorf("after rename, Total(%q) = %v, want 5.5", dbQueries, got)
	}
	if got := r.Count(dbQueries); got != 2 {
		t.Errorf("after rename, Count(%q) = %v, want 2", dbQueries, got)
	}
	if got := r.Unit(dbQueries); got != "ms" {
		t.Errorf("after rename, Unit(%q) = %q, want %q", dbQueries, got, "ms")
	}
	if got, want := r.Names(), []string{dbQueries}; !slices.Equal(got, want) {
		t.Errorf("after rename, Names() = %v, want %v", got, want)
	}
	if got := r.Total(reqLatency); got != 0 {
		t.Errorf("after rename, Total(%q) = %v, want 0", reqLatency, got)
	}
	if got := r.Unit(reqLatency); got != "" {
		t.Errorf("after rename, Unit(%q) = %q, want empty", reqLatency, got)
	}
	// The old name is fully gone: recording under it starts fresh.
	r.Record(reqLatency, 3)
	if got := r.Count(reqLatency); got != 1 {
		t.Errorf("after re-recording, Count(%q) = %v, want 1", reqLatency, got)
	}
	if got := r.Total(reqLatency); got != 3 {
		t.Errorf("after re-recording, Total(%q) = %v, want 3", reqLatency, got)
	}
}

func TestRenameWithoutUnit(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{cacheHits: {2}})
	if err := r.Rename(cacheHits, dbQueries); err != nil {
		t.Fatalf("Rename(%q, %q): %v", cacheHits, dbQueries, err)
	}
	if got := r.Unit(dbQueries); got != "" {
		t.Errorf("Unit(%q) = %q, want empty for a series never given a unit", dbQueries, got)
	}
	if got := r.Total(dbQueries); got != 2 {
		t.Errorf("after rename, Total(%q) = %v, want 2", dbQueries, got)
	}
}

func TestSetUnitOverwrites(t *testing.T) {
	r := newRegistryWith(t, map[string][]float64{reqLatency: {1}})
	if got := r.Unit(reqLatency); got != "" {
		t.Errorf("Unit(%q) = %q, want empty before SetUnit", reqLatency, got)
	}
	if err := r.SetUnit(reqLatency, "ms"); err != nil {
		t.Fatalf("SetUnit(%q): %v", reqLatency, err)
	}
	if err := r.SetUnit(reqLatency, "s"); err != nil {
		t.Fatalf("SetUnit(%q): %v", reqLatency, err)
	}
	if got := r.Unit(reqLatency); got != "s" {
		t.Errorf("Unit(%q) = %q, want %q", reqLatency, got, "s")
	}
	if got := r.Unit(unknown); got != "" {
		t.Errorf("Unit(%q) = %q, want empty for an unknown series", unknown, got)
	}
}

func TestErrors(t *testing.T) {
	tests := []struct {
		name string
		op   func(t *testing.T, r *metrics.Registry) error
	}{
		{"rename a series that does not exist", func(t *testing.T, r *metrics.Registry) error {
			return r.Rename(unknown, cacheHits)
		}},
		{"rename onto a series that exists", func(t *testing.T, r *metrics.Registry) error {
			return r.Rename(reqLatency, dbQueries)
		}},
		{"set unit on a series that does not exist", func(t *testing.T, r *metrics.Registry) error {
			return r.SetUnit(unknown, "ms")
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newRegistryWith(t, map[string][]float64{
				reqLatency: {1},
				dbQueries:  {2},
			})
			if err := tt.op(t, r); err == nil {
				t.Fatalf("%s: got nil, want error", tt.name)
			}
		})
	}
}
