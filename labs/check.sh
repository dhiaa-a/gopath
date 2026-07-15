#!/usr/bin/env bash
# Runs every lab module through gofmt, vet, build, tests, benchmarks, and
# gates. Must be green before any commit that touches labs/.
#
#   ./check.sh              everything, gates included
#   SKIP_GATES=1 ./check.sh skip performance gates (slow/loaded machines)
#   RACE=1 ./check.sh       add -race to the test step (needs cgo)
#   ./check.sh log-parser   check a single lab
set -u

cd "$(dirname "$0")"

race_flag=""
[ "${RACE:-0}" = "1" ] && race_flag="-race"

failures=0
checked=0

run() {
	local dir="$1"
	shift
	echo "  \$ $*"
	if ! (cd "$dir" && "$@"); then
		echo "  FAIL: $dir: $*"
		failures=$((failures + 1))
		return 1
	fi
}

check_module() {
	local dir="$1"
	echo "── $dir"
	checked=$((checked + 1))

	local unformatted
	unformatted=$(cd "$dir" && gofmt -l .)
	if [ -n "$unformatted" ]; then
		echo "  FAIL: gofmt needed on:"
		echo "$unformatted" | sed 's/^/    /'
		failures=$((failures + 1))
	fi

	# The learner-facing skeleton must always compile cleanly.
	run "$dir" go build ./... || return
	run "$dir" go vet ./...

	local has_solution_tag=0
	if grep -rql '^//go:build .*solution' --include='*.go' "$dir"; then
		has_solution_tag=1
	fi

	if [ "$has_solution_tag" = "1" ]; then
		run "$dir" go build -tags solution ./...
		run "$dir" go vet -tags solution ./...
		run "$dir" go test $race_flag -tags solution ./...
	else
		run "$dir" go test $race_flag ./...
	fi

	# Self-check labs: verify the reference passes its own check program.
	if [ -d "$dir/check" ] && [ -d "$dir/solution" ]; then
		run "$dir" go run ./check -target ./solution
	fi

	# Benchmarks must compile and survive one iteration.
	if grep -rql '^func Benchmark' --include='*_test.go' "$dir"; then
		run "$dir" go test -tags solution -run '^$' -bench . -benchtime 1x ./...
	fi

	# Performance gates, relative where possible. Never run under -race.
	if [ "${SKIP_GATES:-0}" != "1" ] &&
		grep -rql '^//go:build .*gate' --include='*_test.go' "$dir"; then
		run "$dir" go test -tags 'solution gate' -run '^TestGate' ./...
	fi
}

only="${1:-}"
for mod in */go.mod; do
	[ -e "$mod" ] || continue
	dir="${mod%/go.mod}"
	if [ -n "$only" ] && [ "$dir" != "$only" ]; then
		continue
	fi
	check_module "$dir"
done

echo
if [ "$checked" = "0" ]; then
	echo "check.sh: no lab modules found${only:+ matching \"$only\"}"
	exit 1
fi
if [ "$failures" -gt 0 ]; then
	echo "check.sh: $failures failure(s) across $checked module(s)"
	exit 1
fi
echo "check.sh: ok — $checked module(s) clean"
