"use client"
import { useState } from "react"

export function SpacedReuseCallout({ projectName }: { projectName: string }) {
	const [answer, setAnswer] = useState("")

	return (
		<div className="mb-6 rounded-lg border border-go-teal/20 bg-go-teal/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-teal">
				spaced reuse
			</div>
			<p className="mb-3 text-sm leading-relaxed text-muted">
				↻ You used this in{" "}
				<strong className="text-white">{projectName}</strong>. Without
				scrolling back, recall what changed:
			</p>
			<textarea
				value={answer}
				onChange={(e) => setAnswer(e.target.value)}
				rows={3}
				placeholder="Write what you remember before reading on…"
				className="w-full resize-none rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-muted focus:border-go-teal/40 focus:outline-none"
			/>
		</div>
	)
}
