//go:build fixed

// The fix is one word in one signature: validate is declared to return
// error, the interface, so its `return nil` builds a genuinely nil
// interface instead of a nil *ValidationError that gets its type stamped
// on at the call site. The call site does not change. Callers that need
// the structured Field reach it with errors.As (see the typed-nil concept).
package main

import (
	"fmt"
	"os"
)

// Config is what the deploy pipeline renders from the environment.
type Config struct {
	ListenAddr string
	StoreDir   string
	MaxConns   int
}

// ValidationError names the field that failed and why, so the operator can
// fix the deploy without reading source.
type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string {
	return "config field " + e.Field + ": " + e.Reason
}

// validate reports the first problem with the config, or nil if the config
// is usable.
func validate(cfg Config) error {
	if cfg.ListenAddr == "" {
		return &ValidationError{Field: "ListenAddr", Reason: "must not be empty"}
	}
	if cfg.StoreDir == "" {
		return &ValidationError{Field: "StoreDir", Reason: "must not be empty"}
	}
	if cfg.MaxConns <= 0 {
		return &ValidationError{Field: "MaxConns", Reason: "must be positive"}
	}
	return nil
}

func main() {
	cfg := Config{
		ListenAddr: "127.0.0.1:8080",
		StoreDir:   "/var/lib/orders",
		MaxConns:   64,
	}

	// Refuse to start on a bad config: a named field in the log beats a
	// half-configured service taking traffic.
	var err error = validate(cfg)
	if err != nil {
		fmt.Println("startup aborted:", err)
		os.Exit(1)
	}

	fmt.Println("startup ok: listening on", cfg.ListenAddr)
}
