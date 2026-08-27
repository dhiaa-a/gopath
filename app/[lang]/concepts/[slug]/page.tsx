import Link from "next/link"
import { notFound } from "next/navigation"
import { getConcept, concepts } from "@/lib/concepts"
import { projects } from "@/lib/projects"
import { conceptToProjects } from "@/lib/relations"
import { walkthroughsForConcept } from "@/lib/source"
import { GoCode } from "@/components/GoCode"
import { RetrievalPrompts } from "@/components/RetrievalPrompts"
import { playgroundUrl } from "@/lib/playground"
import { localePath, localizeHtml, toLang, ui } from "@/lib/i18n"
import { TranslationNotice } from "@/components/TranslationNotice"

export function generateStaticParams() {
	return concepts.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const concept = getConcept(slug)
	if (!concept) return {}
	return {
		title: `${concept.name} — GoPath Concepts`,
		description: concept.tagline,
	}
}

export default async function ConceptPage({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const concept = getConcept(slug)
	if (!concept) notFound()

	const relatedConcepts = concept.relatedSlugs
		.map((s) => concepts.find((c) => c.slug === s))
		.filter(Boolean) as typeof concepts

	const sourceReads = walkthroughsForConcept(concept.slug)

	const practiceLinks = conceptToProjects(concept.slug)
		.slice(0, 3)
		.map(({ projectSlug, stepN }) => ({
			project: projects.find((p) => p.slug === projectSlug),
			stepN,
		}))
		.filter(
			(
				item,
			): item is {
				project: NonNullable<typeof item.project>
				stepN: string
			} => item.project !== undefined,
		)

	const tierColors = {
		1: "text-go-cyan",
		2: "text-go-teal",
		3: "text-go-amber",
	} as const

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<TranslationNotice lang={lang} translated={false} />
			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href={lp("/")} className="transition-colors hover:text-foreground">
					GoPath
				</Link>
				<span>/</span>
				<Link
					href={lp("/concepts")}
					className="transition-colors hover:text-foreground"
				>
					Concepts
				</Link>
				<span>/</span>
				<span className="text-foreground">{concept.name}</span>
			</div>

			{/* Header */}
			<div className="mb-1 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Concept
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{concept.name}
			</h1>
			<p className="mb-10 text-lg text-muted">{concept.tagline}</p>

			{/* Mental model — summary folds in as the definition above the schema-builder */}
			<section className="mb-8">
				<p
					className="mb-4 leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: localizeHtml(concept.summary, lang) }}
				/>
				<div className="rounded-lg border border-go-cyan/20 bg-go-cyan/5 p-6">
					<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
						Mental model
					</div>
					<p
						className="leading-relaxed text-muted"
						dangerouslySetInnerHTML={{ __html: localizeHtml(concept.mentalModel, lang) }}
					/>
				</div>
			</section>

			{/* Retrieval prompts */}
			<RetrievalPrompts prompts={concept.retrievalPrompts} lang={lang} />

			{/* Code example */}
			<section className="mb-8">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-serif text-xl text-foreground">
						Code example
					</h2>
					<a
						href={playgroundUrl(concept.codeExample)}
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
						<span aria-hidden="true" className="h-[7px] w-[7px] bg-m-accent" />
						<span className="ml-2 font-mono text-xs text-muted">
							example.go
						</span>
					</div>
					<pre className="overflow-x-auto p-5 font-mono text-sm leading-7 text-foreground">
						<GoCode code={concept.codeExample} />
					</pre>
				</div>
				<p
					className="mt-3 text-sm leading-relaxed text-muted"
					dangerouslySetInnerHTML={{
						__html: localizeHtml(concept.codeExplanation, lang),
					}}
				/>
			</section>

			{/* Why Go made this choice */}
			<section className="mb-8 rounded-lg border border-go-amber/20 bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					Why Go made this choice
				</div>
				<p
					className="leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: localizeHtml(concept.designRationale, lang) }}
				/>
			</section>

			{/* Common mistakes — collapsed by default */}
			<section className="mb-10">
				<details>
					<summary className="mb-4 flex cursor-pointer list-none items-center justify-between">
						<h2 className="font-serif text-xl text-foreground">
							Common mistakes
						</h2>
						<span className="font-mono text-xs text-muted">
							click to expand
						</span>
					</summary>
					<div className="flex flex-col gap-3">
						{concept.commonMistakes.map((m, i) => (
							<div
								key={i}
								className="rounded-lg border border-border bg-surface p-5"
							>
								<div className="mb-1.5 flex items-center gap-2">
									<span className="font-mono text-xs text-m-accent-ink">
										✗
									</span>
									<span className="font-semibold text-foreground">
										{m.title}
									</span>
								</div>
								<p
									className="text-sm leading-relaxed text-muted"
									dangerouslySetInnerHTML={{ __html: localizeHtml(m.body, lang) }}
								/>
							</div>
						))}
					</div>
				</details>
			</section>

			{/* Related concepts */}
			{relatedConcepts.length > 0 && (
				<section className="mb-10">
					<h2 className="mb-4 font-serif text-xl text-foreground">
						Related concepts
					</h2>
					<div className="flex flex-wrap gap-2">
						{relatedConcepts.map((c) => (
							<Link
								key={c.slug}
								href={lp(`/concepts/${c.slug}`)}
								className="rounded-lg border border-border bg-surface px-4 py-2.5 transition-colors hover:border-go-cyan/40"
							>
								<div className="font-semibold text-foreground">
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

			{/* Read the source */}
			{sourceReads.length > 0 && (
				<section className="mb-10">
					<h2 className="mb-2 font-serif text-xl text-foreground">
						Read the source
					</h2>
					<p className="mb-4 text-sm text-muted">
						The standard library implements this. These walkthroughs
						read the real file with you, line by line.
					</p>
					<div className="flex flex-wrap gap-2">
						{sourceReads.map((w) => (
							<Link
								key={w.slug}
								href={lp(`/source/${w.slug}`)}
								className="rounded-lg border border-border bg-surface px-4 py-2.5 transition-colors hover:border-go-cyan/40"
							>
								<div className="font-semibold text-foreground">
									{w.name}
								</div>
								<div className="mt-0.5 font-mono text-xs text-muted">
									{w.entryFile}
								</div>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* See it in practice */}
			<section className="rounded-lg border border-border bg-surface p-6">
				<h2 className="mb-4 font-serif text-xl text-foreground">
					See it in practice
				</h2>
				<p className="mb-4 text-sm text-muted">
					The best way to learn{" "}
					<strong className="text-foreground">{concept.name}</strong> is to
					use it in a real project.
				</p>
				{practiceLinks.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{practiceLinks.map(({ project: p, stepN }) => (
							<Link
								key={`${p.slug}-${stepN}`}
								href={lp(`/projects/${p.slug}`)}
								className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 transition-colors hover:border-go-cyan/30"
							>
								<span
									className={`font-mono text-xs font-semibold ${tierColors[p.tier]}`}
								>
									{p.code}
								</span>
								<div>
									<div className="text-sm font-semibold text-foreground">
										{p.name}
									</div>
									<div className="text-xs text-muted">
										Step {stepN}
									</div>
								</div>
							</Link>
						))}
					</div>
				) : (
					<p className="text-sm text-muted">
						No projects use this concept explicitly yet.
					</p>
				)}
			</section>
		</main>
	)
}
