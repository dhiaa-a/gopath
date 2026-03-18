import Link from "next/link"
import { notFound } from "next/navigation"
import { getConcept, concepts } from "@/lib/concepts"
import { projects } from "@/lib/projects"

export function generateStaticParams() {
	return concepts.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const concept = await getConcept(slug)
	if (!concept) return {}
	return {
		title: `${concept.name} — GoPath Concepts`,
		description: concept.tagline,
	}
}

export default async function ConceptPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const concept = await getConcept(slug)
	if (!concept) notFound()

	// find projects that use this concept (via tag match)
	const relatedProjects = projects.filter((p) =>
		p.tags.some(
			(t) =>
				t.toLowerCase().replace(/[^a-z0-9]/g, "-") === concept.slug ||
				concept.relatedSlugs.some((r) =>
					t.toLowerCase().includes(r.replace(/-/g, " ")),
				),
		),
	)

	// find other concepts
	const relatedConcepts = concept.relatedSlugs
		.map((s) => concepts.find((c) => c.slug === s))
		.filter(Boolean) as typeof concepts

	const playgroundUrl = `https://go.dev/play/#${encodeURIComponent(concept.codeExample)}`

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href="/" className="transition-colors hover:text-white">
					GoPath
				</Link>
				<span>/</span>
				<Link
					href="/concepts"
					className="transition-colors hover:text-white"
				>
					Concepts
				</Link>
				<span>/</span>
				<span className="text-white">{concept.name}</span>
			</div>

			{/* Header */}
			<div className="mb-1 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Concept
			</div>
			<h1 className="mb-3 font-serif text-4xl text-white">
				{concept.name}
			</h1>
			<p className="mb-10 text-lg text-muted">{concept.tagline}</p>

			{/* Summary */}
			<section className="mb-8">
				<h2 className="mb-3 font-serif text-xl text-white">
					What it is
				</h2>
				<p
					className="leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: concept.summary }}
				/>
			</section>

			{/* Mental model */}
			<section className="mb-8 rounded-lg border border-go-cyan/20 bg-go-cyan/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
					Mental model
				</div>
				<p className="leading-relaxed text-muted">
					{concept.mentalModel}
				</p>
			</section>

			{/* Code example */}
			<section className="mb-8">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-serif text-xl text-white">
						Code example
					</h2>
					<a
						href={`https://go.dev/play`}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-go-cyan"
					>
						<span>▶</span>
						<span>Run in Playground</span>
					</a>
				</div>
				<div className="overflow-hidden rounded-lg border border-border bg-surface">
					<div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-2.5">
						<span className="h-2 w-2 rounded-full bg-red-500/60" />
						<span className="h-2 w-2 rounded-full bg-yellow-500/60" />
						<span className="h-2 w-2 rounded-full bg-green-500/60" />
						<span className="ml-2 font-mono text-xs text-muted">
							example.go
						</span>
					</div>
					<pre className="overflow-x-auto p-5 font-mono text-sm leading-7 text-[#e8f0e8]">
						<code>{concept.codeExample}</code>
					</pre>
				</div>
				<p
					className="mt-3 text-sm leading-relaxed text-muted"
					dangerouslySetInnerHTML={{
						__html: concept.codeExplanation,
					}}
				/>
			</section>

			{/* Coming from */}
			<section className="mb-8 rounded-lg border border-go-amber/20 bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					Coming from another language?
				</div>
				<p
					className="leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: concept.fromOtherLang }}
				/>
			</section>

			{/* Common mistakes */}
			<section className="mb-10">
				<h2 className="mb-4 font-serif text-xl text-white">
					Common mistakes
				</h2>
				<div className="flex flex-col gap-3">
					{concept.commonMistakes.map((m, i) => (
						<div
							key={i}
							className="rounded-lg border border-border bg-surface p-5"
						>
							<div className="mb-1.5 flex items-center gap-2">
								<span className="font-mono text-xs text-red-400">
									✗
								</span>
								<span className="font-semibold text-white">
									{m.title}
								</span>
							</div>
							<p
								className="text-sm leading-relaxed text-muted"
								dangerouslySetInnerHTML={{ __html: m.body }}
							/>
						</div>
					))}
				</div>
			</section>

			{/* Related concepts */}
			{relatedConcepts.length > 0 && (
				<section className="mb-10">
					<h2 className="mb-4 font-serif text-xl text-white">
						Related concepts
					</h2>
					<div className="flex flex-wrap gap-2">
						{relatedConcepts.map((c) => (
							<Link
								key={c.slug}
								href={`/concepts/${c.slug}`}
								className="rounded-lg border border-border bg-surface px-4 py-2.5 transition-colors hover:border-go-cyan/40"
							>
								<div className="font-semibold text-white">
									{c.name}
								</div>
								<div className="mt-0.5 text-xs text-muted">
									{c.tagline}
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* See it in practice */}
			<section className="rounded-lg border border-border bg-surface p-6">
				<h2 className="mb-4 font-serif text-xl text-white">
					See it in practice
				</h2>
				<p className="mb-4 text-sm text-muted">
					The best way to learn{" "}
					<strong className="text-white">{concept.name}</strong> is to
					use it in a real project.
				</p>
				<div className="flex flex-wrap gap-2">
					{/* Link to tier-appropriate projects */}
					{projects
						.filter(
							(p) =>
								p.tags.some(
									(t) =>
										concept.slug.includes(
											t
												.toLowerCase()
												.replace(/[^a-z]/g, ""),
										) ||
										t
											.toLowerCase()
											.includes(
												concept.slug.replace(/-/g, ""),
											),
								) ||
								concept.relatedSlugs.some((r) =>
									p.slug.includes(
										r.replace(/-/g, "").slice(0, 6),
									),
								),
						)
						.slice(0, 3)
						.concat(
							// fallback: grab first project if nothing matched
							projects
								.filter(
									(p) =>
										!projects
											.filter((p2) =>
												p2.tags.some(
													(t) =>
														concept.slug.includes(
															t
																.toLowerCase()
																.replace(
																	/[^a-z]/g,
																	"",
																),
														) ||
														t
															.toLowerCase()
															.includes(
																concept.slug.replace(
																	/-/g,
																	"",
																),
															),
												),
											)
											.includes(p),
								)
								.slice(0, 1),
						)
						.slice(0, 3)
						.map((p) => {
							const tierColors = {
								1: "text-go-cyan",
								2: "text-go-teal",
								3: "text-go-amber",
							} as const
							return (
								<Link
									key={p.slug}
									href={`/projects/${p.slug}`}
									className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 transition-colors hover:border-go-cyan/30"
								>
									<span
										className={`font-mono text-xs font-semibold ${tierColors[p.tier]}`}
									>
										{p.code}
									</span>
									<div>
										<div className="text-sm font-semibold text-white">
											{p.name}
										</div>
										<div className="text-xs text-muted">
											{p.estimatedTime}
										</div>
									</div>
								</Link>
							)
						})}
				</div>
			</section>
		</main>
	)
}
