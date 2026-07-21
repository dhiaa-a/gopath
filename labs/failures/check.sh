#!/usr/bin/env bash
# Expected-to-fail harness for the failure labs (One-Stop brief, Phase 5).
#
# A failure lab is a program that is broken ON PURPOSE. So the contract runs
# both ways: the broken variant must keep reproducing its documented symptom,
# and the fixed variant (-tags fixed) must keep running clean. A broken lab
# that stops failing is as red as a fixed one that stops passing, because a
# reproduction that no longer reproduces teaches nothing.
#
#   ./check.sh             every failure lab
#   ./check.sh deadlock    one lab
#
# Labs that need the race detector are exercised only when a C compiler is
# found (cgo); on machines without one they print SKIP and stay green, since
# a stock Windows box cannot run them and the brief only requires -race
# reproduction where -race exists.
set -u

cd "$(dirname "$0")"

failures=0
checked=0

# timeout(1) exists in Git Bash and Linux; macOS may lack it. Labs are all
# designed to terminate on their own, so running bare is acceptable there.
if command -v timeout >/dev/null 2>&1; then
	TIMEOUT="timeout 90"
else
	TIMEOUT=""
fi

# The race-capable toolchain probe, same locations as ../check.sh.
have_cc=0
if command -v gcc >/dev/null 2>&1 || command -v cc >/dev/null 2>&1; then
	have_cc=1
else
	for d in /c/msys64/ucrt64/bin /c/msys64/mingw64/bin /c/mingw64/bin /c/TDM-GCC-64/bin; do
		if [ -x "$d/gcc.exe" ]; then
			PATH="$d:$PATH"
			have_cc=1
			break
		fi
	done
fi

fail() {
	echo "  FAIL: $*"
	failures=$((failures + 1))
}

# expect <dir> <variant:broken|fixed|race-broken|race-fixed> <want:ok|fail> <grep-regex|-> [absent-regex]
# Runs the lab's program and asserts on exit code and output. The optional
# fifth argument is a regex the output must NOT match, for labs whose broken
# output has no unique line of its own (loop-capture).
expect() {
	local dir="$1" variant="$2" want="$3" re="$4" absent="${5:-}"
	local args="" label="go run ."
	case "$variant" in
	fixed) args="-tags fixed" label="go run -tags fixed ." ;;
	race-broken) args="-race" label="go run -race ." ;;
	race-fixed) args="-race -tags fixed" label="go run -race -tags fixed ." ;;
	esac

	local out code attempt
	for attempt in 1 2 3; do
		case "$variant" in
		race-*) out=$(cd "$dir" && CGO_ENABLED=1 $TIMEOUT go run $args . 2>&1) ;;
		*) out=$(cd "$dir" && $TIMEOUT go run $args . 2>&1) ;;
		esac
		code=$?
		# Intermittent Windows flake: TSan sometimes cannot reserve its shadow
		# memory (VirtualAlloc error 87 under ASLR) and aborts before the
		# program runs. That is "could not measure", not "measured wrong", so
		# retry, and if it persists, say so loudly instead of failing the lab.
		if ! echo "$out" | grep -q "ThreadSanitizer failed to allocate"; then
			break
		fi
		if [ "$attempt" = "3" ]; then
			echo "  SKIP: $label — ThreadSanitizer could not reserve shadow memory (Windows ASLR flake, not a lab regression); rerun to verify"
			return
		fi
		sleep 2 # the flake arrives in bursts; give the address space a beat
	done

	if [ "$want" = "ok" ] && [ "$code" -ne 0 ]; then
		fail "$dir: $label exited $code, want 0"
		echo "$out" | tail -5 | sed 's/^/    /'
		return
	fi
	if [ "$want" = "fail" ] && [ "$code" -eq 0 ]; then
		fail "$dir: $label exited 0 — the broken variant no longer reproduces its symptom"
		return
	fi
	if [ "$re" != "-" ] && ! echo "$out" | grep -Eq "$re"; then
		fail "$dir: $label output no longer matches /$re/"
		echo "$out" | tail -5 | sed 's/^/    /'
		return
	fi
	if [ -n "$absent" ] && echo "$out" | grep -Eq "$absent"; then
		fail "$dir: $label output matches /$absent/, which this variant must never print"
		echo "$out" | tail -5 | sed 's/^/    /'
		return
	fi
	echo "  ok: $label ($want, /$re/${absent:+, !/$absent/})"
}

# vet_expect <dir> <variant:broken|fixed> <want:ok|fail> <grep-regex|->
# For the labs where go vet itself is the diagnostic tool (copylocks).
vet_expect() {
	local dir="$1" variant="$2" want="$3" re="$4"
	local args=""
	[ "$variant" = "fixed" ] && args="-tags fixed"
	local out code
	out=$(cd "$dir" && go vet $args ./... 2>&1)
	code=$?
	if [ "$want" = "ok" ] && [ "$code" -ne 0 ]; then
		fail "$dir: go vet $args ./... failed, want clean"
		echo "$out" | tail -5 | sed 's/^/    /'
		return
	fi
	if [ "$want" = "fail" ] && [ "$code" -eq 0 ]; then
		fail "$dir: go vet $args ./... is clean — vet was expected to catch the broken variant"
		return
	fi
	if [ "$re" != "-" ] && ! echo "$out" | grep -Eq "$re"; then
		fail "$dir: go vet $args output no longer matches /$re/"
		return
	fi
	echo "  ok: go vet $args ($want)"
}

check_lab() {
	local dir="$1"
	echo "── failures/$dir"
	checked=$((checked + 1))

	local unformatted
	unformatted=$(cd "$dir" && gofmt -l .)
	if [ -n "$unformatted" ]; then
		fail "$dir: gofmt needed on: $unformatted"
	fi

	# Both variants must always COMPILE. Broken means broken at runtime;
	# a program that does not build is not a plausible-looking program.
	# (On Windows `go build` drops <dir>.exe in the module dir; remove it.)
	(cd "$dir" && go build ./...) || { fail "$dir: broken variant must compile"; return; }
	(cd "$dir" && go build -tags fixed ./...) || { fail "$dir: fixed variant must compile"; return; }
	rm -f "$dir"/*.exe

	# vet is clean on both variants unless a lab's case says otherwise:
	# for those labs vet IS the lesson, and its catch is asserted instead.
	case "$dir" in
	mutex-by-value) ;; # vet expectations live in the case below
	*)
		(cd "$dir" && go vet ./...) || fail "$dir: go vet (broken) not clean"
		(cd "$dir" && go vet -tags fixed ./...) || fail "$dir: go vet (fixed) not clean"
		;;
	esac

	case "$dir" in
	deadlock)
		expect "$dir" broken fail "all goroutines are asleep - deadlock!"
		expect "$dir" fixed ok "invoice\.pdf"
		;;
	slice-aliasing)
		expect "$dir" broken ok "archived original:.*\*\*\*"
		expect "$dir" fixed ok "archived original:.*user=alice"
		;;
	append-sharing)
		expect "$dir" broken ok "dev flags:.*--quiet"
		expect "$dir" fixed ok "dev flags:.*--verbose"
		;;
	loop-capture)
		# Broken output has no unique line (every handler prints the final
		# menu entry), so the assertion is presence AND absence.
		expect "$dir" broken ok "2: quit" "0: start"
		expect "$dir" fixed ok "0: start"
		;;
	data-race)
		expect "$dir" broken ok "counted "
		expect "$dir" fixed ok "counted 1000000 of 1000000 hits"
		if [ "$have_cc" = "1" ]; then
			expect "$dir" race-broken fail "WARNING: DATA RACE"
			expect "$dir" race-fixed ok "lost: 0"
		else
			echo "  SKIP: -race reproduction (no C compiler; see labs/README.md)"
		fi
		;;
	mutex-by-value)
		# vet IS the headline tool for this lab: copylocks catches the class
		# before any run, so the broken variant is expected vet-red.
		vet_expect "$dir" broken fail "passes lock by value"
		vet_expect "$dir" fixed ok "-"
		expect "$dir" broken fail "concurrent map writes"
		expect "$dir" fixed ok "recorded 400000 of 400000 picks"
		;;
	time-after-leak)
		# go.mod pins go 1.22 on purpose: the leak this lab reproduces was
		# fixed for modules declaring 1.23+. Do not "fix" the pin.
		expect "$dir" broken ok "retained [2-9][0-9]+(\.[0-9]+)? MB"
		expect "$dir" fixed ok "retained 0"
		;;
	json-silent-zero)
		expect "$dir" broken ok "imported invoice: acme 0 EUR"
		expect "$dir" fixed ok "imported invoice: acme 12500 EUR"
		;;
	defer-in-loop)
		expect "$dir" broken fail "verified: 0 of 40 reports complete"
		expect "$dir" fixed ok "verified: 40 of 40 reports complete"
		;;
	typed-nil)
		expect "$dir" broken fail "startup aborted: <nil>"
		expect "$dir" fixed ok "startup ok: listening on 127\.0\.0\.1:8080"
		;;
	nil-map-write)
		expect "$dir" broken fail "assignment to entry in nil map"
		expect "$dir" fixed ok 'words counted: 20 \(15 distinct\)'
		;;
	bytes-vs-runes)
		# The %q print makes the corruption visible as a literal \xc3 escape,
		# which is also the stable ASCII thing to grep. The fixed assertion is
		# "the character after pr is NOT a backslash escape".
		expect "$dir" broken ok 'payload: "Commande pr\\xc3'
		expect "$dir" fixed ok 'payload: "Commande pr[^\\]'
		;;
	goroutine-leak)
		expect "$dir" broken ok "^goroutines now: 101$"
		expect "$dir" fixed ok "^goroutines now: 1$"
		;;
	ctx-ignored)
		expect "$dir" broken ok "^items started after cancel: [1-9][0-9]*$"
		expect "$dir" fixed ok "^items started after cancel: 0$"
		;;
	wg-add-after-wait)
		expect "$dir" broken ok '\([1-9][0-9]* unaccounted\)'
		expect "$dir" fixed ok '^completed 100 of 100 jobs \(0 unaccounted\)$'
		;;
	*)
		fail "$dir: no expectation registered in failures/check.sh — a lab without an expected-to-fail assertion is unverified"
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
	check_lab "$dir"
done

echo
if [ "$checked" = "0" ]; then
	echo "failures/check.sh: no failure labs found${only:+ matching \"$only\"}"
	exit 1
fi
if [ "$failures" -gt 0 ]; then
	echo "failures/check.sh: $failures failure(s) across $checked lab(s)"
	exit 1
fi
echo "failures/check.sh: ok — $checked lab(s): broken reproduces, fixed runs clean"
