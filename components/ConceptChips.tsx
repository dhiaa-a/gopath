"use client"
import { useState } from "react"
import Link from "next/link"
import { getConcept } from "@/lib/concepts"
import { seenBefore } from "@/lib/relations"
import { localePath, localizeHtml, toLang, ui } from "@/lib/i18n"
import { stepId, useProgress } from "@/lib/progress"
import { Disclosure } from "./Disclosure"

// One chip per concept a step uses, answering the question the concept pages
// used to leave to a "See it in practice" list capped at three: which of
// these have I met before, and which is new right now. Clicking a chip opens
// its mental model in place — the point is staying on the step, not losing
// your position in the project to go read a whole other page.
function ChipRow({
	slugs,
	projectSlug,
	stepN,
	lang,
}: {
	slugs: string[]
	projectSlug: string
	stepN: string
	lang: string
}) {
	const [open, setOpen] = useState<string | null>(null)
	const L = toLang(lang)
	const tr = ui(L)
	const lp = (href: string) => localePath(href, L)
	const openConcept = open ? getConcept(open) : null

	return (
		<div>
			<div className="flex flex-wrap gap-1.5">
				{slugs.map((slug) => {
					const concept = getConcept(slug)
					if (!concept) return null
					const seen = seenBefore(slug, projectSlug, stepN)
					const isOpen = open === slug
					return (
						<button
							key={slug}
							type="button"
							onClick={() => setOpen(isOpen ? null : slug)}
							aria-expanded={isOpen}
							aria-label={`${concept.name}, ${seen ? tr.common.seenConcept : tr.common.newConcept}`}
							className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
								isOpen
									? "border-go-cyan bg-go-cyan/10 text-go-cyan"
									: seen
										? "border-border bg-surface text-muted hover:border-go-cyan/40 hover:text-go-cyan"
										: "border-go-cyan/30 bg-go-cyan/5 text-go-cyan hover:bg-go-cyan/10"
							}`}
						>
							{!seen && (
								<span
									aria-hidden="true"
									className="h-1.5 w-1.5 shrink-0 rounded-full bg-go-cyan"
								/>
							)}
							{concept.name}
						</button>
					)
				})}
			</div>
			{openConcept && (
				<div className="mt-2 rounded-lg border border-go-cyan/20 bg-go-cyan/5 p-4">
					<p
						className="text-sm leading-relaxed text-muted"
						dangerouslySetInnerHTML={{
							__html: localizeHtml(openConcept.mentalModel, L),
						}}
					/>
					<Link
						href={lp(`/concepts/${openConcept.slug}`)}
						className="mt-2 inline-block font-mono text-xs text-go-cyan hover:underline"
					>
						{tr.common.fullConceptPage} →
					</Link>
				</div>
			)}
		</div>
	)
}

export function ConceptChips({
	slugs,
	projectSlug,
	stepN,
	tier,
	lang = "en",
}: {
	slugs: string[]
	projectSlug: string
	stepN: string
	// Tier 3 steps are constraint-only by pedagogy rule 1 — naming the
	// concepts up front would hand over the approach the step is testing
	// whether you can find yourself. Chips stay behind a disclosure until
	// the learner asks, or until they've already marked the step done.
	tier: 1 | 2 | 3
	lang?: string
}) {
	const progress = useProgress()
	const done = !!progress.done[stepId(projectSlug, stepN)]

	if (slugs.length === 0) return null

	const row = (
		<ChipRow
			slugs={slugs}
			projectSlug={projectSlug}
			stepN={stepN}
			lang={lang}
		/>
	)

	if (tier === 3 && !done) {
		const tr = ui(toLang(lang))
		return (
			<div className="mb-4">
				<Disclosure label={tr.common.whichConceptsHere} tone="amber">
					{row}
				</Disclosure>
			</div>
		)
	}
	return <div className="mb-4">{row}</div>
}
