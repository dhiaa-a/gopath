import { IdiomAccent, IdiomExercise } from "../content"

// Render order of the accent groups on /idioms. validate.ts holds every
// exercise's accent to this list.
export const idiomAccents: IdiomAccent[] = [
	"Java",
	"Python",
	"C",
	"Any language",
]

// The linters listed per exercise are the ones registered in
// labs/idioms/check.sh, which asserts they actually fire on the starter.
// validate.ts cross-checks this file against that registration.
export const idioms: IdiomExercise[] = [
	{
		slug: "getters-and-factories",
		name: "Getters and factories",
		accent: "Java",
		tagline:
			"A lending catalog written as a Java class hierarchy: an interface, a factory, and an accessor suite all mirroring one struct.",
		mistakes: [
			"Getter/setter pairs where fields or behavior belong",
			"An interface whose only job is mirroring its single struct",
			"A factory type where Go wants a function, with a stuttering name",
			"Receivers named this, and pointer/value receivers mixed on one type",
			"XxxError names and sentence-case error strings",
			"Dead ceremony kept because the class felt incomplete without it",
		],
		linters: ["iface", "recvcheck", "revive", "staticcheck", "unused"],
		labPath: "labs/idioms/getters-and-factories",
		suggestedAfter: "T1 P3",
	},
	{
		slug: "panic-as-control-flow",
		name: "Panic as control flow",
		accent: "Python",
		tagline:
			"A parser that raises: panics internally, recovers at the boundary, and calls that error handling.",
		mistakes: [
			"panic as the error channel, recover as the except block",
			"Error identity destroyed by the panic/recover round trip",
			"else-after-return pyramids instead of a flat happy path",
			"Sentinels and %w wrapping missing where callers need them",
			"Contracts written in prose: doc comments that say panics if where the signature should say (T, error)",
		],
		linters: ["forbidigo", "revive"],
		labPath: "labs/idioms/panic-as-control-flow",
		suggestedAfter: "T1 P3",
	},
	{
		slug: "stringly-typed",
		name: "Stringly typed",
		accent: "Python",
		tagline:
			"An order state machine where every status is a raw string and one typo away from inventing a new state.",
		mistakes: [
			"Raw strings where a named type belongs",
			"The same literal repeated until a typo becomes a state",
			"Validity rules scattered across call sites instead of one table",
			"String comparisons doing the work of the type system",
		],
		linters: ["goconst", "gocritic"],
		labPath: "labs/idioms/stringly-typed",
		suggestedAfter: "T1 P3",
	},
	{
		slug: "index-juggling",
		name: "Index juggling",
		accent: "C",
		tagline:
			"Byte processing transliterated from C: manual index loops, shadowed builtins, and conversions nobody needed.",
		mistakes: [
			"for i := 0; i < len(x); i++ where range belongs",
			"Locals named len, min, and max shadowing the builtins",
			"Type conversions the type system already performs",
			"Manual index bookkeeping the compiler would own under range",
		],
		linters: [
			"intrange",
			"unconvert",
			"modernize",
			"ineffassign",
			"predeclared",
		],
		labPath: "labs/idioms/index-juggling",
		suggestedAfter: "T1 P3",
	},
	{
		slug: "reinvented-stdlib",
		name: "Reinvented stdlib",
		accent: "C",
		tagline:
			"A log sanitizer that hand-rolls TrimPrefix, Contains, max, and copy. Correctly. And slower.",
		mistakes: [
			"Reimplementing strings, slices, and builtin helpers by hand",
			"fmt.Sprintf where strconv already does the job",
			"Manual copy loops where copy() states the intent",
			"Not checking pkg.go.dev before building it yourself",
		],
		linters: ["staticcheck", "modernize", "perfsprint"],
		labPath: "labs/idioms/reinvented-stdlib",
		suggestedAfter: "T1 P3",
	},
	{
		slug: "interface-bloat",
		name: "Interface bloat",
		accent: "Any language",
		tagline:
			"One eight-method Storage interface that every consumer drags around to call two or three of them.",
		mistakes: [
			"Provider-defined interfaces instead of consumer-defined ones",
			"An interface past five methods that no consumer uses whole",
			"Errors relayed naked through interface plumbing",
			"Fakes forced to implement methods the test never touches",
		],
		linters: ["interfacebloat", "wrapcheck"],
		labPath: "labs/idioms/interface-bloat",
		suggestedAfter: "T2 P1",
	},
	{
		slug: "unowned-goroutines",
		name: "Unowned goroutines",
		accent: "Any language",
		tagline:
			"A batch processor that fires goroutines, sleeps 250 milliseconds, and hopes.",
		mistakes: [
			"go statements whose errors vanish into the void",
			"time.Sleep as a synchronization primitive",
			"Goroutines with no owner, no Wait, and no lifecycle",
			"An error return that is decorative because nothing feeds it",
		],
		linters: ["errcheck", "forbidigo"],
		labPath: "labs/idioms/unowned-goroutines",
		suggestedAfter: "T2 P2",
	},
	{
		slug: "any-soup",
		name: "Any soup",
		accent: "Any language",
		tagline:
			"A metrics registry built on map[string]interface{} and the naked type assertions holding it together.",
		mistakes: [
			"interface{} as a type-system escape hatch",
			"Naked type assertions with no comma-ok",
			"Structure the compiler cannot see and cannot defend",
			"Renaming interface{} to any and calling that a fix",
		],
		linters: ["forcetypeassert", "revive"],
		labPath: "labs/idioms/any-soup",
		suggestedAfter: "T2 P3",
	},
	{
		slug: "errors-without-context",
		name: "Errors without context",
		accent: "Any language",
		tagline:
			"Errors relayed naked through three layers until the caller learns a strconv call failed, somewhere.",
		mistakes: [
			"if err != nil { return err } as a reflex instead of a decision",
			"err == sentinel where errors.Is belongs",
			"%v wrapping that flattens the chain %w would keep",
			"errors.New(fmt.Sprintf(...)) instead of fmt.Errorf",
		],
		linters: ["wrapcheck", "errorlint", "revive"],
		labPath: "labs/idioms/errors-without-context",
		suggestedAfter: "T1 P4",
	},
	{
		slug: "package-sprawl",
		name: "Package sprawl",
		accent: "Any language",
		tagline:
			"A 150-line snippet manager spread across four packages, stutter included.",
		mistakes: [
			"Package-per-layer habits imported from Java and Python",
			"Names that stutter because the boundary was premature",
			"Exports that exist only because another package needs them",
			"Boundaries added before anything hurt",
		],
		linters: ["iface", "revive", "wrapcheck"],
		labPath: "labs/idioms/package-sprawl",
		suggestedAfter: "T2 P1",
	},
]
