import Link from "next/link"
import { localePath, toLang, ui } from "@/lib/i18n"
import {
	sourceWalkthroughs,
	goSourceVersion,
	goSourceLicense,
} from "@/lib/source"

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const tr = ui(toLang((await params).lang))
	return {
		title: tr.meta.sourceTitle,
		description: tr.index.sourceLead,
	}
}

export default async function SourcePage({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
				{tr.index.sourceKicker}
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{tr.index.sourceTitle}
			</h1>
			<p className="mb-6 max-w-2xl text-muted">
				{tr.index.sourceLead}
			</p>
			<p className="mb-6 max-w-2xl text-muted">
				Nothing here is retyped. Every excerpt is quoted byte for byte
				from a stock toolchain and every line number was measured, not
				remembered, so you can open the same file on your own machine
				and land on the same lines. Each walkthrough ends with one
				question you can only answer by opening the source.
			</p>
			<p className="mb-12 max-w-2xl text-sm text-muted">
				None of these gate anything: the tier note on each is a
				suggestion about when it will teach the most, nothing more.
			</p>

			<div className="flex flex-col gap-3">
				{sourceWalkthroughs.map((w, i) => (
					<Link
						key={w.slug}
						href={lp(`/source/${w.slug}`)}
						className="group flex items-baseline gap-4 rounded-lg border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-go-cyan/40 hover:shadow-sm"
					>
						<span className="font-mono text-xs text-go-cyan">
							{String(i + 1).padStart(2, "0")}
						</span>
						<div className="min-w-0 flex-1">
							<div className="mb-1 flex items-baseline justify-between gap-3">
								<span className="font-semibold text-foreground group-hover:text-go-cyan">
									{w.name}
								</span>
								<span className="shrink-0 font-mono text-[10px] text-faint">
									T{w.unlockTier}+
								</span>
							</div>
							<p className="mb-3 text-sm leading-relaxed text-muted">
								{w.tagline}
							</p>
							<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
								<code className="font-mono text-[11px] text-muted">
									{w.entryFile}
								</code>
								<span className="font-mono text-[10px] text-muted">
									package {w.pkg} · {w.excerpts.length}{" "}
									excerpts
								</span>
							</div>
						</div>
					</Link>
				))}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					How to work a walkthrough
				</p>
				<p className="text-sm text-muted">
					Open the file first. The page tells you where to enter and
					what to skip, then walks the excerpts in order, but reading
					the commentary without the file in front of you is reading
					about source reading rather than doing it. When you reach the
					exercise, run the command and search before you reveal the
					answer.
				</p>
			</div>

			<div
				id="attribution"
				className="mt-6 scroll-mt-20 rounded-lg border border-border bg-surface p-6"
			>
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
					Attribution
				</div>
				<p className="text-sm text-muted">
					The excerpts across this track are quoted from the Go
					standard library. {goSourceLicense.notice} Used under the{" "}
					{goSourceLicense.license} license:{" "}
					<a
						href={goSourceLicense.url}
						target="_blank"
						rel="noopener noreferrer"
						className="font-mono text-go-cyan hover:underline"
					>
						{goSourceLicense.url}
					</a>
					.
				</p>
				<p className="mt-3 text-sm text-muted">
					Every excerpt and every line number on this track was
					measured against{" "}
					<code className="font-mono">{goSourceVersion}</code>. Line
					numbers move between Go releases, so on a newer toolchain the
					code will still be there but the numbers may have shifted.
					Check yours with{" "}
					<code className="font-mono">go version</code>.
				</p>
			</div>
		</main>
	)
}
