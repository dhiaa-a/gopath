"use client"
import { stepId, toggleDone, useProgress } from "@/lib/progress"

// The step's number, made clickable: click to check a step off, click again
// to undo it. Replaces a plain div in the same slot, so the step spine's
// layout is unchanged whether or not progress tracking is in use.
export function StepMarker({
	projectSlug,
	n,
	accentClass,
}: {
	projectSlug: string
	n: string
	accentClass: string
}) {
	const progress = useProgress()
	const id = stepId(projectSlug, n)
	const done = !!progress.done[id]

	return (
		<button
			type="button"
			onClick={() => toggleDone(id)}
			aria-pressed={done}
			aria-label={
				done ? `Step ${n}, done — mark not done` : `Step ${n} — mark done`
			}
			className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 font-mono text-sm font-semibold transition-colors ${
				done
					? "border-m-accent bg-m-accent text-m-on-accent"
					: `border-border bg-surface ${accentClass} hover:border-m-accent`
			}`}
		>
			{done ? "✓" : n}
		</button>
	)
}
