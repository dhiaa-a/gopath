/**
 * Verbatim-quote harness for the source-reading walkthroughs (Phase 7).
 *
 * The walkthroughs quote the standard library. A quote that has silently
 * drifted from the real file is worse than no quote at all: the reader opens
 * their own copy, sees something else, and learns that the site is unreliable
 * exactly when it is asking them to trust the source over the docs.
 *
 * So every excerpt is checked against the reader's OWN toolchain:
 *
 *   found      the excerpt appears byte-for-byte in the named GOROOT file
 *   unique     it appears exactly once, so its line number is unambiguous
 *   located    it starts on the line the content claims
 *   anchored   each exercise answer names an identifier that still exists
 *
 * And the checker proves it can fail before it is allowed to pass: a probe
 * excerpt with one character changed must NOT be found. A verifier that
 * cannot fail is not a verifier, which is the same reason labs/failures
 * asserts its broken variants still break.
 *
 * Run:  npx tsx scripts/source-check.ts          (all walkthroughs)
 *       npx tsx scripts/source-check.ts sync-waitgroup
 *
 * Deliberately NOT part of `npm run build`: it needs a Go toolchain, and the
 * deploy has none. labs/source/check.sh is the entry point that does.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { sourceWalkthroughs, goSourceVersion } from "../lib/content/source"

const RESET = "\x1b[0m"
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const DIM = "\x1b[2m"

let failures = 0

function fail(msg: string) {
	console.log(`  ${RED}FAIL${RESET}: ${msg}`)
	failures++
}

function ok(msg: string) {
	console.log(`  ${GREEN}ok${RESET}: ${msg}`)
}

/** Normalizes to LF so a CRLF checkout cannot produce a phantom mismatch. */
function readGo(file: string): string {
	return readFileSync(file, "utf8").replace(/\r\n/g, "\n")
}

type Located =
	| { kind: "missing" }
	| { kind: "ambiguous"; count: number }
	| { kind: "found"; line: number }

/** Finds `needle` in `hay`, insisting it occurs exactly once. */
function locate(hay: string, needle: string): Located {
	const first = hay.indexOf(needle)
	if (first === -1) return { kind: "missing" }
	let count = 0
	let at = first
	while (at !== -1) {
		count++
		at = hay.indexOf(needle, at + 1)
	}
	if (count > 1) return { kind: "ambiguous", count }
	return { kind: "found", line: hay.slice(0, first).split("\n").length }
}

/**
 * The first line of the excerpt that is absent from the file, which is almost
 * always the one that was hand-edited. Turns "not found" into a diff.
 */
function firstMissingLine(hay: string, needle: string): string | null {
	for (const line of needle.split("\n")) {
		if (line.trim() === "") continue
		if (!hay.includes(line)) return line
	}
	return null
}

function goroot(): string {
	try {
		return execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim()
	} catch {
		console.error(
			`${RED}source-check: no Go toolchain on PATH.${RESET}\n` +
				`The walkthroughs are checked against your own GOROOT; without Go there is\n` +
				`nothing to check them against, and passing silently would be a lie.`,
		)
		process.exit(1)
	}
}

function goVersion(): string {
	// "go version go1.23.12 windows/amd64" -> "go1.23.12"
	const out = execFileSync("go", ["version"], { encoding: "utf8" }).trim()
	return out.split(/\s+/)[2] ?? "unknown"
}

function main() {
	const only = process.argv[2]
	const root = goroot()
	const version = goVersion()

	console.log(`source-check: GOROOT ${DIM}${root}${RESET}`)
	console.log(`source-check: toolchain ${version}, content pinned to ${goSourceVersion}\n`)

	if (version !== goSourceVersion) {
		console.error(
			`${RED}source-check: toolchain is ${version}, the walkthroughs quote ${goSourceVersion}.${RESET}\n` +
				`Line numbers and excerpts move between releases, so a run against a different\n` +
				`toolchain proves nothing either way. Either match the pin:\n` +
				`    GOTOOLCHAIN=${goSourceVersion} npx tsx scripts/source-check.ts\n` +
				`or re-measure the content against the newer stdlib and move the pin in\n` +
				`lib/content/source/index.ts.`,
		)
		process.exit(1)
	}

	const walkthroughs = only
		? sourceWalkthroughs.filter((w) => w.slug === only)
		: sourceWalkthroughs

	if (walkthroughs.length === 0) {
		console.error(`source-check: no walkthrough matching "${only}"`)
		process.exit(1)
	}

	let excerptCount = 0

	for (const w of walkthroughs) {
		console.log(`── ${w.slug} ${DIM}(${w.name})${RESET}`)

		// A walkthrough with no excerpts is unverified by construction: there is
		// nothing for this harness to hold to the source.
		if (w.excerpts.length === 0) {
			fail(`${w.slug}: no excerpts — nothing is being held to the real source`)
			continue
		}

		const files = new Map<string, string>()
		const load = (rel: string): string | null => {
			if (files.has(rel)) return files.get(rel)!
			const abs = path.join(root, rel)
			if (!existsSync(abs)) {
				fail(`${w.slug}: ${rel} does not exist in this GOROOT`)
				return null
			}
			const text = readGo(abs)
			files.set(rel, text)
			return text
		}

		if (load(w.entryFile) === null) continue

		for (const [i, ex] of w.excerpts.entries()) {
			const label = `${w.slug}[${i}] ${ex.title}`
			const text = load(ex.file)
			if (text === null) continue
			excerptCount++

			const found = locate(text, ex.code)
			if (found.kind === "missing") {
				const culprit = firstMissingLine(text, ex.code)
				fail(
					`${label}: excerpt not found verbatim in ${ex.file}` +
						(culprit ? `\n        first line not in the file: ${culprit.trim()}` : ""),
				)
				continue
			}
			if (found.kind === "ambiguous") {
				fail(
					`${label}: excerpt appears ${found.count}× in ${ex.file} — ` +
						`its line number is ambiguous, quote more context`,
				)
				continue
			}
			if (found.line !== ex.startLine) {
				fail(
					`${label}: excerpt starts at line ${found.line} in ${ex.file}, ` +
						`content says ${ex.startLine} — update startLine`,
				)
				continue
			}
			ok(`${ex.file}:${found.line} ${DIM}${ex.title}${RESET}`)
		}

		// The exercise answer names something real.
		const anchor = w.exercise.answerAnchor
		const anchorText = load(anchor.file)
		if (anchorText !== null && !anchorText.includes(anchor.needle)) {
			fail(
				`${w.slug}: exercise answer anchor not found in ${anchor.file}: ` +
					`"${anchor.needle}"`,
			)
		} else if (anchorText !== null) {
			ok(`exercise anchor present in ${anchor.file}`)
		}

		// Self-probe: the same excerpt with one identifier corrupted must NOT
		// match. This proves the matcher is actually comparing, and would catch
		// a refactor that made `locate` vacuously true.
		const probeSource = w.excerpts[0]
		const probeText = files.get(probeSource.file)
		if (probeText) {
			const probe = probeSource.code.replace(/[A-Za-z]/, (c) =>
				c === "z" ? "q" : String.fromCharCode(c.charCodeAt(0) + 1),
			)
			if (probe !== probeSource.code && locate(probeText, probe).kind !== "missing") {
				fail(
					`${w.slug}: PROBE — a corrupted excerpt still matched. The verifier is ` +
						`not verifying; every ok above is meaningless.`,
				)
			}
		}
	}

	console.log()
	if (failures > 0) {
		console.log(
			`${RED}source-check: ${failures} failure(s) across ${walkthroughs.length} walkthrough(s)${RESET}`,
		)
		process.exit(1)
	}
	console.log(
		`${GREEN}source-check: ok${RESET} — ${excerptCount} excerpt(s) across ` +
			`${walkthroughs.length} walkthrough(s) quoted verbatim from ${version}`,
	)
}

main()
