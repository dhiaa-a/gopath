import { Concept } from "../../content"
// Fundamentals
import { errorHandling } from "./error-handling"
import { sentinelErrors } from "./sentinel-errors"
import { errorsJoin } from "./errors-join"
import { interfaces } from "./interfaces"
import { methodSets } from "./method-sets"
import { structs } from "./structs"
import { embedding } from "./embedding"
import { pointers } from "./pointers"
import { typedNil } from "./typed-nil"
import { nilConcept } from "./nil"
import { closures } from "./closures"
import { defer } from "./defer"
import { panicRecover } from "./panic-recover"
import { iota } from "./iota"
import { packages } from "./packages"
import { modules } from "./modules"
import { initLifecycle } from "./init-lifecycle"
// Data
import { slices } from "./slices"
import { sliceInternals } from "./slice-internals"
import { arraysVsSlices } from "./arrays-vs-slices"
import { valueSemantics } from "./value-semantics"
import { maps } from "./maps"
import { stringsBytesRunes } from "./strings-bytes-runes"
import { structTags } from "./struct-tags"
import { generics } from "./generics"
// Concurrency
import { goroutines } from "./goroutines"
import { scheduler } from "./scheduler"
import { channels } from "./channels"
import { bufferedChannels } from "./buffered-channels"
import { channelOwnership } from "./channel-ownership"
import { select } from "./select"
import { rateLimiting } from "./rate-limiting"
import { syncWaitgroup } from "./sync-waitgroup"
import { syncMutex } from "./sync-mutex"
import { syncOnce } from "./sync-once"
import { atomic } from "./atomic"
import { raceDetector } from "./race-detector"
import { memoryModel } from "./memory-model"
import { context } from "./context"
// Standard library
import { httpHandler } from "./http-handler"
import { httpClient } from "./http-client"
import { serverTimeouts } from "./server-timeouts"
import { gracefulShutdown } from "./graceful-shutdown"
import { slog } from "./slog"
import { secretsConfig } from "./secrets-config"
import { jsonDecode } from "./json-decode"
import { encodingJson } from "./encoding-json"
import { reflection } from "./reflection"
import { ioReaderWriter } from "./io-reader-writer"
import { bufio } from "./bufio"
import { time } from "./time"
// Testing and tooling
import { testing } from "./testing"
import { tableDrivenTests } from "./table-driven-tests"
import { benchmarks } from "./benchmarks"
import { fuzzing } from "./fuzzing"
import { pprof } from "./pprof"
import { escapeAnalysis } from "./escape-analysis"
import { gcTuning } from "./gc-tuning"
import { tooling } from "./tooling"
import { buildTags } from "./build-tags"

export const concepts: Concept[] = [
	// Fundamentals
	errorHandling,
	sentinelErrors,
	errorsJoin,
	interfaces,
	methodSets,
	structs,
	embedding,
	pointers,
	typedNil,
	nilConcept,
	closures,
	defer,
	panicRecover,
	iota,
	packages,
	modules,
	initLifecycle,
	// Data
	slices,
	sliceInternals,
	arraysVsSlices,
	valueSemantics,
	maps,
	stringsBytesRunes,
	structTags,
	generics,
	// Concurrency
	goroutines,
	scheduler,
	channels,
	bufferedChannels,
	channelOwnership,
	select,
	rateLimiting,
	syncWaitgroup,
	syncMutex,
	syncOnce,
	atomic,
	raceDetector,
	memoryModel,
	context,
	// Standard library
	httpHandler,
	httpClient,
	serverTimeouts,
	gracefulShutdown,
	slog,
	secretsConfig,
	jsonDecode,
	encodingJson,
	reflection,
	ioReaderWriter,
	bufio,
	time,
	// Testing and tooling
	testing,
	tableDrivenTests,
	benchmarks,
	fuzzing,
	pprof,
	escapeAnalysis,
	gcTuning,
	tooling,
	buildTags,
]
