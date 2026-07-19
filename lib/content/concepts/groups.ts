// How the concept index is grouped. This is an editorial judgement, not
// something derivable from the Concept type, so it is a hand-curated list.
//
// It lives in lib/ rather than in the page because scripts/validate.ts holds
// it to the one property that must be true: every concept appears in exactly
// one group. The index renders only what is listed here, so a concept missing
// from it is a page that exists and that nothing on /concepts links to.
// Presentation (the colour per group) stays in app/concepts/page.tsx.
export type ConceptGroup = {
	label: string
	slugs: string[]
}

export const conceptGroups: ConceptGroup[] = [
	{
		label: "Fundamentals",
		slugs: [
			"error-handling",
			"sentinel-errors",
			"errors-join",
			"interfaces",
			"method-sets",
			"structs",
			"embedding",
			"pointers",
			"typed-nil",
			"nil",
			"closures",
			"defer",
			"panic-recover",
			"iota",
			"packages",
			"modules",
			"init-lifecycle",
		],
	},
	{
		label: "Data",
		slugs: [
			"slices",
			"slice-internals",
			"arrays-vs-slices",
			"value-semantics",
			"maps",
			"strings-bytes-runes",
			"struct-tags",
			"generics",
			"iterators",
		],
	},
	{
		label: "Concurrency",
		slugs: [
			"goroutines",
			"scheduler",
			"channels",
			"buffered-channels",
			"channel-ownership",
			"select",
			"rate-limiting",
			"sync-waitgroup",
			"sync-mutex",
			"sync-once",
			"atomic",
			"race-detector",
			"memory-model",
			"context",
		],
	},
	{
		label: "Standard library",
		slugs: [
			"http-handler",
			"http-client",
			"server-timeouts",
			"graceful-shutdown",
			"slog",
			"secrets-config",
			"json-decode",
			"encoding-json",
			"reflection",
			"io-reader-writer",
			"bufio",
			"time",
		],
	},
	{
		label: "Testing and tooling",
		slugs: [
			"testing",
			"table-driven-tests",
			"benchmarks",
			"fuzzing",
			"pprof",
			"escape-analysis",
			"gc-tuning",
			"tooling",
			"build-tags",
		],
	},
]
