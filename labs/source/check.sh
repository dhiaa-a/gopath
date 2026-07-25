#!/usr/bin/env bash
# Verbatim-quote harness for the source-reading walkthroughs (One-Stop brief,
# Phase 7).
#
# The other lab harnesses check code we wrote. This one checks code we did NOT
# write: every excerpt on the /source pages is quoted from the standard
# library, and this harness holds each quote against the reader's own GOROOT.
#
#   found      the excerpt appears byte-for-byte in the named file
#   unique     exactly once, so its line number is unambiguous
#   located    starting on the line the page prints next to it
#   anchored   each exercise answer still names something that exists
#
# A quote that has drifted is worse than no quote: the reader opens the file,
# sees something else, and learns not to trust the site at the exact moment it
# is asking them to trust source over documentation. So drift is a red build,
# the same way a failure lab that stops failing is a red build.
#
#   ./check.sh                 every walkthrough
#   ./check.sh sync-waitgroup  one walkthrough
#
# The matching logic lives in scripts/source-check.ts (string handling this
# exact is not a job for bash). This file is the entry point, so the labs
# spine has one convention.
set -u

cd "$(dirname "$0")/../.."

if ! command -v go >/dev/null 2>&1; then
	echo "source/check.sh: no Go toolchain on PATH."
	echo "The walkthroughs are checked against your own GOROOT; without Go there is"
	echo "nothing to check them against, and passing silently would be a lie."
	exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
	echo "source/check.sh: npx not found on PATH (needed to run the TypeScript checker)."
	echo "Install Node 20+, then: npm install"
	exit 1
fi

exec npx tsx scripts/source-check.ts "$@"
