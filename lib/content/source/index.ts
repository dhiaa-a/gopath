import { SourceWalkthrough } from "../../content"

import { bytesBuffer } from "./bytes-buffer"
import { contextPackage } from "./context"
import { errorsPackage } from "./errors"
import { syncWaitgroup } from "./sync-waitgroup"

/**
 * The toolchain every excerpt on these pages was measured against.
 *
 * Line numbers move between Go releases, so the version is part of the claim,
 * not a footnote. scripts/source-check.ts refuses to run against a different
 * toolchain rather than reporting drift it cannot distinguish from a mistake.
 * When Go moves, re-measure and move this pin in the same commit.
 */
export const goSourceVersion = "go1.23.12"

/**
 * Site-wide attribution for the quoted standard library code. The brief asks
 * for this once; it renders on the /source index and every walkthrough links
 * back to it.
 */
export const goSourceLicense = {
	notice: "Copyright (c) 2009 The Go Authors. All rights reserved.",
	license: "BSD 3-Clause",
	url: "https://go.dev/LICENSE",
}

export const sourceWalkthroughs: SourceWalkthrough[] = [
	errorsPackage,
	bytesBuffer,
	syncWaitgroup,
	contextPackage,
].sort((a, b) => a.order - b.order)

export function getWalkthrough(slug: string): SourceWalkthrough | undefined {
	return sourceWalkthroughs.find((w) => w.slug === slug)
}

/** Walkthroughs that read code behind a given concept. */
export function walkthroughsForConcept(conceptSlug: string): SourceWalkthrough[] {
	return sourceWalkthroughs.filter((w) => w.relatedConcepts.includes(conceptSlug))
}

/** Walkthroughs worth reading alongside a given project. */
export function walkthroughsForProject(projectSlug: string): SourceWalkthrough[] {
	return sourceWalkthroughs.filter((w) => w.relatedProjects.includes(projectSlug))
}
