import { idioms, idiomAccents } from "@/lib/idioms"
import { localePath, toLang, ui } from "@/lib/i18n"

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const tr = ui(toLang((await params).lang))
	return {
		title: tr.meta.idiomsTitle,
		description: tr.index.idiomsLead,
	}
}

// Colour per accent is presentation, so it lives here; the accent list
// itself is data (lib/content/idioms) where validate.ts can hold it to
// "every exercise sits in exactly one known accent". Fallback so a future
// accent renders instead of crashing the static export.
const accentStyles: Record<string, { color: string; border: string }> = {
	Java: { color: "text-go-amber", border: "border-go-amber/20" },
	Python: { color: "text-go-teal", border: "border-go-teal/20" },
	C: { color: "text-go-cyan", border: "border-go-cyan/20" },
	"Any language": { color: "text-go-amber", border: "border-go-amber/20" },
}
const fallbackStyle = { color: "text-muted", border: "border-border" }

export default async function IdiomsPage({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-teal">
				{tr.index.idiomsKicker}
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{tr.index.idiomsTitle}
			</h1>
			<p className="mb-6 max-w-2xl text-muted">
				{tr.index.idiomsLead}
			</p>
			<p className="mb-6 max-w-2xl text-sm text-faint">
				Every exercise lives in{" "}
				<code className="font-mono text-muted">labs/idioms/</code> and
				shares one lint config,{" "}
				<code className="font-mono text-muted">
					labs/idioms/.golangci.yml
				</code>
				, enforced by golangci-lint v2 (the track README pins the
				install). None of these gate anything: the tier note on each
				is a suggestion about when it will teach the most, nothing
				more.
			</p>
			<div className="mb-12 rounded-lg border border-border bg-surface p-4 font-mono text-sm text-muted">
				<div>$ go test ./... &nbsp;&nbsp;# green now, must stay green</div>
				<div>$ golangci-lint run &nbsp;&nbsp;# red now, must reach zero</div>
			</div>

			<div className="flex flex-col gap-10">
				{idiomAccents.map((accent) => {
					const style = accentStyles[accent] ?? fallbackStyle
					const group = idioms.filter((i) => i.accent === accent)
					if (group.length === 0) return null

					return (
						<div key={accent}>
							<div
								className={`mb-4 font-mono text-xs uppercase tracking-widest ${style.color}`}
							>
								{accent === "Any language"
									? "Any accent"
									: `${accent} accent`}
							</div>
							<div className="grid grid-cols-1 gap-3">
								{group.map((ex) => (
									<div
										key={ex.slug}
										className={`rounded-lg border ${style.border} bg-surface p-5`}
									>
										<div className="mb-1 flex items-baseline justify-between gap-3">
											<span className="font-semibold text-foreground">
												{ex.name}
											</span>
											<span className="shrink-0 font-mono text-[10px] text-faint">
												{ex.suggestedAfter}+
											</span>
										</div>
										<p className="mb-3 text-sm leading-relaxed text-muted">
											{ex.tagline}
										</p>
										<ul className="mb-3 flex flex-col gap-1">
											{ex.mistakes.map((m) => (
												<li
													key={m}
													className="text-xs leading-relaxed text-muted"
												>
													<span
														className={`mr-2 ${style.color}`}
													>
														×
													</span>
													{m}
												</li>
											))}
										</ul>
										<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
											<code className="font-mono text-[11px] text-faint">
												{ex.labPath}
											</code>
											<span className="font-mono text-[10px] text-faint">
												fires:{" "}
												{ex.linters.join(", ")}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)
				})}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					How to work an exercise
				</p>
				<p className="text-sm text-muted">
					From the exercise directory: run the suite, run the
					linter, and read the exercise README for the exact
					mistakes it trains against. Refactor until both commands
					are green at once. The suite pins behavior through a
					stable public surface, so every rename, collapse, and
					deletion inside is yours to make. When you are done, or
					stuck on what a finding means,{" "}
					<code className="font-mono">REVIEW.md</code> walks the
					same refactor with a senior reviewer&apos;s reasoning,
					and{" "}
					<code className="font-mono">
						go test -tags solution ./...
					</code>{" "}
					runs the same suite against the reference.
				</p>
			</div>
		</main>
	)
}
