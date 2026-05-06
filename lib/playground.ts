import { createHash } from "crypto"
import { readFileSync } from "fs"
import { join } from "path"

function sha256(code: string): string {
	return createHash("sha256").update(code).digest("hex")
}

let _cache: Record<string, string> | null = null

function cache(): Record<string, string> {
	if (_cache) return _cache
	try {
		const file = join(process.cwd(), ".cache", "playground-shares.json")
		_cache = JSON.parse(readFileSync(file, "utf-8"))
	} catch {
		_cache = {}
	}
	return _cache!
}

export function playgroundUrl(code: string): string {
	const id = cache()[sha256(code)]
	return id ? `https://go.dev/play/p/${id}` : "https://go.dev/play"
}
