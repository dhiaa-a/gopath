// Package config is this process's entire view of its environment: which
// database to talk to, and how many connections it may open to it. Nothing
// else in the module reads an environment variable, which is exactly what
// makes the rest of it testable without one.
//
// The package exists because of one fact: DATABASE_URL contains a password.
// Everything here follows from that. The URL is parsed and shape-checked at
// the boundary so that String can rely on it being a URL, and String exists
// so that a Config which reaches a log line cannot take the password with it.
//
// This file is the pinned contract. The suite compiles against these names,
// so their shape is fixed; the behaviour in load.go is yours.
package config

// Environment variable names. They are exported because a name an operator
// has to type is part of a service's public contract, exactly like a route or
// a JSON field: renaming one breaks a deploy the same way renaming a route
// breaks a client.
const (
	// EnvDatabaseURL is required and deliberately has no default. There is
	// no sensible guess for which database a service should write to, and a
	// wrong guess writes real rows somewhere nobody is looking.
	EnvDatabaseURL = "DATABASE_URL"
	// EnvMaxConns caps how many connections this process may open.
	EnvMaxConns = "DBAPI_MAX_CONNS"
	// EnvMinConns is how many it keeps open while idle.
	EnvMinConns = "DBAPI_MIN_CONNS"
)

// Defaults applied when a variable is unset. Unset is not an error and is not
// zero: it means the default was right.
//
// DefaultMaxConns is a flat number rather than something derived from
// runtime.NumCPU(), which is what pgxpool itself defaults to. The reason is
// in step 08: your Postgres has a fixed connection budget, and a per-replica
// limit that changes with the hardware you happened to land on is a budget
// you cannot add up.
const (
	DefaultMaxConns = int32(10)
	DefaultMinConns = int32(0)
)

// Config is everything this process reads from its environment, read exactly
// once at startup and never again. A handler that can ask the environment a
// question at request time is a handler whose behaviour depends on when you
// look at it.
type Config struct {
	// DatabaseURL is a postgres:// or postgresql:// URL. It contains a
	// password, which is why Load refuses any other shape: String cannot
	// redact what Load did not parse.
	DatabaseURL string
	// MaxConns is the ceiling on connections this process opens.
	MaxConns int32
	// MinConns is the floor it keeps open when idle.
	MinConns int32
}
