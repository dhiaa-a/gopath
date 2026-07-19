//go:build !solution

package config

// This file is yours. The suite in config_test.go grades it, and it needs no
// database: Load never connects, and pgxpool.ParseConfig only parses. That is
// why these tests run on every `go test ./...` while the postgres suite skips.
//
// The constraints from the project page:
//
//   - Load takes getenv as a parameter and never calls os.Getenv. The suite
//     hands it a map. Reading process-global state would mean mutating the
//     test binary's own environment and putting it back, and no two such
//     tests could run in parallel.
//   - DATABASE_URL is required. Unset is an error naming the variable.
//   - DATABASE_URL must parse as a URL whose scheme is postgres or
//     postgresql. pgx also accepts libpq keyword/value strings
//     ("host=... password=..."), and this Load rejects them on purpose:
//     String below cannot redact a password it never parsed.
//   - DBAPI_MAX_CONNS and DBAPI_MIN_CONNS are optional. Unset means the
//     documented default. Set-but-unparseable is an error naming both the
//     variable and the value; falling back to the default there would make
//     "you did not set this" and "you set this and I could not read it"
//     indistinguishable, and those need opposite responses.
//   - MaxConns must be > 0. MinConns must be >= 0 and <= MaxConns.
//   - String must redact the password, and it must do so with a VALUE
//     receiver. Load returns a Config by value, so that is what gets logged.
//
// A fresh clone fails every case with errNotImplemented, and the redaction
// cases fail by printing the password. That list is your to-do list.

import (
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotImplemented = errors.New("config: not implemented, fill in load.go")

// Load reads the whole environment once and returns a validated Config.
// getenv returns "" for an unset variable, exactly like os.Getenv.
func Load(getenv func(string) string) (Config, error) {
	return Config{}, errNotImplemented
}

// String renders the Config for a log line with the password removed.
//
// Use net/url's Redacted method: it replaces a present password with the
// literal "xxxxx" and leaves everything else alone. Do not build the string
// with Sprintf("%v", c) or you will recurse until the stack gives out; go vet
// will tell you so.
//
// If the URL somehow does not parse here, do not echo the raw string back:
// the raw string is the thing that might be the secret.
func (c Config) String() string {
	return "config: String not implemented, fill in load.go"
}

// PoolConfig turns a Config into a *pgxpool.Config with the connection limits
// applied. It parses and does not connect, which is why the suite can check
// it with no database anywhere.
//
// pgxpool.ParseConfig fills in its own defaults first, so the two assignments
// that follow it are the whole point of this method: without them you inherit
// pgxpool's default MaxConns, which is the greater of 4 and runtime.NumCPU().
func (c Config) PoolConfig() (*pgxpool.Config, error) {
	return nil, errNotImplemented
}
