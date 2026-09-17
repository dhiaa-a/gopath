// Every concept is supposed to earn its place by teaching a project step
// something — that's the whole point of the concept↔project chips. These are
// the ones that genuinely don't: real Go topics with no anchor-project moment
// that teaches them, rather than an oversight in tagging step.uses.
//
// scripts/validate.ts holds this to the same rule the capstone's blind spots
// use: every concept is in exactly one of "used by a step" or this list,
// never both and never neither. Reference-only entries the moment a step
// picks the concept up for real, so this list only ever shrinks.
export const REFERENCE_ONLY_CONCEPTS: { slug: string; reason: string }[] = [
	{
		slug: "nil",
		reason: "A survey across six types; typed-nil, its sharpest edge, has its own project step (config-watcher), but the survey itself isn't any one step's subject.",
	},
	{
		slug: "panic-recover",
		reason: "Panic shows up as something the runtime does to a learner's program (config-watcher, tcp-echo); no anchor project has a step where recover() is the thing being written.",
	},
	{
		slug: "iota",
		reason: "No anchor project defines a const block shaped like an enum, so iota never comes up in real code.",
	},
	{
		slug: "modules",
		reason: "go.mod and the toolchain are covered on the orientation setup page, not inside a project's own lesson content.",
	},
	{
		slug: "init-lifecycle",
		reason: "No anchor project depends on init() or on package-variable initialisation order.",
	},
	{
		slug: "slice-internals",
		reason: "Slices are everywhere; the pointer/length/capacity header itself is never the thing a step stops to explain.",
	},
	{
		slug: "arrays-vs-slices",
		reason: "Every anchor project reaches straight for a slice; a fixed-size array never appears as a deliberate choice to contrast against one.",
	},
	{
		slug: "value-semantics",
		reason: "Assumed throughout rather than taught — no step's actual subject is copy-vs-reference.",
	},
	{
		slug: "iterators",
		reason: "Go 1.23's range-over-func doesn't appear in any anchor project's code.",
	},
	{
		slug: "scheduler",
		reason: "GOMAXPROCS surfaces inside a benchmarking aside (config-watcher), but no step teaches the G/M/P model itself.",
	},
	{
		slug: "reflection",
		reason: "encoding/json uses it under the hood (json-fetcher), but no anchor project calls the reflect package directly.",
	},
	{
		slug: "fuzzing",
		reason: "None of the anchor projects' test suites use go test -fuzz.",
	},
	{
		slug: "gc-tuning",
		reason: "observability fixes an allocation, not a collector setting; no step adjusts GOGC or GOMEMLIMIT.",
	},
	{
		slug: "build-tags",
		reason: "//go:build lines gate every lab's own starter/solution split, but no step's prose explains the mechanism to the learner — it's infrastructure they benefit from, not read.",
	},
]
