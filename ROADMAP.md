# GoPath Roadmap

_Last updated: 2026-07-11 (One-Stop brief Phase 1: Tier 0 syntax track shipped)_

> One sentence per sprint: what's the biggest thing that needs to be true by end of week?

---

## Current focus

**BRIEF-ONE-STOP.md is the mandate.** GoPath becomes the only Go resource a learner needs: Tier 0 syntax in-house, executable labs, 6–10-step projects, 45–60 concepts, failure labs, idiom track, source reading, capstone. Eight sequential phases; execution plan approved by Aboturab 2026-07-11. While the brief is active, everything in "Up next" below is **frozen** (search, inline runner, progress tracking, Coming-from-X, pricing) — do not pick from it.

## In progress

- [x] **Phase 0 — split the content monolith** (`feat/one-stop-p0`) — done; see Done recently.
- [x] **Phase 1 — Tier 0: syntax taught in-house** (`feat/one-stop-p1`) — done; see Done recently.
- [ ] **Phase 2 — the executable spine (`labs/`)** (~3 sessions) — next up. Upgrade Go toolchain to latest stable first; decide reference-solution layout and log it; add `.gitattributes` for `labs/` line endings.

## Open observations

_Anyone can drop a one-liner here. The PM curates it — converts to tasks, parks, or resolves. This is how the agents talk between sessions._

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
