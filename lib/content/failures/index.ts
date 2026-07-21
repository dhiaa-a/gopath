import { Failure, FailureCategory } from "../../content"
// Concurrency
import { deadlock } from "./deadlock"
import { goroutineLeak } from "./goroutine-leak"
import { ctxIgnored } from "./ctx-ignored"
import { wgAddAfterWait } from "./wg-add-after-wait"
import { dataRace } from "./data-race"
import { mutexByValue } from "./mutex-by-value"
import { timeAfterLeak } from "./time-after-leak"
// Memory and aliasing
import { sliceAliasing } from "./slice-aliasing"
import { appendSharing } from "./append-sharing"
// Language semantics
import { loopCapture } from "./loop-capture"
import { typedNil } from "./typed-nil"
import { nilMapWrite } from "./nil-map-write"
import { bytesVsRunes } from "./bytes-vs-runes"
// Standard library
import { jsonSilentZero } from "./json-silent-zero"
import { deferInLoop } from "./defer-in-loop"

// Render order of the category groups on /failures. validate.ts holds every
// failure's category to this list.
export const failureCategories: FailureCategory[] = [
	"Concurrency",
	"Memory and aliasing",
	"Language semantics",
	"Standard library",
]

export const failures: Failure[] = [
	// Concurrency
	deadlock,
	goroutineLeak,
	ctxIgnored,
	wgAddAfterWait,
	dataRace,
	mutexByValue,
	timeAfterLeak,
	// Memory and aliasing
	sliceAliasing,
	appendSharing,
	// Language semantics
	loopCapture,
	typedNil,
	nilMapWrite,
	bytesVsRunes,
	// Standard library
	jsonSilentZero,
	deferInLoop,
]
