//go:build solution

// Package credstore resolves deployment credentials. A profile file names
// the services an environment runs and points each one at a secret; a
// secrets file holds the base64-encoded tokens themselves.
package credstore

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"strconv"
	"strings"
)

// The sentinels a caller can branch on. Every error this package returns
// wraps one of these, or wraps the io/fs error underneath it, so errors.Is
// answers "why did this fail" without anyone parsing a message.
var (
	// ErrCredentialNotFound is returned when a service has no credential.
	ErrCredentialNotFound = errors.New("credential not found")
	// ErrMalformedEntry is returned when a line is not key = value.
	ErrMalformedEntry = errors.New("malformed entry")
	// ErrUnsupportedVersion is returned when a profile declares a format
	// this package cannot read.
	ErrUnsupportedVersion = errors.New("unsupported profile version")
	// ErrCorruptSecret is returned when a stored token is not valid base64.
	ErrCorruptSecret = errors.New("corrupt secret")
)

const (
	// profileVersion is the only profile format this package understands.
	profileVersion = 1
	// secretPrefix marks a profile value as a reference into the secrets file.
	secretPrefix = "secret:"
	// versionKey is the profile's format header, not a service name.
	versionKey = "version"
)

// Secret is one resolved credential.
type Secret struct {
	Service string
	Token   string
}

// Store reads profiles and secrets out of a filesystem.
type Store struct {
	fsys fs.FS
}

// New returns a Store that reads profiles and secrets from fsys.
func New(fsys fs.FS) *Store {
	return &Store{fsys: fsys}
}

// Lookup resolves the credential a service uses in the given environment.
// Every error it returns names the environment and the service, and wraps
// a cause: match it with errors.Is against the sentinels above, or against
// fs.ErrNotExist when a file is the thing that was missing.
func (s *Store) Lookup(env, service string) (Secret, error) {
	secret, err := s.lookup(env, service)
	if err != nil {
		return Secret{}, fmt.Errorf("credstore %s/%s: %w", env, service, err)
	}
	return secret, nil
}

// lookup is Lookup without the outer context. Splitting it out means env
// and service are formatted into the error in exactly one place instead of
// once per early return, which is also what keeps the same format string
// from appearing three times.
func (s *Store) lookup(env, service string) (Secret, error) {
	entries, err := s.loadProfile(env)
	if err != nil {
		return Secret{}, err
	}
	ref, err := secretRef(entries, service)
	if err != nil {
		return Secret{}, err
	}
	token, err := s.resolveSecret(env, ref)
	if err != nil {
		return Secret{}, err
	}
	return Secret{Service: service, Token: token}, nil
}

// loadProfile reads and parses the profile for one environment.
func (s *Store) loadProfile(env string) (map[string]string, error) {
	name := profilePath(env)
	data, err := fs.ReadFile(s.fsys, name)
	if err != nil {
		// fs.PathError already carries the path; adding it again would
		// print it twice. What the caller cannot see is which of the two
		// files failed, so that is what this adds.
		return nil, fmt.Errorf("profile: %w", err)
	}
	entries, err := parseProfile(data)
	if err != nil {
		return nil, fmt.Errorf("profile %s: %w", name, err)
	}
	return entries, nil
}

// resolveSecret returns the decoded token stored under name.
func (s *Store) resolveSecret(env, name string) (string, error) {
	file := secretsPath(env)
	data, err := fs.ReadFile(s.fsys, file)
	if err != nil {
		return "", fmt.Errorf("secrets: %w", err)
	}
	entries, err := parseEntries(data)
	if err != nil {
		return "", fmt.Errorf("secrets %s: %w", file, err)
	}
	raw, ok := entries[name]
	if !ok {
		return "", fmt.Errorf("secret %q in %s: %w", name, file, ErrCredentialNotFound)
	}
	token, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		// Two %w verbs, one error: errors.Is finds the sentinel a caller
		// branches on, and errors.As still reaches base64.CorruptInputError
		// for anyone who wants the byte offset.
		return "", fmt.Errorf("secret %q in %s: %w: %w", name, file, ErrCorruptSecret, err)
	}
	return string(token), nil
}

// parseProfile turns profile bytes into service entries, consuming the
// version header once it has been checked.
func parseProfile(data []byte) (map[string]string, error) {
	entries, err := parseEntries(data)
	if err != nil {
		return nil, err
	}
	raw, ok := entries[versionKey]
	if !ok {
		return nil, fmt.Errorf("no %s header: %w", versionKey, ErrMalformedEntry)
	}
	version, err := strconv.Atoi(raw)
	if err != nil {
		// The strconv error says only that "one" is not a number, and the
		// message below already quotes it. Dropping it costs nothing a
		// caller could use.
		return nil, fmt.Errorf("%s header %q: %w", versionKey, raw, ErrUnsupportedVersion)
	}
	if version != profileVersion {
		return nil, fmt.Errorf("%s %d, want %d: %w", versionKey, version, profileVersion, ErrUnsupportedVersion)
	}
	delete(entries, versionKey)
	return entries, nil
}

// parseEntries turns key = value lines into a map, skipping blanks and
// comments.
func parseEntries(data []byte) (map[string]string, error) {
	entries := map[string]string{}
	for i, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, err := parseEntry(line)
		if err != nil {
			// The line number is the one piece of context nothing upstream
			// can reconstruct once the bytes are gone.
			return nil, fmt.Errorf("line %d: %w", i+1, err)
		}
		entries[key] = value
	}
	return entries, nil
}

// parseEntry splits one key = value line.
func parseEntry(line string) (string, string, error) {
	key, value, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", fmt.Errorf("%q is not key = value: %w", line, ErrMalformedEntry)
	}
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if key == "" || value == "" {
		return "", "", fmt.Errorf("%q has an empty key or value: %w", line, ErrMalformedEntry)
	}
	return key, value, nil
}

// secretRef returns the secret name a service points at.
func secretRef(entries map[string]string, service string) (string, error) {
	ref, ok := entries[service]
	if !ok {
		// Lookup already names the service; this layer knows nothing the
		// sentinel does not say, so it adds nothing.
		return "", ErrCredentialNotFound
	}
	name, ok := strings.CutPrefix(ref, secretPrefix)
	if !ok {
		return "", fmt.Errorf("value %q does not start with %q: %w", ref, secretPrefix, ErrMalformedEntry)
	}
	return name, nil
}

// profilePath is where an environment's profile lives.
func profilePath(env string) string {
	return "profiles/" + env + ".conf"
}

// secretsPath is where an environment's secrets live.
func secretsPath(env string) string {
	return "secrets/" + env + ".secrets"
}
