import { Concept } from "./content"
import { concepts } from "./content/concepts"

export type { Concept } from "./content"
export { concepts }

export function getConcept(slug: string): Concept | undefined {
	return concepts.find((c) => c.slug === slug)
}
