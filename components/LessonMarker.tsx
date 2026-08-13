"use client"
import { lessonId, toggleDone, useProgress } from "@/lib/progress"

// The basics index shows this as a plain number-or-checkmark (no click
// target there — an index is for scanning, not for toggling); this is the
// interactive counterpart on the lesson page itself, where you actually just
// did the thing.
export function LessonNumber({
	slug,
	order,
}: {
	slug: string
	order: number
}) {
	const progress = useProgress()
	const done = !!progress.done[lessonId(slug)]

	return (
		<div
			className={`flex h-9 w-9 shrink-0 items-center justify-center border font-mono text-sm transition-colors ${
				done
					? "border-m-accent bg-m-accent text-m-on-accent"
					: "border-border bg-bg text-muted"
			}`}
		>
			{done ? "✓" : order}
		</div>
	)
}

export function LessonMarker({
	slug,
	className,
}: {
	slug: string
	className?: string
}) {
	const progress = useProgress()
	const id = lessonId(slug)
	const done = !!progress.done[id]

	return (
		<button
			type="button"
			onClick={() => toggleDone(id)}
			aria-pressed={done}
			className={`flex items-center gap-2 border-2 px-[16px] py-[10px] font-mono text-xs font-semibold transition-colors ${
				done
					? "border-m-accent bg-m-accent text-m-on-accent"
					: "border-border bg-surface text-muted hover:border-m-accent hover:text-m-accent-ink"
			} ${className ?? ""}`}
		>
			<span aria-hidden="true">{done ? "✓" : "○"}</span>
			<span>{done ? "Lesson complete" : "Mark lesson complete"}</span>
		</button>
	)
}
