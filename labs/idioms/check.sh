#!/usr/bin/env bash
# Both-ways harness for the idiom exercises (One-Stop brief, Phase 6).
#
# An idiom exercise is working-but-unidiomatic code with a green test suite.
# The learner refactors until the tests stay green AND the shared linter
# config comes up clean. So the contract runs both ways:
#
#   starter    tests green, lint RED, and every registered accent linter
#              actually fires. A starter that stops tripping its linters
#              teaches nothing, exactly like a failure lab that stops
#              failing.
#   reference  (-tags solution) tests green, lint completely clean.
#
#   ./check.sh                        every exercise
#   ./check.sh getters-and-factories  one exercise
#
# Needs golangci-lint v2 (the shared .golangci.yml is a v2 config; tested
# with v2.12.2). The harness refuses to run without it rather than skipping:
# a green run that never linted would be a lie about the track's core gate.
set -u

cd "$(dirname "$0")"

if ! command -v golangci-lint >/dev/null 2>&1; then
	echo "idioms/check.sh: golangci-lint not found on PATH."
	echo "Install v2 (pinned): go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2"
	exit 1
fi
if ! golangci-lint version 2>&1 | grep -Eq 'version v?2\.'; then
	echo "idioms/check.sh: golangci-lint v2 required (found: $(golangci-lint version 2>&1 | head -1))."
	echo "The shared .golangci.yml is a v2 config; v1 cannot parse it."
	echo "Install: go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2"
	exit 1
fi

failures=0
checked=0

fail() {
	echo "  FAIL: $*"
	failures=$((failures + 1))
}

run() {
	local dir="$1"
	shift
	echo "  \$ $*"
	if ! (cd "$dir" && "$@"); then
		fail "$dir: $*"
		return 1
	fi
}

# lint_red <dir> <linter> [linter...]
# The starter must be lint-red, and each named linter must appear in the
# output. Firing linters are the exercise's teaching surface; if one goes
# quiet the accent it catches is no longer being trained.
lint_red() {
	local dir="$1"
	shift
	local out code
	out=$(cd "$dir" && golangci-lint run 2>&1)
	code=$?
	if [ "$code" -eq 0 ]; then
		fail "$dir: golangci-lint run is clean on the starter — the accent no longer reproduces"
		return
	fi
	local linter missing=0
	for linter in "$@"; do
		if ! echo "$out" | grep -q "($linter)"; then
			fail "$dir: expected linter \"$linter\" did not fire on the starter"
			missing=1
		fi
	done
	if [ "$missing" = "0" ]; then
		echo "  ok: starter lint red, fires: $*"
	else
		echo "$out" | grep -E "^\S+\.go" | sed 's/^/    /' | head -20
	fi
}

# lint_clean <dir>
# The reference must come up completely clean under the same config.
lint_clean() {
	local dir="$1"
	local out
	if ! out=$(cd "$dir" && golangci-lint run --build-tags solution 2>&1); then
		fail "$dir: golangci-lint run --build-tags solution is not clean on the reference"
		echo "$out" | grep -E "^\S+\.go" | sed 's/^/    /' | head -20
		return
	fi
	echo "  ok: reference lint clean"
}

check_exercise() {
	local dir="$1"
	echo "── idioms/$dir"
	checked=$((checked + 1))

	local unformatted
	unformatted=$(cd "$dir" && gofmt -l .)
	if [ -n "$unformatted" ]; then
		fail "$dir: gofmt needed on: $unformatted"
	fi

	# Both variants always build, vet clean, and pass the shared suite. The
	# suite is untagged: the same tests grade the learner and the reference.
	run "$dir" go build ./... || return
	run "$dir" go vet ./...
	run "$dir" go test ./...
	run "$dir" go build -tags solution ./... || return
	run "$dir" go vet -tags solution ./...
	run "$dir" go test -tags solution ./...

	# The idiom gate, both ways. Registered linters per exercise: these are
	# the accents the exercise trains against, by name.
	case "$dir" in
	any-soup)
		lint_red "$dir" forcetypeassert revive
		lint_clean "$dir"
		;;
	errors-without-context)
		lint_red "$dir" errorlint wrapcheck revive
		lint_clean "$dir"
		;;
	getters-and-factories)
		lint_red "$dir" iface recvcheck revive staticcheck unused
		lint_clean "$dir"
		;;
	index-juggling)
		lint_red "$dir" intrange unconvert modernize ineffassign predeclared
		lint_clean "$dir"
		;;
	interface-bloat)
		lint_red "$dir" interfacebloat wrapcheck
		lint_clean "$dir"
		;;
	package-sprawl)
		lint_red "$dir" iface revive wrapcheck
		lint_clean "$dir"
		;;
	panic-as-control-flow)
		lint_red "$dir" forbidigo revive
		lint_clean "$dir"
		;;
	reinvented-stdlib)
		lint_red "$dir" modernize staticcheck perfsprint
		lint_clean "$dir"
		;;
	stringly-typed)
		lint_red "$dir" goconst gocritic
		lint_clean "$dir"
		;;
	unowned-goroutines)
		lint_red "$dir" errcheck forbidigo
		lint_clean "$dir"
		;;
	*)
		fail "$dir: no linters registered in idioms/check.sh — an exercise without a red-side assertion is unverified"
		;;
	esac
}

only="${1:-}"
for mod in */go.mod; do
	[ -e "$mod" ] || continue
	dir="${mod%/go.mod}"
	if [ -n "$only" ] && [ "$dir" != "$only" ]; then
		continue
	fi
	check_exercise "$dir"
done

echo
if [ "$checked" = "0" ]; then
	echo "idioms/check.sh: no idiom exercises found${only:+ matching \"$only\"}"
	exit 1
fi
if [ "$failures" -gt 0 ]; then
	echo "idioms/check.sh: $failures failure(s) across $checked exercise(s)"
	exit 1
fi
echo "idioms/check.sh: ok — $checked exercise(s): starter red on its accents, reference clean"
