// The suite pins behavior, not loop shape: it drives the package only
// through its exported API (Sum, Mean, Bounds, Histogram, CountAbove,
// Smooth) and asserts on returned values. Any internal rewrite that
// keeps these outcomes is a valid frame package, whether it walks bytes
// by index or by range. That freedom is what makes the refactor a lint
// loop instead of a test-rewriting exercise.
package frame_test

import (
	"bytes"
	"errors"
	"testing"

	frame "gopath.dev/labs/idioms/index-juggling"
)

// Subtest names shared across tables.
const (
	emptyFrame   = "empty frame"
	singleSample = "single sample"
)

func TestSum(t *testing.T) {
	tests := []struct {
		name    string
		samples []byte
		want    int
	}{
		{emptyFrame, nil, 0},
		{singleSample, []byte{7}, 7},
		{"typical frame", []byte{1, 2, 3, 4}, 10},
		{"saturated samples", []byte{255, 255, 255}, 765},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := frame.Sum(tt.samples); got != tt.want {
				t.Fatalf("Sum(%v) = %d, want %d", tt.samples, got, tt.want)
			}
		})
	}
}

func TestMean(t *testing.T) {
	tests := []struct {
		name    string
		samples []byte
		want    byte
	}{
		{singleSample, []byte{9}, 9},
		{"exact mean", []byte{2, 4, 6}, 4},
		{"truncated mean", []byte{1, 2}, 1},
		{"saturated samples", []byte{255, 255}, 255},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := frame.Mean(tt.samples)
			if err != nil {
				t.Fatalf("Mean(%v): %v", tt.samples, err)
			}
			if got != tt.want {
				t.Fatalf("Mean(%v) = %d, want %d", tt.samples, got, tt.want)
			}
		})
	}
}

func TestMeanEmptyFrame(t *testing.T) {
	if _, err := frame.Mean(nil); !errors.Is(err, frame.ErrEmptyFrame) {
		t.Fatalf("Mean(nil) error = %v, want frame.ErrEmptyFrame", err)
	}
}

func TestBounds(t *testing.T) {
	tests := []struct {
		name    string
		samples []byte
		wantLo  byte
		wantHi  byte
	}{
		{singleSample, []byte{42}, 42, 42},
		{"already sorted", []byte{1, 2, 3}, 1, 3},
		{"unsorted", []byte{80, 3, 255, 0, 7}, 0, 255},
		{"all equal", []byte{9, 9, 9}, 9, 9},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lo, hi, err := frame.Bounds(tt.samples)
			if err != nil {
				t.Fatalf("Bounds(%v): %v", tt.samples, err)
			}
			if lo != tt.wantLo || hi != tt.wantHi {
				t.Fatalf("Bounds(%v) = (%d, %d), want (%d, %d)",
					tt.samples, lo, hi, tt.wantLo, tt.wantHi)
			}
		})
	}
}

func TestBoundsEmptyFrame(t *testing.T) {
	if _, _, err := frame.Bounds([]byte{}); !errors.Is(err, frame.ErrEmptyFrame) {
		t.Fatalf("Bounds([]byte{}) error = %v, want frame.ErrEmptyFrame", err)
	}
}

func TestHistogram(t *testing.T) {
	samples := []byte{3, 3, 7, 0, 3}
	counts := frame.Histogram(samples)
	want := map[byte]int{0: 1, 3: 3, 7: 1}
	for value, n := range want {
		if counts[value] != n {
			t.Errorf("Histogram(%v)[%d] = %d, want %d", samples, value, counts[value], n)
		}
	}
	total := 0
	for _, n := range counts {
		total += n
	}
	if total != len(samples) {
		t.Errorf("Histogram(%v) counts %d samples in total, want %d",
			samples, total, len(samples))
	}
}

func TestHistogramEmptyFrame(t *testing.T) {
	if counts := frame.Histogram(nil); counts != [256]int{} {
		t.Fatalf("Histogram(nil) = %v, want all zeros", counts)
	}
}

func TestCountAbove(t *testing.T) {
	tests := []struct {
		name      string
		samples   []byte
		threshold byte
		want      int
	}{
		{emptyFrame, nil, 0, 0},
		{"all above", []byte{10, 20, 30}, 5, 3},
		{"none above", []byte{1, 2, 3}, 200, 0},
		{"equal is not above", []byte{50, 50, 51}, 50, 1},
		{"nothing tops max threshold", []byte{255, 255}, 255, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := frame.CountAbove(tt.samples, tt.threshold); got != tt.want {
				t.Fatalf("CountAbove(%v, %d) = %d, want %d",
					tt.samples, tt.threshold, got, tt.want)
			}
		})
	}
}

func TestSmooth(t *testing.T) {
	tests := []struct {
		name    string
		samples []byte
		passes  int
		want    []byte
	}{
		{"zero passes copies", []byte{1, 2, 3}, 0, []byte{1, 2, 3}},
		{"negative passes copies", []byte{5, 10}, -1, []byte{5, 10}},
		{"one pass flattens a spike", []byte{0, 6, 0}, 1, []byte{2, 2, 2}},
		{"steady state stays put", []byte{0, 6, 0}, 2, []byte{2, 2, 2}},
		{"edges reuse the boundary sample", []byte{9, 0, 0, 0}, 1, []byte{6, 3, 0, 0}},
		{emptyFrame, nil, 3, []byte{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := frame.Smooth(tt.samples, tt.passes); !bytes.Equal(got, tt.want) {
				t.Fatalf("Smooth(%v, %d) = %v, want %v",
					tt.samples, tt.passes, got, tt.want)
			}
		})
	}
}

func TestSmoothReturnsAFreshSlice(t *testing.T) {
	samples := []byte{1, 2, 3}
	got := frame.Smooth(samples, 0)
	got[0] = 99
	if !bytes.Equal(samples, []byte{1, 2, 3}) {
		t.Fatalf("mutating Smooth's result changed the input frame to %v; Smooth must return a fresh slice", samples)
	}
}
