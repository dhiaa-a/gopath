#!/usr/bin/env bash
# Both-ways harness for the capstone (One-Stop brief, Phase 8).
#
#   conformance   the reference implementation passes every check
#   seeded bugs   deliberate bugs, each caught by the checks it names
#   objectives    the reference meets its own service level objectives
#
# The middle one is the point. A suite that has only ever been run against
# correct code has not been tested, it has been agreed with, and a capstone
# whose whole claim is "passing this means something" cannot rest on that. So
# every run breaks the reference on purpose, once per seeded bug, and requires
# the suite to notice each time. A seed that goes in, compiles, and leaves the
# suite green is a red build here, exactly like a failure lab that stops
# failing.
#
#   ./check.sh                 everything
#   SKIP_GATES=1 ./check.sh    skip the load run (slow or loaded machines)
#
# The load run takes about fifteen seconds and the seeded bugs a few minutes,
# most of it compiling eleven copies of the reference.
set -u

cd "$(dirname "$0")"

if ! command -v go >/dev/null 2>&1; then
	echo "capstone/check.sh: no Go toolchain on PATH."
	echo "Every part of this harness builds and runs a server; without Go there is"
	echo "nothing to run, and passing silently would be a lie."
	exit 1
fi

failures=0

step() {
	local about="$1"
	shift
	echo
	echo "── capstone: $about"
	if ! "$@"; then
		echo "  FAIL: $about"
		failures=$((failures + 1))
	fi
}

step "conformance (reference must pass)" go run ./suite -target ./reference
step "seeded bugs (suite must catch each)" go run ./seed

if [ "${SKIP_GATES:-0}" != "1" ]; then
	step "objectives (reference must meet its SLOs)" go run ./slo -target ./reference
else
	echo
	echo "── capstone: objectives skipped (SKIP_GATES=1)"
fi

echo
if [ "$failures" -gt 0 ]; then
	echo "capstone/check.sh: $failures stage(s) failed"
	exit 1
fi
echo "capstone/check.sh: ok"
