"use client"
import { useState } from "react"

// The reveal interaction the failure pages use for "how this shows up in
// production": the learner commits to the diagnosis before seeing the war
// story. Deliberately dumb (brief, Phase 5): a button that swaps for its
// content, no animation, no state beyond open.
export function Reveal({
	prompt,
	children,
}: {
	prompt: string
	children: React.ReactNode
}) {
	const [open, setOpen] = useState(false)

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				className="rounded border border-border bg-surface2 px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-go-amber/40 hover:text-foreground"
			>
				{prompt}
			</button>
		)
	}
	return <>{children}</>
}
