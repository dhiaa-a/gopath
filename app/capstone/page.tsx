import Link from "next/link"
import { capstone } from "@/lib/capstone"
import { failures } from "@/lib/failures"
import { concepts } from "@/lib/concepts"
import { projects } from "@/lib/projects"

export const metadata = {
	title: "Capstone: linkd — GoPath",
	description:
		"A link shortener with auth, rate limiting, durable storage and metrics. A spec, a black-box suite, four service level objectives, and no guidance at all.",
}

function failureName(slug: string) {
	return failures.find((f) => f.slug === slug)?.name ?? slug
}

export default function CapstonePage() {
	const seedsFromFailures = capstone.seeds.filter((s) => s.failureSlug)

	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				Capstone
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{capstone.name}
			</h1>
			<p className="mb-6 max-w-2xl text-lg text-muted">
				{capstone.tagline}
			</p>

			<div
				className="mb-10 max-w-2xl space-y-4 text-muted [&_p]:leading-relaxed"
				dangerouslySetInnerHTML={{ __html: capstone.why }}
			/>

			{/* How you find out */}
			<section className="mb-12 rounded-lg border border-go-cyan/30 bg-surface p-6">
				<div className="mb-3 font-mono text-xs uppercase tracking-widest text-go-cyan">
					How you find out
				</div>
				<div className="flex flex-col gap-3">
					{capstone.commands.map((c) => (
						<div key={c.command} className="flex flex-col gap-1">
							<span className="font-mono text-[11px] text-faint">
								{c.label}
							</span>
							<code className="block overflow-x-auto rounded bg-bg px-3 py-2 font-mono text-sm text-foreground">
								{c.command}
							</code>
						</div>
					))}
				</div>
				<p className="mt-4 text-sm text-muted">
					Both must pass. The spec lives at{" "}
					<code className="font-mono text-foreground">
						{capstone.specPath}
					</code>{" "}
					and the lab at{" "}
					<code className="font-mono text-foreground">
						{capstone.labPath}
					</code>
					. Neither harness reads your source: they build your package,
					run the binary, and speak HTTP to it.
				</p>
			</section>

			{/* Surface */}
			<section className="mb-12">
				<h2 className="mb-4 font-serif text-2xl text-foreground">
					The surface
				</h2>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full border-collapse text-sm">
						<tbody>
							{capstone.routes.map((r) => (
								<tr
									key={`${r.method} ${r.path}`}
									className="border-b border-border last:border-0"
								>
									<td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-go-cyan">
										{r.method}
									</td>
									<td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-foreground">
										{r.path}
									</td>
									<td className="px-4 py-3 align-top text-muted">
										{r.summary}
									</td>
									<td className="whitespace-nowrap px-4 py-3 align-top text-right font-mono text-[10px] text-faint">
										{r.auth ? "bearer" : "public"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Requirements worth stating */}
			<section className="mb-12">
				<h2 className="mb-1 font-serif text-2xl text-foreground">
					Six things people get wrong
				</h2>
				<p className="mb-5 text-sm text-muted">
					Out of everything in the spec, these are the requirements that
					separate a service that works from one that works on the
					reviewer&apos;s machine.
				</p>
				<div className="flex flex-col gap-3">
					{capstone.requirements.map((req) => (
						<div
							key={req.title}
							className="rounded-lg border border-border bg-surface p-5"
						>
							<p className="mb-2 font-semibold text-foreground">
								{req.title}
							</p>
							<div
								className="space-y-2 text-sm leading-relaxed text-muted [&_code]:font-mono [&_code]:text-foreground"
								dangerouslySetInnerHTML={{ __html: req.body }}
							/>
						</div>
					))}
				</div>
			</section>

			{/* Objectives */}
			<section className="mb-12">
				<h2 className="mb-1 font-serif text-2xl text-foreground">
					The objectives
				</h2>
				<p className="mb-5 text-sm text-muted">
					Four numbers, all of which have to clear. The measured column is
					the reference implementation&apos;s own output, so the bar is
					one something has actually cleared rather than a number that
					sounded strict.
				</p>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-faint">
									Objective
								</th>
								<th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-faint">
									Threshold
								</th>
								<th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-faint">
									Reference measured
								</th>
							</tr>
						</thead>
						<tbody>
							{capstone.objectives.map((o) => (
								<tr
									key={o.name}
									className="border-b border-border last:border-0"
								>
									<td className="px-4 py-3 align-top font-medium text-foreground">
										{o.name}
									</td>
									<td className="px-4 py-3 align-top text-muted">
										{o.threshold}
									</td>
									<td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-go-cyan">
										{o.measured}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Seeded bugs */}
			<section className="mb-12">
				<h2 className="mb-1 font-serif text-2xl text-foreground">
					How the suite is checked
				</h2>
				<p className="mb-3 max-w-2xl text-sm text-muted">
					A suite that has only ever been run against correct code has not
					been tested, it has been agreed with. So every run of{" "}
					<code className="font-mono text-foreground">check.sh</code>{" "}
					breaks the reference on purpose, once per bug below, and
					requires the {capstone.checkCount} checks to notice each time. A
					bug that goes in, compiles, and leaves the suite green is a red
					build.
				</p>
				<p className="mb-5 max-w-2xl text-sm text-muted">
					{seedsFromFailures.length} of the {capstone.seeds.length} come
					straight from the failure labs, so a submission that trips one
					has somewhere to go and read.
				</p>
				<div className="flex flex-col gap-2">
					{capstone.seeds.map((s) => (
						<div
							key={s.name}
							className="rounded-lg border border-border bg-surface p-4"
						>
							<div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
								<code className="font-mono text-sm text-foreground">
									{s.name}
								</code>
								{s.failureSlug ? (
									<Link
										href={`/failures/${s.failureSlug}`}
										className="font-mono text-[11px] text-go-cyan hover:underline"
									>
										{failureName(s.failureSlug)} →
									</Link>
								) : (
									<span className="font-mono text-[11px] text-faint">
										specific to this spec
									</span>
								)}
							</div>
							<p className="mb-2 text-sm text-muted">{s.why}</p>
							<p className="font-mono text-[11px] text-faint">
								caught by {s.caughtBy.join(", ")}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* Blind spots */}
			<section className="mb-12">
				<h2 className="mb-1 font-serif text-2xl text-foreground">
					What the suite cannot see
				</h2>
				<p className="mb-5 max-w-2xl text-sm text-muted">
					Six of the fifteen failure classes have no seeded bug here, and
					the reason is worth more than the seeds that do.
				</p>

				<div className="mb-5 rounded-lg border border-border bg-surface p-5">
					<p className="mb-2 font-semibold text-foreground">
						A lost update is not observable from outside
					</p>
					<p className="mb-3 text-sm leading-relaxed text-muted">
						The first version of the{" "}
						<code className="font-mono text-foreground">data-race</code>{" "}
						bug removed the lock from click counting and fired 250
						concurrent redirects at one link. The suite passed. Every
						time. Two hundred and fifty increments spread across
						milliseconds of HTTP overhead essentially never land in the
						same two nanosecond window, so no count was ever lost.
					</p>
					<p className="text-sm leading-relaxed text-muted">
						The bug that survived instead writes the store&apos;s map
						with no lock held, which the Go runtime detects and stops
						the process for. That is the difference between a race you
						can see from outside and one you cannot. The suite never
						sees a race. It sees the wrong numbers a race eventually
						produces, and it is entirely possible to have the race and
						never see the numbers. This is why{" "}
						<code className="font-mono text-foreground">-race</code>{" "}
						exists, and why passing this suite is evidence rather than
						proof.
					</p>
				</div>

				<div className="flex flex-col gap-2">
					{capstone.blindSpots.map((b) => (
						<div
							key={b.failureSlug}
							className="rounded-lg border border-border bg-surface p-4"
						>
							<Link
								href={`/failures/${b.failureSlug}`}
								className="font-mono text-sm text-go-cyan hover:underline"
							>
								{failureName(b.failureSlug)}
							</Link>
							<div
								className="mt-1 text-sm leading-relaxed text-muted [&_code]:font-mono [&_code]:text-foreground"
								dangerouslySetInnerHTML={{ __html: b.reason }}
							/>
						</div>
					))}
				</div>
			</section>

			{/* Relations */}
			<section className="mb-12 grid gap-6 md:grid-cols-2">
				<div>
					<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
						Built on
					</div>
					<div className="flex flex-wrap gap-2">
						{capstone.relatedProjects.map((slug) => {
							const p = projects.find((x) => x.slug === slug)
							return (
								<Link
									key={slug}
									href={`/projects/${slug}`}
									className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-foreground"
								>
									{p?.name ?? slug}
								</Link>
							)
						})}
					</div>
				</div>
				<div>
					<div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
						Concepts it leans on
					</div>
					<div className="flex flex-wrap gap-2">
						{capstone.relatedConcepts.map((slug) => {
							const c = concepts.find((x) => x.slug === slug)
							return (
								<Link
									key={slug}
									href={`/concepts/${slug}`}
									className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-go-cyan/40 hover:text-foreground"
								>
									{c?.name ?? slug}
								</Link>
							)
						})}
					</div>
				</div>
			</section>

			<div className="rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					When both are green
				</p>
				<p className="text-sm leading-relaxed text-muted">
					The thing you built holds up to the same treatment a reviewer
					would give it. It does what it says, it says what it is doing,
					it stays correct when hit from many directions at once, and it
					does not leak. That is the claim, and it is yours to make once
					these pass.
				</p>
			</div>
		</main>
	)
}
