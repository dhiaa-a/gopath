import Link from "next/link"
import { notFound } from "next/navigation"
import { getProject, projects } from "@/lib/projects"
import { priorConceptOccurrence } from "@/lib/relations"
import { walkthroughsForProject } from "@/lib/source"
import { ContentRenderer } from "@/components/ContentRenderer"
import { LabCard } from "@/components/LabCard"
import { ProjectSection } from "@/components/ProjectSection"
import { SpacedReuseCallout } from "@/components/SpacedReuseCallout"
import { StepRecap } from "@/components/StepRecap"
import { PageNav, type PageNavItem } from "@/components/PageNav"
import { Appear } from "@/components/Motion"
import { VisitTracker } from "@/components/VisitTracker"
import { StepMarker } from "@/components/StepMarker"
import { ProgressBadge } from "@/components/ProgressBadge"
import { stepId } from "@/lib/progress-ids"

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
	const sourceReads = walkthroughsForProject(project.slug)
	const currentIdx = projects.findIndex((p) => p.slug === project.slug)
	const prevProject = currentIdx > 0 ? projects[currentIdx - 1] : null
	const nextProject =
		currentIdx < projects.length - 1 ? projects[currentIdx + 1] : null

	// Built from what the page actually renders, so a project without an
	// architecture section does not get a rail entry pointing at nothing.
	const navItems: PageNavItem[] = [
		...(project.systemOverview
			? [{ id: "overview", label: "System overview" }]
			: []),
		...(project.architecture
			? [{ id: "architecture", label: "Architecture" }]
			: []),
		...(project.constraints
			? [{ id: "constraints", label: "Constraints" }]
			: []),
		...project.steps.map((s) => ({
			id: `step-${s.n}`,
			label: s.heading.en,
			n: s.n,
		})),
		...(project.recap ? [{ id: "recap", label: "Recap" }] : []),
	]

	return (
		<div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-[56px] px-6 py-16 xl:grid-cols-[minmax(0,760px)_220px] xl:justify-center">
			<main className="min-w-0 xl:col-start-1">
			<VisitTracker
				href={`/projects/${project.slug}`}
				label={project.name}
			/>
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
					⏱ {project.estimatedTime} to build
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

			{/* Lab */}
			{project.lab && <LabCard lab={project.lab} tier={project.tier} />}

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
				id="overview"
				title={{ en: "System Overview" }}
				blocks={project.systemOverview}
			/>
			<ProjectSection
				id="architecture"
				title={{ en: "Architecture" }}
				blocks={project.architecture}
			/>
			<ProjectSection
				id="constraints"
				title={{ en: "Constraints" }}
				blocks={project.constraints}
			/>

			{/* Steps */}
			<div className="mb-6 flex items-baseline justify-between border-b-2 border-border pb-3">
				<h2 className="flex items-baseline gap-3 text-3xl text-foreground">
					Steps{" "}
					<span className="font-mono text-base font-normal text-m-faint">
						({project.steps.length})
					</span>
					<ProgressBadge
						ids={project.steps.map((s) => stepId(project.slug, s.n))}
					/>
				</h2>
				<span className="font-mono text-sm text-m-faint">
					{stepCue[project.tier]}
				</span>
			</div>

			{/* A single spine behind the markers rather than a rule per step:
			    it makes the sequence read as one run of work instead of ten
			    unrelated blocks, which is most of why this page felt endless. */}
			<div className="relative flex flex-col gap-12">
				<span
					aria-hidden="true"
					className="absolute bottom-6 left-[19px] top-6 w-[2px] bg-border"
				/>
				{project.steps.map((step) => {
					const prior = priorConceptOccurrence(project.slug, step.uses)
					const priorProject = prior
						? projects.find((p) => p.slug === prior.priorProjectSlug)
						: null

					return (
						<Appear
							key={step.n}
							className="relative scroll-mt-[110px]"
						>
							<div
								id={`step-${step.n}`}
								className="mb-4 flex items-center gap-4 scroll-mt-[110px]"
							>
								<StepMarker
									projectSlug={project.slug}
									n={step.n}
									accentClass={c.accent}
								/>
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
								{step.retrievalPrompt && (
									<StepRecap prompt={step.retrievalPrompt} />
								)}
							</div>
						</Appear>
					)
				})}
			</div>

			{/* Recap */}
			<div className="mt-12">
				<ProjectSection
					id="recap"
					title={{ en: "Recap" }}
					blocks={project.recap}
				/>
			</div>

			{/* Read the source */}
			{sourceReads.length > 0 && (
				<section className="mb-10">
					<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
						Read the source
					</div>
					<p className="mb-4 text-sm text-muted">
						This project leans on standard library code you never had
						to open. These walkthroughs open it and read it line by
						line.
					</p>
					<div className="flex flex-col gap-2">
						{sourceReads.map((w) => (
							<Link
								key={w.slug}
								href={`/source/${w.slug}`}
								className="group rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-go-cyan/40"
							>
								<div className="flex items-baseline justify-between gap-3">
									<span className="text-sm font-semibold text-foreground group-hover:text-go-cyan">
										{w.name}
									</span>
									<code className="shrink-0 font-mono text-[11px] text-muted">
										{w.entryFile}
									</code>
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* Navigation */}
			<div className="mt-14 flex items-center justify-between border-t border-border pt-8">
				{prevProject ? (
					<Link
						href={`/projects/${prevProject.slug}`}
						className="group flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
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
						<span className="m-arrow">→</span>
					</Link>
				)}
			</div>
			</main>

			<aside className="xl:col-start-2 xl:row-start-1">
				<PageNav items={navItems} />
			</aside>
		</div>
	)
}
