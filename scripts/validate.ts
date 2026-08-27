import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { concepts } from "../lib/concepts"
import { conceptGroups } from "../lib/content/concepts/groups"
import { projects } from "../lib/projects"
import { orientationPages, OrientationPage } from "../lib/orientation"
import { failures, failureCategories } from "../lib/failures"
import { idioms, idiomAccents } from "../lib/idioms"
import { sourceWalkthroughs } from "../lib/content/source"
import { capstone } from "../lib/capstone"
import { tier0Lessons } from "../lib/tier0"
import type { ContentBlock, Tier0Lesson } from "../lib/content"

const KNOWN_TAGS = new Set([
	"os", "flag", "filepath", "error-handling",
	"net/http", "encoding/json", "structs", "defer",
	"goroutines", "channels", "sync", "bufio", "testing",
	"select", "atomic", "time", "benchmarks", "generics",
	"middleware", "context", "httptest", "interfaces",
	"errgroup", "net", "io", "integration-testing",
	"grpc", "protobuf", "interceptors", "streaming", "bufconn",
	"postgres", "pgx", "migrations", "repository",
	"pprof", "runtime", "trace", "benchstat",
])

const conceptSlugs = new Set(concepts.map((c) => c.slug))
const orientationSlugs = new Set(orientationPages.map((p) => p.slug))
const tier0Slugs = new Set(tier0Lessons.map((l) => l.slug))
let errors = 0

function fail(msg: string) {
	console.error(`[validate] ${msg}`)
	errors++
}

// ─── Projects ──────────────────────────────────────────────────────────────

// Every step.uses slug must exist in concepts
for (const project of projects) {
	for (const step of project.steps) {
		for (const slug of step.uses) {
			if (!conceptSlugs.has(slug)) {
				fail(`${project.slug} step ${step.n}: uses unknown concept "${slug}"`)
			}
		}
	}
}

// Every project tag must be in the known set
for (const project of projects) {
	for (const tag of project.tags) {
		if (!KNOWN_TAGS.has(tag)) {
			fail(`${project.slug}: unknown tag "${tag}" — add it to KNOWN_TAGS in scripts/validate.ts if intentional`)
		}
	}
}

// ─── Labs ──────────────────────────────────────────────────────────────────
// Phase 2 contract: every project ships an executable lab at labs/<slug>,
// the project links it, and every assessment references a real path in it.

const labsRoot = path.resolve(process.cwd(), "labs")

for (const project of projects) {
	if (!project.lab) {
		fail(`${project.slug}: no lab — every project links its lab (labs/<slug>)`)
		continue
	}
	const expected = `labs/${project.slug}`
	if (project.lab.path !== expected) {
		fail(`${project.slug}: lab.path is "${project.lab.path}", expected "${expected}"`)
	}
	if (!project.lab.command.trim()) {
		fail(`${project.slug}: lab.command is empty`)
	}
	for (const required of ["go.mod", "README.md"]) {
		if (!existsSync(path.join(labsRoot, project.slug, required))) {
			fail(`${project.slug}: lab is missing ${expected}/${required}`)
		}
	}
	for (const step of project.steps) {
		for (const block of step.blocks) {
			if (block.type !== "assessment") continue
			const labPath = block.assessment.labPath
			if (!labPath) {
				fail(`${project.slug} step ${step.n}: assessment has no labPath — assessments must reference the real suite`)
				continue
			}
			if (labPath !== expected && !labPath.startsWith(`${expected}/`)) {
				fail(`${project.slug} step ${step.n}: labPath "${labPath}" is outside ${expected}`)
			}
			if (!existsSync(path.resolve(process.cwd(), labPath))) {
				fail(`${project.slug} step ${step.n}: labPath "${labPath}" does not exist on disk`)
			}
		}
	}
}

// Orphan check: every module directly under labs/ must belong to a project.
// Future tracks from the One-Stop brief are allowlisted before they exist.
{
	const futureTracks = new Set(["failures", "idioms", "source", "capstone"])
	const projectSlugs = new Set(projects.map((p) => p.slug))
	if (existsSync(labsRoot)) {
		for (const entry of readdirSync(labsRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			if (futureTracks.has(entry.name)) continue
			if (!projectSlugs.has(entry.name)) {
				fail(`labs/${entry.name}: no project with this slug — orphaned lab`)
			}
		}
	}
}

// ─── Step anatomy and the tier spine (Phase 3) ─────────────────────────────
// The tier contract is the pedagogical spine: T1 shows a pattern, T2 states a
// requirement, T3 states a constraint only. A project must never reach for a
// block from another tier, which is how the spine gets flattened.
{
	const buildBlockForTier = { 1: "pattern", 2: "requirement", 3: "constraint" } as const
	const buildBlocks = new Set(["pattern", "requirement", "constraint"])

	for (const project of projects) {
		const allowed = buildBlockForTier[project.tier]
		for (const step of project.steps) {
			for (const block of step.blocks) {
				if (buildBlocks.has(block.type) && block.type !== allowed) {
					fail(
						`${project.slug} step ${step.n}: tier ${project.tier} project uses a "${block.type}" block; tier ${project.tier} builds with "${allowed}"`,
					)
				}
			}

			// Verify blocks are the "done is checkable" promise. A command that
			// points at a lab path must point at a real one.
			for (const block of step.blocks) {
				if (block.type !== "verify") continue
				if (!block.command.trim()) {
					fail(`${project.slug} step ${step.n}: verify block has an empty command`)
				}
				if (block.labPath && !existsSync(path.resolve(process.cwd(), block.labPath))) {
					fail(
						`${project.slug} step ${step.n}: verify labPath "${block.labPath}" does not exist on disk`,
					)
				}
			}

			// Recap prompts reuse the flip-card "question || answer" contract.
			// A prompt with no answer renders a card that reveals nothing.
			if (step.retrievalPrompt !== undefined) {
				const parts = step.retrievalPrompt.split("||")
				if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
					fail(
						`${project.slug} step ${step.n}: retrievalPrompt must be "question || answer"; got ${JSON.stringify(step.retrievalPrompt)}`,
					)
				}
			}
		}
	}
}

// ─── Concepts ──────────────────────────────────────────────────────────────

// Unique slugs
{
	const seen = new Set<string>()
	for (const concept of concepts) {
		if (seen.has(concept.slug)) {
			fail(`concepts: duplicate slug "${concept.slug}"`)
		}
		seen.add(concept.slug)
	}
}

// Every relatedSlug must exist in concepts
for (const concept of concepts) {
	for (const slug of concept.relatedSlugs) {
		if (!conceptSlugs.has(slug)) {
			fail(`concept "${concept.slug}": relatedSlugs contains unknown slug "${slug}"`)
		}
	}
}

// Every concept appears in exactly one group on /concepts. The index renders
// only what the taxonomy lists, so a concept missing from it is a page that
// exists, that steps link to, and that nothing on /concepts can reach.
{
	const timesGrouped = new Map<string, number>()
	for (const group of conceptGroups) {
		for (const slug of group.slugs) {
			if (!conceptSlugs.has(slug)) {
				fail(`concept group "${group.label}": unknown concept "${slug}"`)
			}
			timesGrouped.set(slug, (timesGrouped.get(slug) ?? 0) + 1)
		}
	}
	for (const concept of concepts) {
		const n = timesGrouped.get(concept.slug) ?? 0
		if (n === 0) {
			fail(
				`concept "${concept.slug}": in no group in lib/content/concepts/groups.ts, so it would not appear on /concepts`,
			)
		} else if (n > 1) {
			fail(`concept "${concept.slug}": in ${n} concept groups, expected exactly one`)
		}
	}
}

// ─── Orientation ───────────────────────────────────────────────────────────

// Unique slugs
{
	const seen = new Set<string>()
	for (const page of orientationPages) {
		if (seen.has(page.slug)) {
			fail(`orientation: duplicate slug "${page.slug}"`)
		}
		seen.add(page.slug)
	}
}

// Order values must be unique and sequential 1..N
{
	const orders = orientationPages.map((p) => p.order).sort((a, b) => a - b)
	for (let i = 0; i < orders.length; i++) {
		if (orders[i] !== i + 1) {
			fail(
				`orientation: order values must be sequential 1..${orientationPages.length}; got [${orders.join(", ")}]`,
			)
			break
		}
	}
}

// Concept, orientation, and basics links inside any block text must resolve
function blockTexts(blocks: ContentBlock[]): string[] {
	const out: string[] = []
	for (const block of blocks) {
		if (block.type === "text" || block.type === "callout") {
			out.push(block.value.en)
		} else if (block.type === "code") {
			out.push(block.value)
		} else if (block.type === "list") {
			out.push(...block.items.map((i) => i.en))
		}
	}
	return out
}

function collectScannableText(page: OrientationPage): string[] {
	const out = blockTexts(page.blocks)
	// Prompts are localized now, so scan every language's text rather than
	// only English — a broken link introduced in a translation is still a
	// broken link.
	if (page.retrievalPrompts) {
		for (const prompt of page.retrievalPrompts) {
			out.push(...Object.values(prompt).filter(Boolean))
		}
	}
	return out
}

function checkLinks(where: string, text: string) {
	for (const match of text.matchAll(/\/concepts\/([a-z0-9-]+)/g)) {
		if (!conceptSlugs.has(match[1])) {
			fail(`${where}: link to unknown concept "${match[1]}"`)
		}
	}
	for (const match of text.matchAll(/\/orientation\/([a-z0-9-]+)/g)) {
		if (!orientationSlugs.has(match[1])) {
			fail(`${where}: link to unknown orientation page "${match[1]}"`)
		}
	}
	for (const match of text.matchAll(/\/basics\/([a-z0-9-]+)/g)) {
		if (!tier0Slugs.has(match[1])) {
			fail(`${where}: link to unknown basics lesson "${match[1]}"`)
		}
	}
}

for (const page of orientationPages) {
	for (const text of collectScannableText(page)) {
		checkLinks(`orientation/${page.slug}`, text)
	}
}

// ─── Tier 0 (basics) ───────────────────────────────────────────────────────

// Unique slugs
{
	const seen = new Set<string>()
	for (const lesson of tier0Lessons) {
		if (seen.has(lesson.slug)) {
			fail(`tier0: duplicate slug "${lesson.slug}"`)
		}
		seen.add(lesson.slug)
	}
}

// Order values must be unique and sequential 1..N
{
	const orders = tier0Lessons.map((l) => l.order).sort((a, b) => a - b)
	for (let i = 0; i < orders.length; i++) {
		if (orders[i] !== i + 1) {
			fail(
				`tier0: order values must be sequential 1..${tier0Lessons.length}; got [${orders.join(", ")}]`,
			)
			break
		}
	}
}

// The brief's caps, enforced: one ≤30-line program, ≤20 minutes per lesson.
for (const lesson of tier0Lessons) {
	const codeLines = lesson.program
		.split("\n")
		.filter((line) => line.trim() !== "").length
	if (codeLines > 30) {
		fail(
			`tier0/${lesson.slug}: program has ${codeLines} non-empty lines (max 30)`,
		)
	}
	if (lesson.program.trim() === "") {
		fail(`tier0/${lesson.slug}: program is empty`)
	}
	if (lesson.estimatedMinutes > 20) {
		fail(
			`tier0/${lesson.slug}: estimatedMinutes is ${lesson.estimatedMinutes} (max 20)`,
		)
	}
	if (lesson.retrievalPrompts.length < 2 || lesson.retrievalPrompts.length > 3) {
		fail(
			`tier0/${lesson.slug}: ${lesson.retrievalPrompts.length} retrieval prompts (need 2–3)`,
		)
	}
}

// Link integrity across lesson prose and prompts
function tier0ScannableText(lesson: Tier0Lesson): string[] {
	return [
		...blockTexts(lesson.intro),
		...blockTexts(lesson.after),
		...lesson.retrievalPrompts,
	]
}

for (const lesson of tier0Lessons) {
	for (const text of tier0ScannableText(lesson)) {
		checkLinks(`basics/${lesson.slug}`, text)
	}
}

// ─── Failure labs (Phase 5) ────────────────────────────────────────────────
// Contract: every failure page is backed by a real lab at labs/failures/<slug>
// holding the broken program (main.go, build tag !fixed), the fixed variant
// (fixed.go), SYMPTOM.md, and its own go.mod; every lab dir on disk has a
// page; categories and related concepts resolve. The behavioural half of the
// contract (broken reproduces, fixed runs clean) lives in
// labs/failures/check.sh, which labs/check.sh invokes.

{
	const failureSlugs = new Set(failures.map((f) => f.slug))
	if (failureSlugs.size !== failures.length) {
		fail("failures: duplicate slug in lib/content/failures/index.ts")
	}
	const knownCategories = new Set<string>(failureCategories)

	for (const f of failures) {
		if (!knownCategories.has(f.category)) {
			fail(`failures/${f.slug}: unknown category "${f.category}"`)
		}
		const expected = `labs/failures/${f.slug}`
		if (f.labPath !== expected) {
			fail(`failures/${f.slug}: labPath is "${f.labPath}", expected "${expected}"`)
		}
		for (const required of ["go.mod", "SYMPTOM.md", "main.go", "fixed.go"]) {
			if (!existsSync(path.join(labsRoot, "failures", f.slug, required))) {
				fail(`failures/${f.slug}: lab is missing ${expected}/${required}`)
			}
		}
		if (!f.runCommand.trim()) {
			fail(`failures/${f.slug}: runCommand is empty`)
		}
		if (f.tools.length === 0) {
			fail(`failures/${f.slug}: tools is empty — the page must name what to reach for`)
		}
		if (f.diagnosis.length < 2) {
			fail(`failures/${f.slug}: only ${f.diagnosis.length} diagnosis step(s) — the page must teach the path, not just the answer`)
		}
		for (const [i, step] of f.diagnosis.entries()) {
			if (!step.title.trim() || !step.body.trim()) {
				fail(`failures/${f.slug}: diagnosis step ${i + 1} has an empty title or body`)
			}
		}
		for (const field of ["tagline", "symptom", "fix", "production", "scar"] as const) {
			if (!f[field].trim()) {
				fail(`failures/${f.slug}: ${field} is empty`)
			}
		}
		for (const slug of f.relatedSlugs) {
			if (!conceptSlugs.has(slug)) {
				fail(`failures/${f.slug}: relatedSlugs references unknown concept "${slug}"`)
			}
		}
	}

	// Orphan check: every lab dir under labs/failures must have a page.
	const failuresRoot = path.join(labsRoot, "failures")
	if (existsSync(failuresRoot)) {
		for (const entry of readdirSync(failuresRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			if (!failureSlugs.has(entry.name)) {
				fail(`labs/failures/${entry.name}: no failure page with this slug — orphaned failure lab`)
			}
		}
	}
}

// ─── Idiom exercises (Phase 6) ─────────────────────────────────────────────
// Contract: every idiom entry on /idioms is backed by a real exercise at
// labs/idioms/<slug> (go.mod, README.md, REVIEW.md, solution.go, a test
// file); every exercise dir on disk has an entry; accents are known; and the
// linters the site claims will fire are exactly the ones the harness
// registers and asserts (labs/idioms/check.sh), so the page can never drift
// from what the starter actually teaches. The behavioural half (starter red
// on those linters, reference clean, suite green both ways) lives in the
// harness, which labs/check.sh invokes.

{
	const idiomSlugs = new Set(idioms.map((i) => i.slug))
	if (idiomSlugs.size !== idioms.length) {
		fail("idioms: duplicate slug in lib/content/idioms.ts")
	}
	const knownAccents = new Set<string>(idiomAccents)
	const idiomsRoot = path.join(labsRoot, "idioms")

	for (const shared of [".golangci.yml", "check.sh", "README.md"]) {
		if (!existsSync(path.join(idiomsRoot, shared))) {
			fail(`labs/idioms/${shared} is missing — the track's shared ${shared === ".golangci.yml" ? "lint config" : shared === "check.sh" ? "harness" : "README"} must exist`)
		}
	}

	const harnessPath = path.join(idiomsRoot, "check.sh")
	const harness = existsSync(harnessPath)
		? readFileSync(harnessPath, "utf8")
		: ""

	for (const ex of idioms) {
		if (!knownAccents.has(ex.accent)) {
			fail(`idioms/${ex.slug}: unknown accent "${ex.accent}"`)
		}
		const expected = `labs/idioms/${ex.slug}`
		if (ex.labPath !== expected) {
			fail(`idioms/${ex.slug}: labPath is "${ex.labPath}", expected "${expected}"`)
		}
		for (const required of ["go.mod", "README.md", "REVIEW.md", "solution.go"]) {
			if (!existsSync(path.join(idiomsRoot, ex.slug, required))) {
				fail(`idioms/${ex.slug}: exercise is missing ${expected}/${required}`)
			}
		}
		const dir = path.join(idiomsRoot, ex.slug)
		if (
			existsSync(dir) &&
			!readdirSync(dir).some((f) => f.endsWith("_test.go"))
		) {
			fail(`idioms/${ex.slug}: no _test.go — the suite is half the contract`)
		}
		if (!ex.tagline.trim()) {
			fail(`idioms/${ex.slug}: tagline is empty`)
		}
		if (ex.mistakes.length < 3) {
			fail(`idioms/${ex.slug}: only ${ex.mistakes.length} named mistake(s) — the exercise must name what it trains against`)
		}
		if (ex.linters.length === 0) {
			fail(`idioms/${ex.slug}: linters is empty — the page must say what fires`)
		}
		if (!/^T[123] P\d$/.test(ex.suggestedAfter)) {
			fail(`idioms/${ex.slug}: suggestedAfter "${ex.suggestedAfter}" is not of the form "T2 P1"`)
		}

		// The harness registration is the source of truth for what fires.
		const caseBlock = harness.match(
			new RegExp(`\\n\\t${ex.slug}\\)([\\s\\S]*?);;`),
		)
		if (!caseBlock) {
			fail(`idioms/${ex.slug}: not registered in labs/idioms/check.sh — an exercise the harness never asserts is unverified`)
		} else {
			for (const linter of ex.linters) {
				if (!new RegExp(`lint_red[^\\n]*\\b${linter}\\b`).test(caseBlock[1])) {
					fail(`idioms/${ex.slug}: site claims "${linter}" fires but labs/idioms/check.sh does not assert it`)
				}
			}
		}
	}

	// Orphan check: every module dir under labs/idioms must have an entry.
	if (existsSync(idiomsRoot)) {
		for (const entry of readdirSync(idiomsRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			if (!idiomSlugs.has(entry.name)) {
				fail(`labs/idioms/${entry.name}: no idiom entry with this slug — orphaned exercise`)
			}
		}
	}
}

// ─── Source reading ────────────────────────────────────────────────────────

// Contract: every walkthrough on /source points at real stdlib files, links
// only to content that exists, and carries excerpts for the harness to hold
// against GOROOT. What this cannot check is whether the quotes are accurate:
// that needs a Go toolchain, which the deploy does not have, so it lives in
// labs/source/check.sh. The two are complementary and both are required.
{
	// Catches the placeholder scripts/source-excerpt.ts emits without catching
	// prose that merely mentions one. Reading stdlib source means running into
	// real TODO comments, and a walkthrough must be able to say so: an earlier
	// `value.includes("TODO")` made "the TODO above this branch" unshippable
	// and pushed an author into circumlocution to satisfy the linter.
	const isPlaceholder = (value: string) => /^TODO\b/.test(value.trim())

	const walkthroughSlugs = new Set(sourceWalkthroughs.map((w) => w.slug))
	if (walkthroughSlugs.size !== sourceWalkthroughs.length) {
		fail("source: duplicate slug in lib/content/source")
	}

	const projectSlugs = new Set(projects.map((p) => p.slug))
	const failureSlugs = new Set(failures.map((f) => f.slug))
	const orders = new Set<number>()

	if (!existsSync(path.join(labsRoot, "source", "check.sh"))) {
		fail("labs/source/check.sh is missing — the walkthroughs would be unverified")
	}

	for (const w of sourceWalkthroughs) {
		if (orders.has(w.order)) {
			fail(`source/${w.slug}: duplicate order ${w.order}`)
		}
		orders.add(w.order)

		// An excerpt-free walkthrough is prose about code rather than a reading
		// of it, and nothing in it is held to the real source.
		if (w.excerpts.length === 0) {
			fail(`source/${w.slug}: no excerpts — nothing is held to the real source`)
		}

		// GOROOT-relative, so the harness can resolve it and the reader can too.
		if (!w.entryFile.startsWith("src/")) {
			fail(`source/${w.slug}: entryFile "${w.entryFile}" must be GOROOT-relative (src/...)`)
		}
		if (w.excerpts.length > 0 && !w.excerpts.some((ex) => ex.file === w.entryFile)) {
			fail(
				`source/${w.slug}: entryFile "${w.entryFile}" is never excerpted — ` +
					`the file the reader is told to open should be one they are shown`,
			)
		}

		for (const [i, ex] of w.excerpts.entries()) {
			const where = `source/${w.slug}[${i}]`
			if (!ex.file.startsWith("src/")) {
				fail(`${where}: file "${ex.file}" must be GOROOT-relative (src/...)`)
			}
			if (!Number.isInteger(ex.startLine) || ex.startLine < 1) {
				fail(`${where}: startLine must be a positive integer, got ${ex.startLine}`)
			}
			if (ex.code.trim() === "") {
				fail(`${where}: empty excerpt`)
			}
			// scripts/source-excerpt.ts emits TODO placeholders for the prose.
			// Shipping one means an excerpt was pasted and never annotated, which
			// is the failure mode this whole track exists to avoid.
			for (const [field, value] of [
				["title", ex.title],
				["notice", ex.notice],
			] as const) {
				if (value.trim() === "" || isPlaceholder(value)) {
					fail(`${where}: ${field} is empty or still a TODO placeholder`)
				}
			}
		}

		const { exercise } = w
		for (const [field, value] of [
			["question", exercise.question],
			["command", exercise.command],
			["answer", exercise.answer],
			["answerAnchor.needle", exercise.answerAnchor.needle],
		] as const) {
			if (value.trim() === "" || isPlaceholder(value)) {
				fail(`source/${w.slug}: exercise.${field} is empty or still a TODO placeholder`)
			}
		}
		if (!exercise.answerAnchor.file.startsWith("src/")) {
			fail(
				`source/${w.slug}: exercise.answerAnchor.file "${exercise.answerAnchor.file}" ` +
					`must be GOROOT-relative (src/...)`,
			)
		}

		// Relations: the brief's done-when requires these pages be reachable
		// from the concepts and projects they explain, so the links must resolve.
		for (const slug of w.relatedConcepts) {
			if (!conceptSlugs.has(slug)) {
				fail(`source/${w.slug}: relatedConcepts references unknown concept "${slug}"`)
			}
		}
		for (const slug of w.relatedProjects) {
			if (!projectSlugs.has(slug)) {
				fail(`source/${w.slug}: relatedProjects references unknown project "${slug}"`)
			}
		}
		for (const slug of w.relatedFailures ?? []) {
			if (!failureSlugs.has(slug)) {
				fail(`source/${w.slug}: relatedFailures references unknown failure lab "${slug}"`)
			}
		}
		if (w.relatedConcepts.length === 0 && w.relatedProjects.length === 0) {
			fail(
				`source/${w.slug}: links to no concept and no project — ` +
					`the brief requires walkthroughs be reachable from the curriculum`,
			)
		}
	}
}

// ─── Capstone ──────────────────────────────────────────────────────────────
//
// Contract: the capstone page describes a lab that exists, every failure class
// it names resolves to a real failure lab, and the seeds and blind spots
// between them account for every failure class exactly once.
//
// That last one is the check worth having. The page's claim is not just "these
// bugs are caught" but "these are the ones that are not, and here is why". A
// class that quietly appears in neither list would turn an honest accounting
// into a partial one, which is worse than not making the claim at all.
{
	const c = capstone
	const repoRoot = process.cwd()
	const projectSlugs = new Set(projects.map((p) => p.slug))
	const failureSlugs = new Set(failures.map((f) => f.slug))

	if (!existsSync(path.resolve(repoRoot, c.labPath, "check.sh"))) {
		fail(`capstone: ${c.labPath}/check.sh is missing — the suite would be unproven`)
	}
	for (const file of ["SPEC.md", "go.mod", "reference", "suite", "slo", "seed"]) {
		if (!existsSync(path.resolve(repoRoot, c.labPath, file))) {
			fail(`capstone: ${c.labPath}/${file} is missing`)
		}
	}
	if (!existsSync(path.resolve(repoRoot, c.specPath))) {
		fail(`capstone: specPath "${c.specPath}" does not exist`)
	}

	if (c.seeds.length === 0) {
		fail("capstone: no seeded bugs — the suite would rest on never having been tested")
	}
	if (c.objectives.length === 0) {
		fail("capstone: no objectives — pedagogy rule 3 requires a measurable gate")
	}
	for (const o of c.objectives) {
		if (!o.measured.trim()) {
			fail(`capstone: objective "${o.name}" has no measured value from the reference`)
		}
	}

	const seenSeeds = new Set<string>()
	for (const s of c.seeds) {
		if (seenSeeds.has(s.name)) fail(`capstone: duplicate seed "${s.name}"`)
		seenSeeds.add(s.name)

		if (s.caughtBy.length === 0) {
			fail(`capstone: seed "${s.name}" names no check that catches it`)
		}
		if (s.failureSlug !== null && !failureSlugs.has(s.failureSlug)) {
			fail(`capstone: seed "${s.name}" references unknown failure lab "${s.failureSlug}"`)
		}
	}

	const covered = new Set<string>()
	for (const s of c.seeds) {
		if (s.failureSlug) covered.add(s.failureSlug)
	}
	for (const b of c.blindSpots) {
		if (!failureSlugs.has(b.failureSlug)) {
			fail(`capstone: blind spot references unknown failure lab "${b.failureSlug}"`)
		}
		if (covered.has(b.failureSlug)) {
			fail(
				`capstone: "${b.failureSlug}" is listed as both seeded and unseeable — ` +
					`it cannot be caught and uncatchable at the same time`,
			)
		}
		covered.add(b.failureSlug)
	}
	for (const slug of failureSlugs) {
		if (!covered.has(slug)) {
			fail(
				`capstone: failure class "${slug}" appears in neither the seeds nor the ` +
					`blind spots — the page claims to account for all of them`,
			)
		}
	}

	for (const slug of c.relatedConcepts) {
		if (!conceptSlugs.has(slug)) {
			fail(`capstone: relatedConcepts references unknown concept "${slug}"`)
		}
	}
	for (const slug of c.relatedProjects) {
		if (!projectSlugs.has(slug)) {
			fail(`capstone: relatedProjects references unknown project "${slug}"`)
		}
	}
}

// ─── Final ─────────────────────────────────────────────────────────────────

if (errors > 0) {
	console.error(`\n[validate] ${errors} error(s). Fix before building.`)
	process.exit(1)
}

console.log("[validate] ok — all relations and tags are valid")
