import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { concepts } from "../lib/concepts"
import { conceptGroups } from "../lib/content/concepts/groups"
import { projects } from "../lib/projects"
import { orientationPages, OrientationPage } from "../lib/orientation"
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
	const futureTracks = new Set(["failures", "idioms", "capstone"])
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
	if (page.retrievalPrompts) out.push(...page.retrievalPrompts)
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

// ─── Final ─────────────────────────────────────────────────────────────────

if (errors > 0) {
	console.error(`\n[validate] ${errors} error(s). Fix before building.`)
	process.exit(1)
}

console.log("[validate] ok — all relations and tags are valid")
