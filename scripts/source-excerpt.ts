/**
 * Authoring tool for the source-reading walkthroughs (Phase 7).
 *
 * Prints a ready-to-paste SourceExcerpt for a line range of a GOROOT file,
 * with `startLine` measured and the code escaped for a TS template literal.
 *
 *   npx tsx scripts/source-excerpt.ts src/sync/waitgroup.go 25 30
 *
 * Use this instead of copying out of an editor. Hand-transcribed excerpts are
 * the one thing labs/source/check.sh exists to catch, and the cheapest way to
 * never fail that check is to never type the code in the first place.
 *
 * Pass --uniq to only test whether a range is unambiguous, without printing.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

const [, , rel, fromArg, toArg, flag] = process.argv

if (!rel || !fromArg || !toArg) {
	console.error("usage: npx tsx scripts/source-excerpt.ts <goroot-rel-path> <from> <to> [--uniq]")
	process.exit(2)
}

const root = execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim()
const text = readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n")
const lines = text.split("\n")

const from = Number(fromArg)
const to = Number(toArg)
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > lines.length || from > to) {
	console.error(`bad range ${fromArg}..${toArg} for ${rel} (${lines.length} lines)`)
	process.exit(2)
}

const code = lines.slice(from - 1, to).join("\n")

// The harness insists an excerpt occurs exactly once, so that its line number
// is unambiguous. Catch that here, while the range is easy to widen.
let count = 0
for (let at = text.indexOf(code); at !== -1; at = text.indexOf(code, at + 1)) count++

if (count !== 1) {
	console.error(
		`${rel}:${from}-${to} occurs ${count}× in the file. ` +
			`Widen the range until it is unique, or the line number means nothing.`,
	)
	process.exit(1)
}

if (flag === "--uniq") {
	console.log(`ok: ${rel}:${from}-${to} is unique`)
	process.exit(0)
}

// Escape for a TS template literal: backticks and ${ would otherwise break out.
const escaped = code.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")

console.log(`		{
			file: "${rel}",
			title: "TODO",
			startLine: ${from},
			code: \`${escaped}\`,
			notice: "TODO",
		},`)
