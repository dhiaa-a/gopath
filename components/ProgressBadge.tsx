"use client"
import { countDone, useProgress } from "@/lib/progress"

// A plain "3/11" — used on tier rows, the basics index, and a project's own
// step header. Renders nothing until there is something to count, and
// nothing once a scope is empty (the capstone has no steps to track).
export function ProgressBadge({
	ids,
	className,
}: {
	ids: string[]
	className?: string
}) {
	const progress = useProgress()
	if (ids.length === 0) return null
	const done = countDone(progress, ids)

	return (
		<span
			className={`font-mono text-[11px] tabular-nums text-faint ${done === ids.length ? "text-m-accent-ink" : ""} ${className ?? ""}`}
		>
			{done}/{ids.length}
		</span>
	)
}

// A single checkmark, shown only once its one id is done — for spots (the
// basics index rows) where a fraction would be noise and a plain "seen it"
// mark is all that's useful.
export function DoneMark({
	id,
	className,
}: {
	id: string
	className?: string
}) {
	const progress = useProgress()
	if (!progress.done[id]) return null

	return (
		<span
			aria-label="Complete"
			className={`text-m-accent-ink ${className ?? ""}`}
		>
			✓
		</span>
	)
}
