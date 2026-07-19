"use client"
import { useState } from "react"

// The closing beat of a step: one retrieval prompt. Deliberately smaller than
// the RetrievalPrompts flip cards, which end a whole concept or lesson. This
// one is a single line you answer in your head before clicking, so it costs a
// few seconds and still forces the recall.
//
// Format matches the flip cards: "question || answer".
export function StepRecap({ prompt }: { prompt: string }) {
	const [open, setOpen] = useState(false)
	const [question, answer = ""] = prompt.split("||").map((s) => s.trim())

	return (
		<div className="mt-6 rounded-lg border border-go-cyan/25 bg-go-cyan/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-cyan">
				recap
			</div>
			<p className="text-sm leading-relaxed text-foreground">{question}</p>
			<button
				onClick={() => setOpen((o) => !o)}
				className="mt-2 font-mono text-[10px] text-muted transition-colors hover:text-go-cyan"
			>
				{open ? "▾ hide" : "▸ answer it, then check"}
			</button>
			{open && (
				<div className="mt-2 rounded border border-go-cyan/20 bg-bg px-3 py-2 text-sm leading-relaxed text-muted">
					{answer}
				</div>
			)}
		</div>
	)
}
