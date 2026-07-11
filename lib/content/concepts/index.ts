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
import { select } from "./select"
import { httpHandler } from "./http-handler"
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
	select,
	httpHandler,
	jsonDecode,
	packages,
]
