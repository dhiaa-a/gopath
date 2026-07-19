# GoPath Decisions Log

Append-only. Newest at the top.

---

## 2026-07-19 — Gap-filling pass: -race, the last two T3 gates, and 60 concepts

**Scope:** close the open gaps carried out of Phases 2-4 before starting Phase 5, prompted by Aboturab installing a C compiler and asking to fix the rest. Four things landed: `-race` is now real, rule 3 is complete across T3, the concept library reached 60, and the working tree was cleaned up.

**`-race`: fix the toolchain lookup, do not touch the global PATH.** The MSYS2 ucrt64 gcc (16.1.0) was installed but not on PATH, and `CGO_ENABLED` was pinned to 0 in `go env`; that was the entire blocker. Rather than mutate the user's global PATH or `go env` (a persistent, machine-wide change I would rather not make unilaterally), `check.sh` now, only when `RACE=1`, sets `CGO_ENABLED=1` for the run and probes the usual Windows toolchain locations if no gcc is on PATH. So `RACE=1 ./labs/check.sh` works out of the box here and stays portable to a CI box where gcc is already on PATH. Verified two ways: the detector fires on a deliberate data race, and all 11 modules are race-clean. The detector working AND the suites being clean are separate claims; both are now checked, where before neither was.

**Rule 3 (T3 hard-gated by a measurable metric) was half-unmet; both halves are now implemented, which is compliance, not a rule change.** grpc-service and db-api had no gate. Implementing one satisfies an existing pedagogy rule, so it is within autonomy (changing rule 3 would not be). Metric choices, both code-property gates that assert an exact value with no machine-dependent threshold, mirroring the worker-pool/config-watcher house style:
- **grpc-service: the read path allocates zero times.** `GetUser` is a map lookup returning the stored pointer, so 0 heap allocations is the honest number; `testing.AllocsPerRun` asserts it, and `CreateUser` is the in-run control that must allocate (a comparison that cannot fail on the control is not a comparison). Chosen over an end-to-end latency gate because latency through bufconn is noisy and a per-request allocation is the real production tax a gRPC read service pays.
- **db-api: Create is one round trip, full CRUD is five.** Round-trip count is the dominant cost of a DB API and the thing `INSERT ... RETURNING` exists to minimise. A counting fake `querier` (the same interface seam that makes `WithTx` work) counts hops with no live Postgres, so the gate runs in `check.sh` offline. Chosen over the originally-logged `pgx.QueryTracer` idea, which needs a live connection to fire.

Both gates were adversarially verified: the reference was regressed (grpc-service returns a copy; db-api splits Create into INSERT + SELECT) and each gate failed with its intended message before being reverted. Each project also gained a taught step 10 and a README section, which adds a little real T3 content; the T3 hours gap (now ~56-64 vs 60-80) is narrowed, not closed.

**Concepts 48 → 60, with two deliberate substitutions from the brief's list.** Twelve pages at the `server-timeouts` bar, written by a six-way agent fan-out and then independently re-verified by the orchestrator: every example was re-compiled and run here (12/12), not trusted from the agents' reports, and all 12 POSTed to the Playground clean. **Dropped from the brief's named list, and why:** iterators / range-over-func needs Go 1.23 (the toolchain is go1.22.1), so its example cannot compile, let alone run; and a `database/sql` page cannot run an example without a driver, and the db-api project already teaches pgx deeply. **Substituted in** (all stdlib-runnable on 1.22): iota, value-semantics, reflection, scheduler. If the toolchain moves to 1.23+, iterators is the first page to add. One agent died on an API error mid-run; its two files (secrets-config, build-tags) were already on disk, complete, and were read and verified against a real run rather than assumed good, consistent with this project's standing "verify against disk, not notifications" habit. A cross-cutting bug the fan-out surfaced: `retrievalPrompts` render as plain text (not HTML), so two files' prompts had their `<code>` tags stripped.

**Restored the deleted agent files rather than committing the deletion.** `.claude/agents/{engineer,pm,content}.md` showed as deleted in the working tree. CLAUDE.md points at all three as the standing briefs, so committing the deletion would leave the project's own instructions dangling. Nothing recorded an intent to remove them, so the consistent fix was `git checkout`, not `git rm`.

**Alternatives considered:** adding `C:\msys64\ucrt64\bin` to the global PATH / flipping `CGO_ENABLED=1` in `go env` (rejected: persistent machine-wide change, and the `check.sh` probe is portable and scoped); a latency gate for grpc-service and a `QueryTracer` gate for db-api (rejected: both need a noisy or live dependency, and a gate that flakes is worse than none); padding T3 steps to hit 60-80h (rejected: the estimatedTime honesty rule); shipping the agent-written concepts on their self-reports (rejected: the session has caught wrong-but-plausible output five times, so all 12 were re-run).

**Logged by:** Claude Code (engineer + content, One-Stop brief)

---

## 2026-07-15 — One-Stop Phase 4 (first slice): the five concepts http-server already needed

**Scope:** 15 → 20 concepts, and the four http-server `uses` arrays that Phase 3 left stretched or empty are now wired to real pages. This is the first slice of Phase 4, not the whole phase: the floor is 45.

**Five, not four.** The task named four (`sync-mutex`, `race-detector`, `slog`, `graceful-shutdown`). Step 08 teaches the four `http.Server` deadlines and their fallback chain, and none of those four covers it, so pointing step 08 at any of them would have swapped one meaningless link (`structs`) for another. `server-timeouts` was added so the rewiring is honest. It is already on the brief's priority list ("http server internals") and named in the Phase 3 observation listing this exact shopping list.

**`structs` dropped from step 08 rather than kept alongside.** A `uses` entry drives two things: the concept pills and the spaced-reuse callout. `structs` appears in prior T1 projects, so keeping it would have fired a "recall structs" callout on a step about deadlines. `interfaces` was kept on step 03 next to `slog` on the opposite reasoning: the Logger/Handler split is genuinely an interface lesson, where "you set fields on a struct" is true of nearly all Go code and teaches nothing.

**The concept index silently dropped ungrouped concepts, and now cannot.** `/concepts` renders from a hand-written slug list in `app/concepts/page.tsx`, so a concept absent from that list was a page that existed, that steps linked to, and that the index could not reach. Nothing checked it, and all five new concepts would have shipped invisible. The taxonomy moved to `lib/content/concepts/groups.ts` (colour stays in the page, it is presentation) and `validate.ts` now enforces "every concept in exactly one group", plus a duplicate-slug check. The guard was verified to fail when violated rather than assumed: removing `sync-mutex` from its group reds the build. This matters more at 45-60 concepts than at 20.

**Four concept code examples did not compile, three of them already shipped.** Writing `\n` inside a TypeScript template literal produces a real newline, so the Go source ends up with a string literal broken across two lines. `/concepts/sync-waitgroup` was rendering `fmt.Printf("Worker %d done` / `", id)` across two lines, and `maps` and `json-decode` had the same bug; the fourth was mine, in `server-timeouts`. Each also fed a "Run in Playground" button, so the button offered code that cannot compile. The share pipeline never noticed because `go.dev/_/share` stores snippets without compiling them. Fixed by escaping to `\\n`; the shared snippet now round-trips and vets clean. Found only by extracting all 20 `codeExample` fields back out of the TypeScript and running them, which is the lesson Phases 2 and 3 kept learning: reading content does not surface this, running it does immediately. A gofmt sweep of the same extraction also caught a stale comment alignment in `json-decode`.

**Every claim on the five new pages was measured here, not recalled.** The `sync.Mutex` example prints 1000 on every run; the racy counter it is contrasted with printed seventeen different answers between 919 and 994 across twenty runs and never crashed, which is the number quoted on the page. `slog`'s two output lines are its real output, including `JSONHandler` encoding a duration as an integer nanosecond count where `TextHandler` writes `1.5s`. The `server-timeouts` fallback chain was proven by deletion: all four set hangs up at 150ms, deleting `ReadHeaderTimeout` moves it to 1s because `ReadTimeout` takes over, deleting both means it never hangs up at all. Graceful shutdown's four output lines are ordered proof that `Shutdown` waited, and handing it an already-cancelled context was tested rather than asserted: it returns `context canceled` instantly and "Shutdown returned" jumps ahead of "handler finished".

**The race detector page claims less than the folklore does.** Two things were deliberately not written. The docs make no "no false positives" claim and there is an open golang/go issue about potential ones, so the page argues from what is documented: the detector is dynamic, so false *negatives* are the risk, and a clean run is evidence about coverage as much as about code. And the memory model does not make racy programs arbitrarily undefined: word-sized reads must observe some value actually written, with out-of-thin-air values forbidden, while multiword values (maps, slices, strings, interfaces) may be torn, and *that* is what the spec says can lead to arbitrary memory corruption. The distinction is the concept's third retrieval prompt.

**Sources:** go.dev/ref/mem and go.dev/doc/articles/race_detector (report shape, overhead, platform list), plus `go doc` on the local toolchain for `net/http.Server.Shutdown`/`Close`/`ErrServerClosed`/`RegisterOnShutdown` and `log/slog.Level`, whose gap-of-4 rationale is quoted from there.

## 2026-07-16 — One-Stop Phase 4: reference layer, 20 to 48 concepts

**Scope:** the concept library goes from 20 to 48, clearing the brief's floor of 45 with margin (target was 60; see the honest shortfall note). The five concepts on commit 92f8dbf (sync-mutex, race-detector, slog, graceful-shutdown, server-timeouts) took the count to 20 before this session; this pass added 28 more. `server-timeouts.ts` from that commit was used as the quality bar for every new page, and it earned it: a runnable example that demonstrates the failure rather than touring the API, a design rationale that reaches the history behind the behaviour, and five concrete mistakes.

**The 28:** atomic, sync-once, buffered-channels, channel-ownership, memory-model, escape-analysis, pprof, benchmarks, slice-internals, arrays-vs-slices, strings-bytes-runes, struct-tags, io-reader-writer, bufio, http-client, encoding-json, testing, table-driven-tests, fuzzing, tooling, generics, embedding, panic-recover, typed-nil, time, init-lifecycle, sentinel-errors, modules. Grouped into six sections (Fundamentals, Data, Concurrency, Standard library, Testing and tooling; validate.ts enforces every concept sits in exactly one).

**Every code example was run before it shipped, and that discipline paid.** The examples are POSTed to the Go Playground at build, so they must be real standalone programs; each agent wrote its example to a temp module, vetted it, ran it, and pasted the actual output. What running rather than reasoning turned up:
- `time.ts`: the `time.After` leak is gated on the `go.mod` directive, not the toolchain. Verified by building identical source three ways: go1.24.10 toolchain with `go 1.24` in go.mod leaks nothing, the same toolchain with `go 1.22` leaks ~50MB, and `GODEBUG=asynctimerchan=1` brings the leak back on a modern module. The shipped example prints `+39.84 MB` on this repo's go1.22.1, which I re-ran by hand to confirm.
- `struct-tags.ts`: the brief's hint called "space instead of colon" a silent typo. Measured, `go vet` catches it. The genuinely silent failures are a misspelled key and a wrong-case option, so the page teaches those.
- `panic-recover.ts`: the brief said re-panicking loses the stack. Measured, re-raising during unwinding preserves the trace annotated `[recovered]`; you lose the origin only if you recover, unwind fully, and re-panic from a later frame. The page teaches the accurate version.
- `benchmarks.ts`: reconfirmed the two facts from the Phase 3 benchstat finding by running them (benchstat@latest fails on Go 1.22, and `-count=5` prints `± ∞` below its six-sample floor).
- A claim I had carried since a Phase 2/3 verification note, that `go test -run '/atomic'` "silently matches nothing", is FALSE as a statement about Go. It only looked true because Git Bash rewrites a leading-slash argument into a Windows path before the go command sees it (`C:/Program Files/Git/atomic`). The testing agent proved this three ways and did not ship it. It never reached shipped content; recording it here so nobody reintroduces it.

**Two rendering bugs found and fixed, both pre-existing:**
- `app/concepts/[slug]/page.tsx` rendered `mentalModel` as plain-text JSX while its sibling fields (summary, designRationale, codeExplanation) use `dangerouslySetInnerHTML`. So any `<code>` in a mental model rendered as literal visible `<code>` text, across roughly 16 files including the five from 92f8dbf. Fixed at the renderer, which formats all of them at once, rather than by stripping HTML from every file. The content is build-time authored, not user input, so it matches the established pattern in that same file.
- `app/concepts/page.tsx` held a per-group colour map keyed by group label, with only the original three labels. Adding the Data and Testing-and-tooling groups made `groupStyles[label]` undefined and `.color` crashed the static export of `/concepts`. Fixed by giving the five groups the three-colour palette with no adjacent repeats, AND adding a fallback so a future group in groups.ts renders in a default colour instead of breaking the build. The crash was the real lesson: a data file and a presentation map that must stay in sync, with nothing enforcing it.

**Project `uses` wiring:** Phase 3 left 23 project steps with empty `uses` arrays because the concepts they needed did not exist. 17 are now wired to real concept pages (log-parser step 01, the rule-2 anchor, finally links `testing` and `table-driven-tests`; observability's profiling steps link `pprof` and `escape-analysis`; the benchmark steps link `benchmarks`; and so on). Six are left empty on purpose: reflection steps ("run the self-check, then read the reference"), `fmt` number formatting, static linking, and SQL injection have no concept page, and a forced-but-wrong link is worse than an honest empty array. SQL injection in particular is Phase 5 scar-tissue material, not a reference concept.

**Homepage stats corrected to the truth (the audit rule):** "9 Projects" is now 11 and "15 Go concepts" is now 48. Both numbers were already real, which is the only condition under which that stat changes.

**Honest shortfall:** the brief's target was 60 concepts with 45 as the floor. This pass hit 48. The remaining priority-list items (iterators/range-over-func, build tags, GC knobs at awareness level, rate limiting, database/sql and pgx patterns, prepared statements, secrets/config, method sets and receivers, closures and captured variables, nil deeper, errors.Join as its own page) are real and mostly have a natural home, but 48 clears the floor and every page is at the bar rather than padded to a number. Reaching 60 is more concept-writing at this quality, which is the same call the T3 depth-pass shortfall came down to: content, not inflation. Logged in ROADMAP.

**Process note (third session interruption):** the concept fan-out was seven agents writing four files each. A Claude Code process restart orphaned six of them mid-run; 17 files were already on disk and well-formed, and the six agents were resumed from their saved transcripts pointed at exactly the files still missing, so no work was redone and no context (the bar file, the type, the neighbours they had read) was lost. Verifying against disk rather than against "completed" notifications is now the standing habit for this project.

**Alternatives considered:** adding two new theme accent colours for the two new concept groups (rejected: the brief forbids visual redesign, and the three-colour palette cycles cleanly across five groups); stripping HTML from every `mentalModel` instead of fixing the renderer (rejected: 16 files touched to work around one wrong line); forcing a concept link onto all 23 empty steps (rejected: a wrong link teaches a false relationship).

**Logged by:** Claude Code (engineer + content, One-Stop brief)

---

## 2026-07-15 — One-Stop Phase 3 (part 2): T2/T3 depth pass, and what running the claims found

**Scope:** depth pass on the remaining six projects (http-server, worker-pool, tcp-echo, grpc-service, db-api, observability). All 11 projects now carry the full step anatomy across all 93 steps. Totals: **T1 30-38h (target 30-40, hit), T2 40-46h (target 40-50, hit), T3 54-62h (target 60-80, MISSED, see below).**

**The `-race` headline command was broken on Windows and is now fixed.** `http-server`, `tcp-echo` and `worker-pool` each had `lab.command: "go test -race ./..."`, which the project page renders as *the* command to run. On a stock Windows toolchain it fails before a single test: `go: -race requires cgo; enable cgo by setting CGO_ENABLED=1`. The LabCard is the front door, and a front door that fails for a large share of developers is broken. All three are now `go test ./...`. `-race` is not dropped: it stays taught inside the steps (7 mentions in tcp-echo alone), in every lab README with the exact cgo error quoted, and in the assessments, which are still the standard the learner is held to. This also makes all 11 commands consistent; `config-watcher`, `db-api` and `grpc-service` already used the plain form.

**`benchstat@latest` has been a broken instruction, in two places.** `go install golang.org/x/perf/cmd/benchstat@latest` fails on Go 1.22: x/perf bumped its requirement to Go 1.25 in Feb 2026 and the module refuses to build. Verified directly. Both `observability` and `config-watcher` told learners to run it. Now pinned to `@400946f43c82` (verified: installs and runs) in both. The same hint also paired it with `-count=5`, which benchstat cannot use: it needs at least 6 samples for a confidence interval and prints `± ∞` below that, so the promised "mean ± variance" never appeared. Verified by running it. Now `-count=10`. Note `config-watcher`'s lab README keeps `-count=5` deliberately: that one feeds raw `go test` output for reading by eye, where five samples is fine.

**The brief itself prescribed an exercise that cannot work.** Phase 3 names "input validation and SQL injection (db-api)", and the obvious demo is concatenating a `'; DROP TABLE` payload and watching it land. Against pgx it does not: pgx v5 defaults to `QueryExecModeCacheStatement` (extended protocol) and Postgres refuses more than one statement in a Parse message, so the payload errors instead. Following the brief literally would have shipped a demo that does not reproduce, which is precisely what the brief's own bar ("every claim about behavior must be runnable") exists to prevent. The shipped version is better teaching anyway: four outcomes, three of them surprises, including `O'Brien` breaking the same concatenated query with no attacker involved, and `windows\path\` surviving only because `standard_conforming_strings` has defaulted on since Postgres 9.1.

**Dependency promotion (grpc-service):** `google.golang.org/genproto/googleapis/rpc` moves indirect to direct so `CreateUser` can attach a standard `google.rpc.BadRequest` error detail. **Same pinned version, no bump, `go.sum` unchanged**, grpc and protobuf untouched. Rejected alternative: hand-rolling a detail proto, which teaches a private convention instead of the standard every gRPC client already understands.

**Rule 3 stays pinned, and both agents were told to recommend rather than implement.** Neither invented a gate. Two concrete proposals now exist for the owner to accept or reject:

- **grpc-service:** codegen'd message allocation count via `testing.AllocsPerRun` over `proto.Marshal`/`Unmarshal`, gated relatively in-process. Deterministic, no cgo, no timing, machine-independent, and it teaches something true (generated messages are allocation-heavy). Explicitly rejected p99-over-bufconn: bufconn measures a pipe, not a network, so the number is architecture noise.
- **db-api:** a query-count budget via a `pgx.QueryTracer`, failing when `GET /tasks?limit=50` issues more than one query. Makes N+1 machine-checkable and relative, and needs no benchmark harness. Rejected connection-pool saturation as asserting config rather than a code property.

`ship-it`, built this phase, shows what a rule-3-compliant T3 looks like: zero dropped requests across a rolling shutdown, a count rather than a timing, proven to bite three ways.

**worker-pool keeps two pools rather than one generic one.** The brief says "worker-pool gets a generic-worker step". Rewriting the graded pool to `Pool[In,Out]` would have destroyed working assets (notably the 100-round `TestSubmitStopRace`) to prove a point about types. Instead `GenericPool` ships alongside the concrete one, both graded, so the comparison is the lesson. This follows the codebase's own precedent: `config-watcher` builds `Store` and `MutexStore` and gates on the relationship. Measured payoff, not asserted: boxed 1 alloc/op and 15 B/op against generic 0 and 0.

**T3 misses its target honestly: 54-62h against 60-80.** Every estimate is bottom-up and justified per project, and the whole point of the estimatedTime decision was that the number must be earned by content. Inflating the figures to reach 60 would reintroduce exactly the dishonesty that decision removed. Closing the gap means more T3 material, not bigger numbers. The projects sit at 9 steps against the brief's 6-10 ceiling, so there is roughly one step of headroom each; the honest options are to spend it where real material exists, or to accept that T3 is a ~10% smaller tier than the brief guessed. Flagged, not papered over. Site total is now 124-146h against the brief's 150-250 ambition, before Phases 5 (failure labs), 6 (idioms), 7 (source reading) and 8 (capstone) add theirs.

**What the depth pass actually bought, which is worth naming.** The agents were required to run every claim rather than restate it, and that turned up shipped content that was confidently wrong rather than merely thin: `parser_test.go` (the file rule 2 calls the lesson) taught a `time.Parse` gotcha that stopped being true in Go 1.20; `config-watcher` claimed a serial benchmark shows atomic and mutex as similar when they are 12x apart; `worker-pool` step 02 taught context cancellation against an API with no context parameter; a fully synchronous echo server passed `TestConcurrent`; the http-server middleware suite passed a wrapper logging `status=0` for every success. None of those are visible by reading. All of them are obvious the moment someone runs the thing.

**Alternatives considered:** keeping `-race` as the headline and telling Windows users to install gcc (punishes the majority to keep a purity that the steps already teach); inflating T3 estimates to hit 60h (reintroduces the exact dishonesty the estimatedTime decision removed); rewriting worker-pool's graded suite to be generic (destroys working assets to make a typing point).

**Logged by:** Claude Code (engineer + content, One-Stop brief)

---

## 2026-07-15 — One-Stop Phase 3: step anatomy, and the pins carried into it

**Owner instruction (2026-07-15):** put a pin in the Phase 2 blockers and keep moving; make reasonable assumptions and log everything for review when the product is complete. This entry is that log. Nothing below was approved by Aboturab; it is all assumption, recorded so it can be reversed cheaply.

**Pinned, NOT resolved (carried forward, still owed):**
1. **`-race` has never run.** Windows without cgo cannot start the detector. Five suites (tcp-echo, http-server, worker-pool, db-api, grpc-service) teach `-race` as the primary command and are race-clean by construction only. **Assumption made:** they are correct. First CI run must be `RACE=1 ./labs/check.sh`. If that is red, Phase 2's claims are wrong and Phase 3 content built on them inherits the error.
2. **Rule 3 vs the contract-style T3 labs.** `grpc-service` and `db-api` are T3 with no benchmark gate; their assessment blocks predate the brief and state no metric. **Assumption made: leave them alone.** Phase 2 refused to invent a metric and Phase 3 continues that refusal, because rule 3 is protected and inventing a gate is a curriculum decision, not an engineering one. If the answer is "they are exempt, they are contract labs", that needs one line here. If the answer is "give them metrics", that is a content task and the labs need new gates.
3. **`.claude/agents/*.md` deletions** remain uncommitted, along with the `.claude/` tracking question. Untouched. `.claude/launch.json` was created this session (a dev-server config for the preview tooling) and deliberately left untracked rather than half-resolving the question in one direction.

**Step anatomy, encoded rather than documented.** The brief specifies a fixed six-part step: motivation, concept, build, verify, break it, recap. Three of those had no representation in the types, which meant the anatomy could only ever be a convention that drifts. Added: a `verify` block (command + where + expect + optional labPath), a `breakIt` block (change + observe + why, with `why` behind a reveal so the learner commits to a guess before reading the mechanism), and `Step.retrievalPrompt` in the existing flip-card "question || answer" form. Recap is a step field rather than a block specifically so it always renders last; as a block it could drift into the middle of a step and the anatomy would rot quietly.

**The tier spine is now mechanical.** The brief calls `pattern` (T1) -> `requirement` (T2) -> `constraint` (T3) the pedagogical spine and says to extend it and never flatten it. validate.ts now fails the build if a project reaches for another tier's build block. All existing content already passed, which is the good outcome: the check documents an invariant that already held rather than forcing a migration. Also enforced: `verify.labPath` resolves on disk, `verify.command` is non-empty, and `retrievalPrompt` really is "question || answer" (a prompt with no answer renders a card that reveals nothing).

**estimatedTime, decided once (resolves the standing backlog item).** Keep the wall-clock range; label it "to build" at the render site. The backlog complaint was that "2–3 hours" reads to a competent dev as fluff or distrust, and it was right: the number was describing content you could type in twenty minutes. The fix is not to drop the number but to make it honest about what it covers, which is building plus verifying plus deliberately breaking. cli-renamer moves 2–3h -> 5–7h on content that genuinely takes that long. T1 targets 30–40h across its four projects.

**cli-renamer rebuilt first, as the reference.** It went 3 steps -> 7 with the full anatomy, and it went first because the backlog flags it as the highest-bounce-risk page on the site: the median target reader could write the renamer in twenty minutes and needs telling, in the opening paragraph, that the four-layer shape is the lesson. That framing block now exists, closing a second backlog item. Its verify blocks stay honest mid-build by exploiting that the self-check prints per-scenario results, so step 01 can say "the three refusal scenarios match now, the other four will not until you write the transform". Every subsequent project follows this file.

**Known limitation, logged:** the in-app browser could not load the dev server (it forces https on a plain-http localhost), so the three new UI blocks were verified against the served HTML and the RSC payload rather than visually. The components reuse the exact class patterns of the existing blocks, so the risk is low, but nobody has looked at them with human eyes.

**Alternatives considered:** prose-only motivation/verify/break-it via existing `text`/`callout` blocks (zero type churn, but the anatomy becomes unenforceable and rots); `breakIt` as a full Phase 5 style reveal component (Phase 5 builds its own thing for failure labs, this is the small in-step version); dropping wall-clock time entirely (loses the honest planning signal the "~6 weeks of evenings" promise depends on).

**Logged by:** Claude Code (engineer + content, One-Stop brief)

---

## 2026-07-15 — One-Stop Phase 2: the executable spine (labs/)

**Decision:** Every project now ships a self-contained Go module at `labs/<slug>`, linked from its project page by a new `ProjectLab` field and from each assessment block by `labPath`. Learner code and the reference live in the same package separated by build tags: your files are `//go:build !solution`, the reference is `//go:build solution`, suites are untagged and black-box, and performance gates are `//go:build gate` with `TestGate*` names. So `go test ./...` always grades the learner; `-tags solution` is how CI proves the suite is passable. `labs/check.sh` loops all ten modules (gofmt, build, vet, solution build/vet/test, self-checks, benchmarks, gates) and must be green before any commit touching `labs/`.

**Tier discipline, mechanically enforced:** rule 1 holds literally: `cli-renamer` and `json-fetcher` contain zero `_test.go` files. They ship a `check/` program that builds the learner binary, runs it against fixtures, and prints what your program did next to what was expected. It exits 1 so scripts can rely on it, but never uses the word test, pass, or fail. Rule 2 holds: the first graded suite on the site is `log-parser`, and it is table-driven and comment-dense on purpose, because the learner meets table-driven tests by reading the suite that grades them. Rule 3: `config-watcher`, `worker-pool`, and `observability` gates are relative, in-process comparisons via `testing.Benchmark` (atomic vs mutex, optimized vs the shipped baseline), so they hold on any hardware instead of encoding one laptop's ns/op.

**Adversarial verification found what self-reporting missed.** Every lab was built green and self-reported green; a second pass then tried to break each one by swapping a plausible-wrong implementation into the learner file. Three graded suites passed implementations that were wrong: `http-server` never composed more than one middleware, so a backwards `Chain` graded correct; `tcp-echo` had every test client close its connection before `Shutdown`, so a server with no WaitGroup passed all four tests and goleak; `grpc-service` never sent a wrong token, so a presence-only auth interceptor passed. Also: `observability`'s own gate command filtered out its correctness tests, green-lighting a fast-but-wrong rewrite, and `db-api`'s `List` SQL was never executed against Postgres. All are fixed, and each fix was proven by re-running the named wrong implementation against the new assertion. The lesson worth keeping: a suite written alongside its reference is not evidence, because both can be wrong in the same direction. Only a deliberate wrong implementation is.

**Truthfulness corrections:** `observability`'s `metricsAchievable` promised roughly 70 percent ns/op and 85 percent alloc reduction; the real fix measures about 99 percent and 1001 to 1 allocs, because an O(n^2) to O(n) rewrite cannot land near 70 at n=1000. The stated numbers are now the measured ones; the gate thresholds (40/50 percent) stay as the machine check with room for slow machines. `worker-pool`'s "Submit p99 latency < 5 µs" was unverifiable (the harness emits no percentile) and is now mean ns/op. `config-watcher`'s "10–40 ns/op" mutex band excluded mainstream Intel mobile (measured 45–48), so it was widened. `log-parser`'s architecture block named files the lab does not ship. `cli-renamer`'s skip-if-unchanged guard is provably dead code while `--pattern` is required (`transformName` always returns a strictly longer name), so rather than fake a scenario for it, the step now explains why you write the guard anyway.

**Dependencies (4, all pinned for Go 1.22):** `go.uber.org/goleak v1.3.0` (tcp-echo, required by the existing assessment), `google.golang.org/grpc v1.65.1` + `google.golang.org/protobuf v1.34.2` (grpc-service; generated `userspb` is committed so learners never need buf or protoc), `github.com/jackc/pgx/v5 v5.6.0` (db-api). **Rejected: testcontainers-go**, which the db-api assessment hinted at: it drags in Docker as a hard prerequisite and a large dependency tree for one lifecycle test, against the brief's "labs require no service and no infrastructure". Instead `db-api` grades handlers against a hand-rolled mock repo always, and runs the real-Postgres lifecycle only when `TEST_DATABASE_URL` is set, skipping with a copy-pasteable `docker run` line otherwise.

**Also:** added `labs/.gitattributes` (`* text=auto eol=lf`) covering every file under `labs/`. Windows defaults to `core.autocrlf=true` and `gofmt -l` flags CRLF files, so without it a fresh Windows clone would find all ten modules red on the first check before writing a line. Verified two ways: gofmt does flag a CRLF file, and the attribute resolves to `eol: lf` for .go, .sh, .proto, and the byte-compared testdata fixtures. Scoped to `labs/` because no .go or .sh files exist elsewhere in the repo.

**Alternatives considered:** separate `solution/` module per lab (duplicates go.mod and lets the reference drift from the suite); tests in an external `_test` package everywhere (blocked for `config-watcher`, whose steps teach an unexported store, so it stays in-package); absolute ns/op gates (encode one machine); a hosted grader service (explicitly out of scope).

**Verification:** `labs/check.sh` green across 10 modules; `npm run build` green, 52 pages; `validate.ts` extended to enforce that every project has a lab whose path matches its slug and ships `go.mod` + `README.md`, that every assessment carries a `labPath` resolving on disk, and that no orphaned lab directory exists.

**Known gaps, logged not hidden:** `-race` was never run: this machine is Windows without cgo, so the detector cannot start. The concurrent suites are race-clean by construction and their READMEs still teach `-race`, but `RACE=1 ./check.sh` is owed on Linux or CI. Everything was verified on the installed go1.22.1 rather than the latest stable the brief asks for; the modules declare `go 1.22` and deps were pinned to match, so a newer toolchain should run them, but that is unverified. `tcp-echo`'s 30-second idle deadline stays untested (a fast test needs a seam that would leak test infrastructure into the taught API; the README discloses it).

**Logged by:** Claude Code (engineer, One-Stop brief)

---

## 2026-07-11 — One-Stop Phase 1: Tier 0 syntax track at /basics

**Decision:** Shipped the in-house syntax on-ramp as a new page family: `lib/content/tier0/<slug>.ts` (14 lessons) rendered at `/basics` and `/basics/[slug]`, with a `Tier0Lesson` type (intro blocks → one program → after blocks → retrieval prompts) added to `lib/content.ts` and a `lib/tier0.ts` module matching the projects/concepts pattern. Routing went to a new `/basics` family rather than extending orientation: orientation's validation enforces a contiguous 6-page order, its pages carry no program anatomy, and `learn-syntax` has to point *at* the track, which is circular if the track lives inside orientation. Lesson order puts pointers before structs/methods so pointer receivers have footing and the known T1 P1 `flag.String` friction is pre-empted (the pointers lesson closes with exactly that callout).

**Coverage call:** interfaces are deliberately absent from Tier 0, matching the brief's coverage list. The learn-syntax checklist item and the ready-check retrieval prompt that previously demanded interfaces (material the site never taught in-house) were replaced with pointer-parameter and nil-map prompts, which Tier 0 does teach. Tier 1 introduces interfaces in context via the existing concept page. Rule 2 discipline held: zero testing content anywhere in Tier 0.

**Verification:** every lesson program was extracted and machine-checked locally: gofmt-clean, vet-clean, compiles and runs on go1.22.1, and the prose's output claims match actual output (this caught two programs where a TS `\n` escape produced a real newline inside a Go string literal, and one wrong claimed output). validate.ts now mechanically enforces the brief's caps: ≤30 non-empty program lines, ≤20 estimated minutes, 2–3 retrieval prompts, unique slugs, contiguous order, and `/basics/`+`/concepts/`+`/orientation/` link integrity across all three content families.

**Review pass:** a content-agent review (single pass, per session instruction) returned 13 findings including 2 blockers, all fixed: a retrieval answer asserting a nonexistent compiler requirement (`string(rune(65))`), lesson 1's `go build` failing outside a module directory, a false "no way to dump names into your namespace" claim (dot imports exist), a break-it step producing two errors where prose promised one, stale compiler error text, and an unexplained "goroutine" in lesson 1's self-check. One finding fixed outside Phase 1 scope as a small accuracy ride-along: the maps concept summary's "passes a reference" phrasing (now "copies a small header pointing at shared data", also fixing keys-vs-values comparability). Remaining improvement (break-it steps for 8 more lessons) logged as an open observation.

**Alternatives considered:** extending orientation with 14 more pages (breaks its order validation and its "airlock" framing); a generic `blocks`-only lesson shape (loses the enforced program anatomy and the guaranteed playground link); teaching interfaces in Tier 0 anyway (contradicts the brief's list and delays first contact with real building).

**Logged by:** Claude Code (engineer + content, One-Stop brief)

---

## 2026-07-11 — One-Stop brief Phase 0: content monolith split

**Decision:** Executed Phase 0 of BRIEF-ONE-STOP.md on `feat/one-stop-p0`. Each of the 10 projects now lives in `lib/content/projects/<slug>.ts` and each of the 15 concepts in `lib/content/concepts/<slug>.ts`, assembled by per-directory `index.ts` files that preserve the original tier banner comments and ordering. `lib/projects.ts` and `lib/concepts.ts` are now shims re-exporting the same public API (`projects`, `getProject`, `getProjectsByTier`, `concepts`, `Concept`, `getConcept`), so no page, script, or import elsewhere changed. The `Concept` type moved into `lib/content.ts` (the shared types module) so per-slug files can import it without a cycle; `lib/concepts.ts` re-exports it for compatibility. Zero prose edits.

**Verification:** JSON-serialized `projects` + `concepts` (plus lookup-function spot checks) before and after the split and diffed the dumps: byte-identical. This matters because a naive line de-indent corrupts template literals — the first splitter pass did exactly that to concept `codeExample` fields (Go code indented with tabs inside backtick strings), which the diff caught; the final splitter tracks template-literal state and leaves those lines untouched. `npm run build` green (validate, playground cache, 31 static pages).

**Also found:** the project had no local `node_modules` — Next.js and plugins were resolving from a stray `C:\Users\aboturab\node_modules` install, which broke the production build on CSS plugin resolution. Ran `npm install` in the project; build works normally now. Pre-existing issue, unrelated to the split.

**Not touched:** the pending working-tree deletions of `.claude/agents/*.md` and the untracked `BRIEF-ONE-STOP.md` are left as-is — whether to commit them is Aboturab's call (raised in the approved execution plan; also related to the standing "team-setup files not in git" observation).

**Alternatives considered:** codegen re-emitting objects via JSON (destroys formatting and template literals — diff would be unreviewable); per-tier files instead of per-slug (still merge-prone once Phase 3 grows each project 2–3x); moving `getProject`/`getProjectsByTier` into the index (kept them in the shim so the diff stays a pure move).

**Logged by:** Claude Code (engineer, One-Stop brief)

---

## 2026-05-13 — Open-observations triage + small data-truth fix (pointers concept)

**Decision:** Curated the Open observations section down from six items to one (the still-pending Aboturab call on whether team-setup files get committed to git). Two observations resolved by being folded into Up next (homepage truth-audit finish; Coming-from-X urgency), two promoted to backlog (engineering: first-time concept link affordance; content: T1 P2 curl preamble), one resolved with a small data fix this session (added `pointers` to T1 P1 step 01's `uses` array so the dependency is now truthful in `lib/projects.ts`). Re-ranked Up next: homepage truth-audit finish is #1 (smallest, highest-credibility), Coming-from-X promoted to #2 (load-bearing per persona walkthrough), inline code runner moved to #3 with explicit cross-agent loop framing (engineer feasibility report → PM decision → content UX sign-off → build).

**Why:** The observations list had grown to six items in two sessions, several of which were already represented elsewhere (e.g. `fromOtherLang` was both an observation and Up next #4). Letting it grow is exactly the drift the PM standing brief is supposed to catch. Triage now is cheaper than triage later. The `pointers` data fix was a one-line change that makes the concept dependency honest in the data layer, regardless of what UI we eventually build to surface it; doing it now means whichever first-time-link UI we ship will already work without a follow-up data pass.

**Why this session, not more:** Three candidate threads were on the table — finish the homepage truth-audit (content session), build the first-time concept link UI (engineer + content design loop, multi-session), kick off inline code runner research (engineer, multi-session). All three were too big for a PM session that already had a sweeping em-dash diff to review and commit. Triaging the backlog is the orchestrator's actual job; doing it well now means the next engineer/content session opens to a clean queue. A polished `git log` beats a busy one.

**Alternatives considered:** Have content do the full homepage line-by-line pass this session (would have been a second sweeping diff stacked on top of the em-dash one, hard to review); kick off inline-runner research now (no time to set up the cross-agent loop properly, would result in a rushed brief); ship the first-time concept link UI directly (skips the design conversation the observation explicitly called for); leave observations untriaged (drift accelerates).

**Logged by:** Claude Code (PM)

---

## 2026-05-13 — Em-dash sweep across all prose

**Decision:** Replaced 266 of 267 em-dashes in user-facing prose across `lib/projects.ts`, `lib/concepts.ts`, `lib/orientation.ts`, and `app/page.tsx` with commas, colons, or sentence breaks depending on local rhythm. One em-dash was kept intentionally: the `↻ You used this concept in {project}. Before reading on — how well do you remember applying it?` line in `components/SpacedReuseCallout.tsx`, which is component UI copy (not authored prose) and where the dash carries an interactive-prompt beat the comma can't reproduce. Two unrelated whitespace-only diffs in `RetrievalPrompts.tsx` and `SpacedReuseCallout.tsx` came along for the ride (Prettier re-wrapped during the content sweep) and were committed alongside.

**Why:** Voice consistency across the curriculum. Em-dashes were being used as a default joiner everywhere — declarative explanations, list items, callouts, taglines. Reading a project end-to-end made the punctuation tic visible. Commas and colons read calmer and let actual emphasis land when an em-dash *is* used (the one in SpacedReuseCallout now reads as a deliberate pause rather than house style).

**Alternatives considered:** Leave em-dashes everywhere (status-quo voice tic); replace only egregious cases (subjective, hard to enforce); ban em-dashes entirely including UI copy (overcorrects — the SpacedReuseCallout line genuinely needs the beat).

**Logged by:** Claude Code (content + PM)

---

## 2026-05-13 — Homepage truth-audit: fix overclaims before shipping new features

**Decision:** Set current focus to "homepage truthfulness." Fixed two concrete overclaims today: stats card claimed "40+ Go concepts" (actual: 15) and the "Why GoPath" grid promised "Coming from X sidebars" as if shipped (the feature is still on Up Next). Replaced the false promise with a truthful card ("Concepts explain the why") that surfaces the real `designRationale` feature already in `lib/concepts.ts`. The "Coming from X" feature remains on Up Next #4 — when it ships, the original card can come back.

**Why:** First strategic-health pass per the PM standing brief ("compare the homepage's stated value prop to what the site actually delivers"). A visitor who notices an overclaim discounts every other claim. Credibility is cheaper to protect than to rebuild. Both fixes were a few-line content edit — no point queueing them.

**Alternatives considered:** Leave both and prioritize building Coming-from-X immediately (multi-session work, leaves the false claim live in the meantime); remove the card entirely (breaks the 2×2 grid layout); fix only the stat (leaves the bigger credibility issue).

**Logged by:** Claude Code (PM)

---

## 2026-05-13 — Switch from sprint-based to continuous-improvement mode

**Decision:** Each agent now operates with a **standing brief** in addition to assigned tasks. When no task is assigned, the agent runs the brief — engineer does routine quality work, content runs persona walkthroughs and audience audits, PM monitors project health and ecosystem signals. The team works as a real product team would: continuous, self-driven, no waiting for tickets.

**Why:** Sprint-based work is bounded by what's been ticketed, which means the project only improves at the rate someone files tickets. Aboturab wants the team to think — see the site as a user, find friction, propose improvements, and ship them. The goal isn't "complete the backlog," it's "keep making this better until it's as good as it can be."

**Alternatives considered:** Keep pure sprint model; have each agent invent its own loop without explicit briefs; only PM has the standing brief.

**Logged by:** Aboturab + Claude Code

---

## 2026-05-13 — Expand agent autonomy

**Decision:** Default mode for all three agents is "act, don't ask." Approval is required only for: spending money, public-facing communications under Aboturab's name, push-to-main / production deploys, changes to the five pedagogy rules, dropping or renaming an anchor project (Config Watcher T1, TCP Echo T2), pricing, and irreversible operations. Everything else — code, content, dependency additions, prioritization, web research, A/B variations — is the agents' call.

**Why:** The first cut of this experiment was over-cautious. Aboturab wants to see how far autonomous development can go and is willing to course-correct in the weekly review rather than be paged. A tightly-gated approval workflow defeats the experiment.

**Alternatives considered:** Keep the previous ask-list; widen incrementally over weeks; let each agent set its own thresholds.

**Logged by:** Aboturab + Claude Code

---

## 2026-05-13 — Cross-agent collaboration pattern

**Decision:** Any non-trivial decision follows the loop in CLAUDE.md — PM names the decision, asks engineer for feasibility, asks content for pedagogy/audience impact, weighs, decides, logs. Small single-domain decisions skip the loop.

**Why:** Solo decisions in unfamiliar domains are the most common drift vector. The loop is cheap (one round-trip), the cost of a bad call is high.

**Alternatives considered:** Each agent decides independently; everything goes through Aboturab; PM has unilateral authority.

**Logged by:** Aboturab + Claude Code

---

## 2026-05-13 — Run GoPath as a Claude Code experiment with three sub-agents

**Decision:** Claude Code, with three specialized sub-agents (engineer, pm, content), owns active development of GoPath. Aboturab reviews weekly and gates only the items in the autonomy policy.

**Why:** Test how far autonomous agentic development can go on a real project with clear pedagogy constraints. GoPath has a clean codebase, hard pedagogy constraints that limit drift, and room for visible weekly progress.

**Alternatives considered:** Single Claude Code session without role separation; continuing manual development; building a custom orchestrator on top of the Anthropic API.

**Logged by:** Aboturab

---

## 2026-05-13 — Pedagogy rules treated as non-negotiable

**Decision:** The five pedagogy rules in `CLAUDE.md` cannot be changed without a new entry in this file approved by Aboturab.

**Why:** These were hard-won pedagogical decisions. Without explicit protection, future Claude sessions will reason their way into "improvements" that quietly violate them. The constraint is more valuable than the cleverness.

**Alternatives considered:** Document them as guidelines instead of rules; let agents propose changes inline.

**Logged by:** Aboturab
