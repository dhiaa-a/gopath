import Link from "next/link"
import { notFound } from "next/navigation"
import { getProject, projects } from "@/lib/projects"
import { GoCodeBlock } from "@/components/GoCode"

export function generateStaticParams() {
	return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const project = await getProject(slug)
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
	},
	2: {
		accent: "text-go-teal",
		badge: "bg-go-teal/10 border-go-teal/25 text-go-teal",
	},
	3: {
		accent: "text-go-amber",
		badge: "bg-go-amber/10 border-go-amber/25 text-go-amber",
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
				<span className="text-faint">/</span>
				<Link
					href="/projects"
					className="transition-colors hover:text-white"
				>
					Projects
				</Link>
				<span className="text-faint">/</span>
				<span className="text-white">{project.name}</span>
			</div>

			{/* Header */}
			<div
				className={`mb-2 font-mono text-xs uppercase tracking-widest ${c.accent}`}
			>
				{project.tierLabel}
			</div>
			<h1 className="mb-4 font-serif text-5xl text-white">
				{project.name}
			</h1>
			<p className="mb-7 text-xl leading-relaxed text-muted">
				{project.tagline}
			</p>

			{/* Meta badges */}
			<div className="mb-12 flex flex-wrap items-center gap-2">
				<span
					className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-sm ${c.badge}`}
				>
					⏱ {project.estimatedTime}
				</span>
				{project.tags.map((t) => (
					<span
						key={t}
						className="rounded border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted"
					>
						{t}
					</span>
				))}
			</div>

			{/* What you'll build */}
			<section className="mb-6 rounded-xl border border-border bg-surface p-7">
				<h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
					What you&apos;ll build
				</h2>
				<p
					className="text-base leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: project.what }}
				/>
			</section>

			{/* What you'll learn */}
			<section className="mb-6 rounded-xl border border-border bg-surface p-7">
				<h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
					What you&apos;ll learn
				</h2>
				<ul className="flex flex-col gap-3">
					{project.learn.map((item, idx) => (
						<li
							key={idx}
							className="flex items-start gap-3 text-base text-muted"
						>
							<span
								className={`mt-1 shrink-0 font-mono text-sm ${c.accent}`}
							>
								→
							</span>
							<span dangerouslySetInnerHTML={{ __html: item }} />
						</li>
					))}
				</ul>
			</section>

			{/* Coming from another language */}
			<section className="mb-12 rounded-xl border border-go-amber/20 bg-go-amber/5 p-7">
				<h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-go-amber">
					Coming from another language?
				</h2>
				<p
					className="text-base leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: project.fromOtherLang }}
				/>
			</section>

			{/* Steps */}
			<div className="mb-4 flex items-baseline justify-between">
				<h2 className="font-serif text-3xl text-white">Steps</h2>
				<span className="font-mono text-sm text-faint">
					guided, not hand-holding
				</span>
			</div>

			<div className="flex flex-col gap-10">
				{project.steps.map((step, i) => (
					<div key={step.n} className="relative">
						{/* Step header */}
						<div className="mb-4 flex items-center gap-4">
							<div
								className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-sm font-semibold ${c.accent}`}
							>
								{step.n}
							</div>
							<h3 className="text-xl font-semibold text-white">
								{step.heading}
							</h3>
						</div>

						{/* Step body */}
						<div className="ml-14">
							<p
								className="mb-4 text-base leading-relaxed text-muted"
								dangerouslySetInnerHTML={{ __html: step.body }}
							/>
							{step.code && (
								<GoCodeBlock
									code={step.code}
									filename={step.filename}
								/>
							)}
						</div>
					</div>
				))}
			</div>

			{/* Go Playground tip */}
			<div className="mt-10 rounded-xl border border-border bg-surface px-6 py-4 text-sm text-muted">
				<span className="font-mono text-go-cyan">tip →</span> Try
				snippets instantly at{" "}
				<a
					href="https://go.dev/play"
					target="_blank"
					rel="noopener noreferrer"
					className="text-go-cyan underline hover:opacity-80"
				>
					go.dev/play
				</a>{" "}
				— no local setup required.
			</div>

			{/* Prev / Next */}
			<div className="mt-14 flex items-center justify-between border-t border-border pt-8">
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
						className={`flex items-center gap-2 font-mono text-sm font-semibold transition-opacity hover:opacity-75 ${c.accent}`}
					>
						<span>{nextProject.name}</span>
						<span>→</span>
					</Link>
				)}
			</div>
		</main>
	)
}
