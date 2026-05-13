import { ContentBlock } from "./content"

export type OrientationPage = {
	slug: string
	order: number
	title: string
	tagline: string
	estimatedMinutes: number
	blocks: ContentBlock[]
	// Only ready-check uses these; left undefined elsewhere.
	retrievalPrompts?: string[]
	cta?: { href: string; label: string }
}

export const orientationPages: OrientationPage[] = [
	{
		slug: "what-is-go",
		order: 1,
		title: "Is Go right for you right now?",
		tagline:
			"What Go is built for, what it isn't, and how to know if it's the right tool for the work you actually do.",
		estimatedMinutes: 4,
		blocks: [],
	},
	{
		slug: "reading-go",
		order: 2,
		title: "What Go code looks like",
		tagline:
			"A short annotated program — not a syntax tutorial. What to notice before you start writing it.",
		estimatedMinutes: 6,
		blocks: [],
	},
	{
		slug: "surprises",
		order: 3,
		title: "Five things that will surprise you",
		tagline:
			"Design decisions that will trip you up if you're coming from another language.",
		estimatedMinutes: 7,
		blocks: [],
	},
	{
		slug: "setup",
		order: 4,
		title: "Install Go and run your first program",
		tagline:
			"Get Go installed, write a 5-line program, run it. No project structure, no frameworks.",
		estimatedMinutes: 8,
		blocks: [],
	},
	{
		slug: "learn-syntax",
		order: 5,
		title: "Where to learn Go syntax",
		tagline:
			"Two official resources, when to use each, and a checklist for when you're ready to leave.",
		estimatedMinutes: 4,
		blocks: [],
	},
	{
		slug: "ready-check",
		order: 6,
		title: "Are you ready for Tier 1?",
		tagline:
			"Five retrieval prompts. If you can answer all of them without looking, you're ready.",
		estimatedMinutes: 5,
		blocks: [],
	},
]

export function getOrientationPage(slug: string): OrientationPage | undefined {
	return orientationPages.find((p) => p.slug === slug)
}
