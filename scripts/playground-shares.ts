import { createHash } from "crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { concepts } from "../lib/concepts"
import { projects } from "../lib/projects"
import type { ContentBlock } from "../lib/content"

const CACHE_DIR = join(process.cwd(), ".cache")
const CACHE_FILE = join(CACHE_DIR, "playground-shares.json")
const SHARE_URL = "https://go.dev/_/share"

function sha256(code: string): string {
	return createHash("sha256").update(code).digest("hex")
}

function loadCache(): Record<string, string> {
	try {
		return JSON.parse(readFileSync(CACHE_FILE, "utf-8"))
	} catch {
		return {}
	}
}

function saveCache(cache: Record<string, string>): void {
	mkdirSync(CACHE_DIR, { recursive: true })
	writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

async function shareSnippet(code: string): Promise<string | null> {
	try {
		const res = await fetch(SHARE_URL, {
			method: "POST",
			body: code,
			headers: { "Content-Type": "text/plain" },
		})
		if (!res.ok) {
			console.warn(`[playground] share API returned HTTP ${res.status}`)
			return null
		}
		return (await res.text()).trim()
	} catch (err) {
		console.warn(`[playground] share API unreachable: ${err}`)
		return null
	}
}

function collectCodeBlocks(blocks: ContentBlock[] | undefined): string[] {
	if (!blocks) return []
	const out: string[] = []
	for (const b of blocks) {
		if (b.type === "code") out.push(b.value)
	}
	return out
}

function collectAll(): string[] {
	const snippets: string[] = []

	for (const c of concepts) {
		snippets.push(c.codeExample)
	}

	for (const p of projects) {
		snippets.push(...collectCodeBlocks(p.systemOverview))
		snippets.push(...collectCodeBlocks(p.architecture))
		snippets.push(...collectCodeBlocks(p.constraints))
		snippets.push(...collectCodeBlocks(p.recap))
		for (const step of p.steps) {
			snippets.push(...collectCodeBlocks(step.blocks))
		}
	}

	return snippets
}

async function main() {
	const cache = loadCache()
	const all = collectAll()
	const unique = [...new Set(all)]
	const todo = unique.filter((code) => !cache[sha256(code)])

	if (todo.length === 0) {
		console.log("[playground] cache is up to date")
		saveCache(cache)
		return
	}

	console.log(`[playground] sharing ${todo.length} new snippet(s)…`)
	let ok = 0
	let failed = 0

	for (const code of todo) {
		const id = await shareSnippet(code)
		if (id) {
			cache[sha256(code)] = id
			ok++
		} else {
			failed++
		}
		await new Promise((r) => setTimeout(r, 150))
	}

	saveCache(cache)

	if (failed > 0) {
		console.warn(
			`[playground] ${failed} snippet(s) failed — will fall back to /play`,
		)
	}
	console.log(`[playground] done — ${ok} shared, ${failed} failed`)
}

main().catch((err) => {
	// Never fail the build — playground is a progressive enhancement
	console.warn("[playground] unexpected error:", err)
})
