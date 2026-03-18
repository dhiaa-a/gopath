import Link from "next/link"
import { concepts } from "@/lib/concepts"

// Group concepts thematically
const groups = [
	{
		label: "Fundamentals",
		slugs: [
			"error-handling",
			"interfaces",
			"structs",
			"pointers",
			"packages",
		],
		color: "text-go-cyan",
		border: "border-go-cyan/20",
		bg: "bg-go-cyan/5",
	},
	{
		label: "Concurrency",
		slugs: [
			"goroutines",
			"channels",
			"select",
			"sync-waitgroup",
			"context",
		],
		color: "text-go-teal",
		border: "border-go-teal/20",
		bg: "bg-go-teal/5",
	},
	{
		label: "Standard library",
		slugs: ["http-handler", "json-decode", "slices", "maps", "defer"],
		color: "text-go-amber",
		border: "border-go-amber/20",
		bg: "bg-go-amber/5",
	},
]

export default function ConceptsPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Concepts
			</div>
			<h1 className="mb-3 font-serif text-4xl text-white">
				Every concept, explained clearly.
			</h1>
			<p className="mb-12 max-w-xl text-muted">
				Hit a wall while building? Find the concept, read the mental
				model, run the example, get unstuck.
			</p>

			<div className="flex flex-col gap-10">
				{groups.map((group) => {
					const groupConcepts = group.slugs
						.map((s) => concepts.find((c) => c.slug === s))
						.filter(Boolean) as typeof concepts

					return (
						<div key={group.label}>
							<div
								className={`mb-4 font-mono text-xs uppercase tracking-widest ${group.color}`}
							>
								{group.label}
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{groupConcepts.map((c) => (
									<Link
										key={c.slug}
										href={`/concepts/${c.slug}`}
										className={`group rounded-lg border ${group.border} bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm`}
									>
										<div className="mb-1 font-semibold text-white group-hover:text-go-cyan">
											{c.name}
										</div>
										<div className="text-xs leading-relaxed text-muted">
											{c.tagline}
										</div>
										<div className="mt-3 flex flex-wrap gap-1">
											{c.commonMistakes
												.slice(0, 1)
												.map((m) => (
													<span
														key={m.title}
														className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-faint"
													>
														✗{" "}
														{m.title
															.split(" ")
															.slice(0, 3)
															.join(" ")}
														…
													</span>
												))}
										</div>
									</Link>
								))}
							</div>
						</div>
					)
				})}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-white">
					Using concepts while building
				</p>
				<p className="text-sm text-muted">
					Every project step links to relevant concepts. When you see
					a concept pill on a step, click it to get a full explanation
					— then come back and keep building.
				</p>
			</div>
		</main>
	)
}
