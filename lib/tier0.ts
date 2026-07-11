import { Tier0Lesson } from "./content"
import { tier0Lessons } from "./content/tier0"

export type { Tier0Lesson } from "./content"
export { tier0Lessons }

export function getTier0Lesson(slug: string): Tier0Lesson | undefined {
	return tier0Lessons.find((l) => l.slug === slug)
}
