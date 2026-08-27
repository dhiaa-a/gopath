/**
 * Every internal link on every generated page must resolve to a page that was
 * actually generated.
 *
 * This exists because bilingual routing moved every route under /<lang>/, and
 * the failure mode it guards is silent: a link written as "/concepts/slices"
 * in a content file still *looks* right in the source, still renders as a
 * normal link, and 404s only when somebody clicks it. There is no type error
 * and no build warning. The first pass of the migration left exactly one such
 * link — inside a concept's HTML summary, where no amount of reading the TSX
 * would have found it — and this check is what found it.
 *
 * Runs against the build output rather than the source, so it sees the same
 * HTML a reader gets, including links produced by dangerouslySetInnerHTML
 * after localizeHtml has rewritten them.
 *
 * Usage: npm run build && npx tsx scripts/link-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, sep } from "node:path"

const ROOT = ".next/server/app"

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) walk(full, out)
		else if (entry.endsWith(".html")) out.push(full)
	}
	return out
}

let files: string[]
try {
	files = walk(ROOT)
} catch {
	console.error(
		`link-check: no build output at ${ROOT}. Run \`npm run build\` first.`,
	)
	process.exit(1)
}

const routeOf = (file: string) =>
	file.split(sep).join("/").slice(ROOT.length, -".html".length)

const pages = new Set(files.map(routeOf))

// Static assets, the bare root (which next.config.js redirects to /en) and the
// generated icon are all legitimate targets that are not pages.
const isExempt = (path: string) =>
	path.startsWith("/_next") ||
	path === "/" ||
	path === "/icon.svg" ||
	path === "/favicon.ico"

const HREF = /href="(\/[^"#?]*)/g
const broken = new Map<string, Set<string>>()
let checked = 0

for (const file of files) {
	const from = routeOf(file)
	const html = readFileSync(file, "utf8")
	for (const match of html.matchAll(HREF)) {
		const path = match[1].replace(/\/$/, "") || "/"
		checked++
		if (pages.has(path) || isExempt(path)) continue
		if (!broken.has(path)) broken.set(path, new Set())
		broken.get(path)!.add(from)
	}
}

console.log(
	`link-check: ${checked} internal links across ${pages.size} pages`,
)

if (broken.size === 0) {
	console.log("link-check: all internal links resolve")
	process.exit(0)
}

console.error(`link-check: ${broken.size} unresolved target(s)`)
for (const [path, sources] of [...broken].sort()) {
	const from = [...sources].sort().slice(0, 3).join(", ")
	console.error(`  ${path}  <-  ${from}`)
}
process.exit(1)
