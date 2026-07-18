import { Concept } from "../../content"
import { errorHandling } from "./error-handling"
import { sentinelErrors } from "./sentinel-errors"
import { interfaces } from "./interfaces"
import { goroutines } from "./goroutines"
import { channels } from "./channels"
import { bufferedChannels } from "./buffered-channels"
import { channelOwnership } from "./channel-ownership"
import { defer } from "./defer"
import { panicRecover } from "./panic-recover"
import { structs } from "./structs"
import { embedding } from "./embedding"
import { pointers } from "./pointers"
import { typedNil } from "./typed-nil"
import { context } from "./context"
import { slices } from "./slices"
import { sliceInternals } from "./slice-internals"
import { arraysVsSlices } from "./arrays-vs-slices"
import { maps } from "./maps"
import { stringsBytesRunes } from "./strings-bytes-runes"
import { structTags } from "./struct-tags"
import { generics } from "./generics"
import { syncWaitgroup } from "./sync-waitgroup"
import { syncMutex } from "./sync-mutex"
import { syncOnce } from "./sync-once"
import { atomic } from "./atomic"
import { raceDetector } from "./race-detector"
import { memoryModel } from "./memory-model"
import { select } from "./select"
import { httpHandler } from "./http-handler"
import { httpClient } from "./http-client"
import { serverTimeouts } from "./server-timeouts"
import { gracefulShutdown } from "./graceful-shutdown"
import { slog } from "./slog"
import { jsonDecode } from "./json-decode"
import { encodingJson } from "./encoding-json"
import { ioReaderWriter } from "./io-reader-writer"
import { bufio } from "./bufio"
import { time } from "./time"
import { packages } from "./packages"
import { modules } from "./modules"
import { initLifecycle } from "./init-lifecycle"
import { testing } from "./testing"
import { tableDrivenTests } from "./table-driven-tests"
import { benchmarks } from "./benchmarks"
import { fuzzing } from "./fuzzing"
import { pprof } from "./pprof"
import { escapeAnalysis } from "./escape-analysis"
import { tooling } from "./tooling"

export const concepts: Concept[] = [
	// Fundamentals
	errorHandling,
	sentinelErrors,
	interfaces,
	structs,
	embedding,
	pointers,
	typedNil,
	packages,
	modules,
	initLifecycle,
	// Data
	slices,
	sliceInternals,
	arraysVsSlices,
	maps,
	stringsBytesRunes,
	structTags,
	generics,
	// Concurrency
	goroutines,
	channels,
	bufferedChannels,
	channelOwnership,
	select,
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
	jsonDecode,
	encodingJson,
	ioReaderWriter,
	bufio,
	defer,
	panicRecover,
	time,
	// Testing and tooling
	testing,
	tableDrivenTests,
	benchmarks,
	fuzzing,
	pprof,
	escapeAnalysis,
	tooling,
]
