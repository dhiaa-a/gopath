//go:build !solution

package validate

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"gopath.dev/labs/idioms/package-sprawl/model"
)

// Validation failures. They are exported because the service layer hands
// them on to its own callers.
var (
	// ErrInvalidID is returned when a snippet id is unusable as a key.
	ErrInvalidID = errors.New("invalid snippet id")
	// ErrInvalidBody is returned when a snippet body is unusable.
	ErrInvalidBody = errors.New("invalid snippet body")
)

// ValidateID reports the problem with id, or nil when it is usable as a
// snippet key.
func ValidateID(id string) error {
	switch {
	case id == "":
		return fmt.Errorf("empty id: %w", ErrInvalidID)
	case strings.ContainsFunc(id, unicode.IsSpace):
		return fmt.Errorf("id contains whitespace: %w", ErrInvalidID)
	}
	return nil
}

// ValidateSnippet reports the problem with s, or nil when it can be
// stored.
func ValidateSnippet(s model.ModelSnippet) error {
	if err := ValidateID(s.ID); err != nil {
		return err
	}
	runes := utf8.RuneCountInString(s.Body)
	switch {
	case strings.TrimSpace(s.Body) == "":
		return fmt.Errorf("empty body: %w", ErrInvalidBody)
	case runes > model.MaxBodyRunes:
		return fmt.Errorf("body is %d runes, limit %d: %w", runes, model.MaxBodyRunes, ErrInvalidBody)
	}
	return nil
}
