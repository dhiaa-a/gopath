// The suite pins behavior, not layout. It drives the store only through
// the root package's public surface (NewStore, Add, Get, Preview, List and
// the four sentinels), and it never names the model, util or validate
// packages. That is deliberate: those three packages are the accent, they
// do not survive the refactor, and a test that mentioned them would be a
// test that only compiles against the starter. Everything behind the
// surface below is yours to move, rename, and delete.
package snippets_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"unicode/utf8"

	snippets "gopath.dev/labs/idioms/package-sprawl"
)

const (
	greetingID = "greeting"
	haikuID    = "haiku"
	noticeID   = "notice"
	missingID  = "no-such-snippet"

	greetingBody = "hello, world"
	haikuBody    = "an old silent pond\na frog jumps in\nsplash, silence again"
	haikuFirst   = "an old silent pond"

	// previewRunes is the width Preview cuts at, in runes. The suite pins
	// the number because callers see it; where the constant lives is not
	// the suite's business.
	previewRunes = 40

	// accented is one multi-byte rune. A body built out of it has twice as
	// many bytes as runes, so a preview cut by byte and a preview cut by
	// rune come out visibly different lengths.
	accented = "é"

	// ellipsis marks a preview that was cut short.
	ellipsis = "…"
)

// requireIs fails the test unless err arrived and matches target. The
// assertion lives in a helper rather than in a table closure that returns
// the error: handing the package's error back out of a closure is an
// unwrapped return across a package boundary, and a test has nothing to
// wrap it into.
func requireIs(t *testing.T, err error, target error) {
	t.Helper()
	if err == nil {
		t.Fatalf("got nil, want an error matching %v", target)
	}
	if !errors.Is(err, target) {
		t.Fatalf("got %v, want it to match %v", err, target)
	}
}

func newStoreWith(t *testing.T, bodies map[string]string) *snippets.Store {
	t.Helper()
	s := snippets.NewStore()
	for id, body := range bodies {
		if err := s.Add(id, body); err != nil {
			t.Fatalf("Add(%q, ...): %v", id, err)
		}
	}
	return s
}

func TestGetReturnsTheWholeBody(t *testing.T) {
	s := newStoreWith(t, map[string]string{haikuID: haikuBody})
	got, err := s.Get(haikuID)
	if err != nil {
		t.Fatalf("Get(%q): %v", haikuID, err)
	}
	if got != haikuBody {
		t.Fatalf("Get(%q) = %q, want %q", haikuID, got, haikuBody)
	}
}

func TestListIsSorted(t *testing.T) {
	s := newStoreWith(t, map[string]string{
		noticeID:   "the kitchen tap drips",
		greetingID: greetingBody,
		haikuID:    haikuBody,
	})
	want := []string{greetingID, haikuID, noticeID}
	if got := s.List(); !slices.Equal(got, want) {
		t.Fatalf("List() = %v, want %v", got, want)
	}
}

func TestEmptyStoreListsNothing(t *testing.T) {
	if got := snippets.NewStore().List(); len(got) != 0 {
		t.Fatalf("List() on a fresh store = %v, want empty", got)
	}
}

func TestDuplicateIDIsRefused(t *testing.T) {
	s := newStoreWith(t, map[string]string{greetingID: greetingBody})
	requireIs(t, s.Add(greetingID, "something else entirely"), snippets.ErrDuplicate)

	// The refused Add must not have overwritten the stored body.
	got, err := s.Get(greetingID)
	if err != nil {
		t.Fatalf("Get(%q) after a refused Add: %v", greetingID, err)
	}
	if got != greetingBody {
		t.Fatalf("Get(%q) after a refused Add = %q, want %q", greetingID, got, greetingBody)
	}
}

func TestUnknownIDIsNotFound(t *testing.T) {
	s := newStoreWith(t, map[string]string{greetingID: greetingBody})

	_, err := s.Get(missingID)
	requireIs(t, err, snippets.ErrNotFound)

	_, err = s.Preview(missingID)
	requireIs(t, err, snippets.ErrNotFound)
}

func TestPreviewStopsAtTheFirstLine(t *testing.T) {
	s := newStoreWith(t, map[string]string{haikuID: haikuBody})
	got, err := s.Preview(haikuID)
	if err != nil {
		t.Fatalf("Preview(%q): %v", haikuID, err)
	}
	if got != haikuFirst {
		t.Fatalf("Preview(%q) = %q, want %q", haikuID, got, haikuFirst)
	}
}

func TestPreviewLeavesAShortBodyAlone(t *testing.T) {
	s := newStoreWith(t, map[string]string{greetingID: greetingBody})
	got, err := s.Preview(greetingID)
	if err != nil {
		t.Fatalf("Preview(%q): %v", greetingID, err)
	}
	if got != greetingBody {
		t.Fatalf("Preview(%q) = %q, want %q", greetingID, got, greetingBody)
	}
}

func TestPreviewCountsRunesNotBytes(t *testing.T) {
	exact := strings.Repeat(accented, previewRunes)
	long := strings.Repeat(accented, previewRunes+20) + "\nand a second line"
	s := newStoreWith(t, map[string]string{
		greetingID: exact,
		noticeID:   long,
	})

	got, err := s.Preview(greetingID)
	if err != nil {
		t.Fatalf("Preview of a line exactly %d runes wide: %v", previewRunes, err)
	}
	if got != exact {
		t.Fatalf("Preview of a line exactly %d runes wide = %q, want it untouched", previewRunes, got)
	}

	got, err = s.Preview(noticeID)
	if err != nil {
		t.Fatalf("Preview of an over-long line: %v", err)
	}
	if n := utf8.RuneCountInString(got); n != previewRunes {
		t.Fatalf("Preview of an over-long line is %d runes, want %d", n, previewRunes)
	}
	if !strings.HasSuffix(got, ellipsis) {
		t.Fatalf("Preview of an over-long line = %q, want it to end in %q", got, ellipsis)
	}
	if want := strings.Repeat(accented, previewRunes-1) + ellipsis; got != want {
		t.Fatalf("Preview of an over-long line = %q, want %q", got, want)
	}
}

func TestRefusedInput(t *testing.T) {
	tests := []struct {
		name string
		op   func(t *testing.T)
	}{
		{"add under an empty id", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add("", greetingBody), snippets.ErrInvalidID)
		}},
		{"add under an id with a space in it", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add("two words", greetingBody), snippets.ErrInvalidID)
		}},
		{"add under an id with a tab in it", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add("two\twords", greetingBody), snippets.ErrInvalidID)
		}},
		{"add an empty body", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add(greetingID, ""), snippets.ErrInvalidBody)
		}},
		{"add a body that is only whitespace", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add(greetingID, " \n\t "), snippets.ErrInvalidBody)
		}},
		{"add a body past the size limit", func(t *testing.T) {
			requireIs(t, snippets.NewStore().Add(greetingID, strings.Repeat(accented, 4097)), snippets.ErrInvalidBody)
		}},
		{"get an empty id", func(t *testing.T) {
			_, err := snippets.NewStore().Get("")
			requireIs(t, err, snippets.ErrInvalidID)
		}},
		{"preview an id with a space in it", func(t *testing.T) {
			_, err := snippets.NewStore().Preview("two words")
			requireIs(t, err, snippets.ErrInvalidID)
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, tt.op)
	}
}

func TestRefusedAddStoresNothing(t *testing.T) {
	s := snippets.NewStore()
	requireIs(t, s.Add(greetingID, ""), snippets.ErrInvalidBody)
	if got := s.List(); len(got) != 0 {
		t.Fatalf("List() after a refused Add = %v, want empty", got)
	}
}
