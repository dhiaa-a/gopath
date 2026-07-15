export type LocalizedString = {
	en: string
}

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
	desiredMetrics?: string
	metricsAchievable?: string
	hints?: Hint[]
	// Repo-relative path to the real, runnable suite that this assessment
	// describes, e.g. "labs/log-parser". Validated by scripts/validate.ts.
	labPath?: string
}

// Every project ships an executable lab under labs/<slug>: a self-contained
// Go module the learner clones and runs with the standard toolchain.
export type ProjectLab = {
	// Repo-relative lab directory, always "labs/<slug>". Must exist on disk.
	path: string
	// The one command the learner runs from inside the lab directory.
	command: string
	// One sentence on what the lab checks. For T1 P1–P2 this must read as a
	// self-check, never as a graded exam (pedagogy rule 1).
	summary: LocalizedString
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
			pattern: string
			example: LocalizedString
			task: LocalizedString
			hints?: Hint[]
	  }
	// T2 — state requirement + why + stdlib / third-party hints, optional snippet for non-obvious APIs
	| {
			type: "requirement"
			what: LocalizedString
			why: LocalizedString
			stdlibHint?: string
			thirdPartyHint?: string
			complexSnippet?: string
			hints?: Hint[]
	  }
	// T3 — constraint only, systems thinking
	| {
			type: "constraint"
			what: LocalizedString
			rationale: LocalizedString
			hints?: Hint[]
	  }
	// Verify — the step's claim, made checkable. A step that builds something
	// ends by running something real, almost always in the project's lab.
	// Prose that cannot be run is not a verify block.
	| {
			type: "verify"
			// Exactly what to run, copy-pasteable, from the directory named in
			// `where`.
			command: string
			// Where the command runs. Usually the lab directory.
			where?: string
			// What you should see. Concrete: an exit code, a line of output, a
			// file that now exists.
			expect: LocalizedString
			// Repo path backing this check. Validated to exist on disk.
			labPath?: string
			note?: LocalizedString
	  }
	// Break it — cause one failure on purpose and watch it happen. The
	// learner predicts before revealing `why`, which is where the learning is:
	// a mechanism you predicted wrong is a mechanism you now remember.
	| {
			type: "breakIt"
			// The single thing to change. One line, reversible.
			change: LocalizedString
			// What they will see: the panic, the hang, the wrong number.
			observe: LocalizedString
			// The mechanism, revealed only after they have committed to a guess.
			why: LocalizedString
	  }
	| { type: "assessment"; assessment: Assessment }

export type Step = {
	n: string
	heading: LocalizedString
	uses: string[]
	blocks: ContentBlock[]
	// Recap, the closing beat of the step anatomy: one retrieval prompt in the
	// "question || answer" form the flip cards already use. A step field
	// rather than a block, so it always renders last and cannot drift up into
	// the middle of the step.
	retrievalPrompt?: string
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
	lab?: ProjectLab
	mentalModels?: string[]
	systemOverview?: ContentBlock[]
	architecture?: ContentBlock[]
	constraints?: ContentBlock[]
	recap?: ContentBlock[]
	steps: Step[]
}

export type Tier0Lesson = {
	slug: string
	order: number
	title: string
	tagline: string
	estimatedMinutes: number
	// Prose (and supporting snippets) before the program.
	intro: ContentBlock[]
	// The one runnable program the lesson is built around. Max 30 non-empty
	// lines, enforced by scripts/validate.ts. Rendered with a playground link.
	program: string
	// Prose after the program: what to notice, what to change, gotchas.
	after: ContentBlock[]
	retrievalPrompts: string[]
}

export type Concept = {
	slug: string
	name: string
	tagline: string
	summary: string
	mentalModel: string
	retrievalPrompts: string[]
	codeExample: string
	codeExplanation: string
	designRationale: string
	commonMistakes: { title: string; body: string }[]
	relatedSlugs: string[]
}

export function t(val: LocalizedString, lang: string) {
	return val[lang as keyof LocalizedString] ?? val.en
}
