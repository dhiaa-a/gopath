import Link from "next/link"
import { projects } from "@/lib/projects"

const tierColors = {
	1: {
		accent: "text-go-cyan",
		icon: "bg-go-cyan/15 text-go-cyan",
		border: "border-go-cyan/20 hover:border-go-cyan/50",
	},
	2: {
		accent: "text-go-teal",
		icon: "bg-go-teal/15 text-go-teal",
		border: "border-go-teal/20 hover:border-go-teal/50",
	},
	3: {
		accent: "text-go-amber",
		icon: "bg-go-amber/15 text-go-amber",
		border: "border-go-amber/20 hover:border-go-amber/50",
	},
}

export default function ProjectsPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				All projects
			</div>
			<h1 className="mb-3 font-serif text-4xl text-white">
				Nine projects. One path.
			</h1>
			<p className="mb-12 text-muted">
				Work through them in order. Each one builds on the last.
			</p>

			<div className="flex flex-col gap-3">
				{projects.map((p, i) => {
					const c = tierColors[p.tier]
					return (
						<Link
							key={p.slug}
							href={`/projects/${p.slug}`}
							className={`group flex items-center gap-5 rounded-lg border bg-surface p-5 transition-all ${c.border} hover:translate-x-1`}
						>
							{/* Step number */}
							<div className="hidden w-6 shrink-0 text-right font-mono text-xs text-faint sm:block">
								{String(i + 1).padStart(2, "0")}
							</div>
							<div
								className={`flex h-10 w-10 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${c.icon}`}
							>
								{p.code}
							</div>
							<div className="min-w-0 flex-1">
								<div
									className={`mb-0.5 font-mono text-[10px] uppercase tracking-widest ${c.accent}`}
								>
									{p.tierLabel}
								</div>
								<div className="font-semibold text-white">
									{p.name}
								</div>
								<div className="mt-0.5 text-sm text-muted">
									{p.tagline}
								</div>
							</div>
							<div className="shrink-0 font-mono text-xs text-faint">
								{p.estimatedTime}
							</div>
						</Link>
					)
				})}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6 text-center">
				<p className="mb-4 text-sm text-muted">
					Total estimated time across all projects
				</p>
				<p className="font-mono text-2xl font-semibold text-white">
					30–45 hours
				</p>
				<p className="mt-2 text-xs text-faint">
					of focused, real-world Go practice
				</p>
			</div>
		</main>
	)
}
