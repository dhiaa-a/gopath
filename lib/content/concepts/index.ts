import { Concept } from "../../content"
import { errorHandling } from "./error-handling"
import { interfaces } from "./interfaces"
import { goroutines } from "./goroutines"
import { channels } from "./channels"
import { defer } from "./defer"
import { structs } from "./structs"
import { pointers } from "./pointers"
import { context } from "./context"
import { slices } from "./slices"
import { maps } from "./maps"
import { syncWaitgroup } from "./sync-waitgroup"
import { syncMutex } from "./sync-mutex"
import { raceDetector } from "./race-detector"
import { select } from "./select"
import { httpHandler } from "./http-handler"
import { serverTimeouts } from "./server-timeouts"
import { gracefulShutdown } from "./graceful-shutdown"
import { slog } from "./slog"
import { jsonDecode } from "./json-decode"
import { packages } from "./packages"

export const concepts: Concept[] = [
	errorHandling,
	interfaces,
	goroutines,
	channels,
	defer,
	structs,
	pointers,
	context,
	slices,
	maps,
	syncWaitgroup,
	syncMutex,
	raceDetector,
	select,
	httpHandler,
	serverTimeouts,
	gracefulShutdown,
	slog,
	jsonDecode,
	packages,
]
