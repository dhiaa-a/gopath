import Link from "next/link"
import { notFound } from "next/navigation"
import { getTier0Lesson, tier0Lessons } from "@/lib/tier0"
import { ContentRenderer } from "@/components/ContentRenderer"
import { RetrievalPrompts } from "@/components/RetrievalPrompts"
import { GoCode } from "@/components/GoCode"
import { playgroundUrl } from "@/lib/playground"
import { VisitTracker } from "@/components/VisitTracker"
import { LessonMarker } from "@/components/LessonMarker"
import { localePath, toLang, ui } from "@/lib/i18n"
import { TranslationNotice } from "@/components/TranslationNotice"
import { blocksTranslated } from "@/lib/content"

export function generateStaticParams() {
	return tier0Lessons.map((l) => ({ slug: l.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const lesson = getTier0Lesson(slug)
	if (!lesson) return {}
	return {
		title: `${lesson.title} — Basics — GoPath`,
		description: lesson.tagline,
	}
}

export default async function BasicsLessonPage({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const lesson = getTier0Lesson(slug)
	if (!lesson) notFound()

	const ordered = [...tier0Lessons].sort((a, b) => a.order - b.order)
	const idx = ordered.findIndex((l) => l.slug === lesson.slug)
	const prev = idx > 0 ? ordered[idx - 1] : null
	const next = idx < ordered.length - 1 ? ordered[idx + 1] : null

	// After the last lesson, send the learner to the ready check.
	const nextHref = lp(
		next ? `/basics/${next.slug}` : "/orientation/ready-check",
	)
	const nextLabel = next ? next.title : tr.common.readyCheck

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<VisitTracker
				href={lp(`/basics/${lesson.slug}`)}
				label={lesson.title}
			/>

			<TranslationNotice
				lang={lang}
				translated={blocksTranslated(
					[...lesson.intro, ...lesson.after],
					lang,
				)}
			/>

			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href={lp("/")} className="transition-colors hover:text-foreground">
					GoPath
				</Link>
				<span className="text-faint">/</span>
				<Link
					href={lp("/basics")}
					className="transition-colors hover:text-foreground"
				>
					{tr.home.basicsName}
				</Link>
				<span className="text-faint">/</span>
				<span className="text-foreground">{lesson.title}</span>
			</div>

			{/* Header */}
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted">
				<span>
					{tr.common.lesson} {lesson.order} {tr.common.of} {ordered.length}
				</span>
				<span className="text-faint">·</span>
				<span>
					{lesson.estimatedMinutes} {tr.common.minutes}
				</span>
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{lesson.title}
			</h1>
			<p className="mb-10 text-lg text-muted">{lesson.tagline}</p>

			{/* Intro */}
			<div className="mb-8">
				<ContentRenderer blocks={lesson.intro} lang={lang} />
			</div>

			{/* The program */}
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-serif text-xl text-foreground">
					The program
				</h2>
				<a
					href={playgroundUrl(lesson.program)}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-go-cyan"
				>
					<span>▶</span>
					<span>Run in Playground</span>
				</a>
			</div>
			<div className="mb-8 overflow-hidden rounded-lg border border-border bg-[var(--color-code-bg)] text-sm">
				<div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-2">
					<span aria-hidden="true" className="h-[7px] w-[7px] bg-m-accent" />
					<span className="ml-1 font-mono text-xs text-muted">
						main.go
					</span>
				</div>
				<pre className="overflow-x-auto p-4 leading-7">
					<GoCode code={lesson.program} />
				</pre>
			</div>

			{/* After the program */}
			<div className="mb-10">
				<ContentRenderer blocks={lesson.after} lang={lang} />
			</div>

			{/* Retrieval prompts */}
			<RetrievalPrompts prompts={lesson.retrievalPrompts} lang={lang} />

			<div className="mt-10">
				<LessonMarker slug={lesson.slug} />
			</div>

			{/* Prev / next navigation */}
			<div className="mt-8 flex items-center justify-between border-t border-border pt-8">
				{prev ? (
					<Link
						href={lp(`/basics/${prev.slug}`)}
						className="group flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
					>
						<span aria-hidden="true" className="m-arrow">←</span>
						<span>{prev.title}</span>
					</Link>
				) : (
					<div />
				)}

				<Link
					href={nextHref}
					className="flex items-center gap-2 font-mono text-sm font-semibold text-muted transition-colors hover:text-foreground"
				>
					<span>{nextLabel}</span>
					<span aria-hidden="true" className="m-arrow">→</span>
				</Link>
			</div>
		</main>
	)
}
