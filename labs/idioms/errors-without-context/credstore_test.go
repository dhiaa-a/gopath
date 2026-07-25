// The suite pins behavior, not the shape of the error values. It drives
// the package through New, Lookup and Secret only, and it never names a
// sentinel this package declares. That is deliberate: the refactor renames
// every one of them, and a suite that spelled one out would be a suite that
// stops compiling the moment you fix the naming. What survives a rename is
// what a caller can actually observe: whether the call failed, what the
// message says, and what errors.Is still finds underneath. Those are the
// three things asserted below.
//
// Fixtures are testing/fstest.MapFS, so nothing here touches disk and a
// "missing file" is just a name the map does not have.
package credstore_test

import (
	"errors"
	"io/fs"
	"strings"
	"testing"
	"testing/fstest"

	credstore "gopath.dev/labs/idioms/errors-without-context"
)

const (
	prod  = "prod"
	ghost = "ghost" // an environment with no files at all

	postgres = "postgres"
	redis    = "redis"
	mailer   = "mailer" // a service no profile lists

	prodProfile = "profiles/prod.conf"
	prodSecrets = "secrets/prod.secrets"
)

// goodProfile is a well-formed profile: a version header, a comment, a
// blank line, two services, and padding around the equals signs.
const goodProfile = `# services this environment runs
version = 1

postgres = secret:pg_main
redis    = secret:redis_cache
`

// goodSecrets holds the tokens goodProfile points at. pg_main's value
// carries base64 padding on purpose: the entry parser splits on the first
// "=" only, and a parser that splits on every "=" silently truncates the
// token instead of failing.
const goodSecrets = `# base64, because a token is bytes and not text
pg_main     = aHVudGVyMg==
redis_cache = czNjcjN0
`

const (
	pgToken    = "hunter2"
	redisToken = "s3cr3t"
)

// newStore builds a Store over an in-memory filesystem. A name absent from
// files is absent from the filesystem, which is how the suite reaches the
// missing-file paths.
func newStore(files map[string]string) *credstore.Store {
	fsys := fstest.MapFS{}
	for name, body := range files {
		fsys[name] = &fstest.MapFile{Data: []byte(body)}
	}
	return credstore.New(fsys)
}

// goodStore is the happy path: a valid profile and the secrets it names.
func goodStore() *credstore.Store {
	return newStore(map[string]string{prodProfile: goodProfile, prodSecrets: goodSecrets})
}

// storeWithProfile keeps the good secrets and swaps in another profile.
func storeWithProfile(profile string) *credstore.Store {
	return newStore(map[string]string{prodProfile: profile, prodSecrets: goodSecrets})
}

// storeWithSecrets keeps the good profile and swaps in other secrets.
func storeWithSecrets(secrets string) *credstore.Store {
	return newStore(map[string]string{prodProfile: goodProfile, prodSecrets: secrets})
}

func TestLookupResolvesEachService(t *testing.T) {
	tests := []struct {
		service string
		token   string
	}{
		{postgres, pgToken},
		{redis, redisToken},
	}
	for _, tt := range tests {
		got, err := goodStore().Lookup(prod, tt.service)
		if err != nil {
			t.Fatalf("Lookup(%q, %q): %v", prod, tt.service, err)
		}
		if got.Service != tt.service {
			t.Errorf("Secret.Service = %q, want %q", got.Service, tt.service)
		}
		if got.Token != tt.token {
			t.Errorf("Secret.Token = %q, want %q", got.Token, tt.token)
		}
	}
}

// The version header is profile metadata, not a service. Consuming it is
// the parser's job, so asking for it by name has to come back not found.
func TestVersionHeaderIsNotAService(t *testing.T) {
	if _, err := goodStore().Lookup(prod, "version"); err == nil {
		t.Fatal("looked up the version header as a service and got a credential, want error")
	}
}

// The one chain assertion in the suite, and the reason it is here: a
// profile the store cannot open fails somewhere under io/fs, and
// fs.ErrNotExist has to stay reachable through every layer that touched
// the error on its way out. The starter passes this by accident, because
// it relays the fs error untouched. A refactor that adds context with %v
// instead of %w breaks it. That is the whole lesson in one assertion:
// adding context must not cost the caller the cause.
func TestMissingProfileKeepsFsErrNotExistReachable(t *testing.T) {
	_, err := goodStore().Lookup(ghost, postgres)
	if err == nil {
		t.Fatal("looked up a credential in an environment with no profile and got one, want error")
	}
	if !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("errors.Is(err, fs.ErrNotExist) is false for %q: the cause was flattened on the way out", err)
	}
}

// Whatever the message ends up saying, it has to say which service was
// asked for. An error that reports only "not found" makes every caller
// reconstruct the question from context it may no longer have.
func TestNotFoundErrorNamesTheService(t *testing.T) {
	_, err := goodStore().Lookup(prod, mailer)
	if err == nil {
		t.Fatal("looked up a service the profile does not list and got a credential, want error")
	}
	if !strings.Contains(err.Error(), mailer) {
		t.Fatalf("error %q never names the service that was missing", err)
	}
}

// requireErr fails the test unless the lookup was refused. The assertion
// lives here, next to the call, instead of the closure handing the error
// back to the loop: returning the package's error out of a table closure
// is an unwrapped return across a package boundary, and a test has nothing
// to wrap it into. The linter is right about that even in a suite.
func requireErr(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatal("got nil, want error")
	}
}

func TestLookupRefusals(t *testing.T) {
	tests := []struct {
		name string
		op   func(t *testing.T)
	}{
		{"service the profile does not list", func(t *testing.T) {
			_, err := goodStore().Lookup(prod, mailer)
			requireErr(t, err)
		}},
		{"profile value is not a secret reference", func(t *testing.T) {
			_, err := storeWithProfile("version = 1\npostgres = pg_main\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"profile line is not key = value", func(t *testing.T) {
			_, err := storeWithProfile("version = 1\npostgres\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"profile has no version header", func(t *testing.T) {
			_, err := storeWithProfile("postgres = secret:pg_main\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"profile version is not a number", func(t *testing.T) {
			_, err := storeWithProfile("version = one\npostgres = secret:pg_main\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"profile version is from the future", func(t *testing.T) {
			_, err := storeWithProfile("version = 2\npostgres = secret:pg_main\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"environment has no secrets file", func(t *testing.T) {
			_, err := newStore(map[string]string{prodProfile: goodProfile}).Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"secrets file does not hold that secret", func(t *testing.T) {
			_, err := storeWithSecrets("pg_other = aHVudGVyMg==\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"secrets line is not key = value", func(t *testing.T) {
			_, err := storeWithSecrets("pg_main\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
		{"stored token is not base64", func(t *testing.T) {
			_, err := storeWithSecrets("pg_main = not!base64\n").Lookup(prod, postgres)
			requireErr(t, err)
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, tt.op)
	}
}
