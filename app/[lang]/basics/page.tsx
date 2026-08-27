import Link from "next/link"
import { tier0Lessons } from "@/lib/tier0"
import { lessonId } from "@/lib/progress-ids"
import { ProgressBadge } from "@/components/ProgressBadge"
import { LessonNumber } from "@/components/LessonMarker"
import { localePath, toLang, ui } from "@/lib/i18n"

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const tr = ui(toLang((await params).lang))
	return {
		title: tr.meta.basicsTitle,
		description: tr.meta.basicsDesc,
	}
}

export default async function BasicsIndexPage({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	const ordered = [...tier0Lessons].sort((a, b) => a.order - b.order)
	const totalMinutes = ordered.reduce(
		(sum, l) => sum + l.estimatedMinutes,
		0,
	)
	const totalHours = Math.round((totalMinutes / 60) * 10) / 10
	const allLessonIds = ordered.map((l) => lessonId(l.slug))

	return (
		<main className="mx-auto max-w-3xl px-6 py-16">
			<div className="mb-2 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted">
				<span>{tr.index.basicsKicker}</span>
				<ProgressBadge ids={allLessonIds} />
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{tr.index.basicsTitle}
			</h1>
			<p className="mb-10 max-w-xl text-muted">
				{tr.index.basicsLead.replace("{n}", String(totalHours))}
			</p>

			<ol className="flex flex-col gap-3">
				{ordered.map((lesson) => (
					<li key={lesson.slug}>
						<Link
							href={lp(`/basics/${lesson.slug}`)}
							className="group flex items-start gap-4 border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-border2 hover:shadow-sm"
						>
							<LessonNumber
								slug={lesson.slug}
								order={lesson.order}
							/>
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
					{tr.index.basicsSkipTitle}
				</p>
				<p className="text-sm text-muted">
					{tr.index.basicsSkipBody}{" "}
					<Link
						href={lp("/orientation/ready-check")}
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						{tr.common.readyCheck}
					</Link>{" "}
					{tr.index.basicsSkipBody2}{" "}
					<Link
						href={lp("/projects/cli-renamer")}
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
					>
						{tr.common.tier1FirstProject} →
					</Link>
				</p>
			</div>
		</main>
	)
}
