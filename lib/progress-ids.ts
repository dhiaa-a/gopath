// Pure id/type helpers, deliberately split out of lib/progress.ts. That file
// is "use client" (it touches localStorage and React hooks), which makes
// every one of its exports a client-only reference — including id builders
// that have no browser dependency at all. Server components (the homepage,
// the basics index) need to build id arrays like `stepId(project.slug, n)`
// to pass into <ProgressBadge>, and calling a client-tagged function from a
// server component is a build error, not just a lint warning.

export type LastVisited = { href: string; label: string; at: number }
export type ProgressData = {
	done: Record<string, true>
	last?: LastVisited
}

export function stepId(projectSlug: string, stepN: string) {
	return `step:${projectSlug}:${stepN}`
}

export function lessonId(slug: string) {
	return `lesson:${slug}`
}

export function countDone(data: ProgressData, ids: string[]) {
	return ids.filter((id) => !!data.done[id]).length
}
