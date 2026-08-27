import Link from "next/link"
import { orientationPages } from "@/lib/orientation"
import { t } from "@/lib/content"
import { localePath, toLang, ui } from "@/lib/i18n"

export const metadata = {
	title: "Orientation — GoPath",
	description:
		"A short on-ramp for newcomers: what Go is, where to learn the syntax, and how to know when you're ready for Tier 1.",
}

export default async function OrientationIndexPage({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const ordered = [...orientationPages].sort((a, b) => a.order - b.order)
	const totalMinutes = ordered.reduce(
		(sum, p) => sum + p.estimatedMinutes,
		0,
	)

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
				{tr.nav.orientation}
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{tr.index.orientationTitle}
			</h1>
			<p className="mb-10 max-w-xl text-muted">
				{tr.index.orientationLead.replace(
					"{n}",
					String(totalMinutes),
				)}
			</p>

			<ol className="flex flex-col gap-3">
				{ordered.map((page) => (
					<li key={page.slug}>
						<Link
							href={lp(`/orientation/${page.slug}`)}
							className="group flex items-start gap-4 rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-border2 hover:shadow-sm"
						>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg font-mono text-sm text-muted">
								{page.order}
							</div>
							<div className="min-w-0 flex-1">
								<div className="mb-1 font-semibold text-foreground group-hover:text-muted">
									{t(page.title, lang)}
								</div>
								<div className="text-sm leading-relaxed text-muted">
									{t(page.tagline, lang)}
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
					{tr.index.orientationSkipTitle}
				</p>
				<p className="text-sm text-muted">
					{tr.index.orientationSkipBody}{" "}
					<Link
						href={lp("/projects/cli-renamer")}
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						{tr.common.tier1FirstProject} →
					</Link>
				</p>
			</div>
		</main>
	)
}
