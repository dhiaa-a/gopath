# BRIEF — One-Stop Go

Read this after CLAUDE.md. While this brief is active, it is the mandate: ROADMAP items not listed here (search, inline runner, progress tracking, Coming-from-X sidebars, pricing) are frozen until this brief is done. The pedagogy rules in CLAUDE.md still bind everything below.

---

## Mission

GoPath's current promise is "learn Go by building." The new promise is stronger: **GoPath is the only Go resource a learner needs** — from never-written-a-line-of-Go to an employable backend engineer who can build, debug, and profile production services. No Tour of Go on-ramp, no Go by Example sidecar tab, no "now go read Effective Go." If finishing GoPath still requires another resource, that is a bug in GoPath.

A one-stop resource must do five jobs that are currently spread across five kinds of resources:

1. **Mental models** (the job of the Go book) — explain *why*, down to the machine and the language design.
2. **Idiom** (the job of Effective Go / 100 Go Mistakes) — make learners *write* Go like Go, not Java-in-Go.
3. **Lookup** (the job of Go by Example) — answer "how do I X in Go" in under two minutes, years after finishing.
4. **Verified practice** (the job of Learn Go with Tests) — executable checks, not self-assessed prose.
5. **Scar tissue** (the job of production incidents) — deadlocks, leaks, and races debugged here first, not on the job.

GoPath today does job 1 partially and jobs 2–5 barely or not at all. This brief closes all five.

## Current state, honestly

- `orientation/learn-syntax` sends learners to Tour of Go and tells them to keep Go by Example open as a sidecar. By its own words the site is not one-stop. This page gets rewritten in Phase 1.
- 15 concepts in `lib/concepts.ts`. Generics is absent. So are embedding, sync.Mutex/atomic, the memory model, slice internals, testing, benchmarking, modules and tooling.
- 10 projects, 3–4 steps each, roughly 35–45 learner-hours total. The target is 150–250 honest hours.
- Nothing is executable. Assessment blocks describe test cases in prose; a learner never runs `go test` against anything we wrote.
- No debugging exercises, no refactoring exercises, no guided source reading, no deployment coverage.

What is already right — do not rebuild:

- Typed content blocks + `scripts/validate.ts` in the build.
- The tier teaching contracts: `pattern` (T1) → `requirement` (T2) → `constraint` (T3). This is the pedagogical spine; extend it, never flatten it.
- Concept anatomy: mental model, retrieval prompts, design rationale, common mistakes, relations.
- Spaced reuse callouts.
- The five pedagogy rules.

## Non-goals — do not touch

- No platform features: no search, no inline code runner, no progress tracking, no auth, no payments, no analytics. They stay on ROADMAP for later.
- No visual redesign, no new fonts, no component library.
- No CMS, no database, no i18n beyond the existing `en` LocalizedString shape.
- Labs require no service and no infrastructure: plain Go modules a learner clones and runs with the standard toolchain. If a phase seems to need a server, a grader service, or CI-for-learners, it doesn't — simplify.
- No new dependencies unless a phase genuinely cannot ship without one; log any addition in DECISIONS with the alternative you rejected.

## Constraints

- The five pedagogy rules hold. Their concrete consequences for this brief:
  - **Rule 1 (no assessments in early T1):** T1 P1 and P2 labs ship starter code and a runnable expected-output self-check, NOT a graded test suite.
  - **Rule 2 (table tests at T1 P3):** the first graded test suite appears at T1 P3 (`log-parser`), and that suite is table-driven — the learner learns table-driven tests by reading the suite that grades them. This is deliberate; write the suite to be read.
  - **Rule 3 (T3 benchmark-gated):** T3 labs include benchmark/load harnesses that enforce the metric gates already stated in the T3 assessment blocks.
  - **Rule 4 (micro-exercises never gate):** failure labs and idiom exercises are always optional strengthening. Never phrase them as prerequisites.
  - **Rule 5 (anchors fixed):** `config-watcher` and `tcp-echo` keep their names and positions.
- `npm run build` green after every session. Extend `scripts/validate.ts` to cover every new content shape you introduce (labs links resolve, new slugs unique, relations intact).
- Every Go file shipped: `gofmt`-clean, `go vet`-clean, builds and tests on the latest stable Go. Add `labs/check.sh` that loops every lab module and runs vet + test (+ benchmarks compile). It must pass before any commit that touches `labs/`.
- Voice spec below applies to every word of prose.

## Voice spec

- Write to a smart, impatient adult. No cheerleading, no filler, no "awesome."
- Explain *why* at the level of the machine or the language design, never "because best practice."
- Concrete before abstract: show the naive or failing version first, then the right one.
- Every claim about behavior must be runnable in the adjacent code or attributable to the spec/stdlib docs.
- Em-dashes stay out of prose (DECISIONS 2026-05-13). Commas, colons, sentence breaks.

---

## Phases

Sequential. One phase = one or more Claude Code sessions. Every phase ends with: build green, `labs/check.sh` green (where labs exist), ROADMAP updated, a DECISIONS entry, commits on a `feat/one-stop-p<N>` branch. Never push to main.

### Phase 0 — Split the content monolith (mechanical, no prose changes)

`lib/projects.ts` is 1,800+ lines and about to grow 5–10x; sessions will choke reading it and parallel work on it is merge hell.

- Move each project to `lib/content/projects/<slug>.ts`; `lib/projects.ts` becomes imports + the existing exports. Public API identical, pages untouched.
- Do the same for concepts (`lib/content/concepts/<slug>.ts`) since Phase 4 quadruples that file.
- Zero prose edits in this phase. Diff should be pure moves.

**Done when:** rendered site is byte-identical, every content file is under ~500 lines, build green.

### Phase 1 — Tier 0: syntax taught in-house

Replace the outsourced on-ramp. 12–16 micro-lessons, each ≤20 minutes: one syntax cluster, taught by writing one ≤30-line program, closed with 2–3 retrieval prompts in the existing flip-card format.

Coverage: values/variables/zero values; basic types and conversions; functions and multiple returns; control flow (for is everything); structs and methods; pointers (what `*` and `&` actually do — this fixes the known T1 P1 friction); slices and maps first contact; strings/bytes/runes first contact; packages and imports; errors first contact; closures; `main`, `go run`, `go build`.

- Reuse existing block types and the Go Playground share pipeline. New page family (e.g. `lib/content/tier0/`), decide the routing (`/basics/[slug]` or extend orientation) and log it.
- Rewrite `learn-syntax`: it now points inward to Tier 0. External links may survive only as a small "other angles" footnote.
- Update the ready-check page to test Tier 0 material.

**Done when:** a developer fluent in Python/JS/Java/C# can go from zero Go to starting T1 P1 without leaving the site, and `learn-syntax` no longer instructs anyone to keep another site open.

### Phase 2 — The executable spine (`labs/`)

The single biggest gap. Create `labs/<project-slug>/` for all 10 projects:

- Each lab is a self-contained Go module: `go.mod`, `README.md` (how to run the checks), `starter/` scaffolding where appropriate.
- **T1 P1–P2:** runnable expected-output self-checks only (rule 1). A small `run-check` script or verify binary that diffs output is fine; it must not read as a graded exam.
- **T1 P3 onward:** a real `go test` suite the learner's implementation must pass. Black-box where possible (test the binary or the exported API, not internals) so learner design freedom survives.
- **T3:** benchmark/load harnesses enforcing the metric gates the assessment blocks already state (e.g. the observability project's before/after numbers become a `benchstat`-comparable harness).
- Site integration: each project page links its lab; `assessment` blocks reference the real files instead of describing hypothetical tests. Extend the `Assessment` type minimally (e.g. a `labPath` field) rather than inventing a new block.
- `labs/check.sh` loops every module: `gofmt -l`, `go vet ./...`, `go test ./...`.

**Done when:** `labs/check.sh` passes with reference solutions in place, and "done" for every project from T1 P3 up is machine-checkable on the learner's machine.

### Phase 3 — Depth pass on the 10 projects

Grow each project from 3–4 steps to 6–10. Fixed step anatomy:

1. **Motivation** — what breaks or hurts without this step.
2. **Concept** — the minimum theory, linked to its concept page.
3. **Build** — the tier-appropriate contract block (pattern/requirement/constraint).
4. **Verify** — run something concrete, tied to the Phase 2 lab.
5. **Break it** — one deliberate failure the learner causes and observes (wrong flag, killed connection, race flag on).
6. **Recap** — one retrieval prompt.

Fill professional gaps inside existing projects where they naturally belong: graceful shutdown and timeouts (http-server), slog structured logging (db-api or http-server), middleware depth (http-server), config from env (db-api), input validation and SQL injection (db-api), generics in practice (worker-pool gets a generic-worker step).

Add **one** new T3 project, `ship-it`: single static binary, minimal Dockerfile, GitHub Actions CI running vet+test, health/readiness endpoints, env-based config, and a written deploy story. That closes the deployment hole. Adding a project is within autonomy; anchors untouched.

**Done when:** honest totals of roughly T1 30–40h, T2 40–50h, T3 60–80h; every step's Verify maps to something runnable; the `estimatedTime` backlog item gets resolved as part of this pass (decide once, apply everywhere).

### Phase 4 — Reference layer: 15 → 60 concepts

Every concept must pass the **lookup test**: a mid-project learner (or a graduate two years later) lands on the page, copies a runnable example, scans the gotchas, and leaves inside two minutes. Keep the existing `Concept` shape, retrieval prompts included.

Priority order (ship top-down; ≥45 is the floor, 60 the target):

generics; embedding; sync.Mutex and RWMutex; atomic; sync.Once; buffered vs unbuffered channels; channel closing and ownership; the memory model and happens-before; escape analysis and allocation; slice internals (len/cap/append/aliasing); arrays vs slices; strings, bytes, runes; io.Reader/Writer composition; bufio; time (timers, tickers, AfterFunc, the time.After leak); testing; table-driven tests; benchmarks; fuzzing; pprof; the race detector; modules and go.mod; tooling (gofmt, vet, staticcheck, golangci-lint); panic and recover; init and package lifecycle; struct tags; encoding/json beyond the basics; the http client (timeouts!); http server internals; context propagation patterns; errors.Join and multi-errors; sentinel vs typed errors; nil in all its shapes (typed-nil interfaces); method sets and receivers; closures and captured variables; iterators / range-over-func; build tags and conditional compilation; GC knobs (GOGC, GOMEMLIMIT) at awareness level; goroutine leak patterns; worker pool patterns; rate limiting; graceful shutdown; database/sql and pgx patterns; prepared statements and SQL injection; secrets and configuration.

Wire `relatedSlugs` and project relations as you go. Update the homepage stat only when the number is real (truth-audit rule stands).

**Done when:** ≥45 concepts at the existing quality bar, relations valid, homepage truthful.

### Phase 5 — Failure labs (scar tissue)

`labs/failures/<slug>`: a program that compiles and looks plausible but is broken, plus `SYMPTOM.md` written the way a user or on-call engineer would report it. The site gets one page per lab: symptom, which tools to reach for, then diagnosis, fix, and "how this shows up in production" behind a reveal interaction (a small new block or component is justified here; keep it dumb).

Ship 12–15 covering: deadlock via unbuffered send with no receiver; goroutine leak (blocked forever on a channel nobody closes); data race caught with `-race`; write to nil map; typed-nil interface that isn't nil; slice aliasing corrupting a caller's data; append sharing a backing array; loop-variable capture (with the Go 1.22 semantics change noted); ignored context cancellation; time.After leaking in a select loop; WaitGroup Add-after-Wait; defer in a loop holding file handles; JSON unmarshal silently zeroing misspelled fields; mutex copied by value; iterating bytes when you meant runes.

Each must reproduce deterministically (or reliably under `-race`) on a stock toolchain — verify in `labs/check.sh` with an expected-to-fail mode. Optional strengthening only (rule 4); suggest an unlock tier per lab.

**Done when:** every lab reproduces on demand and every site page teaches the diagnostic path, not just the answer.

### Phase 6 — Idiom track ("accent removal")

This is what replaces Effective Go and 100 Go Mistakes: not reading about idiom, refactoring toward it under mechanical enforcement.

`labs/idioms/<slug>`: working-but-unidiomatic code with a green test suite, plus a shared strict `.golangci.yml` at `labs/idioms/`. The learner refactors until tests stay green AND the linter is clean. `REVIEW.md` per exercise walks each smell → idiom with the reasoning a senior Go reviewer would give.

8–10 exercises targeting real accents: Java-brain (getters/setters, interface-per-struct, factory soup); Python-brain (exceptions thinking, stringly-typed everything); C-brain (index-juggling instead of range, manual buffers); plus: giant interfaces → small consumer-defined ones; panic-driven error handling → wrapped errors; naked goroutines → owned lifecycles; `interface{}` soup → generics or concrete types; package sprawl → flat-until-it-hurts.

**Done when:** reference solutions pass tests + lint for every exercise, and each exercise names the exact mistakes it trains against.

### Phase 7 — Guided source reading

Professionals read code; almost nothing teaches it. Five walkthrough pages: the errors package; bytes.Buffer; sync.WaitGroup; the net/http Server accept loop; context. Short annotated excerpts (Go's stdlib is BSD-3-Clause; include attribution once, site-wide), "what to notice" commentary, and one exercise each (e.g. "find the exact line where http.Server decides to spawn a goroutine per connection").

**Done when:** a learner finishing T2 can open stdlib source without fear, and the walkthroughs are linked from the relevant concepts and projects.

### Phase 8 — Capstone

One page + `labs/capstone`: a real spec (your call — something like a URL shortener or link tracker with auth, rate limiting, persistence, metrics; log the choice), a full black-box test suite, SLOs enforced by a benchmark/load harness, and **zero guidance**. Passing the suite and the SLOs is the site's public claim of job-readiness.

Only after this ships: update homepage positioning to the new promise, and rewrite any remaining copy that still frames GoPath as a companion resource.

**Done when:** a reference implementation passes suite + SLOs, and the suite catches seeded bugs from the Phase 5 failure classes.

---

## Working agreement for this brief

- One phase per session unless a phase's Done criteria clearly needs more; the human runs `/clear` between phases.
- Never parallel-edit a shared file. Parallel work is allowed only on disjoint paths (`labs/*`, `lib/content/concepts/*`, `lib/content/projects/*` after Phase 0).
- Ambiguity: decide, log one line in DECISIONS, proceed — except the standing escalations (money, main, pedagogy rules, anchors, pricing, public comms).
- When a phase changes structure or counts, update CLAUDE.md's repo map and tier description in the same session (it currently says "9 real programs" while the code ships 10; fix that when the count next changes).
- Homepage and marketing claims change only when the thing they describe has shipped.

## The bar

The delete-test, applied at the end: pick any chapter of the Go book, any section of Effective Go, any Go by Example page, any Learn Go with Tests chapter. GoPath must have an equal-or-better treatment of it reachable in two clicks or fewer. Every miss is a bug — file it in ROADMAP under Open observations.
