import { concepts } from "../lib/concepts"
import { projects } from "../lib/projects"

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
let errors = 0

function fail(msg: string) {
	console.error(`[validate] ${msg}`)
	errors++
}

// Every uses slug must exist in concepts
for (const project of projects) {
	for (const step of project.steps) {
		for (const slug of step.uses) {
			if (!conceptSlugs.has(slug)) {
				fail(`${project.slug} step ${step.n}: uses unknown concept "${slug}"`)
			}
		}
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

// Every project tag must be in the known set
for (const project of projects) {
	for (const tag of project.tags) {
		if (!KNOWN_TAGS.has(tag)) {
			fail(`${project.slug}: unknown tag "${tag}" — add it to KNOWN_TAGS in scripts/validate.ts if intentional`)
		}
	}
}

if (errors > 0) {
	console.error(`\n[validate] ${errors} error(s). Fix before building.`)
	process.exit(1)
}

console.log("[validate] ok — all relations and tags are valid")
