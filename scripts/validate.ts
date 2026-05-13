import { concepts } from "../lib/concepts"
import { projects } from "../lib/projects"
import { orientationPages, OrientationPage } from "../lib/orientation"

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

// Concept and orientation links inside any block text must resolve
function collectScannableText(page: OrientationPage): string[] {
	const out: string[] = []
	for (const block of page.blocks) {
		if (block.type === "text" || block.type === "callout" || block.type === "code") {
			out.push(block.value)
		} else if (block.type === "list") {
			out.push(...block.items)
		}
	}
	if (page.retrievalPrompts) out.push(...page.retrievalPrompts)
	return out
}

for (const page of orientationPages) {
	for (const text of collectScannableText(page)) {
		for (const match of text.matchAll(/\/concepts\/([a-z0-9-]+)/g)) {
			const slug = match[1]
			if (!conceptSlugs.has(slug)) {
				fail(`orientation/${page.slug}: link to unknown concept "${slug}"`)
			}
		}
		for (const match of text.matchAll(/\/orientation\/([a-z0-9-]+)/g)) {
			const slug = match[1]
			if (!orientationSlugs.has(slug)) {
				fail(`orientation/${page.slug}: link to unknown orientation page "${slug}"`)
			}
		}
	}
}

// ─── Final ─────────────────────────────────────────────────────────────────

if (errors > 0) {
	console.error(`\n[validate] ${errors} error(s). Fix before building.`)
	process.exit(1)
}

console.log("[validate] ok — all relations and tags are valid")
