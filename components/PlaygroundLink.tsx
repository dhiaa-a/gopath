"use client"
import posthog from "posthog-js"

export function PlaygroundLink({
	href,
	conceptSlug,
}: {
	href: string
	conceptSlug: string
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-go-cyan"
			onClick={() =>
				posthog.capture("playground_opened", { concept_slug: conceptSlug })
			}
		>
			<span>▶</span>
			<span>Run in Playground</span>
		</a>
	)
}
