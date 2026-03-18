import { ContentRenderer } from "./ContentRenderer"
import { LocalizedString, t, ContentBlock } from "@/lib/content"

export function ProjectSection({
	title,
	blocks,
	lang = "en",
}: {
	title: LocalizedString
	blocks?: ContentBlock[]
	lang?: string
}) {
	if (!blocks) return null

	return (
		<section className="mb-10 rounded-xl border border-border bg-surface p-7">
			<h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
				{t(title, lang)}
			</h2>
			<ContentRenderer blocks={blocks} lang={lang} />
		</section>
	)
}
