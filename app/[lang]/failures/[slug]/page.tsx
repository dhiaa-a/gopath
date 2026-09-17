import Link from "next/link"
import { notFound } from "next/navigation"
import { failures } from "@/lib/failures"
import { concepts } from "@/lib/concepts"
import { Reveal } from "@/components/Reveal"
import { localePath, localizeHtml, toLang, ui } from "@/lib/i18n"
import { TranslationNotice } from "@/components/TranslationNotice"

export function generateStaticParams() {
	return failures.map((f) => ({ slug: f.slug }))
}

export default async function FailurePage({
	params,
}: {
	params: Promise<{ lang: string; slug: string }>
}) {
	const { lang: rawLang, slug } = await params
	const lang = toLang(rawLang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const failure = failures.find((f) => f.slug === slug)
	if (!failure) notFound()

	const related = failure.relatedSlugs
		.map((s) => concepts.find((c) => c.slug === s))
		.filter(Boolean) as typeof concepts

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<TranslationNotice lang={lang} translated={false} />
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
				<Link
					href={lp("/failures")}
					className="text-faint transition-colors hover:text-foreground"
				>
					Failure labs
				</Link>
				<span className="text-faint">/</span>
				<span className="text-go-amber">{failure.category}</span>
			</div>
			<h1 className="mb-2 font-serif text-4xl text-foreground">
				{failure.name}
			</h1>
			<p className="mb-4 text-muted">{failure.tagline}</p>
			<p className="mb-10 text-sm text-muted">
				Teaches most after Tier {failure.unlockTier}. A suggestion, not
				a gate: nothing here is locked.
			</p>

			{/* The report, as it arrives */}
			<section className="mb-10 rounded-lg border border-border border-s-4 border-s-go-amber bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					The report
				</div>
				<div
					className="text-sm leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]"
					dangerouslySetInnerHTML={{ __html: localizeHtml(failure.symptom, lang) }}
				/>
			</section>

			{/* Reproduce */}
			<section className="mb-10 rounded-lg border border-border bg-surface p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-teal">
					Reproduce it
				</div>
				<p className="mb-3 text-sm text-muted">
					The lab lives at{" "}
					<a
						href={`https://github.com/dhiaa-a/gopath/tree/main/${failure.labPath}`}
						className="font-mono text-go-cyan hover:underline"
					>
						{failure.labPath}
					</a>
					. Read SYMPTOM.md there, run the program, and commit to a
					diagnosis before reading past this box.
				</p>
				<pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-sm text-foreground">
					{failure.runCommand}
				</pre>
			</section>

			{/* Tools */}
			<section className="mb-10">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-go-cyan">
					Reach for
				</div>
				<ol className="flex flex-col gap-2">
					{failure.tools.map((tool, i) => (
						<li
							key={i}
							className="flex items-baseline gap-3 text-sm text-muted"
						>
							<span className="font-mono text-xs text-faint">
								{i + 1}.
							</span>
							{tool}
						</li>
					))}
				</ol>
			</section>

			{/* Diagnosis */}
			<section className="mb-10">
				<div className="mb-4 font-mono text-xs uppercase tracking-widest text-go-cyan">
					The diagnosis
				</div>
				{/* A single spine behind the step numbers, not a card per step: it
				    reads as one line of reasoning instead of N unrelated boxes. */}
				<div className="relative flex flex-col gap-10">
					<span
						aria-hidden="true"
						className="absolute bottom-5 start-[15px] top-5 w-[2px] bg-border"
					/>
					{failure.diagnosis.map((step, i) => (
						<div key={i} className="relative flex gap-4">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface font-mono text-xs text-go-cyan">
								{String(i + 1).padStart(2, "0")}
							</span>
							<div className="min-w-0 flex-1 pt-0.5">
								<h2 className="mb-2 font-semibold text-foreground">
									{step.title}
								</h2>
								<div
									className="max-w-[65ch] text-sm leading-relaxed text-muted [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_em]:text-foreground"
									dangerouslySetInnerHTML={{ __html: localizeHtml(step.body, lang) }}
								/>
								{step.command && (
									<pre className="mt-3 overflow-x-auto rounded bg-bg p-3 font-mono text-sm text-go-teal">
										{step.command}
									</pre>
								)}
								{step.output && (
									<pre className="mt-2 overflow-x-auto rounded bg-bg p-3 font-mono text-xs leading-relaxed text-muted">
										{step.output}
									</pre>
								)}
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Fix */}
			<section className="mb-10 rounded-lg border border-border border-s-4 border-s-go-teal bg-go-teal/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-teal">
					The fix
				</div>
				<div
					className="text-sm leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]"
					dangerouslySetInnerHTML={{ __html: localizeHtml(failure.fix, lang) }}
				/>
			</section>

			{/* Production, behind the reveal */}
			<section className="mb-10">
				<Reveal prompt="how does this show up in production?">
					<div className="rounded-lg border border-border border-s-4 border-s-go-amber bg-surface p-6">
						<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
							In production
						</div>
						<div
							className="text-sm leading-relaxed text-muted [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_em]:text-foreground"
							dangerouslySetInnerHTML={{
								__html: localizeHtml(failure.production, lang),
							}}
						/>
					</div>
				</Reveal>
			</section>

			{/* Scar — the one deliberately different beat on the page, kept plain */}
			<section className="mb-10 rounded-lg border-s-4 border-go-amber bg-surface p-6">
				<div className="mb-1 font-mono text-xs uppercase tracking-widest text-faint">
					The scar
				</div>
				<p className="font-serif text-lg text-foreground">
					{failure.scar}
				</p>
			</section>

			{/* Related concepts */}
			{related.length > 0 && (
				<section className="mb-4">
					<div className="mb-3 font-mono text-xs uppercase tracking-widest text-faint">
						The mechanics, in depth
					</div>
					<div className="flex flex-wrap gap-2">
						{related.map((c) => (
							<Link
								key={c.slug}
								href={lp(`/concepts/${c.slug}`)}
								className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-foreground"
							>
								{c.name}
							</Link>
						))}
					</div>
				</section>
			)}
		</main>
	)
}
