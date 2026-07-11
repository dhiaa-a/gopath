import { concepts } from "../lib/concepts"
import { projects } from "../lib/projects"
import { orientationPages, OrientationPage } from "../lib/orientation"
import { tier0Lessons } from "../lib/tier0"
import type { ContentBlock, Tier0Lesson } from "../lib/content"

const KNOWN_TAGS = new Set([
	"os", "flag", "filepath", "error-handling",
	"net/http", "encoding/json", "structs", "defer",
	"goroutines", "channels", "sync", "bufio", "testing",
	"select", "atomic", "time", "benchmarks",
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

// ─── Concepts ──────────────────────────────────────────────────────────────

// Every relatedSlug must exist in concepts
for (const concept of concepts) {
	for (const slug of concept.relatedSlugs) {
		if (!conceptSlugs.has(slug)) {
			fail(`concept "${concept.slug}": relatedSlugs contains unknown slug "${slug}"`)
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
