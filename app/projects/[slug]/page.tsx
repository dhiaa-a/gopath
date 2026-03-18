import Link from "next/link"
import { notFound } from "next/navigation"
import { getProject, projects } from "@/lib/projects"

export function generateStaticParams() {
	return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: { slug: string }
}) {
	const project = getProject(params.slug)
	if (!project) return {}
	return {
		title: `${project.name} — GoPath`,
		description: project.tagline,
	}
}

const tierColors = {
	1: {
		accent: "text-go-cyan",
		badge: "bg-go-cyan/10 border-go-cyan/25 text-go-cyan",
		dot: "bg-go-cyan",
	},
	2: {
		accent: "text-go-teal",
		badge: "bg-go-teal/10 border-go-teal/25 text-go-teal",
		dot: "bg-go-teal",
	},
	3: {
		accent: "text-go-amber",
		badge: "bg-go-amber/10 border-go-amber/25 text-go-amber",
		dot: "bg-go-amber",
	},
}

export default async function ProjectPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const project = await getProject(slug)
	if (!project) notFound()

	const c = tierColors[project.tier]
	const allProjects = projects
	const currentIdx = allProjects.findIndex((p) => p.slug === project.slug)
	const prevProject = currentIdx > 0 ? allProjects[currentIdx - 1] : null
	const nextProject =
		currentIdx < allProjects.length - 1 ? allProjects[currentIdx + 1] : null

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href="/" className="transition-colors hover:text-white">
					GoPath
				</Link>
				<span>/</span>
				<Link
					href="/projects"
					className="transition-colors hover:text-white"
				>
					Projects
				</Link>
				<span>/</span>
				<span className="text-white">{project.name}</span>
			</div>

			{/* Header */}
			<div
				className={`mb-1 font-mono text-xs uppercase tracking-widest ${c.accent}`}
			>
				{project.tierLabel}
			</div>
			<h1 className="mb-3 font-serif text-4xl text-white">
				{project.name}
			</h1>
			<p className="mb-6 text-lg text-muted">{project.tagline}</p>

			{/* Meta */}
			<div className="mb-10 flex flex-wrap items-center gap-2">
				<span
					className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs ${c.badge}`}
				>
					⏱ {project.estimatedTime}
				</span>
				{project.tags.map((t) => (
					<span
						key={t}
						className="rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] text-muted"
					>
						{t}
					</span>
				))}
			</div>

			{/* What you'll build */}
			<div className="mb-6 rounded-lg border border-border bg-surface p-6">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
					What you&apos;ll build
				</div>
				<p
					className="text-sm leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: project.what }}
				/>
			</div>

			{/* What you'll learn */}
			<div className="mb-6 rounded-lg border border-border bg-surface p-6">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
					What you&apos;ll learn
				</div>
				<ul className="flex flex-col gap-2">
					{project.learn.map((item, idx) => (
						<li
							key={idx}
							className="flex items-start gap-3 text-sm text-muted"
						>
							<span
								className={`mt-0.5 shrink-0 font-mono ${c.accent}`}
							>
								→
							</span>
							<span dangerouslySetInnerHTML={{ __html: item }} />
						</li>
					))}
				</ul>
			</div>

			{/* Coming from another language */}
			<div className="mb-10 rounded-lg border border-go-amber/20 bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					Coming from another language?
				</div>
				<p
					className="text-sm leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: project.fromOtherLang }}
				/>
			</div>

			{/* Steps */}
			<h2 className="mb-1 font-serif text-2xl text-white">Steps</h2>
			<p className="mb-6 font-mono text-xs text-faint">
				Guided, not hand-holding.
			</p>
			<div className="relative">
				{/* Connecting line */}
				<div className="absolute left-[19px] top-0 h-full w-px bg-border" />
				<div className="flex flex-col gap-0">
					{project.steps.map((step, i) => (
						<div
							key={step.n}
							className="relative flex gap-6 pb-8 last:pb-0"
						>
							{/* Step dot */}
							<div
								className={`relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-bg font-mono text-xs font-semibold ${c.accent}`}
							>
								{step.n}
							</div>
							<div className="pt-1.5">
								<h3 className="mb-2 font-semibold text-white">
									{step.heading}
								</h3>
								<p
									className="text-sm leading-relaxed text-muted"
									dangerouslySetInnerHTML={{
										__html: step.body,
									}}
								/>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Go Playground link */}
			<div className="mt-10 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
				<span className="font-mono text-go-cyan">tip:</span> Run your
				code at{" "}
				<a
					href="https://go.dev/play"
					target="_blank"
					rel="noopener noreferrer"
					className="text-go-cyan underline hover:opacity-80"
				>
					go.dev/play
				</a>{" "}
				— no local setup needed to get started.
			</div>

			{/* Prev / Next navigation */}
			<div className="mt-12 flex items-center justify-between border-t border-border pt-8">
				{prevProject ? (
					<Link
						href={`/projects/${prevProject.slug}`}
						className="group flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-white"
					>
						<span>←</span>
						<span>{prevProject.name}</span>
					</Link>
				) : (
					<div />
				)}
				{nextProject && (
					<Link
						href={`/projects/${nextProject.slug}`}
						className={`group flex items-center gap-2 font-mono text-sm font-semibold transition-opacity hover:opacity-75 ${c.accent}`}
					>
						<span>{nextProject.name}</span>
						<span>→</span>
					</Link>
				)}
			</div>
		</main>
	)
}
