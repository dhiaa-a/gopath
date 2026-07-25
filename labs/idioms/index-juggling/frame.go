//go:build !solution

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
	for i := 0; i < len(samples); i++ {
		total += int(samples[i])
	}
	return total
}

// Mean returns the truncated average sample value. It fails on an empty
// frame, which has no mean.
func Mean(samples []byte) (byte, error) {
	if len(samples) == 0 {
		return 0, fmt.Errorf("mean: %w", ErrEmptyFrame)
	}
	len := len(samples)
	total := 0
	for i := 0; i < len; i++ {
		total += int(samples[i])
	}
	return byte(int(total) / len), nil
}

// Bounds returns the lowest and highest sample in the frame. It fails on
// an empty frame, which has no bounds.
func Bounds(samples []byte) (byte, byte, error) {
	if len(samples) == 0 {
		return 0, 0, fmt.Errorf("bounds: %w", ErrEmptyFrame)
	}
	min := byte(0xFF)
	max := byte(0x00)
	min = samples[0]
	max = samples[0]
	for i := 0; i < len(samples); i++ {
		if samples[i] < min {
			min = samples[i]
		}
		if samples[i] > max {
			max = samples[i]
		}
	}
	return min, max, nil
}

// Histogram returns how many times each of the 256 possible sample
// values occurs in the frame.
func Histogram(samples []byte) [256]int {
	var counts [256]int
	for i := 0; i < len(samples); i++ {
		counts[samples[i]]++
	}
	return counts
}

// CountAbove returns how many samples are strictly above the threshold.
func CountAbove(samples []byte, threshold byte) int {
	count := 0
	for i := 0; i < len(samples); i++ {
		if byte(samples[i]) > threshold {
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
	for i := 0; i < len(samples); i++ {
		out[i] = samples[i]
	}
	for p := 0; p < passes; p++ {
		next := make([]byte, len(out))
		for i := 0; i < len(out); i++ {
			lo := i - 1
			if lo < 0 {
				lo = 0
			}
			hi := i + 1
			if hi > len(out)-1 {
				hi = len(out) - 1
			}
			next[i] = byte((int(out[lo]) + int(out[i]) + int(out[hi])) / 3)
		}
		out = next
	}
	return out
}
