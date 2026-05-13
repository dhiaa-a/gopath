import Link from "next/link"
import { notFound } from "next/navigation"
import { getProject, projects } from "@/lib/projects"
import { priorConceptOccurrence } from "@/lib/relations"
import { ContentRenderer } from "@/components/ContentRenderer"
import { ProjectSection } from "@/components/ProjectSection"
import { SpacedReuseCallout } from "@/components/SpacedReuseCallout"
import { ProjectNavLink } from "@/components/ProjectNavLink"
import { ProjectStepTracker } from "@/components/ProjectStepTracker"

export function generateStaticParams() {
	return projects.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const project = getProject(slug)
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

const stepCue = {
	1: "pattern → example → your task",
	2: "requirement → why → hints",
	3: "constraint only",
} as const

export default async function ProjectPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const project = getProject(slug)
	if (!project) notFound()

	const c = tierColors[project.tier]
	const currentIdx = projects.findIndex((p) => p.slug === project.slug)
	const prevProject = currentIdx > 0 ? projects[currentIdx - 1] : null
	const nextProject =
		currentIdx < projects.length - 1 ? projects[currentIdx + 1] : null

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href="/" className="transition-colors hover:text-foreground">
					GoPath
				</Link>
				<span className="text-faint">/</span>
				<Link
					href="/projects"
					className="transition-colors hover:text-foreground"
				>
					Projects
				</Link>
				<span className="text-faint">/</span>
				<span className="text-foreground">{project.name}</span>
			</div>

			{/* Header */}
			<div
				className={`mb-2 font-mono text-xs uppercase tracking-widest ${c.accent}`}
			>
				{project.tierLabel}
			</div>
			<h1 className="mb-4 font-serif text-5xl text-foreground">
				{project.name}
			</h1>
			<p className="mb-7 text-xl leading-relaxed text-muted">
				{project.tagline}
			</p>

			{/* Meta */}
			<div className="mb-8 flex flex-wrap items-center gap-2">
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

			{/* Mental Models */}
			{project.mentalModels && project.mentalModels.length > 0 && (
				<div className="mb-10">
					<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
						Mental Models
					</div>
					<div className="flex flex-wrap gap-2">
						{project.mentalModels.map((m) => (
							<span
								key={m}
								className="rounded border border-border bg-surface px-3 py-1 text-sm text-muted"
							>
								{m}
							</span>
						))}
					</div>
				</div>
			)}

			{/* System Sections */}
			<ProjectSection
				title={{ en: "System Overview" }}
				blocks={project.systemOverview}
			/>
			<ProjectSection
				title={{ en: "Architecture" }}
				blocks={project.architecture}
			/>
			<ProjectSection
				title={{ en: "Constraints" }}
				blocks={project.constraints}
			/>

			{/* Steps */}
			<div className="mb-6 flex items-baseline justify-between">
				<h2 className="font-serif text-3xl text-foreground">Steps</h2>
				<span className="font-mono text-sm text-faint">
					{stepCue[project.tier]}
				</span>
			</div>

			<ProjectStepTracker
				projectSlug={project.slug}
				totalSteps={project.steps.length}
			/>

			<div className="flex flex-col gap-10">
				{project.steps.map((step) => {
					const prior = priorConceptOccurrence(project.slug, step.uses)
					const priorProject = prior
						? projects.find((p) => p.slug === prior.priorProjectSlug)
						: null

					return (
						<div
							key={step.n}
							className="relative"
							data-step-n={step.n}
						>
							<div className="mb-4 flex items-center gap-4">
								<div
									className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-sm font-semibold ${c.accent}`}
								>
									{step.n}
								</div>
								<h3 className="text-xl font-semibold text-foreground">
									{step.heading.en}
								</h3>
							</div>
							<div className="ml-14">
								{priorProject && prior && (
									<SpacedReuseCallout
										projectName={priorProject.name}
										projectSlug={priorProject.slug}
									/>
								)}
								<ContentRenderer blocks={step.blocks} />
							</div>
						</div>
					)
				})}
			</div>

			{/* Recap */}
			<ProjectSection title={{ en: "Recap" }} blocks={project.recap} />

			{/* Navigation */}
			<div className="mt-14 flex items-center justify-between border-t border-border pt-8">
				{prevProject ? (
					<ProjectNavLink
						href={`/projects/${prevProject.slug}`}
						projectSlug={prevProject.slug}
						direction="prev"
						label={prevProject.name}
						className="group flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
					>
						<span>←</span>
						<span>{prevProject.name}</span>
					</ProjectNavLink>
				) : (
					<div />
				)}
				{nextProject && (
					<ProjectNavLink
						href={`/projects/${nextProject.slug}`}
						projectSlug={nextProject.slug}
						direction="next"
						label={nextProject.name}
						className={`flex items-center gap-2 font-mono text-sm font-semibold transition-opacity hover:opacity-75 ${c.accent}`}
					>
						<span>{nextProject.name}</span>
						<span>→</span>
					</ProjectNavLink>
				)}
			</div>
		</main>
	)
}
