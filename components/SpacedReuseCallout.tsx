"use client"
import Link from "next/link"
import { useState } from "react"

type State = "pending" | "remembered" | "forgot"

export function SpacedReuseCallout({
	projectName,
	projectSlug,
}: {
	projectName: string
	projectSlug: string
}) {
	const [state, setState] = useState<State>("pending")

	return (
		<div className="mb-6 rounded-lg border border-go-teal/20 bg-go-teal/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-teal">
				spaced reuse
			</div>
			<p className="mb-4 text-sm leading-relaxed text-muted">
				↻ You used this concept in{" "}
				<strong className="text-foreground">{projectName}</strong>. Before
				reading on — how well do you remember applying it?
			</p>

			{state === "pending" && (
				<div className="flex gap-2">
					<button
						onClick={() => setState("remembered")}
						className="rounded border border-go-teal/30 px-3 py-1.5 font-mono text-xs text-go-teal transition-colors hover:bg-go-teal/10"
					>
						✓ I remember it
					</button>
					<button
						onClick={() => setState("forgot")}
						className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-teal/20 hover:text-foreground"
					>
						✗ Need a refresher
					</button>
				</div>
			)}

			{state === "remembered" && (
				<p className="font-mono text-xs text-go-teal">
					✓ Good. Read the step below and compare — same pattern or a
					new twist?
				</p>
			)}

			{state === "forgot" && (
				<div className="flex flex-wrap items-center gap-3">
					<Link
						href={`/projects/${projectSlug}`}
						className="font-mono text-xs text-go-teal underline decoration-go-teal/40 hover:no-underline"
					>
						Review {projectName} →
					</Link>
					<span className="font-mono text-xs text-muted">
						then come back and continue below.
					</span>
				</div>
			)}
		</div>
	)
}
