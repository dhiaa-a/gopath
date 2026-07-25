//go:build solution

// Package frame computes statistics over frames of raw 8-bit sensor
// samples: totals, bounds, histograms, and a small smoothing filter. A
// frame is a []byte straight off the wire. Every function treats each
// byte as one sample, and none of them mutate their input.
package frame

import (
	"errors"
	"fmt"
)

// ErrEmptyFrame is returned by statistics that need at least one sample.
var ErrEmptyFrame = errors.New("empty frame")

// Sum returns the total of every sample in the frame.
func Sum(samples []byte) int {
	total := 0
	for _, v := range samples {
		total += int(v)
	}
	return total
}

// Mean returns the truncated average sample value. It fails on an empty
// frame, which has no mean.
func Mean(samples []byte) (byte, error) {
	if len(samples) == 0 {
		return 0, fmt.Errorf("mean: %w", ErrEmptyFrame)
	}
	return byte(Sum(samples) / len(samples)), nil
}

// Bounds returns the lowest and highest sample in the frame. It fails on
// an empty frame, which has no bounds.
func Bounds(samples []byte) (byte, byte, error) {
	if len(samples) == 0 {
		return 0, 0, fmt.Errorf("bounds: %w", ErrEmptyFrame)
	}
	lo, hi := samples[0], samples[0]
	for _, v := range samples[1:] {
		lo = min(lo, v)
		hi = max(hi, v)
	}
	return lo, hi, nil
}

// Histogram returns how many times each of the 256 possible sample
// values occurs in the frame.
func Histogram(samples []byte) [256]int {
	var counts [256]int
	for _, v := range samples {
		counts[v]++
	}
	return counts
}

// CountAbove returns how many samples are strictly above the threshold.
func CountAbove(samples []byte, threshold byte) int {
	count := 0
	for _, v := range samples {
		if v > threshold {
			count++
		}
	}
	return count
}

// Smooth returns a copy of the frame run through a width-3 box filter
// the given number of times. Each sample becomes the truncated mean of
// itself and its two neighbors; the first and last samples reuse
// themselves as the missing neighbor. Zero or negative passes return an
// unfiltered copy.
func Smooth(samples []byte, passes int) []byte {
	out := make([]byte, len(samples))
	copy(out, samples)
	for range passes {
		next := make([]byte, len(out))
		for i := range out {
			left := out[max(i-1, 0)]
			right := out[min(i+1, len(out)-1)]
			next[i] = byte((int(left) + int(out[i]) + int(right)) / 3)
		}
		out = next
	}
	return out
}
