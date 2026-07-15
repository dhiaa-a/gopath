//go:build solution

// Reference implementation of the config layer. Do not open this until your
// own run is green; it exists so the repo's checks can prove the suite passes
// against a real implementation.
package config

import (
	"fmt"
	"net/url"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Load reads the whole environment once and returns a validated Config.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		MaxConns: DefaultMaxConns,
		MinConns: DefaultMinConns,
	}

	raw := getenv(EnvDatabaseURL)
	if raw == "" {
		return Config{}, fmt.Errorf("%s is required", EnvDatabaseURL)
	}
	// Shape-check at the boundary so String has an invariant to stand on.
	// Note what the error does NOT contain: raw. It is the secret.
	u, err := url.Parse(raw)
	if err != nil {
		return Config{}, fmt.Errorf("%s is not a valid URL", EnvDatabaseURL)
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" {
		return Config{}, fmt.Errorf("%s scheme is %q, want postgres or postgresql", EnvDatabaseURL, u.Scheme)
	}
	cfg.DatabaseURL = raw

	if v := getenv(EnvMaxConns); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			return Config{}, fmt.Errorf("%s=%q is not a number", EnvMaxConns, v)
		}
		cfg.MaxConns = int32(n)
	}
	if v := getenv(EnvMinConns); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			return Config{}, fmt.Errorf("%s=%q is not a number", EnvMinConns, v)
		}
		cfg.MinConns = int32(n)
	}

	if cfg.MaxConns <= 0 {
		return Config{}, fmt.Errorf("%s=%d must be greater than 0", EnvMaxConns, cfg.MaxConns)
	}
	if cfg.MinConns < 0 {
		return Config{}, fmt.Errorf("%s=%d must not be negative", EnvMinConns, cfg.MinConns)
	}
	// The cross-field check: no single variable is wrong here, the pair is.
	if cfg.MinConns > cfg.MaxConns {
		return Config{}, fmt.Errorf("%s=%d exceeds %s=%d", EnvMinConns, cfg.MinConns, EnvMaxConns, cfg.MaxConns)
	}

	return cfg, nil
}

// String renders the Config for a log line with the password removed. The
// receiver is a value, not a pointer, and that is load-bearing: Load returns
// a Config by value, so a *Config method would simply not be in the method
// set of the thing anyone actually logs, and fmt would fall back to printing
// the struct fields verbatim.
func (c Config) String() string {
	return fmt.Sprintf("database_url=%s max_conns=%d min_conns=%d",
		redactURL(c.DatabaseURL), c.MaxConns, c.MinConns)
}

// redactURL replaces the password with "xxxxx". net/url already does exactly
// this and has since Go 1.15; writing it by hand is how you get it wrong.
func redactURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		// Never echo raw on the error path. If it did not parse we do not
		// know which part of it was the password, so none of it can be
		// printed.
		return "<unparseable>"
	}
	return u.Redacted()
}

// PoolConfig turns a Config into a *pgxpool.Config with the limits applied.
// It parses and does not connect.
func (c Config) PoolConfig() (*pgxpool.Config, error) {
	poolCfg, err := pgxpool.ParseConfig(c.DatabaseURL)
	if err != nil {
		// pgx redacts the password in its own connection-string errors, but
		// this error is ours and the URL is not going in it.
		return nil, fmt.Errorf("parse %s: invalid connection string", EnvDatabaseURL)
	}
	// ParseConfig has already applied pgxpool's defaults. These two lines
	// replace them with the numbers we chose.
	poolCfg.MaxConns = c.MaxConns
	poolCfg.MinConns = c.MinConns
	return poolCfg, nil
}
