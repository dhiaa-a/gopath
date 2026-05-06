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
): { conceptSlug: string; priorProjectSlug: string; priorStepN: string } | null {
	if (uses.length === 0) return null

	const currentIdx = projects.findIndex((p) => p.slug === currentProjectSlug)
	if (currentIdx <= 0) return null

	type Best = {
		conceptSlug: string
		priorProjectSlug: string
		priorStepN: string
		projectIdx: number
	}
	let best: Best | null = null

	for (const conceptSlug of uses) {
		for (const { projectSlug, stepN } of conceptToProjects(conceptSlug)) {
			const idx = projects.findIndex((p) => p.slug === projectSlug)
			if (idx < currentIdx && (best === null || idx > best.projectIdx)) {
				best = { conceptSlug, priorProjectSlug: projectSlug, priorStepN: stepN, projectIdx: idx }
			}
		}
	}

	if (!best) return null
	return {
		conceptSlug: best.conceptSlug,
		priorProjectSlug: best.priorProjectSlug,
		priorStepN: best.priorStepN,
	}
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
