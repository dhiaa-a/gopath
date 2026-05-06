"use client"
import { useState } from "react"
import { GoCodeBlock } from "./GoCode"

type PromptState = "closed" | "open" | "explained"

export function RetrievalPrompts({
	prompts,
	codeExample,
	codeExplanation,
}: {
	prompts: string[]
	codeExample: string
	codeExplanation: string
}) {
	const [states, setStates] = useState<PromptState[]>(
		prompts.map(() => "closed"),
	)
	const [answers, setAnswers] = useState<string[]>(prompts.map(() => ""))

	function toggle(i: number) {
		setStates((prev) =>
			prev.map((s, idx) =>
				idx === i ? (s === "closed" ? "open" : "closed") : s,
			),
		)
	}

	function showExplanation(i: number) {
		setStates((prev) =>
			prev.map((s, idx) => (idx === i ? "explained" : s)),
		)
	}

	function setAnswer(i: number, value: string) {
		setAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)))
	}

	return (
		<section className="mb-8">
			<div className="mb-1 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Retrieval practice
			</div>
			<p className="mb-3 text-sm text-muted">
				Answer before reading on. You don't need to be right — writing
				forces recall.
			</p>
			<div className="flex flex-col gap-2">
				{prompts.map((prompt, i) => (
					<div
						key={i}
						className="overflow-hidden rounded-lg border border-border bg-surface"
					>
						<button
							onClick={() => toggle(i)}
							className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-go-cyan/20"
						>
							<span className="font-mono text-[10px] text-go-cyan">
								{states[i] === "closed" ? "►" : "▼"}
							</span>
							<span className="font-mono text-xs text-muted">
								prompt {i + 1}
							</span>
						</button>

						{states[i] !== "closed" && (
							<div className="border-t border-border px-4 pb-4 pt-3">
								<p className="mb-3 text-sm leading-relaxed text-white">
									{prompt}
								</p>
								<textarea
									value={answers[i]}
									onChange={(e) =>
										setAnswer(i, e.target.value)
									}
									rows={4}
									placeholder="Write your answer before reading on…"
									className="w-full resize-none rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-muted focus:border-go-cyan/40 focus:outline-none"
								/>
								{states[i] === "open" && (
									<button
										onClick={() => showExplanation(i)}
										className="mt-2 font-mono text-[10px] text-muted transition-colors hover:text-go-cyan"
									>
										► show explanation
									</button>
								)}
								{states[i] === "explained" && (
									<div className="mt-4">
										<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
											explanation
										</div>
										<div className="overflow-hidden rounded-lg border border-border bg-bg">
											<pre className="overflow-x-auto p-4 font-mono text-sm leading-7 text-[#e8f0e8]">
												<GoCodeBlock code={codeExample} />
											</pre>
										</div>
										<p
											className="mt-2 text-sm leading-relaxed text-muted"
											dangerouslySetInnerHTML={{
												__html: codeExplanation,
											}}
										/>
									</div>
								)}
							</div>
						)}
					</div>
				))}
			</div>
		</section>
	)
}
