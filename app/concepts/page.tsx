import Link from "next/link"
import { concepts } from "@/lib/concepts"
import { conceptGroups } from "@/lib/content/concepts/groups"

// The grouping itself lives in lib/content/concepts/groups.ts, where
// validate.ts can hold it to "every concept is in exactly one group". Only
// the colour per group is a presentation decision, so only it lives here.
const groupStyles: Record<string, { color: string; border: string }> = {
	Fundamentals: { color: "text-go-cyan", border: "border-go-cyan/20" },
	Data: { color: "text-go-amber", border: "border-go-amber/20" },
	Concurrency: { color: "text-go-teal", border: "border-go-teal/20" },
	"Standard library": { color: "text-go-cyan", border: "border-go-cyan/20" },
	"Testing and tooling": { color: "text-go-amber", border: "border-go-amber/20" },
}

// A group with no explicit style must not crash the page: fall back rather
// than read `.color` off undefined. groups.ts is the source of truth for which
// groups exist, so a new one there renders (in the default colour) instead of
// breaking the build.
const fallbackStyle = { color: "text-muted", border: "border-border" }

export default function ConceptsPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Concepts
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				Every concept, explained clearly.
			</h1>
			<p className="mb-12 max-w-xl text-muted">
				Hit a wall while building? Find the concept, read the mental
				model, run the example, get unstuck.
			</p>

			<div className="flex flex-col gap-10">
				{conceptGroups.map((group) => {
					const style = groupStyles[group.label] ?? fallbackStyle
					const groupConcepts = group.slugs
						.map((s) => concepts.find((c) => c.slug === s))
						.filter(Boolean) as typeof concepts

					return (
						<div key={group.label}>
							<div
								className={`mb-4 font-mono text-xs uppercase tracking-widest ${style.color}`}
							>
								{group.label}
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{groupConcepts.map((c) => (
									<Link
										key={c.slug}
										href={`/concepts/${c.slug}`}
										className={`group rounded-lg border ${style.border} bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm`}
									>
										<div className="mb-1 font-semibold text-foreground group-hover:text-go-cyan">
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
				<p className="mb-1 font-semibold text-foreground">
					Using concepts while building
				</p>
				<p className="text-sm text-muted">
					Every project step links to relevant concepts. When you see
					a concept pill on a step, click it to get a full explanation
					, then come back and keep building.
				</p>
			</div>
		</main>
	)
}
