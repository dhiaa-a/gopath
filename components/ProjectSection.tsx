import { ContentRenderer } from "./ContentRenderer"
import { ContentBlock, LocalizedString, t } from "@/lib/content"

export function ProjectSection({
	title,
	blocks,
	lang = "en",
	id,
}: {
	title: LocalizedString
	blocks?: ContentBlock[]
	lang?: string
	// Anchor target, so the page's sticky navigator can jump here. Scroll
	// lands under the sticky nav rather than behind it — see `scroll-mt`.
	id?: string
}) {
	if (!blocks) return null

	return (
		<section
			id={id}
			className="mb-10 scroll-mt-[110px] border-2 border-border bg-surface p-7"
		>
			<h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-m-accent-ink">
				{t(title, lang)}
			</h2>
			<ContentRenderer blocks={blocks} lang={lang} />
		</section>
	)
}
