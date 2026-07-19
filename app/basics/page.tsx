import Link from "next/link"
import { tier0Lessons } from "@/lib/tier0"

export const metadata = {
	title: "Basics — GoPath",
	description:
		"Tier 0: Go syntax taught in-house. Fourteen micro-lessons from your first compiled binary to error handling, each built around one small program you type and run.",
}

export default function BasicsIndexPage() {
	const ordered = [...tier0Lessons].sort((a, b) => a.order - b.order)
	const totalMinutes = ordered.reduce(
		(sum, l) => sum + l.estimatedMinutes,
		0,
	)
	const totalHours = Math.round((totalMinutes / 60) * 10) / 10

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
				Basics · Tier 0
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				Go syntax, taught by typing it.
			</h1>
			<p className="mb-10 max-w-xl text-muted">
				Fourteen micro-lessons for developers who already program.
				Each one teaches a syntax cluster through a single small
				program you type, run, and often deliberately break, then
				locks it in with retrieval prompts. About {totalHours} hours
				total, and you leave ready for Tier 1.
			</p>

			<ol className="flex flex-col gap-3">
				{ordered.map((lesson) => (
					<li key={lesson.slug}>
						<Link
							href={`/basics/${lesson.slug}`}
							className="group flex items-start gap-4 rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-border2 hover:shadow-sm"
						>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-bg font-mono text-sm text-muted">
								{lesson.order}
							</div>
							<div className="min-w-0 flex-1">
								<div className="mb-1 font-semibold text-foreground group-hover:text-muted">
									{lesson.title}
								</div>
								<div className="text-sm leading-relaxed text-muted">
									{lesson.tagline}
								</div>
							</div>
							<div className="shrink-0 self-center font-mono text-xs text-faint">
								{lesson.estimatedMinutes} min
							</div>
						</Link>
					</li>
				))}
			</ol>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					Already read Go without squinting?
				</p>
				<p className="text-sm text-muted">
					Take the{" "}
					<Link
						href="/orientation/ready-check"
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						ready check
					</Link>{" "}
					and skip straight to{" "}
					<Link
						href="/projects/cli-renamer"
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						Tier 1 — CLI renamer →
					</Link>
				</p>
			</div>
		</main>
	)
}
