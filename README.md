# GoPath

A Next.js site that teaches Go through real, executable projects — built for developers coming from another language. Full pedagogy, curriculum structure, and content model: [`CLAUDE.md`](CLAUDE.md).

This file answers a narrower question: **how do you actually work with this repo day to day?**

## The short version

This folder on disk *is* the repo — there's no separate "clone it, then edit the clone" step. Two things happen to it:

1. **You ask Claude Code for something, in chat.** This is how most work here gets done. Claude reads [`CLAUDE.md`](CLAUDE.md) (the standing brief), picks up context from `ROADMAP.md` and `DECISIONS.md`, does the work — content, code, research, planning — and commits it to a feature branch. You did not write any code; you asked for an outcome.
2. **You edit files yourself**, exactly like any other Next.js + Go repo: open a file, change it, run the dev server, commit. Nothing here requires going through an agent. If you touch content, match the shape of an existing entry (see below); if you touch code, `npm run lint && npm run build` is the same gate an agent session runs.

Both paths end the same way: a commit, on a feature branch, eventually a PR. Neither path pushes to `main` without you saying so explicitly — that's the one rule every session (agent or you) follows.

## Running it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Go side needs Go 1.23.12 — see [`labs/README.md`](labs/README.md) if you're running the exercises themselves, not just the site.

## Where things live

- `app/` — pages (Next.js App Router). `app/page.tsx` is the homepage.
- `components/` — shared UI.
- `lib/content/` — **the actual content**: one module per project/concept/failure lab/idiom exercise/source walkthrough. This is what you edit to change what the site says.
- `lib/*.ts` (flat) — thin re-exports of the above, plus type definitions in `lib/content.ts`.
- `labs/` — the executable side: one real Go module per project, plus the failure labs, idiom exercises, source-reading harness, and the capstone. This is what a learner actually runs.
- `scripts/validate.ts` — runs in `npm run build`; catches broken links between content and labs before they ship.

Full tree and rationale: [`CLAUDE.md`](CLAUDE.md#repo-state-at-a-glance).

## Verifying a change

- **Web changes** (`app/`, `components/`, `lib/`): `npm run lint && npm run build`. Build runs the validator, so a broken content reference fails loudly instead of shipping.
- **Lab changes** (`labs/`): `bash labs/check.sh` — gofmt, vet, build, test, and the gates across every module. It's slow (10+ minutes); scope it to what you touched if you're in a hurry, or let a session run it in the background.
- **Visual changes**: actually load the page. `npm run dev` and look, or ask Claude to drive a browser and check — a green build proves the code compiles, not that the page looks right.

## Git workflow

- Feature branches, always. Nobody — human or agent — pushes straight to `main`.
- Branch from `origin/main`, not from an older feature branch: PRs here are **squash-merged**, so an old branch's commits are never actually ancestors of `main` once its PR lands, and building on top of one produces a bogus diff. (Exception: a branch mid-review sometimes keeps growing with directly-related follow-up work rather than forking — e.g. the redesign PR picked up its own follow-on commits before merging. If a session does this, it says so.)
- Open a PR when a chunk of work is ready to look at. You review and merge (or ask Claude to merge after you've looked).
- `DECISIONS.md` has the reasoning behind anything non-obvious; `ROADMAP.md` tracks what's in flight, what's next, and a running "Open observations" list anyone can drop a note into.

## Adding or editing content

Don't hand-type a new content object from a schema — the types in `lib/content.ts` are precise and drift-prone to guess. Instead, **copy the shape of a real neighboring entry**:

- New project → copy `lib/content/projects/cli-renamer.ts` (simplest T1 project) or a closer match by tier, then wire it into `lib/content/projects/index.ts`.
- New concept → copy any file in `lib/content/concepts/`.
- New failure lab / idiom exercise / source walkthrough → same pattern, in the matching `lib/content/*/` directory, plus its `labs/` counterpart if it needs one.

`npm run build` will tell you immediately if a slug, tag, or cross-link doesn't resolve.

## Where this stands

Not deployed. `gopath.dev` is secured but this stays local until the site is fully functional and has been used end-to-end, with no complaints, to actually learn Go — that's the bar for a first prod deploy, not a specific feature list.

## The rest of the docs

- [`CLAUDE.md`](CLAUDE.md) — full project context, pedagogy rules, the three agent roles, autonomy policy.
- [`ROADMAP.md`](ROADMAP.md) — what's in progress, what's next, open observations.
- [`DECISIONS.md`](DECISIONS.md) — append-only log of non-obvious calls and why.
- [`.claude/agents/`](.claude/agents/) — the engineer / PM / content standing briefs, if you want to see exactly what a session is told.
- [`labs/README.md`](labs/README.md) — how the executable labs work, race detector setup, `check.sh` internals.
