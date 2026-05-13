import Link from "next/link"
import { orientationPages } from "@/lib/orientation"

export const metadata = {
	title: "Orientation — GoPath",
	description:
		"A short on-ramp for newcomers: what Go is, where to learn the syntax, and how to know when you're ready for Tier 1.",
}

export default function OrientationIndexPage() {
	const ordered = [...orientationPages].sort((a, b) => a.order - b.order)
	const totalMinutes = ordered.reduce(
		(sum, p) => sum + p.estimatedMinutes,
		0,
	)

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
				Orientation
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				The airlock before Tier 1.
			</h1>
			<p className="mb-10 max-w-xl text-muted">
				Six short pages for newcomers. What Go is, what it isn't, where
				to learn syntax, and a readiness check before you start
				building. About {totalMinutes} minutes total.
			</p>

			<ol className="flex flex-col gap-3">
				{ordered.map((page) => (
					<li key={page.slug}>
						<Link
							href={`/orientation/${page.slug}`}
							className="group flex items-start gap-4 rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-border2 hover:shadow-sm"
						>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg font-mono text-sm text-muted">
								{page.order}
							</div>
							<div className="min-w-0 flex-1">
								<div className="mb-1 font-semibold text-foreground group-hover:text-muted">
									{page.title}
								</div>
								<div className="text-sm leading-relaxed text-muted">
									{page.tagline}
								</div>
							</div>
							<div className="shrink-0 self-center font-mono text-xs text-faint">
								{page.estimatedMinutes} min
							</div>
						</Link>
					</li>
				))}
			</ol>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					Already comfortable with Go?
				</p>
				<p className="text-sm text-muted">
					Skip orientation and start with{" "}
					<Link
						href="/projects/cli-renamer"
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						Tier 1 — CLI renamer →
					</Link>
				</p>
			</div>
		</main>
	)
}
