import Link from "next/link"
import { notFound } from "next/navigation"
import { failures } from "@/lib/failures"
import { concepts } from "@/lib/concepts"
import { Reveal } from "@/components/Reveal"

export function generateStaticParams() {
	return failures.map((f) => ({ slug: f.slug }))
}

export default async function FailurePage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const failure = failures.find((f) => f.slug === slug)
	if (!failure) notFound()

	const related = failure.relatedSlugs
		.map((s) => concepts.find((c) => c.slug === s))
		.filter(Boolean) as typeof concepts

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
				<Link
					href="/failures"
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
			<p className="mb-10 font-mono text-xs text-faint">
				Teaches most after Tier {failure.unlockTier}. A suggestion, not
				a gate: nothing here is locked.
			</p>

			{/* The report, as it arrives */}
			<section className="mb-10 rounded-lg border border-go-amber/30 bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					The report
				</div>
				<div
					className="text-sm leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]"
					dangerouslySetInnerHTML={{ __html: failure.symptom }}
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
				<div className="flex flex-col gap-6">
					{failure.diagnosis.map((step, i) => (
						<div
							key={i}
							className="rounded-lg border border-border bg-surface p-6"
						>
							<div className="mb-2 flex items-baseline gap-3">
								<span className="font-mono text-xs text-go-cyan">
									{String(i + 1).padStart(2, "0")}
								</span>
								<h2 className="font-semibold text-foreground">
									{step.title}
								</h2>
							</div>
							<div
								className="text-sm leading-relaxed text-muted [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_em]:text-foreground"
								dangerouslySetInnerHTML={{ __html: step.body }}
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
					))}
				</div>
			</section>

			{/* Fix */}
			<section className="mb-10 rounded-lg border border-go-teal/30 bg-go-teal/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-teal">
					The fix
				</div>
				<div
					className="text-sm leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]"
					dangerouslySetInnerHTML={{ __html: failure.fix }}
				/>
			</section>

			{/* Production, behind the reveal */}
			<section className="mb-10">
				<Reveal prompt="how does this show up in production?">
					<div className="rounded-lg border border-go-amber/30 bg-surface p-6">
						<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
							In production
						</div>
						<div
							className="text-sm leading-relaxed text-muted [&_code]:rounded [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_em]:text-foreground"
							dangerouslySetInnerHTML={{
								__html: failure.production,
							}}
						/>
					</div>
				</Reveal>
			</section>

			{/* Scar */}
			<section className="mb-10 rounded-lg border-l-4 border-go-amber bg-surface p-6">
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
								href={`/concepts/${c.slug}`}
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
