import Link from "next/link"
import { projects } from "@/lib/projects"

const conceptMap: Record<
	string,
	{ projectSlug: string; projectName: string; tier: 1 | 2 | 3 }[]
> = {}

for (const project of projects) {
	for (const tag of project.tags) {
		if (!conceptMap[tag]) conceptMap[tag] = []
		conceptMap[tag].push({
			projectSlug: project.slug,
			projectName: project.name,
			tier: project.tier,
		})
	}
}

const tierColors = {
	1: "text-go-cyan",
	2: "text-go-teal",
	3: "text-go-amber",
} as const
const tierLabels = { 1: "T1", 2: "T2", 3: "T3" } as const

const sortedConcepts = Object.entries(conceptMap).sort(([a], [b]) =>
	a.localeCompare(b),
)

export default function ConceptsPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Concepts
			</div>
			<h1 className="mb-3 font-serif text-4xl text-white">
				Every concept, linked to the project that teaches it.
			</h1>
			<p className="mb-4 text-muted">
				Not a docs page. Not a blog post. Real code you can run.
			</p>

			{/* Legend */}
			<div className="mb-10 flex items-center gap-6 font-mono text-xs text-muted">
				<span className="flex items-center gap-1.5">
					<span className="text-go-cyan">T1</span> Get Comfortable
				</span>
				<span className="flex items-center gap-1.5">
					<span className="text-go-teal">T2</span> Go Idioms
				</span>
				<span className="flex items-center gap-1.5">
					<span className="text-go-amber">T3</span> Production Grade
				</span>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{sortedConcepts.map(([concept, projs]) => (
					<div
						key={concept}
						className="rounded-lg border border-border bg-surface p-4"
					>
						<div className="mb-3 font-mono text-sm font-semibold text-white">
							{concept}
						</div>
						<div className="flex flex-col gap-1.5">
							{projs.map((p) => (
								<Link
									key={p.projectSlug}
									href={`/projects/${p.projectSlug}`}
									className="flex items-center gap-2 text-xs text-muted transition-colors hover:text-white"
								>
									<span
										className={`font-mono ${tierColors[p.tier]}`}
									>
										→
									</span>
									<span className="flex-1 truncate">
										{p.projectName}
									</span>
									<span
										className={`font-mono text-[10px] ${tierColors[p.tier]}`}
									>
										{tierLabels[p.tier]}
									</span>
								</Link>
							))}
						</div>
					</div>
				))}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-2 text-sm font-semibold text-white">
					Missing a concept?
				</p>
				<p className="text-sm text-muted">
					The concepts index is built automatically from project tags.
					As more projects are added, more concepts will appear here.
				</p>
			</div>
		</main>
	)
}
