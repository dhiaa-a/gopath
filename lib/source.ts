// Thin shim over lib/content/source, matching the convention used by
// lib/projects.ts, lib/concepts.ts, lib/failures.ts and lib/idioms.ts.
export {
	sourceWalkthroughs,
	getWalkthrough,
	walkthroughsForConcept,
	walkthroughsForProject,
	goSourceVersion,
	goSourceLicense,
} from "./content/source"
