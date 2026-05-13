"use client"
import Link from "next/link"
import posthog from "posthog-js"

export function ConceptPracticeLink({
	projectSlug,
	projectCode,
	projectName,
	stepN,
	tierColor,
}: {
	projectSlug: string
	projectCode: string
	projectName: string
	stepN: string
	tierColor: string
}) {
	return (
		<Link
			href={`/projects/${projectSlug}`}
			className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 transition-colors hover:border-go-cyan/30"
			onClick={() =>
				posthog.capture("concept_practice_link_clicked", {
					project_slug: projectSlug,
					step_n: stepN,
				})
			}
		>
			<span className={`font-mono text-xs font-semibold ${tierColor}`}>
				{projectCode}
			</span>
			<div>
				<div className="text-sm font-semibold text-foreground">
					{projectName}
				</div>
				<div className="text-xs text-muted">Step {stepN}</div>
			</div>
		</Link>
	)
}
