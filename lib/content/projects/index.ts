import { Project } from "../../content"
import { cliRenamer } from "./cli-renamer"
import { jsonFetcher } from "./json-fetcher"
import { logParser } from "./log-parser"
import { configWatcher } from "./config-watcher"
import { httpServer } from "./http-server"
import { workerPool } from "./worker-pool"
import { tcpEcho } from "./tcp-echo"
import { grpcService } from "./grpc-service"
import { dbApi } from "./db-api"
import { observability } from "./observability"

export const projects: Project[] = [
	// ─────────────────────────────────────────────────────────────────────────
	// TIER 1: FOUNDATIONS
	// Step type "pattern": show idiom skeleton + similar example + state task.
	// No assessment in P1/P2. Tests introduced in P3, benchmarks in P4.
	// ─────────────────────────────────────────────────────────────────────────

	cliRenamer,

	// ─────────────────────────────────────────────────────────────────────────

	jsonFetcher,

	// ─────────────────────────────────────────────────────────────────────────

	logParser,

	// ─────────────────────────────────────────────────────────────────────────

	configWatcher,

	// ─────────────────────────────────────────────────────────────────────────
	// TIER 2: SYSTEMS
	// Step type "requirement": what + why + stdlib/3rd-party hints.
	// Complex snippets only for non-obvious APIs.
	// Assessment required on every project.
	// ─────────────────────────────────────────────────────────────────────────

	httpServer,

	// ─────────────────────────────────────────────────────────────────────────

	workerPool,

	// ─────────────────────────────────────────────────────────────────────────

	tcpEcho,

	// ─────────────────────────────────────────────────────────────────────────
	// TIER 3: PRODUCTION
	// Step type "constraint": what must be true + rationale.
	// Assessment is a hard deliverable. Project is not done without it.
	// ─────────────────────────────────────────────────────────────────────────

	grpcService,

	// ─────────────────────────────────────────────────────────────────────────

	dbApi,

	// ─────────────────────────────────────────────────────────────────────────

	observability,
]
