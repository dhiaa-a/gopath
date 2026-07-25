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

// ─── Failure labs (Phase 5: scar tissue) ────────────────────────────────────
//
// A failure lab is a program under labs/failures/<slug> that compiles and
// looks plausible but is broken, plus SYMPTOM.md written the way an on-call
// engineer would report it. The site page's job is the diagnostic PATH, not
// the answer: symptom, which tool to reach for, what the tool says, and only
// then the fix. "How this shows up in production" renders behind a reveal.

export type FailureCategory =
	| "Concurrency"
	| "Memory and aliasing"
	| "Language semantics"
	| "Standard library"

// One beat of the diagnosis: something you run or read, and what it tells
// you. `command` and `output` are rendered as code, so prose never has to
// smuggle terminal text.
export type FailureStep = {
	title: string
	// HTML prose (inline <code> allowed), rendered via dangerouslySetInnerHTML.
	body: string
	command?: string
	// Real observed output, pasted from an actual run. Never invented.
	output?: string
}

export type Failure = {
	slug: string
	name: string
	category: FailureCategory
	tagline: string
	// The report as it arrives: what the user or on-call engineer sees,
	// before anyone knows the cause. HTML.
	symptom: string
	// Always "labs/failures/<slug>". Validated to exist on disk with go.mod,
	// SYMPTOM.md, main.go (build tag !fixed) and fixed.go (build tag fixed).
	labPath: string
	// Copy-pasteable reproduction, run from inside the lab directory.
	runCommand: string
	// The tools this failure teaches, in the order you actually reach for
	// them. Rendered as a "reach for" list before the diagnosis.
	tools: string[]
	diagnosis: FailureStep[]
	// The fix and why it is the fix, ending with how to prove it: the lab's
	// fixed variant (go run -tags fixed .). HTML.
	fix: string
	// How this exact bug looks in production, where it is never this clean.
	// Rendered behind a reveal interaction. HTML.
	production: string
	// The one sentence you keep after the tab is closed.
	scar: string
	relatedSlugs: string[]
	// Suggested tier before which this lab will read as noise. A suggestion
	// only: failure labs never gate anything (pedagogy rule 4).
	unlockTier: 1 | 2 | 3
}

// ─── Idiom exercises (Phase 6: accent removal) ──────────────────────────────
//
// An idiom exercise is working-but-unidiomatic code under labs/idioms/<slug>
// with a green test suite. The learner refactors until the tests stay green
// AND the shared strict linter (labs/idioms/.golangci.yml) comes up clean.
// The teaching artifact is in-repo: REVIEW.md walks each smell to its idiom
// the way a senior reviewer would. The site's job is discovery: name the
// accent, name the exact mistakes, point at the directory.

export type IdiomAccent = "Java" | "Python" | "C" | "Any language"

export type IdiomExercise = {
	slug: string
	name: string
	accent: IdiomAccent
	// One sentence: what the starter is and why it is foreign.
	tagline: string
	// The exact mistakes the exercise trains against (the brief's done-when
	// requires naming them). Rendered as the card's list.
	mistakes: string[]
	// The linters that fire on the starter, as registered in
	// labs/idioms/check.sh. Kept in sync by validate.ts.
	linters: string[]
	// Always "labs/idioms/<slug>". Validated to exist on disk with go.mod,
	// README.md, REVIEW.md, solution.go and a test file.
	labPath: string
	// Suggested earliest point on the path, e.g. "T1 P3". A suggestion
	// only: idiom exercises never gate anything (pedagogy rule 4).
	suggestedAfter: string
}

// ─── Source reading (Phase 7: reading the standard library) ─────────────────
//
// Professionals read code; almost nothing teaches it. A walkthrough takes one
// real stdlib file and reads it the way an experienced Go programmer would:
// where to enter, what to skip, what to notice, and what the code is defending
// against. The excerpts are quoted verbatim from the reader's OWN toolchain,
// and labs/source/check.sh proves it: every excerpt must be found byte-for-byte,
// exactly once, at the line this content claims. Line numbers here are measured,
// never asserted from memory, and the harness reports drift when Go moves on.

// One beat of the read: a real excerpt plus what an experienced reader sees in
// it. The pair is the unit; an excerpt with no commentary is just a paste.
export type SourceExcerpt = {
	// GOROOT-relative path, e.g. "src/sync/waitgroup.go".
	file: string
	// A short heading for this beat, e.g. "The state word".
	title: string
	// Verbatim from GOROOT at the pinned Go version. Never retyped, never
	// reflowed, never elided mid-block: the harness searches for this exact
	// string, so a single changed character or a tab turned into spaces is a
	// failure. That strictness is the point, it is what makes the quote
	// trustworthy.
	code: string
	// 1-indexed start line, as MEASURED by scripts/source-check.ts rather than
	// claimed. Stored so the site can render line numbers without needing a Go
	// toolchain at build time (the deploy has none).
	startLine: number
	// What to notice, and why it is there. HTML prose (inline <code> allowed).
	notice: string
}

// The brief's requirement: one exercise per walkthrough, answerable only by
// opening the source. "Find the exact line where http.Server decides to spawn a
// goroutine per connection" is the shape.
export type SourceExercise = {
	question: string
	// A real command that starts the search on the reader's own machine.
	command: string
	// The answer, rendered behind a reveal so the reader searches first. HTML.
	answer: string
	// The identifier the answer turns on, asserted to exist in `file` by the
	// harness. Without this an answer can quietly rot into a lie when the
	// stdlib is refactored.
	answerAnchor: { file: string; needle: string }
}

export type SourceWalkthrough = {
	slug: string
	// The thing being read, as a Go programmer would name it: "sync.WaitGroup".
	name: string
	// Import path of the package, e.g. "sync" or "net/http".
	pkg: string
	tagline: string
	// Why this file repays reading, and which reading skill it trains. HTML.
	why: string
	// The file to open first, GOROOT-relative.
	entryFile: string
	// How to open it on the reader's own machine. A real, copy-pasteable
	// command, not a description of one.
	openCommand: string
	// How the file is laid out, before any excerpt: what to skip, where the
	// real work is. Orientation is most of what a senior reader has and a
	// junior one does not. HTML.
	orientation: string
	excerpts: SourceExcerpt[]
	exercise: SourceExercise
	// The one sentence you keep after the tab is closed.
	takeaway: string
	relatedConcepts: string[]
	relatedProjects: string[]
	// Failure labs that this file explains, e.g. reading WaitGroup's counter
	// after meeting wg-add-after-wait.
	relatedFailures?: string[]
	// Suggested point on the path before which this read is noise. A
	// suggestion only: source reading never gates anything (pedagogy rule 4).
	unlockTier: 1 | 2 | 3
	// Reading order on the index page, ascending.
	order: number
}

export function t(val: LocalizedString, lang: string) {
	return val[lang as keyof LocalizedString] ?? val.en
}
