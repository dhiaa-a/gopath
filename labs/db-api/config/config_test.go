// Suite for the config layer. Every test here runs on every `go test ./...`
// and none of them need a database: Load never connects, and ParseConfig only
// parses. That is the difference between this package and postgres/, whose
// suite skips without TEST_DATABASE_URL.
//
// Nothing in this file touches the real environment. Load takes getenv as a
// parameter, so a map is a complete stand-in, the tests run in parallel, and
// no test can leave a variable set for the next one.
package config_test

import (
	"fmt"
	"strings"
	"testing"

	"gopath.dev/labs/db-api/config"
)

// env builds a getenv function from a map. Absent key returns "", exactly
// like os.Getenv on an unset variable.
func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

// A DSN with a password in it. Every redaction test measures against this
// exact string: "hunter2" must not survive anywhere.
const (
	dsn      = "postgres://api:hunter2@db.internal:5432/tasks?sslmode=require"
	password = "hunter2"
)

func TestLoadAppliesDefaults(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(map[string]string{config.EnvDatabaseURL: dsn}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.DatabaseURL != dsn {
		t.Errorf("DatabaseURL = %q, want the URL verbatim", cfg.DatabaseURL)
	}
	if cfg.MaxConns != config.DefaultMaxConns {
		t.Errorf("MaxConns = %d, want the default %d: unset is not zero", cfg.MaxConns, config.DefaultMaxConns)
	}
	if cfg.MinConns != config.DefaultMinConns {
		t.Errorf("MinConns = %d, want the default %d", cfg.MinConns, config.DefaultMinConns)
	}
}

func TestLoadReadsEveryVariable(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(map[string]string{
		config.EnvDatabaseURL: dsn,
		config.EnvMaxConns:    "25",
		config.EnvMinConns:    "5",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MaxConns != 25 {
		t.Errorf("MaxConns = %d, want 25", cfg.MaxConns)
	}
	if cfg.MinConns != 5 {
		t.Errorf("MinConns = %d, want 5", cfg.MinConns)
	}
}

// TestLoadRejects covers every value the boundary must refuse. A table, one
// row per way an operator can be wrong.
func TestLoadRejects(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		env  map[string]string
		// wantIn is a substring the error must contain: the variable name,
		// so the operator knows which line of their manifest to fix.
		wantIn string
	}{
		{
			name:   "DATABASE_URL unset",
			env:    map[string]string{},
			wantIn: config.EnvDatabaseURL,
		},
		{
			name:   "DATABASE_URL is a libpq keyword string, not a URL",
			env:    map[string]string{config.EnvDatabaseURL: "host=db.internal user=api password=hunter2"},
			wantIn: config.EnvDatabaseURL,
		},
		{
			name:   "DATABASE_URL has the wrong scheme",
			env:    map[string]string{config.EnvDatabaseURL: "mysql://api:hunter2@db.internal:3306/tasks"},
			wantIn: config.EnvDatabaseURL,
		},
		{
			name: "MAX_CONNS is not a number",
			env: map[string]string{
				config.EnvDatabaseURL: dsn,
				config.EnvMaxConns:    "ten",
			},
			wantIn: config.EnvMaxConns,
		},
		{
			name: "MAX_CONNS is zero",
			env: map[string]string{
				config.EnvDatabaseURL: dsn,
				config.EnvMaxConns:    "0",
			},
			wantIn: config.EnvMaxConns,
		},
		{
			name: "MIN_CONNS is negative",
			env: map[string]string{
				config.EnvDatabaseURL: dsn,
				config.EnvMinConns:    "-1",
			},
			wantIn: config.EnvMinConns,
		},
		{
			// No single variable is wrong here. The pair is.
			name: "MIN_CONNS exceeds MAX_CONNS",
			env: map[string]string{
				config.EnvDatabaseURL: dsn,
				config.EnvMaxConns:    "4",
				config.EnvMinConns:    "9",
			},
			wantIn: config.EnvMinConns,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := config.Load(env(tc.env))
			if err == nil {
				t.Fatalf("Load: err = nil, want an error; a bad value must stop the process, not be defaulted away")
			}
			if !strings.Contains(err.Error(), tc.wantIn) {
				t.Errorf("error = %q, want it to name %q so an operator knows what to fix", err, tc.wantIn)
			}
		})
	}
}

// TestLoadErrorsDoNotLeakThePassword is the reason the error strings above
// are built the way they are. An unparseable DATABASE_URL is still a
// DATABASE_URL: it is the one string in the process most likely to contain a
// secret, and an error is a thing that gets logged.
func TestLoadErrorsDoNotLeakThePassword(t *testing.T) {
	t.Parallel()

	bad := []string{
		"host=db.internal user=api password=" + password,
		"mysql://api:" + password + "@db.internal:3306/tasks",
		"://" + password,
	}
	for _, raw := range bad {
		_, err := config.Load(env(map[string]string{config.EnvDatabaseURL: raw}))
		if err == nil {
			t.Fatalf("Load(%q): err = nil, want an error", raw)
		}
		if strings.Contains(err.Error(), password) {
			t.Errorf("Load(%q): error contains the password: %q\nan error that echoes the raw value echoes the secret", raw, err)
		}
	}
}

// TestConfigStringRedactsThePassword is the whole point of the String method.
// It checks the VALUE, not a pointer, because Load returns a value and a
// value is what any caller will hand to a logger.
func TestConfigStringRedactsThePassword(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(map[string]string{config.EnvDatabaseURL: dsn}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	// cfg.String() is first on purpose, and it is the weakest check here.
	// Calling the method directly works even with a pointer receiver, because
	// Go takes the address of an addressable value for you. fmt gets no such
	// favour: it receives a Config through an interface, and a *Config method
	// is not in a Config's method set, so fmt silently prints the fields
	// instead. That is why the verbs below matter more than the call above.
	//
	// %s is deliberately absent: vet rejects it at build time on a non
	// Stringer, so it can never reach a log file. %v is legal on anything,
	// which is what makes it the one that leaks.
	for _, got := range []string{
		cfg.String(),
		fmt.Sprintf("%v", cfg),
		fmt.Sprintf("%+v", cfg),
		fmt.Sprint(cfg),
	} {
		if strings.Contains(got, password) {
			t.Fatalf("rendered config contains the password: %q\nIf cfg.String() alone is clean but the fmt verbs are not, your String has a pointer receiver: it is not in the method set of a Config value, so fmt printed the fields instead.", got)
		}
		if !strings.Contains(got, "xxxxx") {
			t.Errorf("rendered config = %q, want the password replaced by xxxxx", got)
		}
		// Redacting by dropping the URL entirely would pass the check above
		// and make the log line useless. The host is the part an operator
		// actually needs.
		if !strings.Contains(got, "db.internal") {
			t.Errorf("rendered config = %q, want it to still name the host", got)
		}
	}
}

// TestConfigStringOnAnUnparseableURLDoesNotEchoIt covers the path where
// redaction cannot work. A Config built by hand skips Load's validation, so
// String has to hold the line on its own.
func TestConfigStringOnAnUnparseableURLDoesNotEchoIt(t *testing.T) {
	t.Parallel()

	cfg := config.Config{DatabaseURL: "://" + password, MaxConns: 10}
	got := fmt.Sprintf("%v", cfg)
	if strings.Contains(got, password) {
		t.Errorf("String on an unparseable URL echoed it: %q\nIf it did not parse you do not know which part was the password, so none of it can be printed.", got)
	}
}

// TestPoolConfigAppliesTheLimits proves the two assignments that matter. It
// needs no database: ParseConfig parses and does not connect.
func TestPoolConfigAppliesTheLimits(t *testing.T) {
	t.Parallel()

	cfg, err := config.Load(env(map[string]string{
		config.EnvDatabaseURL: dsn,
		config.EnvMaxConns:    "25",
		config.EnvMinConns:    "5",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	poolCfg, err := cfg.PoolConfig()
	if err != nil {
		t.Fatalf("PoolConfig: %v", err)
	}
	if poolCfg == nil {
		t.Fatal("PoolConfig returned a nil config and no error")
	}
	if poolCfg.MaxConns != 25 {
		t.Errorf("pool MaxConns = %d, want 25.\nParseConfig applies pgxpool's own default first (the greater of 4 and NumCPU); overwriting it is the job of this method.", poolCfg.MaxConns)
	}
	if poolCfg.MinConns != 5 {
		t.Errorf("pool MinConns = %d, want 5", poolCfg.MinConns)
	}
	// The parsed connection carries the credentials through untouched.
	if poolCfg.ConnConfig.Host != "db.internal" {
		t.Errorf("pool host = %q, want db.internal", poolCfg.ConnConfig.Host)
	}
}
