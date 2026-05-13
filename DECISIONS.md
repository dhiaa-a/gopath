# GoPath Decisions Log

Append-only. Newest at the top.

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
