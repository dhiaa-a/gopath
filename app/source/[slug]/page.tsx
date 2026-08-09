import Link from "next/link"
import { notFound } from "next/navigation"
import { sourceWalkthroughs, getWalkthrough, goSourceVersion } from "@/lib/source"
import { concepts } from "@/lib/concepts"
import { projects } from "@/lib/projects"
import { failures } from "@/lib/failures"
import { GoCode } from "@/components/GoCode"
import { Reveal } from "@/components/Reveal"
import { PageNav, type PageNavItem } from "@/components/PageNav"
import { Appear } from "@/components/Motion"

export function generateStaticParams() {
	return sourceWalkthroughs.map((w) => ({ slug: w.slug }))
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const walkthrough = getWalkthrough(slug)
	if (!walkthrough) return {}
	return {
		title: `Reading ${walkthrough.name} — GoPath`,
		description: walkthrough.tagline,
	}
}

// The walkthrough's prose fields are HTML (see lib/content.ts). Tailwind's
// preflight zeroes paragraph margins and strips list markers, so anything
// rendering one of those fields opts back in through the same scoped
// utilities. Inline <code> is left to the global rule, which is what the
// concept pages do with their HTML fields.
const prose =
	"text-muted [&_em]:text-foreground [&_strong]:text-foreground [&_p+p]:mt-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-2 [&_li]:leading-relaxed [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-border [&_pre]:bg-bg [&_pre]:p-3"

// The excerpt claims a start line; the range it covers is that plus its own
// height. Computed the same way GoCode counts lines so the header and the
// gutter can never disagree.
function lineRange(code: string, startLine: number) {
	const lines = code.split("\n")
	if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
	return { from: startLine, to: startLine + lines.length - 1 }
}

function LinkRow({
	label,
	links,
}: {
	label: string
	links: { href: string; name: string }[]
}) {
	if (links.length === 0) return null
	return (
		<div>
			<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
				{label}
			</div>
			<div className="flex flex-wrap gap-2">
				{links.map((l) => (
					<Link
						key={l.href}
						href={l.href}
						className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-foreground"
					>
						{l.name}
					</Link>
				))}
			</div>
		</div>
	)
}

export default async function SourceWalkthroughPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const walkthrough = getWalkthrough(slug)
	if (!walkthrough) notFound()

	const conceptLinks = walkthrough.relatedConcepts
		.map((s) => concepts.find((c) => c.slug === s))
		.filter((c) => c !== undefined)
		.map((c) => ({ href: `/concepts/${c.slug}`, name: c.name }))

	const projectLinks = walkthrough.relatedProjects
		.map((s) => projects.find((p) => p.slug === s))
		.filter((p) => p !== undefined)
		.map((p) => ({ href: `/projects/${p.slug}`, name: p.name }))

	const failureLinks = (walkthrough.relatedFailures ?? [])
		.map((s) => failures.find((f) => f.slug === s))
		.filter((f) => f !== undefined)
		.map((f) => ({ href: `/failures/${f.slug}`, name: f.name }))

	// One entry per excerpt: the read is the page, and jumping between excerpts
	// is the whole reason a twelve-screen walkthrough needs a rail.
	const navItems: PageNavItem[] = walkthrough.excerpts.map((e, i) => ({
		id: `excerpt-${i + 1}`,
		label: e.title,
		n: String(i + 1),
	}))

	return (
		<div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-[56px] px-6 py-16 xl:grid-cols-[minmax(0,760px)_220px] xl:justify-center">
		<main className="min-w-0 xl:col-start-1">
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
				<Link
					href="/source"
					className="text-faint transition-colors hover:text-foreground"
				>
					Source reading
				</Link>
				<span className="text-faint">/</span>
				<span className="text-go-cyan">package {walkthrough.pkg}</span>
			</div>
			<h1 className="mb-2 font-serif text-4xl text-foreground">
				{walkthrough.name}
			</h1>
			<p className="mb-4 text-muted">{walkthrough.tagline}</p>
			<p className="mb-10 font-mono text-xs text-muted">
				Teaches most after Tier {walkthrough.unlockTier}. A suggestion,
				not a gate: nothing here is locked.
			</p>

			{/* Why this file */}
			<section className="mb-10">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-go-cyan">
					Why this file
				</div>
				<div
					className={prose}
					dangerouslySetInnerHTML={{ __html: walkthrough.why }}
				/>
			</section>

			{/* Open it */}
			<section className="mb-10 rounded-lg border border-go-teal/30 bg-go-teal/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-teal">
					Open it
				</div>
				<p className="mb-3 text-sm text-muted">
					The file is{" "}
					<code className="font-mono text-go-cyan">
						{walkthrough.entryFile}
					</code>
					, relative to your GOROOT. Open it before you read on. Every
					excerpt below is quoted from it, and the line numbers are
					real.
				</p>
				<pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-sm text-foreground">
					{walkthrough.openCommand}
				</pre>
			</section>

			{/* Orientation */}
			<section className="mb-10">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-go-cyan">
					How the file is laid out
				</div>
				<div
					className={prose}
					dangerouslySetInnerHTML={{ __html: walkthrough.orientation }}
				/>
			</section>

			{/* The read */}
			<section className="mb-10">
				<div className="mb-4 font-mono text-xs uppercase tracking-widest text-go-cyan">
					The read
				</div>
				<div className="flex flex-col gap-10">
					{walkthrough.excerpts.map((excerpt, i) => {
						const { from, to } = lineRange(
							excerpt.code,
							excerpt.startLine,
						)
						return (
							<Appear key={i} className="scroll-mt-[110px]">
								<div
									id={`excerpt-${i + 1}`}
									className="mb-3 flex scroll-mt-[110px] items-baseline gap-3"
								>
									<span className="font-mono text-xs text-go-cyan">
										{String(i + 1).padStart(2, "0")}
									</span>
									<h2 className="font-semibold text-foreground">
										{excerpt.title}
									</h2>
								</div>
								<div className="overflow-hidden rounded-lg border border-border bg-[var(--color-code-bg)]">
									<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface2 px-4 py-2">
										<span className="font-mono text-xs text-muted">
											{excerpt.file}
										</span>
										<span className="font-mono text-[11px] text-muted">
											{from === to
												? `line ${from}`
												: `lines ${from} to ${to}`}
										</span>
									</div>
									<pre className="overflow-x-auto p-4 leading-7">
										<GoCode
											code={excerpt.code}
											startLine={excerpt.startLine}
										/>
									</pre>
								</div>
								<div
									className={`mt-4 ${prose}`}
									dangerouslySetInnerHTML={{
										__html: excerpt.notice,
									}}
								/>
							</Appear>
						)
					})}
				</div>
			</section>

			{/* Exercise */}
			<section className="mb-10 rounded-lg border border-go-amber/30 bg-go-amber/5 p-6">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
					Find it yourself
				</div>
				<p className="mb-3 text-sm leading-relaxed text-foreground">
					{walkthrough.exercise.question}
				</p>
				<pre className="mb-4 overflow-x-auto rounded bg-bg p-3 font-mono text-sm text-go-teal">
					{walkthrough.exercise.command}
				</pre>
				<Reveal prompt="show the answer">
					<div className="rounded-lg border border-border bg-surface p-6">
						<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
							The answer
						</div>
						<div
							className={prose}
							dangerouslySetInnerHTML={{
								__html: walkthrough.exercise.answer,
							}}
						/>
					</div>
				</Reveal>
			</section>

			{/* Takeaway */}
			<section className="mb-10 rounded-lg border-l-4 border-go-cyan bg-surface p-6">
				<div className="mb-1 font-mono text-xs uppercase tracking-widest text-faint">
					The takeaway
				</div>
				<p className="font-serif text-lg text-foreground">
					{walkthrough.takeaway}
				</p>
			</section>

			{/* Related */}
			{(conceptLinks.length > 0 ||
				projectLinks.length > 0 ||
				failureLinks.length > 0) && (
				<section className="mb-10 flex flex-col gap-6">
					<LinkRow label="The mechanics, in depth" links={conceptLinks} />
					<LinkRow label="Where you use it" links={projectLinks} />
					<LinkRow
						label="What it looks like when it breaks"
						links={failureLinks}
					/>
				</section>
			)}

			<p className="border-t border-border pt-6 text-sm text-muted">
				Excerpts quoted from the Go standard library at{" "}
				<code className="font-mono">{goSourceVersion}</code>. Full
				attribution and license on the{" "}
				<Link
					href="/source#attribution"
					className="text-go-cyan hover:underline"
				>
					source reading index
				</Link>
				.
			</p>
		</main>

			<aside className="xl:col-start-2 xl:row-start-1">
				<PageNav items={navItems} />
			</aside>
		</div>
	)
}
