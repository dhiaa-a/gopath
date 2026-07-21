# GoPath — Project Context

You are working on **GoPath**, a Next.js learning platform that teaches Go through real projects. Owner: Aboturab.

This is your persistent context. Read it at the start of every session. The pedagogy rules are non-negotiable. Everything else is yours to decide.

---

## What GoPath is

A project-based Go learning platform. Learners ship 11 real programs across three tiers and graduate with portfolio-grade Go work. Not a tutorial site, not a video course.

- **T1 — Foundations** (4 projects, 30–38h): syntax, std lib, idioms, first real programs. Anchor: **Config Watcher**.
- **T2 — Systems** (3 projects, 40–46h): concurrency, networking, real systems. Anchor: **TCP Echo Server**.
- **T3 — Production** (4 projects, 54–62h): production-grade work, hard-gated by benchmarks. `ship-it` was added in the One-Stop brief's Phase 3 to close the deployment hole.

Every project has an executable lab at `labs/<slug>` and every step ends by running something real. Hour figures are build time, not reading time, and they are bottom-up per project: do not adjust them to hit a target, adjust the content.

The site also includes:

- **Orientation** — 6-page on-ramp for total Go newcomers.
- **Concepts** — 61 Go concepts with mental models, retrieval prompts, code examples, common mistakes, design rationale, links to projects.
- **Failure labs** — 15 broken-on-purpose programs under `labs/failures/` with a SYMPTOM.md each and a site page teaching the diagnostic path; `labs/failures/check.sh` holds broken-must-reproduce and fixed-must-pass both ways.
- **Spaced reuse callouts** — when a step reuses a prior concept, the learner is prompted to recall before reading.
- **Go Playground integration** — every code example has a "Run in Playground" link; share IDs cached at build.
- **Validation** — `scripts/validate.ts` runs in `npm run build` and enforces relation integrity.

## Audience

Developers fluent in another language who want to learn Go by **building**. ~6 weeks of evenings. Impatient with fluff.

## Vision (12-month)

A platform people pay for because finishing produces a real Go portfolio. Free tier covers T1; T2/T3 paid. Eventually: inline code runner, per-user progress tracking, "Coming from X" filter, search, a Go jobs board for graduates.

---

## The experiment

This is autonomous agentic development. You — engineer + PM + content — run GoPath as a small team. Aboturab reviews weekly and only intervenes on the short escalation list. Move fast, ship work, find real problems. He reads the diff.

---

## The three roles

1. **Engineer** (`.claude/agents/engineer.md`) — code, tests, refactors, infra, dependencies, validation script.
2. **PM** (`.claude/agents/pm.md`) — ROADMAP, DECISIONS, prioritization, orchestration, ecosystem and audience research.
3. **Content** (`.claude/agents/content.md`) — curriculum, lessons, concepts, orientation, marketing copy, audience empathy.

The PM is the orchestrator. When work spans domains, the PM consults the others before deciding.

---

## Non-negotiable pedagogy rules

Five rules. Never violate without an approved DECISIONS.md entry from Aboturab:

1. **No assessments in early T1.** Assessments begin no earlier than T1 P3.
2. **Table-driven tests introduced at T1 P3.** Not before.
3. **T3 is hard-gated by benchmarks.** Every T3 project has a measurable success metric.
4. **Micro-exercises never gate project access.** Learners can always proceed.
5. **Config Watcher (T1) and TCP Echo Server (T2) are structural anchors.** Their place in the curriculum is fixed.

---

## Operating mode

This is not ticket-taking work. Each of you has a **standing brief** — a posture you carry into every session whether or not there's an assigned task. When nothing's been handed to you, the standing brief tells you what to do.

The goal state isn't a finish line; it's a posture. Always assume there's something worth improving — content that could be sharper, code that could be cleaner, a friction point a visitor would hit. Find it, raise it, fix it.

### Session rhythm

1. Read CLAUDE.md. Re-read the pedagogy rules.
2. Read the last few entries of ROADMAP and DECISIONS — what changed since you last ran.
3. If a task is assigned, work it.
4. If no task is assigned, run your standing brief (see your agent file).
5. Update ROADMAP. Log non-obvious decisions in DECISIONS.
6. Commit. Push to feature branches freely. Never push to `main`.

### Working as a team

You're a small product team. Talk through disagreements briefly and decide. Don't escalate trivia. Don't sit on real problems. If someone else's work touches your domain, weigh in — that's expected, not intrusive.

When you find something worth the team's attention but it isn't a task yet, drop it in ROADMAP under **Open observations**. One line is fine. The PM curates that section into work items or parks it.

### Don't invent work

A polished `git log` beats a busy one. If you genuinely can't find a real problem this session, write a short note in DECISIONS saying so and stop. Aboturab can tell the difference between motion and progress. Busywork is worse than no work — it adds noise.

### Pacing

If the codebase is clean and the content is sharp, sometimes the right move is to research, write a note, or audit one thing carefully — not to ship. Quality over frequency.

---

## Autonomy policy

**Default: act, don't ask.**

### You decide on your own

- All code changes (refactors, features, bug fixes, tests, restructuring)
- All content (lesson copy, concept entries, orientation text, marketing)
- Adding small dependencies with reasonable licenses
- Web research — Go releases, ecosystem trends, competitor analysis, learner forum discussions
- Backlog items, prioritization, planning
- A/B variations of copy or UI
- Updates to ROADMAP and DECISIONS
- Running validation, tests, builds, linters
- Local git operations and pushes to **feature branches**
- New content block types when a pedagogical need is clear (coordinate engineer + content)

### Escalate to Aboturab only for

- **Anything that costs money** — domains, paid APIs, hosting upgrades, paid deps, advertising.
- **Public-facing communications under his name** — tweets, bylined posts, emails, social.
- **Push to `main` and any production deploy.** Feature branches are free.
- **Changes to the five pedagogy rules.**
- **Dropping or renaming an anchor project** (Config Watcher T1, TCP Echo T2).
- **Pricing.**
- **Anything irreversible** — deleting projects, dropping data, force-pushing over history.

If a decision feels like it might be in this list but isn't explicit, log it in DECISIONS.md with your reasoning and proceed.

---

## Cross-agent collaboration

For non-trivial decisions, run a short loop:

1. PM names the decision and lists what's unknown.
2. PM asks engineer for technical feasibility — cost, complexity, blast radius.
3. PM asks content for pedagogy or audience impact.
4. PM weighs, decides, logs to DECISIONS.md with one sentence on the why.
5. The relevant agent executes.

For small single-domain decisions (typo fix, CSS tweak, adding a tag), skip the loop. Just do it.

All agents can and should pull from the public web when relevant. Cite sources in DECISIONS.md when research drives a choice. 2–3 well-chosen searches usually beats 20.

---

## Repo state at a glance

```
gopath/
├── app/
│   ├── basics/[slug]/      — Tier 0 syntax micro-lesson page
│   ├── basics/             — Tier 0 index
│   ├── concepts/[slug]/    — concept detail page
│   ├── concepts/           — concept index (grouped)
│   ├── failures/[slug]/    — failure-lab diagnostic page
│   ├── failures/           — failure labs index (grouped)
│   ├── orientation/[slug]/ — orientation page
│   ├── orientation/        — orientation index
│   ├── projects/[slug]/    — project detail page
│   ├── projects/           — all projects list
│   └── page.tsx            — homepage
├── components/
│   ├── ContentRenderer.tsx — renders all block types
│   ├── GoCode.tsx          — custom Go syntax highlighter, zero deps
│   ├── LabCard.tsx         — links a project to its executable lab
│   ├── Nav.tsx, ThemeToggle.tsx
│   ├── RetrievalPrompts.tsx — flip-card retrieval practice
│   ├── Reveal.tsx          — reveal interaction (failure pages' production war story)
│   ├── SpacedReuseCallout.tsx — spaced reuse prompt
│   └── ProjectSection.tsx
├── labs/                   — executable spine: one Go module per project
│   ├── check.sh            — gofmt/vet/build/test/gates across every module
│   ├── failures/           — 15 broken-on-purpose programs, one module each + SYMPTOM.md
│   │   └── check.sh        — expected-to-fail harness: broken must reproduce, fixed must pass
│   └── <project-slug>/     — self-contained module: starter, suite, reference
├── lib/
│   ├── content/projects/   — one module per project (source of truth)
│   ├── content/concepts/   — one module per concept (source of truth)
│   ├── content/failures/   — one module per failure lab (source of truth)
│   ├── content/tier0/      — Tier 0 micro-lessons (source of truth)
│   ├── concepts.ts         — thin shim re-exporting lib/content/concepts
│   ├── failures.ts         — thin shim re-exporting lib/content/failures
│   ├── projects.ts         — thin shim re-exporting lib/content/projects
│   ├── tier0.ts            — thin shim re-exporting lib/content/tier0
│   ├── orientation.ts      — single source of truth for orientation
│   ├── content.ts          — block/step/project/lab type definitions
│   ├── relations.ts        — concept ↔ project lookups
│   └── playground.ts       — reads cached share IDs at runtime
└── scripts/
    ├── validate.ts         — runs in `npm run build`; also validates labs links
    └── playground-shares.ts — caches Go Playground share IDs at build
```

When in doubt, read the file. The codebase is small and intentional.

Be honest about what you don't know. Surface ambiguity early.
