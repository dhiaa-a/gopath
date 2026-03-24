export type LocalizedString = {
	en: string
}

export type Hint = {
	label: string // short label shown on the toggle button
	value: string // revealed when clicked
}

export type TestCase = {
	description: string
	input?: string
	expected: string
}

export type Assessment = {
	kind: "unit" | "benchmark" | "integration" | "system" | "metrics"
	title: string
	description: string
	testCases?: TestCase[]
	desiredOutput?: string
	desiredMetrics?: string
	metricsAchievable?: string // shown only when user reveals it
	hints?: Hint[]
}

export type ContentBlock =
	| { type: "text"; value: LocalizedString }
	| { type: "code"; value: string; filename?: string }
	| { type: "list"; items: LocalizedString[] }
	| { type: "callout"; variant: "info" | "warning"; value: LocalizedString }
	// T1 — show pattern skeleton + similar example, state the task
	| {
			type: "pattern"
			concept: LocalizedString
			pattern: string // minimal generic code showing the idiom shape
			example: LocalizedString // brief description of a similar solved case
			task: LocalizedString // what the learner must build for THIS project
			hints?: Hint[]
	  }
	// T2 — state requirement + why + stdlib / third-party hints, optional snippet for non-obvious APIs
	| {
			type: "requirement"
			what: LocalizedString
			why: LocalizedString
			stdlibHint?: string
			thirdPartyHint?: string
			complexSnippet?: string // only for genuinely non-obvious APIs
			hints?: Hint[]
	  }
	// T3 — constraint only, systems thinking
	| {
			type: "constraint"
			what: LocalizedString
			rationale: LocalizedString
			hints?: Hint[]
	  }
	// Assessment — attached to a step
	| { type: "assessment"; assessment: Assessment }

export type Step = {
	n: string
	heading: LocalizedString
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
	recap?: ContentBlock[]
	steps: Step[]
}

export function t(val: LocalizedString, lang: string) {
	return val[lang as keyof LocalizedString] ?? val.en
}
