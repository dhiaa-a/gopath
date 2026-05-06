export type Hint = {
	label: string
	value: string
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
	desiredMetrics?: String
	metricsAchievable?: string // censored metrics for grounded truths
	hints?: Hint[]
}

export type ContentBlock =
	| {
			type: "text"
			value: string
	  }
	| {
			type: "code"
			value: string // The code content to display
			filename?: string // Optional filename for display, e.g., "main.go"
	  }
	| {
			type: "list"
			items: string[]
	  }
	// Highlighted note or warning
	| {
			type: "callout"
			variant: "info" | "warning" // Determines style: info (neutral) or warning (caution)
			value: string
	  }
	// T1 Project Structure: show patterns + similar examples, state the task
	| {
			type: "pattern"
			concept: string
			pattern: string
			example: string
			task: string
			hints?: Hint[]
	  }
	// T2 Project Structure: state requirements, list needed libraries, code snippets for non-obvious parts
	| {
			type: "requirement"
			what: string
			why: string
			stdlibHint?: string
			thirdPartyHint?: string
			complexSnippet?: string
			hints?: Hint[]
	  }
	// T3 Project Structure: provide constraints, motivate thinking in systems
	| {
			type: "constraint"
			what: string
			rationale: string
			hints?: Hint[]
	  }
	| {
			type: "assessment"
			assessment: Assessment
	  }
	// Conceptual + implementation block
	| {
			type: "structured"
			intent: string // What this block aims to achieve (goal)
			concept: string // Explanation of the underlying idea or principle
			implementation?: string // Optional code snippet implementing the concept
			filename?: string // Optional filename for the code snippet
	  }

export type Step = {
	n: string
	heading: string
	uses: string[] // concept slugs applied in this step
	blocks?: ContentBlock[]
}

export type ProjectMetaSection = {
	title: string
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
}
