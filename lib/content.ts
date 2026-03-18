export type LocalizedString = {
	en: string
	ar?: string
}

export type ContentBlock =
	| {
			type: "text"
			value: LocalizedString // Localized text content, e.g., { en: "Hello", ar: "مرحبا" }
	  }
	| {
			type: "code"
			value: string // The code content to display
			filename?: string // Optional filename for display, e.g., "main.go"
	  }
	| {
			type: "list"
			items: LocalizedString[]
	  }
	// Highlighted note or warning
	| {
			type: "callout"
			variant: "info" | "warning" // Determines style: info (neutral) or warning (caution)
			value: LocalizedString // Localized message for the callout
	  }
	// Conceptual + implementation block
	| {
			type: "structured"
			intent: LocalizedString // What this block aims to achieve (goal)
			concept: LocalizedString // Explanation of the underlying idea or principle
			implementation?: string // Optional code snippet implementing the concept
			filename?: string // Optional filename for the code snippet
	  }

export type Step = {
	n: string
	heading: LocalizedString
	blocks?: ContentBlock[]

	// legacy fallback
	body?: string
	code?: string
	filename?: string
}

export type ProjectMetaSection = {
	title: LocalizedString
	blocks: ContentBlock[]
}

export type Project = {
	slug: string
	name: string
	tagline: string
	code: string
	tier: 1 | 2 | 3
	tierLabel: string

	estimatedTime: string
	tags: string[]

	mentalModels?: string[]

	systemOverview?: ContentBlock[]
	architecture?: ContentBlock[]
	constraints?: ContentBlock[]
	recap?: ContentBlock[]

	steps: Step[]

	// legacy
	what?: string
	learn?: string[]
	fromOtherLang?: LocalizedString
}

export function t(val: LocalizedString, lang: string) {
	return val[lang as keyof LocalizedString] ?? val.en
}
