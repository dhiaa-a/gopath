import { projects } from "./projects"

export function conceptToProjects(
	slug: string,
): { projectSlug: string; stepN: string }[] {
	const results: { projectSlug: string; stepN: string }[] = []
	for (const project of projects) {
		for (const step of project.steps) {
			if (step.uses.includes(slug)) {
				results.push({ projectSlug: project.slug, stepN: step.n })
			}
		}
	}
	return results
}

// For a step in the current project, find the single concept whose most
// recent prior appearance is the latest in the project list. Returns null
// when no concept in `uses` has appeared in any earlier project.
export function priorConceptOccurrence(
	currentProjectSlug: string,
	uses: string[],
): { conceptSlug: string; priorProjectSlug: string } | null {
	if (uses.length === 0) return null

	const currentIdx = projects.findIndex((p) => p.slug === currentProjectSlug)
	if (currentIdx <= 0) return null

	let best: { conceptSlug: string; priorProjectSlug: string; projectIdx: number } | null = null

	for (const conceptSlug of uses) {
		for (const { projectSlug } of conceptToProjects(conceptSlug)) {
			const idx = projects.findIndex((p) => p.slug === projectSlug)
			if (idx < currentIdx && (best === null || idx > best.projectIdx)) {
				best = { conceptSlug, priorProjectSlug: projectSlug, projectIdx: idx }
			}
		}
	}

	if (!best) return null
	return {
		conceptSlug: best.conceptSlug,
		priorProjectSlug: best.priorProjectSlug,
	}
}

// True when `slug` was already tagged on an earlier step, in path order,
// strictly before (projectSlug, stepN) — "earlier" meaning an earlier
// project in the array, or an earlier step number within the same one. Powers
// the concept chips' new-vs-seen-before distinction: a chip only counts as
// "new" the first time a learner could possibly have reached it.
export function seenBefore(
	slug: string,
	projectSlug: string,
	stepN: string,
): boolean {
	const targetIdx = projects.findIndex((p) => p.slug === projectSlug)
	for (let i = 0; i <= targetIdx; i++) {
		for (const step of projects[i].steps) {
			if (i === targetIdx && step.n >= stepN) break
			if (step.uses.includes(slug)) return true
		}
	}
	return false
}

export function projectToConcepts(slug: string): string[] {
	const project = projects.find((p) => p.slug === slug)
	if (!project) return []

	const seen = new Set<string>()
	const result: string[] = []

	for (const step of project.steps) {
		for (const conceptSlug of step.uses) {
			if (!seen.has(conceptSlug)) {
				seen.add(conceptSlug)
				result.push(conceptSlug)
			}
		}
	}

	return result
}
