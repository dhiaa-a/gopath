import { Concept } from "../../content"

export const secretsConfig: Concept = {
	slug: "secrets-config",
	name: "Secrets and configuration",
	tagline:
		"A password held as a plain string leaks the instant anything prints the struct, so the secret has to be a type that refuses to print itself.",
	summary:
		"Configuration is where a program meets its environment, and a secret is the part of that you have to load and use without ever printing. Two machine facts shape the design. Precedence has to be explicit: a flag beats an environment variable beats a built-in default, and one loader decides that order because nothing implicit will. And a secret held as a plain <code>string</code> field leaks the instant anything hands the struct to <code>fmt</code> with <code>%v</code>, which reflects over the exported fields and formats each one, so the secret must be a type whose <code>String()</code> method redacts it rather than a value every future log line is trusted to remember.",
	mentalModel:
		"Think of a secret as a value that has to survive being held inside a struct that will, sooner or later, be logged whole. You do not get to audit every call site: someone will eventually write <code>slog.Info(\"boot\", \"config\", cfg)</code> or <code>fmt.Printf(\"%v\", cfg)</code>, and <code>fmt</code> will reflect over the fields and print each one it can. The only place a defense survives that is on the type itself. A <code>Secret</code> string whose <code>String()</code> method returns <code>xxxxx</code> is masked everywhere it is ever printed, as a field, as a bare value, inside a map, because <code>fmt</code> asks a value how it wants to print before it prints the bytes. Configuration is the same discipline pointed at a different problem: one loader reads the environment once, applies defaults, and fails immediately when a required value is missing, so the order of precedence is a fact you can point at in a single function instead of an emergent property of scattered <code>if</code> statements.",
	retrievalPrompts: [
		"Your Config has a Password field whose type has a String method that returns xxxxx, yet fmt.Printf(\"%v\", cfg) still prints the real password. What is almost certainly wrong? || The receiver. If String is defined on *Secret, a pointer receiver, then a Secret value does not carry it in its method set, only *Secret does. When fmt formats the struct it holds each field as a non-addressable value, so for a Secret field it cannot reach a pointer method and falls back to printing the bytes: {:8080 hunter2}. Define String on a value receiver, func (Secret) String() string, and both Secret and *Secret satisfy fmt.Stringer, so the field masks to {:8080 xxxxx}. Redaction living on the type is not enough, it has to live on the value form the field actually stores.",
		"A required DB_PASSWORD is unset in production. Where should that surface, and what must the error never contain? || It should surface at load time, in the one function that reads config, as an explicit error naming the variable: DB_PASSWORD is required and unset. Skip the check and the empty string flows on and surfaces much later as a nil dereference or an auth failure several layers deep, where the stack points at the symptom and nothing points back at the missing variable. And the error must never contain the value, even when there is one: an error is the single most likely thing in a program to be logged, so echoing a bad or partial secret into it writes the secret to exactly the place you were keeping it out of. Name the variable, never its contents.",
		"A flag, an environment variable, and a default all supply the listen address. Who wins, and where is that decided? || Whoever your loader says, because precedence is not implicit: the conventional order is flag beats environment beats built-in default, and it holds only because one function applies it in one place. Scatter the checks, an if here reading the env, a default set over there, a flag parsed somewhere else, and the effective order becomes whatever ran last, a bug you cannot see by reading any single site. Prefer the environment over a flag for the secret itself: a flag value lands in the process argv, which ps and /proc expose to other users on the host, while an environment variable is not printed by those tools by default.",
	],
	codeExample: `package main

import (
	"errors"
	"fmt"
	"os"
)

// Secret is a string that will not print itself. Because String has a VALUE
// receiver, both Secret and *Secret satisfy fmt.Stringer, so the mask holds
// whether the secret is logged alone or as one field inside a larger struct.
type Secret string

func (Secret) String() string { return "xxxxx" }

// Config is everything this program reads from its environment, loaded once.
// The password is a Secret, not a string, so redaction is a property of the
// TYPE, not a rule every future log line has to remember.
type Config struct {
	Addr     string
	Password Secret
}

// resolve is the one place precedence lives: an explicit value (say a parsed
// flag) wins, else the environment, else the built-in default. One function,
// one order. Scatter this across the program and the order stops being a fact
// you can point at.
func resolve(flagVal, envKey, def string) string {
	if flagVal != "" {
		return flagVal
	}
	if v, ok := os.LookupEnv(envKey); ok {
		return v
	}
	return def
}

// Load reads config once and fails fast. A required variable that is unset is
// an error here, named but never echoed, not a nil dereference three calls
// deep once something tries to use the empty value.
func Load(addrFlag string) (Config, error) {
	pw, ok := os.LookupEnv("APP_PASSWORD")
	if !ok {
		// Name the variable, never its value. An error is the single most
		// likely thing to be logged, so it is the last place a secret belongs.
		return Config{}, errors.New("APP_PASSWORD is required and unset")
	}
	return Config{
		Addr:     resolve(addrFlag, "APP_ADDR", ":8080"),
		Password: Secret(pw),
	}, nil
}

func main() {
	// Stand in for the deploy environment. In production the orchestrator sets
	// these; os.LookupEnv reads them the same either way.
	os.Setenv("APP_PASSWORD", "hunter2")

	cfg, err := Load("") // no flag override, so APP_ADDR (or the default) wins
	if err != nil {
		fmt.Println("config error:", err)
		os.Exit(1)
	}

	// The whole struct prints redacted: fmt walks the fields, reaches the
	// Secret, and calls its String method instead of printing the bytes.
	fmt.Printf("loaded: %v\\n", cfg)

	// The real value is still right here, reachable through an explicit
	// conversion. Masked by default, available on purpose.
	fmt.Println("password intact:", string(cfg.Password) == "hunter2", "| length", len(cfg.Password))
}`,
	codeExplanation:
		"Run it and it prints two lines: <code>loaded: {:8080 xxxxx}</code> and <code>password intact: true | length 7</code>. The first line is the whole point. Nothing in <code>main</code> asked for redaction; it printed <code>cfg</code> with <code>%v</code>, and <code>fmt</code> reflected over the struct's fields, reached <code>Password</code>, and, because <code>Secret</code> implements <code>fmt.Stringer</code>, called its <code>String()</code> method instead of printing the bytes. The second line proves the masking is display-only: <code>string(cfg.Password)</code> is still exactly <code>hunter2</code>, recoverable through an explicit conversion that bypasses <code>String()</code>. Masked by default, available on purpose. Now change one character to see the trap: make the receiver a pointer, <code>func (*Secret) String() string</code>. It still compiles, but the first line becomes <code>loaded: {:8080 hunter2}</code>, a live leak, because a <code>Secret</code> stored in a struct field is not addressable and only <code>*Secret</code> now carries <code>String()</code>, so <code>fmt</code> cannot reach the method and prints the raw string. Delete the <code>Secret</code> type entirely and make <code>Password</code> a plain <code>string</code> and you get the same <code>{:8080 hunter2}</code> leak for the same reason. And unset <code>APP_PASSWORD</code>: <code>Load</code> returns <code>APP_PASSWORD is required and unset</code> and the program exits before anything can use an empty credential, with an error that names the variable and never its value.",
	designRationale:
		"Two Go choices meet here. The first is that <code>fmt</code> checks for the <code>Stringer</code> interface before it formats a value, which is what makes redaction on the type possible at all: because <code>fmt</code> asks <code>String()</code> for a value's text before falling back to reflecting over its fields, a type can control how it appears in every log line ever written about it, with no cooperation from those call sites and no knowledge of them. <code>log/slog</code> generalizes the same idea with <code>slog.LogValuer</code>, whose <code>LogValue()</code> method redacts a value in structured output the way <code>String()</code> does in <code>fmt</code>: the interface differs because the destination differs, but the principle is identical, put the defense on the type so it cannot be forgotten. The second choice is what Go pointedly does not ship. There is no configuration framework in the standard library, no <code>viper</code>, because the platform gives you <code>os.LookupEnv</code>, the <code>flag</code> package, and <code>encoding/json</code>, and treats assembling them into a loader as application code. That is consistent with the rest of Go, and it is why precedence is your job: nothing decides for you whether a flag or an environment variable wins, so a program that does not decide it in one place has decided it by accident. Environment variables became the conventional home for secrets partly through the twelve-factor style and partly for a concrete reason: a value passed as a command-line flag lands in the process <code>argv</code>, which is world-readable through <code>ps</code> and <code>/proc/&lt;pid&gt;/cmdline</code> on a shared host, whereas another unprivileged process cannot read your environment. Neither is a vault; both beat compiling the secret into the binary, the one option that also makes it impossible to rotate.",
	commonMistakes: [
		{
			title: "Logging the whole config struct and trusting yourself to redact",
			body: "<code>log.Printf(\"config: %v\", cfg)</code> or <code>slog.Info(\"boot\", \"config\", cfg)</code> prints every exported field, because <code>%v</code> reflects over the struct and formats each one. A password held as a plain <code>string</code> is right there in the output, which is now in an aggregator many people can read and that keeps records for a year. Make the secret a type whose <code>String()</code> (and <code>slog.LogValuer</code>) redacts, so the value cannot print itself. Define that method on a VALUE receiver: on a pointer receiver a value stored in a struct field is not addressable, <code>fmt</code> cannot reach the method, and the field leaks the raw bytes anyway.",
		},
		{
			title: "Passing a secret as a command-line flag",
			body: "<code>--db-password=hunter2</code> puts the secret in the process <code>argv</code>, which is not private: <code>ps auxww</code> and <code>/proc/&lt;pid&gt;/cmdline</code> expose it to other users on the host, and it commonly lands in shell history and process-monitoring output. An environment variable read with <code>os.LookupEnv</code> is not printed by those tools by default. Use flags for the non-secret knobs, the listen address or a verbosity level, and the environment or a mounted file for the secret itself.",
		},
		{
			title: "No fail-fast, so a missing value becomes a nil dereference later",
			body: "Skip the required check and an unset <code>DATABASE_URL</code> is just the empty string, which sails through <code>Load</code> and only explodes later, when something dials <code>\"\"</code> or dereferences a client that was never built. The panic's stack points at that call site, not at the missing variable, so you debug the symptom. Check every required value in the loader and return an error that names the variable, turning a mystery nil dereference into a one-line boot failure.",
		},
		{
			title: "Echoing the bad value into the error message",
			body: "<code>fmt.Errorf(\"invalid APP_PASSWORD %q\", pw)</code> feels helpful and is a leak: an error is the single most likely thing in the program to be logged, so you have just written the secret to the logs while reporting a problem with it. Report the variable's NAME and the shape of what is wrong, <code>APP_PORT must be an integer</code>, never the offending contents. The same rule holds for a secret that fails validation: say which one failed, not what it was.",
		},
		{
			title: "Scattering precedence across the program instead of one loader",
			body: "When one function reads <code>APP_ADDR</code> from the environment, another hard-codes a default, and a third overrides both from a flag, the effective order of precedence is whatever runs last, which is written down nowhere and shifts as the code moves. Put the resolution in one place: one function that takes the flag value, the env key, and the default and applies a single documented order, flag then environment then default, so what wins is a fact you read in five lines instead of reconstruct by tracing execution.",
		},
	],
	relatedSlugs: ["slog", "error-handling", "method-sets", "struct-tags"],
}
