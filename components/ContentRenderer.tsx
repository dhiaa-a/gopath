"use client"
import { useState } from "react"
import { ContentBlock, Hint } from "@/lib/content"
import { GoCodeBlock } from "./GoCode"

function HintPill({ hint }: { hint: Hint }) {
	const [open, setOpen] = useState(false)
	return (
		<span className="inline-block">
			<button
				onClick={() => setOpen((o) => !o)}
				className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted transition-colors hover:border-go-cyan/40 hover:text-go-cyan"
			>
				{open ? "▼" : "►"} {hint.label}
			</button>
			{open && (
				<span className="ml-2 font-mono text-[11px] text-go-cyan">
					{hint.value}
				</span>
			)}
		</span>
	)
}

function HintRow({ hints }: { hints: Hint[] }) {
	if (!hints.length) return null
	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{hints.map((hints, i) => (
				<HintPill key={i} hint={hints} />
			))}
		</div>
	)
}

function AssessmentBlock({
	block,
}: {
	block: ContentBlock & { type: "assessment" }
}) {
	const [metricsOpen, setMetricsOpen] = useState(false)
	const a = block.assessment

	const palette: Record<string, string> = {
		unit: "border-go-cyan/25 bg-go-cyan/5",
		benchmark: "border-go-amber/25 bg-go-amber/5",
		metrics: "border-go-amber/25 bg-go-amber/5",
		integration: "border-go-teal/25 bg-go-teal/5",
		systems: "border-go-teal/25 bg-go-teal/5",
	}

	const accent: Record<string, string> = {
		unit: "text-go-cyan",
		benchmark: "text-go-amber",
		metrics: "text-go-amber",
		integration: "text-go-teal",
		systems: "text-go-teal",
	}

	return (
		<div
			className={`my-5 rounded-lg border p-5 ${palette[a.kind] ?? "border-border bg-surface"}`}
		>
			<div
				className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${accent[a.kind] ?? "text-muted"}`}
			>
				{a.kind} assessment
			</div>
			<div className="mb-2 font-semibold text-foreground">{a.title}</div>
			<p className="mb-4 text-sm leading-relaxed test-muted">
				{a.description}
			</p>

			{a.testCases && a.testCases.length > 0 && (
				<div className="mb-4">
					<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
						test cases
					</div>
					<div className="flex flex-col gap-2">
						{a.testCases.map((tc, i) => (
							<div
								key={i}
								className="rounded border border-border bg-bg p-3"
							>
								<div className="mb-1 font-mono text-xs text-go-cyan">
									in: {tc.input}
								</div>
								{tc.input && (
									<div className="mb-1 font-mono text-xs text-go-cyan">
										in: {tc.input}
									</div>
								)}
								<div className="font-mono text-xs text-go-teal">
									want: {tc.expected}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{a.desiredOutput && (
				<div className="mb-4">
					<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
						expected output
					</div>
					<pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-go-teal">
						{a.desiredOutput}
					</pre>
				</div>
			)}

			{a.desiredMetrics && (
				<div className="mb-3">
					<div className="mb-1 font-mono text-[10px] upper tracking-widest text-muted">
						target metrics
					</div>
					<div className="rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-go-amber">
						{a.desiredMetrics}
					</div>
					{a.metricsAchievable && (
						<div className="mt-2">
							<button
								onClick={() => setMetricsOpen((o) => !o)}
								className="font-mono text-[10px] text-muted translate-colors hover:text-go-amber"
							>
								{metricsOpen ? "▼" : "►"} is this actually
								achievable?
							</button>
							{metricsOpen && (
								<div className="mt-1.5 rounded border border-go-amber/20 bg-go-amber/5 px-3 py-2 text-xs text-muted">
									{a.metricsAchievable}
								</div>
							)}
						</div>
					)}
				</div>
			)}
			{a.hints && <HintRow hints={a.hints} />}
		</div>
	)
}

export function ContentRenderer({ blocks }: { blocks: ContentBlock[] }) {
	return (
		<>
			{blocks.map((block, i) => {
				switch (block.type) {
					case "text":
						return (
							<p
								key={i}
								className="mb-4 text-base leading-relaxed text-muted"
								dangerouslySetInnerHTML={{
									__html: block.value,
								}}
							/>
						)

					case "code":
						return (
							<GoCodeBlock
								key={i}
								code={block.value}
								filename={block.filename}
							/>
						)

					case "list":
						return (
							<ul key={i} className="mb-4 flex flex-col gap-2">
								{block.items.map((item, j) => (
									<li key={j} className="text-sm text-muted">
										{item}
									</li>
								))}
							</ul>
						)

					case "callout":
						return (
							<div
								key={i}
								className={`mb-4 rounded border p-4 text-sm text-muted ${
									block.variant === "warning"
										? "border-go-amber/20 bg-go-amber/5"
										: "border-go-cyan/20 bg-go-cyan/5"
								}`}
							>
								{block.value}
							</div>
						)

					// T1 pattern block
					case "pattern":
						return (
							<div
								key={i}
								className="mb-6 rounded-xl border border-border bg-surface overflow-hidden"
							>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-cyan">
										concept
									</div>
									<p className="text-sm leading-relaxed text-muted">
										{block.concept}
									</p>
								</div>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
										pattern
									</div>
									<GoCodeBlock code={block.pattern} />
								</div>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-teal">
										similar example
									</div>
									<p className="text-sm leading-relaxed text-muted">
										{block.example}
									</p>
								</div>
								<div className="px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-amber">
										your task
									</div>
									<p className="text-sm leading-relaxed text-foreground">
										{block.task}
									</p>
									{block.hints && (
										<HintRow hints={block.hints} />
									)}
								</div>
							</div>
						)

					// T2 requirement block
					case "requirement":
						return (
							<div
								key={i}
								className="mb-6 rounded-xl border border-go-teal/20 bg-surface overflow-hidden"
							>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-teal">
										requirement
									</div>
									<p className="text-sm font-medium leading-relaxed text-foreground">
										{block.what}
									</p>
								</div>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
										why
									</div>
									<p className="text-sm leading-relaxed text-muted">
										{block.why}
									</p>
								</div>
								{(block.stdlibHint || block.thirdPartyHint) && (
									<div className="border-b border-border px-5 py-3 flex flex-wrap gap-4">
										{block.stdlibHint && (
											<div>
												<span className="mr-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
													stdlib
												</span>
												<code className="font-mono text-xs text-go-cyan">
													{block.stdlibHint}
												</code>
											</div>
										)}
										{block.thirdPartyHint && (
											<div>
												<span className="mr-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
													third-party
												</span>
												<code className="font-mono text-xs text-go-teal">
													{block.thirdPartyHint}
												</code>
											</div>
										)}
									</div>
								)}
								{block.complexSnippet && (
									<div className="border-b border-border px-5 py-4">
										<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
											api shape
										</div>
										<GoCodeBlock
											code={block.complexSnippet}
										/>
									</div>
								)}
								{block.hints && (
									<div className="px-5 py-3">
										<HintRow hints={block.hints} />
									</div>
								)}
							</div>
						)

					// T3 constraint block
					case "constraint":
						return (
							<div
								key={i}
								className="mb-4 rounded-lg border border-go-amber/20 bg-go-amber/5 px-5 py-4"
							>
								<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-amber">
									constraint
								</div>
								<p className="mb-2 text-sm font-medium text-foreground">
									{block.what}
								</p>
								<p className="text-sm leading-relaxed text-muted">
									{block.rationale}
								</p>
								{block.hints && (
									<div className="mt-3">
										<HintRow hints={block.hints} />
									</div>
								)}
							</div>
						)

					case "assessment":
						return <AssessmentBlock key={i} block={block} />

					default:
						return null
				}
			})}
		</>
	)
}
