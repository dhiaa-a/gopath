import { Tier0Lesson } from "../../content"

export const errors: Tier0Lesson = {
	slug: "errors",
	order: 13,
	title: "Errors, first contact",
	tagline: "No exceptions. Failure is a return value you handle where it happens.",
	estimatedMinutes: 15,
	intro: [
		{
			type: "text",
			value: {
				en: "Go has no exceptions. No try, no catch, no throw. A function that can fail says so in its signature by returning an <code>error</code> as its last value, and the caller decides what to do, right there at the call site. This is the design decision people argue about most and the one you'll come to defend: with exceptions, any line might secretly transfer control three stack frames up; in Go, every point where failure can occur is marked <code>if err != nil</code> in the source. Control flow has no hidden paths.",
			},
		},
		{
			type: "text",
			value: {
				en: "An <code>error</code> is just a value (an interface with one method, <code>Error() string</code>, but you don't need that detail yet). <code>nil</code> means \"no error.\" The pattern below, call, check, handle-or-return, is the most common four lines in all of Go. You will write it thousands of times, and after about a week your eyes parse it as a single unit.",
			},
		},
	],
	program: `package main

import (
	"errors"
	"fmt"
	"strconv"
)

func parseAge(s string) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, err // can't even parse: pass the failure up
	}
	if n < 0 || n > 150 {
		return 0, errors.New("age out of range")
	}
	return n, nil
}

func main() {
	for _, input := range []string{"34", "abc", "999"} {
		age, err := parseAge(input)
		if err != nil {
			fmt.Println(input, "→ error:", err)
			continue
		}
		fmt.Println(input, "→ age:", age)
	}
}`,
	after: [
		{
			type: "text",
			value: {
				en: "Walk the three inputs. <code>\"34\"</code> parses and validates: <code>(34, nil)</code>. <code>\"abc\"</code> fails inside <code>strconv.Atoi</code>, a real standard-library function that returns <code>(int, error)</code> exactly like yours; <code>parseAge</code> checks and passes the error up. <code>\"999\"</code> parses fine but fails your own rule, so you construct an error with <code>errors.New</code>. Same channel for library failures and business-rule failures: a value in the second return slot.",
			},
		},
		{
			type: "text",
			value: {
				en: "Two conventions to absorb now. Error is always the <em>last</em> return value. And when a function returns a non-nil error, the other return values are zero values the caller must not trust; that's why <code>parseAge</code> returns <code>0, err</code> and never a partial result alongside a failure. The full machinery (wrapping with context, matching specific errors) lives in the <a href=\"/concepts/error-handling\" class=\"text-go-cyan underline decoration-go-cyan/40 hover:no-underline\">error handling concept</a>, which Tier 1 project one will send you to.",
			},
		},
		{
			type: "callout",
			variant: "info",
			value: {
				en: "The verbosity is a feature, not a cost to engineer away. Reading a Go function top to bottom, every <code>if err != nil</code> is a visible fork where the happy path and the failure path split. Compare a Java method where any call might throw: the failure paths exist, you just can't see them. Go trades keystrokes for the ability to audit failure handling by reading.",
			},
		},
	],
	retrievalPrompts: [
		"What is the idiomatic shape for calling a function that returns (T, error)? || v, err := fn(); if err != nil { handle or return }. Check the error before touching v; when err is non-nil, v is a zero value you must not trust. The error is always the last return value.",
		"How do you create an error for a business rule, like a value out of range? || errors.New(\"age out of range\") for a fixed message, or fmt.Errorf(\"age %d out of range\", n) when it needs formatting. Return it as the last value with zero values for the rest: return 0, errors.New(...).",
		"Why did Go reject exceptions? Make the strongest version of the argument. || Exceptions create invisible control flow: any call can transfer control up the stack without a trace at the call site. Errors-as-values put every failure fork in the source as if err != nil, so failure handling is auditable by reading. The cost is verbosity; the payoff is no hidden paths.",
	],
}
