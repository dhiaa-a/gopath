# GoPath Roadmap

_Last updated: 2026-07-15 (One-Stop brief Phase 3 in progress: T1 depth pass + ship-it done)_

> One sentence per sprint: what's the biggest thing that needs to be true by end of week?

---

## Current focus

**BRIEF-ONE-STOP.md is the mandate.** GoPath becomes the only Go resource a learner needs: Tier 0 syntax in-house, executable labs, 6–10-step projects, 45–60 concepts, failure labs, idiom track, source reading, capstone. Eight sequential phases; execution plan approved by Aboturab 2026-07-11. While the brief is active, everything in "Up next" below is **frozen** (search, inline runner, progress tracking, Coming-from-X, pricing) — do not pick from it.

## In progress

- [x] **Phase 0 — split the content monolith** (`feat/one-stop-p0`) — done; see Done recently.
- [x] **Phase 1 — Tier 0: syntax taught in-house** (`feat/one-stop-p1`) — done; see Done recently.
- [x] **Phase 2 — the executable spine (`labs/`)** (`feat/one-stop-p2`) — done; see Done recently. Reference-solution layout decided (build tags, logged in DECISIONS); `.gitattributes` added. Toolchain NOT upgraded: see open observation below.
- [~] **Phase 3 — depth pass on the projects** (`feat/one-stop-p2`) — **T1 done, ship-it done, T2/T3 outstanding.** Step anatomy encoded (`verify` + `breakIt` blocks, `Step.retrievalPrompt`); tier spine now enforced by validate.ts; `estimatedTime` decided (keep wall-clock, label "to build") and applied to T1. Tier totals now: **T1 30-38h (target 30-40, hit)**, T2 11-14h (target 40-50, untouched), T3 23-31h (target 60-80, only ship-it grown). Remaining: depth pass on http-server, worker-pool, tcp-echo, grpc-service, db-api, observability. CLAUDE.md still says "9 real programs" and the count is now **11**: fix when T2/T3 land.

## Open observations

_Anyone can drop a one-liner here. The PM curates it — converts to tasks, parks, or resolves. This is how the agents talk between sessions._

- **Stray `labs/index.html`: a scraped copy of go.dev's homepage** — _needs Aboturab's ok to delete_: 64KB of go.dev's front page including Google Tag Manager scripts and a `canonical` pointing at https://go.dev/, sitting untracked in `labs/`. Not created by any deliberate step; almost certainly an agent running curl/wget from the wrong directory. Never committed and inert where it sits (`labs/` is not served by Next.js), but a wholesale `git add labs/` would sweep it in, which is exactly what Phase 2 did. Left in place because nobody here created it. Recommend deleting.
- **No `testing` or `table-driven-tests` concept page exists** — _content, Phase 4_: log-parser step 01 is the site's rule-2 anchor (the learner meets table-driven tests by reading the suite that grades them) and it cannot link a concept page, so its `uses` array is empty. Phase 4's concept list already includes `testing` and `table-driven tests`; anchor them here when they land. Raised Phase 3.
- **log-parser's worker pool overlaps `worker-pool` (T2)** — _needs a PM/content call_: T1 P3 now ships a real `pipeline` package with a fan-out pool, and T2 P2 is a whole project about pools. Probably fine (T1 is first contact; T2 adds backpressure, `Stop` semantics, throughput gates) but it is a curriculum judgment nobody has explicitly made. Confirm rather than inherit. Raised Phase 3.
- **`Project.constraints` rendered nothing for the first 10 projects** — _observation, no action needed_: the field and its "Constraints" section were wired in `page.tsx` since before this brief and no project ever populated it. `ship-it` is the first to use it. Worth knowing that other `Project` fields may be similarly dead; a sweep for unused optional fields would be cheap.
- **json-fetcher's self-check now costs ~10-13s per run** — _deliberate, flagging the trade_: proving a client timeout exists requires a server that never answers, so the check waits for the learner's own timeout to fire. It is the only place in T1 where a learner watches a program hang because a deadline was missing, which the brief's "claims must be runnable" bar demands. Someone could reasonably weigh the UX cost differently.
- **The in-app browser cannot load the local dev server** — _tooling, low priority_: it forces https on a plain-http localhost and hangs. Phase 3's three new UI blocks (`verify`, `breakIt`, `StepRecap`) were verified against served HTML and the RSC payload, not visually. Nobody has looked at them with human eyes. A stale dev server also holds the `.next/dev` lock, which blocks a second `next dev`.
- **`-race` never actually run on the lab suites** — _engineer, needs a Linux/macOS box or CI_: the race detector needs cgo and this Windows machine has no gcc, so `RACE=1 ./labs/check.sh` has never executed. The concurrent suites (tcp-echo, http-server, worker-pool, db-api, grpc-service) are race-clean by construction and their READMEs teach `-race` as the primary command, but that claim is unverified. First CI run should be `RACE=1`. Raised Phase 2.
- **Labs verified on go1.22.1, not latest stable** — _engineer_: the brief asks for latest stable Go; the installed toolchain is 1.22.1, so every lab was built and tested against it with `GOTOOLCHAIN=local`, and the four lab deps (grpc v1.65.1, protobuf v1.34.2, pgx v5.6.0, goleak v1.3.0) were pinned to versions that support 1.22. Modules declare `go 1.22` so a newer toolchain should run them unchanged, but nobody has proven it. Upgrade the toolchain, unpin where newer majors are worth it, re-run check.sh. Raised Phase 2 (was a Phase 2 pre-req in the plan, deliberately deferred to avoid a toolchain change mid-build).
- **Rule 3 vs the two contract-style T3 labs** — _needs Aboturab_: pedagogy rule 3 says "T3 is hard-gated by benchmarks. Every T3 project has a measurable success metric." `grpc-service` and `db-api` are T3 but their assessment blocks (which predate the One-Stop brief) state no metric, so Phase 2 had no stated gate to enforce and deliberately did not invent one: their labs grade contract correctness instead. Either they need an approved rule-3 exemption for contract labs, or Phase 3 should give each a real stated metric (e.g. p99 latency under load for grpc-service, query budget or connection-pool behaviour for db-api). Flagged rather than papered over. Raised Phase 2.
- **Self-checks cannot see resource cleanup (T1 P1/P2)** — _content/engineer, low priority_: black-box self-checks grade observable output, so `json-fetcher`'s required `http.Client{Timeout}` and `defer resp.Body.Close()`, and `cli-renamer`'s boundary `IsDir` validation, pass whether or not the learner writes them (proven: `os.ReadDir` fails on a file anyway, so the refuse-the-input contract holds either way). Disclosed in the lab READMEs rather than faked. These get exercised for real in the Tier 2 labs; no action needed unless Phase 3 wants a seam.
- **Team-setup files not in git** — _awaiting Aboturab_: `CLAUDE.md`, `ROADMAP.md`, `DECISIONS.md`, and `.claude/` are still untracked on `main`. The working memory only exists on local disk. One-time decision needed on what to track vs. keep local (e.g. `.claude/settings.local.json` typically stays local). Raised PM 2026-05-13, still pending. Related: `.claude/agents/*.md` deletions and `BRIEF-ONE-STOP.md` sit uncommitted in the working tree, also awaiting the call.
- **Break-it steps for 8 more Basics lessons** — content review 2026-07-11: only 6 of 14 Tier 0 lessons have a deliberate break-it moment (the track's signature move). Obvious candidates exist for the rest: nil map write (maps), nil pointer dereference (pointers), `s[0] = 'H'` (strings). Copy already softened to "often deliberately break"; adding the steps upgrades it back.

## Up next (ranked) — FROZEN while BRIEF-ONE-STOP.md is active

1. **Homepage truth-audit (finish the pass)** — _content_ — PM session 1 fixed two overclaims (concept count, Coming-from-X promise). Content's em-dash sweep (session 2) also touched homepage prose. Still owed: full line-by-line read of `app/page.tsx` against what the site actually ships today. Anything the hero or sub-sections promise must be either shipped, fixable in a session, or rewritten. Done = a short note in DECISIONS listing each homepage claim verified.
2. **"Coming from X" sidebars** — _content + engineer_ — Up Next #2 (was #4). Confirmed load-bearing by content's 2026-05-13 Python-dev persona walkthrough: `flag.String` returning a pointer on T1 P1 step 01 is exactly the kind of friction these sidebars were designed for. `Project` type in `lib/content.ts` has no `fromOtherLang` field today; needs a map keyed by Python / JS / Rust / Java. Once shipped, the original homepage card can come back.
3. **Inline code runner** — _engineer_ — high pedagogical leverage but multi-session and unscoped. Investigate Sandpack vs an embedded Go Playground iframe vs WASM-based options. Engineer produces a written option comparison (cost, security, offline behaviour, UX) → PM logs decision → content signs off on UX → engineer ships. Decision must be logged before work starts.
4. **Per-user progress tracking (localStorage MVP)** — _engineer_ — no backend yet; just visible tier completion and "last visited" continue-button. Backend tracking later when auth lands.
5. **Search across projects and concepts** — _engineer_ — site is now large enough that browsing is slow. Client-side fuse.js, no infra needed.
6. **Sharper "Why GoPath" positioning** — _content_ — current homepage section is decent but generic; sharpen vs gophercises, exercism Go, Boot.dev Go, Go by Example. PM to do competitor scan first.

## Backlog (not promised, not scheduled)

### Engineering

- **First-time concept link affordance** — _engineer + content design call_ — surfaced by content 2026-05-13: T1 P1 step 01 uses `*dir` (pointer dereference) but `SpacedReuseCallout` only fires for concepts seen in *prior* projects (`lib/relations.ts → priorConceptOccurrence`). Need either (a) a second callout variant for first-time intros, or (b) a passive "concepts touched" list per step that links to concept pages without breaking flow. Data is now truthful: PM added `pointers` to step 01's `uses` array on 2026-05-13 so whichever UI we build will already have the dependency wired. Design conversation needed before code.
- Search component (fuse.js or similar)
- Inline code runner (decision pending — see Up next #3)
- Per-user progress tracking (localStorage → optional backend later)
- Auth + paid tier infrastructure (deferred until pricing decision lands)
- SEO pass: structured data, sitemap, per-project OG images
- Lighthouse audit + fixes
- Image/asset optimization pass

### Content

- **T1 P1 (`cli-renamer`) framing block** — add a 2–3 sentence "why this small task" intro above System Overview, written for someone who could write the script in 20 min. Names the four-layer pattern as the actual lesson. Surfaced by 2026-05-13 Python-dev persona walkthrough — first project is the highest-bounce-risk page in the site for the median target audience.
- **T1 P2 (`json-fetcher`) step 01 curl preamble** — surfaced by content 2026-05-13. Step 01 is the first moment the site asks the learner to leave the page and run something in a terminal, with no preamble. Inline a sample response and frame the curl as "verify yourself" rather than "go discover this." Small content edit; could ride along with any other T1 P2 pass.
- **Reframe `estimatedTime` across T1** — "2–3 hours" reads to a competent dev as either fluff or distrust. Either drop the wall-clock or rephrase as "~2 hours to internalise the pattern". Decide once, apply to all three T1 projects.
- Concept page for `generics` (Go 1.18+ — gap in current coverage)
- Concept page for `embedding` (referenced in `structs` but no dedicated page)
- "What next after T3" page — pointing to real Go OSS, jobs, communities
- "Coming from X" copy (Python / JS / Rust / Java) per project
- T2 P1 (http-server) polish — first paid-tier project, sets the bar
- Sharper homepage positioning section

### PM / strategy

- **Pricing decision for T2/T3** — escalate to Aboturab
- Define MVP scope for the paid tier (minimum viable charge)
- Competitive analysis writeup → DECISIONS.md
- Launch surface decision: ProductHunt / HN Show / r/golang / dev.to
- Confirm gopath.dev is secured (footer claims it; verify)
- Analytics: privacy-respecting option (Plausible vs Umami self-hosted) — cost escalation needed

---

## Done recently (rolling)

- [x] 2026-07-15 — **One-Stop Phase 3 (part 1: T1 + ship-it):** step anatomy encoded rather than documented: new `verify` block (command + where + expect + labPath), `breakIt` block (change + observe + why, `why` behind a reveal so the learner guesses first), and `Step.retrievalPrompt` ("question || answer", a field not a block so it always renders last). validate.ts now enforces the **tier spine** (T1 `pattern` / T2 `requirement` / T3 `constraint`, never crossed), `verify.labPath` resolution, and prompt format. `estimatedTime` backlog item resolved: keep the wall-clock, label it "to build" at the render site, make the content justify the number. **T1 grown 10-14h -> 30-38h** (target 30-40): cli-renamer 3->7 steps (also closed its framing-block backlog item), json-fetcher 3->7, log-parser 4->7, config-watcher 4->8, every step carrying motivation/build/verify/break-it/recap. Labs grew to match so every Verify runs: json-fetcher +2 check scenarios (unknown city, server-never-answers), log-parser +`pipeline` package +`cmd/logparse` +testdata (the processFile/worker-pool steps previously had nowhere to live), config-watcher +graded `Debounce`. **New T3 project `ship-it`** (11th project): 9 steps, zero deps, env config -> health/readiness -> drain -> static binary -> CI -> deploy story, gated on **zero dropped requests across a rolling shutdown** (a count, not a timing, so it holds on any machine), proven to bite three ways. Agents corrected several false claims in existing content, including one inside `parser_test.go`, the file rule 2 designates as the lesson: it taught that `time.Parse` allocates a fresh Location per offset so `==` fails, which is untrue on Go 1.20+ (`FixedZone` caches whole-hour zones), so the gotcha never fired. check.sh green x11, build green, 53 pages.
- [x] 2026-07-15 — **One-Stop Phase 2:** the executable spine. Ten self-contained Go modules under `labs/<slug>`, one per project, plus `labs/check.sh` (gofmt, build, vet, solution build/vet/test, self-checks, benchmarks, gates across every module) and `labs/README.md` documenting the conventions. Learner code vs reference separated by build tags (`!solution` / `solution`), suites untagged and black-box, gates behind `gate`. Site integration: new `ProjectLab` type + `LabCard` on every project page, `labPath` on every assessment block linking the real suite, and `validate.ts` extended to enforce lab existence, path-matches-slug, `go.mod`+`README.md` present, `labPath` resolves on disk, and no orphaned labs. Rule 1 held literally (cli-renamer and json-fetcher ship zero `_test.go`; a `check/` program mirrors output instead); rule 2 held (log-parser is the first graded suite, table-driven and written to be read); rule 3 gates are relative in-process comparisons, not absolute ns thresholds. Adversarial pass (one skeptic per lab, each trying to pass a wrong implementation) found 3 BLOCKERs where a wrong impl was graded correct: backwards `Chain` in http-server, no-WaitGroup `Shutdown` in tcp-echo, presence-only auth in grpc-service, plus a gate that green-lit a fast-but-wrong observability rewrite and `List` SQL never hit by db-api's integration suite. All fixed and each fix proven against the named wrong impl. Several content claims corrected to measured truth (observability's impossible 70/85 percent, worker-pool's unmeasured p99, config-watcher's Apple-only ns band, log-parser's fictional file layout). 4 pinned deps; testcontainers rejected. `.gitattributes` added (CRLF would have made all ten modules red on a fresh Windows clone). check.sh green x10, build green, 52 pages.
- [x] 2026-07-11 — **One-Stop Phase 1:** Tier 0 "Basics" track shipped at `/basics`: 14 micro-lessons (hello → packages, ~3.2h total) in `lib/content/tier0/`, each with one machine-verified ≤30-line program (gofmt/vet/run checked locally), playground link, and 2–3 retrieval prompts. `learn-syntax` now points inward (external resources demoted to a footnote); `ready-check` prompts realigned to Tier 0 coverage (interface prompt swapped for pointer-argument prompt; nil-map trap added). Nav gained "Basics". validate.ts now enforces tier0 slug/order/link integrity plus the brief's caps (≤30-line programs, ≤20 min, 2–3 prompts). Content-agent review pass: 13 findings, 2 blockers, all fixed. Build green, 52 pages.
- [x] 2026-07-11 — **One-Stop Phase 0:** split `lib/projects.ts` (1,834 lines) and `lib/concepts.ts` (939 lines) into `lib/content/projects/<slug>.ts` × 10 and `lib/content/concepts/<slug>.ts` × 15 plus index files; the old paths are now thin shims with an identical public API. `Concept` type moved to `lib/content.ts`. Verified byte-identical data via JSON dump diff; build green. Largest content file is now 242 lines. Also: project `node_modules` was missing (deps resolved from a stray home-directory install); ran `npm install` locally.
- [x] 2026-05-13 — Em-dash sweep across all prose (`lib/projects.ts`, `lib/concepts.ts`, `lib/orientation.ts`, `app/page.tsx`). 266 of 267 prose em-dashes replaced with commas, colons, or sentence breaks per voice decision; one intentional em-dash in `SpacedReuseCallout` UI copy kept (component-level, not prose). Build clean.
- [x] 2026-05-13 — Step 01 of `cli-renamer` now lists `pointers` in `uses`. Data layer is truthful; UI affordance (first-time concept link) tracked in engineering backlog.
- [x] Concepts system (`lib/concepts.ts`) — 15 entries with mental models, retrieval prompts, design rationale, common mistakes
- [x] Orientation system — 6 pages: what-is-go, reading-go, surprises, setup, learn-syntax, ready-check
- [x] Relations system (`lib/relations.ts`) — concept ↔ project + spaced-reuse lookup
- [x] Custom Go syntax highlighter (zero deps)
- [x] Theme toggle — light/dark, persists, no flash on hydration
- [x] Spaced reuse callouts on steps that reuse prior concepts
- [x] RetrievalPrompts flip-card component
- [x] Go Playground share-ID caching at build time
- [x] Validation script keeps slugs and tags in sync
- [x] 9 projects authored across T1/T2/T3 with the pattern → requirement → constraint progression
- [x] Three-agent setup (CLAUDE.md, agents/, ROADMAP, DECISIONS, settings.json)

---

## Parked

_(Move items here when they've sat in Backlog without movement for 3+ weeks.)_
