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
