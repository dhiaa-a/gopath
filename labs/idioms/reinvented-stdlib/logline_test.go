// The suite pins behavior, not implementation. It drives the package only
// through the exported API and asserts observable results, so any
// implementation that keeps these outcomes is a valid normalizer. That is
// what makes the lint loop safe: refactor freely, rerun, repeat.
package logline_test

import (
	"slices"
	"strings"
	"testing"

	logline "gopath.dev/labs/idioms/reinvented-stdlib"
)

const (
	shipper = "gopath-agent: "
	boot    = "server booting"
	token   = "tok-88f1c2"
	marker  = "41f"
)

func TestTrimAgent(t *testing.T) {
	tests := []struct {
		name, line, want string
	}{
		{"prefix comes off", shipper + boot, boot},
		{"no prefix, untouched", boot, boot},
		{"prefix in the middle stays", "x " + shipper + boot, "x " + shipper + boot},
		{"only one layer comes off", shipper + shipper + boot, shipper + boot},
		{"empty line", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.TrimAgent(tt.line); got != tt.want {
				t.Fatalf("TrimAgent(%q) = %q, want %q", tt.line, got, tt.want)
			}
		})
	}
}

func TestKnownSeverity(t *testing.T) {
	tests := []struct {
		sev  string
		want bool
	}{
		{"TRACE", true},
		{"DEBUG", true},
		{"INFO", true},
		{"WARN", true},
		{"ERROR", true},
		{"info", false},
		{"FATAL", false},
		{"INFO ", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := logline.KnownSeverity(tt.sev); got != tt.want {
			t.Errorf("KnownSeverity(%q) = %v, want %v", tt.sev, got, tt.want)
		}
	}
}

func TestHasMarker(t *testing.T) {
	tests := []struct {
		name, line, needle string
		want               bool
	}{
		{"marker in the middle", "deploy " + marker + " done", marker, true},
		{"marker at the start", marker + " rolling", marker, true},
		{"marker at the end", "rolled back to " + marker, marker, true},
		{"marker absent", boot, marker, false},
		{"empty marker is everywhere", boot, "", true},
		{"empty marker in empty line", "", "", true},
		{"marker longer than line", "no", "nope", false},
		{"near miss", "deploy 41g done", marker, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.HasMarker(tt.line, tt.needle); got != tt.want {
				t.Fatalf("HasMarker(%q, %q) = %v, want %v", tt.line, tt.needle, got, tt.want)
			}
		})
	}
}

func TestRedact(t *testing.T) {
	stars := strings.Repeat("*", len(token))
	tests := []struct {
		name, line string
		secrets    []string
		want       string
	}{
		{"one secret masked", "auth with " + token, []string{token}, "auth with " + stars},
		{"every occurrence masked", token + " then " + token, []string{token}, stars + " then " + stars},
		{"two secrets masked", token + " user hunter2", []string{token, "hunter2"}, stars + " user *******"},
		{"mask keeps the line width", token, []string{token}, stars},
		{"secret absent, untouched", boot, []string{token}, boot},
		{"empty secret ignored", boot, []string{""}, boot},
		{"no secrets, untouched", boot, nil, boot},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.Redact(tt.line, tt.secrets); got != tt.want {
				t.Fatalf("Redact(%q, %v) = %q, want %q", tt.line, tt.secrets, got, tt.want)
			}
		})
	}
}

func TestDedupe(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{"empty input", nil, nil},
		{"no repeats", []string{"a", "b", "c"}, []string{"a", "b", "c"}},
		{"run collapses with a count", []string{"a", "a", "a", "b"}, []string{"a (x3)", "b"}},
		{"trailing run collapses", []string{"b", "a", "a"}, []string{"b", "a (x2)"}},
		{"non-adjacent repeats stay separate", []string{"a", "b", "a"}, []string{"a", "b", "a"}},
		{"single line", []string{"a"}, []string{"a"}},
		{"long run counts past nine", slices.Repeat([]string{"a"}, 12), []string{"a (x12)"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.Dedupe(tt.in); !slices.Equal(got, tt.want) {
				t.Fatalf("Dedupe(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestWidest(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want int
	}{
		{"no lines", nil, 0},
		{"single line", []string{boot}, len(boot)},
		{"longest in the middle", []string{"ab", "abcdef", "abc"}, 6},
		{"longest first", []string{"abcdef", "ab"}, 6},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.Widest(tt.in); got != tt.want {
				t.Fatalf("Widest(%v) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestFit(t *testing.T) {
	tests := []struct {
		name, line string
		width      int
		want       string
	}{
		{"shorter than width", "hi", 5, "hi"},
		{"exactly width", "world", 5, "world"},
		{"truncated to width", "abcdefgh", 5, "abcde"},
		{"zero width", boot, 0, ""},
		{"negative width", boot, -3, ""},
		{"empty line", "", 4, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.Fit(tt.line, tt.width); got != tt.want {
				t.Fatalf("Fit(%q, %d) = %q, want %q", tt.line, tt.width, got, tt.want)
			}
		})
	}
}

func TestTail(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		keep int
		want []string
	}{
		{"last two", []string{"a", "b", "c"}, 2, []string{"b", "c"}},
		{"keep equals length", []string{"a", "b"}, 2, []string{"a", "b"}},
		{"keep past the start", []string{"a", "b"}, 5, []string{"a", "b"}},
		{"keep zero", []string{"a", "b"}, 0, nil},
		{"negative keep", []string{"a", "b"}, -1, nil},
		{"tail of nothing", nil, 3, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logline.Tail(tt.in, tt.keep); !slices.Equal(got, tt.want) {
				t.Fatalf("Tail(%v, %d) = %v, want %v", tt.in, tt.keep, got, tt.want)
			}
		})
	}
}

func TestTailIsIndependent(t *testing.T) {
	lines := []string{"a", "b", "c"}
	got := logline.Tail(lines, 2)
	lines[1] = "mutated"
	lines[2] = "mutated"
	if want := []string{"b", "c"}; !slices.Equal(got, want) {
		t.Fatalf("Tail result changed when the input was mutated: got %v, want %v", got, want)
	}
}
