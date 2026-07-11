import { Project } from "./content"
import { projects } from "./content/projects"

export { projects }

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug)
}

export function getProjectsByTier(tier: 1 | 2 | 3): Project[] {
	return projects.filter((p) => p.tier === tier)
}
