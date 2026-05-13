"use client"
import { useState } from "react"

export function RetrievalPrompts({
	prompts,
}: {
	prompts: string[]
}) {
	const [flipped, setFlipped] = useState<boolean[]>(prompts.map(() => false))

	function flip(i: number) {
		setFlipped((prev) => prev.map((f, idx) => (idx === i ? !f : f)))
	}

	return (
		<section className="mb-8">
			<div className="mb-1 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Retrieval practice
			</div>
			<p className="mb-4 text-sm text-muted">
				Think of your answer, then click the card to reveal it.
			</p>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{prompts.map((prompt, i) => {
					const parts = prompt.split("||")
					const question = parts[0].trim()
					const answer = parts[1]?.trim() ?? ""

					return (
						<button
							key={i}
							onClick={() => flip(i)}
							className="group relative h-44 w-full cursor-pointer text-left"
							style={{ perspective: "1000px" }}
						>
							<div
								className="relative h-full w-full transition-transform duration-500"
								style={{
									transformStyle: "preserve-3d",
									transform: flipped[i]
										? "rotateY(180deg)"
										: "rotateY(0deg)",
								}}
							>
								{/* Front */}
								<div
									className="absolute inset-0 flex flex-col rounded-lg border border-border bg-surface p-4"
									style={{ backfaceVisibility: "hidden" }}
								>
									<div className="min-h-0 flex-1 overflow-y-auto">
										<p className="text-sm leading-relaxed text-foreground">
											{question}
										</p>
									</div>
									<span className="mt-3 shrink-0 font-mono text-[10px] text-muted transition-colors group-hover:text-go-cyan">
										click to reveal →
									</span>
								</div>

								{/* Back */}
								<div
									className="absolute inset-0 flex flex-col rounded-lg border border-go-cyan/30 bg-go-cyan/5 p-4"
									style={{
										backfaceVisibility: "hidden",
										transform: "rotateY(180deg)",
									}}
								>
									<div className="min-h-0 flex-1 overflow-y-auto">
										<p className="text-sm leading-relaxed text-muted">
											{answer}
										</p>
									</div>
									<span className="mt-3 shrink-0 font-mono text-[10px] text-muted transition-colors group-hover:text-go-cyan">
										click to flip back →
									</span>
								</div>
							</div>
						</button>
					)
				})}
			</div>
		</section>
	)
}
