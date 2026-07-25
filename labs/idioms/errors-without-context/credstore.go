//go:build !solution

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

// CredentialNotFoundError is returned when a service has no credential.
var CredentialNotFoundError = errors.New("The credential was not found.")

// MalformedEntryError is returned when a line is not key = value.
var MalformedEntryError = errors.New("Malformed entry!")

// profileVersion is the only profile format this package understands.
const profileVersion = 1

// secretPrefix marks a profile value as a reference into the secrets file.
const secretPrefix = "secret:"

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
func (s *Store) Lookup(env, service string) (Secret, error) {
	entries, err := s.loadProfile(env)
	if err != nil {
		return Secret{}, err
	}
	ref, err := secretRef(entries, service)
	if err == CredentialNotFoundError {
		return Secret{}, errors.New(fmt.Sprintf("No credential named %s.", service))
	}
	if err != nil {
		return Secret{}, err
	}
	token, err := s.resolveSecret(env, ref)
	if err != nil {
		if strings.Contains(err.Error(), "illegal base64") {
			return Secret{}, errors.New(fmt.Sprintf("The secret for %s is corrupt.", service))
		}
		return Secret{}, fmt.Errorf("could not load the credential: %v", err)
	}
	return Secret{Service: service, Token: token}, nil
}

// loadProfile reads and parses the profile for one environment.
func (s *Store) loadProfile(env string) (map[string]string, error) {
	data, err := fs.ReadFile(s.fsys, profilePath(env))
	if err != nil {
		return nil, err
	}
	return parseProfile(data)
}

// resolveSecret returns the decoded token stored under name.
func (s *Store) resolveSecret(env, name string) (string, error) {
	data, err := fs.ReadFile(s.fsys, secretsPath(env))
	if err != nil {
		if isMissing(err) {
			return "", errors.New(fmt.Sprintf("Environment %s has no secrets file.", env))
		}
		return "", err
	}
	entries, err := parseEntries(data)
	if err != nil {
		return "", err
	}
	raw, ok := entries[name]
	if !ok {
		return "", CredentialNotFoundError
	}
	return decodeToken(raw)
}

// parseProfile turns profile bytes into service entries.
func parseProfile(data []byte) (map[string]string, error) {
	entries, err := parseEntries(data)
	if err != nil {
		return nil, err
	}
	raw, ok := entries["version"]
	if !ok {
		return nil, errors.New("Profile is missing its version header!")
	}
	version, err := strconv.Atoi(raw)
	if err != nil {
		return nil, err
	}
	if version != profileVersion {
		return nil, errors.New(fmt.Sprintf("Unsupported profile version %d.", version))
	}
	delete(entries, "version")
	return entries, nil
}

// parseEntries turns key = value lines into a map, skipping blanks and
// comments.
func parseEntries(data []byte) (map[string]string, error) {
	entries := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, err := parseEntry(line)
		if err != nil {
			return nil, err
		}
		entries[key] = value
	}
	return entries, nil
}

// parseEntry splits one key = value line.
func parseEntry(line string) (string, string, error) {
	key, value, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", MalformedEntryError
	}
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if key == "" || value == "" {
		return "", "", MalformedEntryError
	}
	return key, value, nil
}

// secretRef returns the secret name a service points at.
func secretRef(entries map[string]string, service string) (string, error) {
	ref, ok := entries[service]
	if !ok {
		return "", CredentialNotFoundError
	}
	name, ok := strings.CutPrefix(ref, secretPrefix)
	if !ok {
		return "", MalformedEntryError
	}
	return name, nil
}

// decodeToken decodes one stored secret.
func decodeToken(raw string) (string, error) {
	token, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", fmt.Errorf("decoding the secret failed: %v", err)
	}
	return string(token), nil
}

// isMissing reports whether a read failed because the file is not there.
func isMissing(err error) bool {
	pathErr := err.(*fs.PathError)
	return pathErr.Err == fs.ErrNotExist
}

// profilePath is where an environment's profile lives.
func profilePath(env string) string {
	return "profiles/" + env + ".conf"
}

// secretsPath is where an environment's secrets live.
func secretsPath(env string) string {
	return "secrets/" + env + ".secrets"
}
