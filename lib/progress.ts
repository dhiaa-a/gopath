"use client"
import { useSyncExternalStore } from "react"
import { stepId, lessonId, countDone } from "./progress-ids"
import type { ProgressData } from "./progress-ids"

// Re-exported so client components can pull everything progress-related from
// one path; server components should import from "@/lib/progress-ids"
// directly (id builders and the type only — no store), since this whole
// module is client-only and Next.js refuses to call a client-tagged export
// from a server component, even a pure one.
export { stepId, lessonId, countDone }
export type { ProgressData, LastVisited } from "./progress-ids"

// Progress tracking, localStorage-only — no backend, no accounts. A learner's
// progress lives in the browser they used, which is the whole MVP: "visible
// tier completion and a last-visited continue button" (ROADMAP Up next #4),
// nothing more.
//
// One flat map of completed item ids rather than separate step/lesson
// collections: a lesson and a step are both just "a thing you can check off",
// and a single namespaced id (`step:<project>:<n>`, `lesson:<slug>`) lets
// every piece of UI — a tier row, a project's own header, a single marker —
// answer "how many of these ids are done" with the same function.
//
// Modeled as a module-level external store (useSyncExternalStore), the same
// pattern ThemeToggle already uses for the `dark` class: progress has to be
// readable from components that don't share a parent (the nav's CTA, a step
// marker three components down a server-rendered tree), and React context
// would need a client provider wrapping the whole app for what is, in the
// end, one object synced to localStorage.

const KEY = "gopath:progress:v1"
const EMPTY: ProgressData = { done: {} }

let cache: ProgressData = EMPTY
let hydrated = false
const listeners = new Set<() => void>()

function load(): ProgressData {
	if (typeof window === "undefined") return EMPTY
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return EMPTY
		const parsed = JSON.parse(raw)
		return {
			done:
				parsed.done && typeof parsed.done === "object" ? parsed.done : {},
			last: parsed.last,
		}
	} catch {
		return EMPTY
	}
}

function ensureHydrated() {
	if (hydrated || typeof window === "undefined") return
	cache = load()
	hydrated = true
}

function commit(next: ProgressData) {
	cache = next
	try {
		localStorage.setItem(KEY, JSON.stringify(cache))
	} catch {
		// Storage disabled or full: progress stays in memory for this load.
	}
	// The native `storage` event fires in other tabs only, never the tab that
	// made the change, so same-tab subscribers are notified by hand here.
	listeners.forEach((l) => l())
}

function subscribe(onChange: () => void) {
	ensureHydrated()
	listeners.add(onChange)
	const onStorage = (e: StorageEvent) => {
		if (e.key !== KEY) return
		cache = load()
		onChange()
	}
	window.addEventListener("storage", onStorage)
	return () => {
		listeners.delete(onChange)
		window.removeEventListener("storage", onStorage)
	}
}

function getSnapshot() {
	ensureHydrated()
	return cache
}

function getServerSnapshot() {
	return EMPTY
}

export function toggleDone(id: string) {
	ensureHydrated()
	const done = { ...cache.done }
	if (done[id]) delete done[id]
	else done[id] = true
	commit({ ...cache, done })
}

// Called on mount of a project or lesson page. Deliberately just "the page
// you were last on" rather than an inferred next-incomplete-step: that is
// what was asked for, and a wrong guess at "where you actually meant to
// resume" is worse than an honest last-visited link.
export function recordVisit(href: string, label: string) {
	ensureHydrated()
	commit({ ...cache, last: { href, label, at: Date.now() } })
}

export function useProgress() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
