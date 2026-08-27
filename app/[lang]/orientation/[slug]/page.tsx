import Link from "next/link"
import { notFound } from "next/navigation"
import {
	getOrientationPage,
	orientationPages,
} from "@/lib/orientation"
import { ContentRenderer } from "@/components/ContentRenderer"
import { RetrievalPrompts } from "@/components/RetrievalPrompts"
import { localePath, toLang, ui } from "@/lib/i18n"
import { TranslationNotice } from "@/components/TranslationNotice"
import { blocksTranslated, t } from "@/lib/content"

export function generateStaticParams() {
	return orientationPages.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const page = getOrientationPage(slug)
	if (!page) return {}
	return {
		title: `${t(page.title, lang)} — ${ui(lang).nav.orientation} — GoPath`,
		description: t(page.tagline, lang),
	}
}

export default async function OrientationPage({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const page = getOrientationPage(slug)
	if (!page) notFound()

	const ordered = [...orientationPages].sort((a, b) => a.order - b.order)
	const idx = ordered.findIndex((p) => p.slug === page.slug)
	const prev = idx > 0 ? ordered[idx - 1] : null
	const next = idx < ordered.length - 1 ? ordered[idx + 1] : null

	// After the last orientation page, send the learner into Tier 1.
	const nextHref = lp(
		next ? `/orientation/${next.slug}` : "/projects/cli-renamer",
	)
	const nextLabel = next
		? t(next.title, lang)
		: tr.common.tier1FirstProject

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<TranslationNotice
				lang={lang}
				translated={blocksTranslated(page.blocks, lang)}
			/>

			{/* Breadcrumb */}
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href={lp("/")} className="transition-colors hover:text-foreground">
					GoPath
				</Link>
				<span className="text-faint">/</span>
				<Link
					href={lp("/orientation")}
					className="transition-colors hover:text-foreground"
				>
					{tr.nav.orientation}
				</Link>
				<span className="text-faint">/</span>
				<span className="text-foreground">{t(page.title, lang)}</span>
			</div>

			{/* Header */}
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted">
				<span>
					{tr.common.step} {page.order} {tr.common.of} {ordered.length}
				</span>
				<span className="text-faint">·</span>
				<span>
					{page.estimatedMinutes} {tr.common.minutes}
				</span>
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{t(page.title, lang)}
			</h1>
			<p className="mb-10 text-lg text-muted">{t(page.tagline, lang)}</p>

			{/* Body */}
			{page.blocks.length > 0 && (
				<div className="mb-10">
					<ContentRenderer blocks={page.blocks} lang={lang} />
				</div>
			)}

			{/* Optional retrieval prompts (ready-check) */}
			{page.retrievalPrompts && page.retrievalPrompts.length > 0 && (
				<RetrievalPrompts
					prompts={page.retrievalPrompts.map((p) => t(p, lang))}
					lang={lang}
				/>
			)}

			{/* Optional CTA */}
			{page.cta && (
				<div className="mb-10 flex justify-center">
					<Link
						href={lp(page.cta.href)}
						className="rounded bg-go-cyan px-6 py-3 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-85"
					>
						{t(page.cta.label, lang)}
					</Link>
				</div>
			)}

			{/* Prev / next navigation */}
			<div className="mt-14 flex items-center justify-between border-t border-border pt-8">
				{prev ? (
					<Link
						href={lp(`/orientation/${prev.slug}`)}
						className="group flex items-center gap-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
					>
						<span aria-hidden="true" className="m-arrow">←</span>
						<span>{t(prev.title, lang)}</span>
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
