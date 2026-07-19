# Lab: cli-renamer (Tier 1, Project 1)

The lab for the file renamer CLI. There is no test suite in here, on purpose:
this early in Tier 1 you check your own work by running it and reading the
output, the way you would with any small tool you just wrote. Graded suites
start at T1 P3, where you learn to read tests before you write them.

## Layout

    starter/main.go    your program: three TODOs, one per project step
    solution/main.go   the reference; stay out until your check run is green
    check/main.go      the self-check program
    testdata/          the folders the check copies into temp dirs and renames

## Run the check

From this directory:

    go run ./check

That builds `starter/`, then runs your binary through six scenarios: a plain
rename run, a dry run, a folder containing a subdirectory, awkward
extensions, a missing `--pattern`, and a `--dir` that does not exist. Each
scenario prints what your program did next to what the project steps
describe, with the differences spelled out. Any difference and the check
exits 1.

A fresh clone matches almost nothing. That is the intended starting state,
not a problem: work the TODOs in `starter/main.go` in step order and rerun
the check after each step. The list of differences is your progress bar.

The check never touches `testdata/` itself. Every scenario runs against a
fresh copy in a temp directory, so you can rerun it as often as you like.

To point it somewhere else (for example at the reference):

    go run ./check -target ./solution

## What done looks like

    all 6 scenarios match. Your renamer does what the steps describe.

and an exit code of 0.

## About solution/

The reference lives in its own package so the check can build either one;
later labs keep the reference behind a `solution` build tag instead. The rule
is the same everywhere: do not open the solution until your run is green.
Then do read it, and compare decisions, not just output.
