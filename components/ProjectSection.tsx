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

	// No card here on purpose: most of what this wraps is a couple of
	// paragraphs and one code block, and the code block already carries its
	// own border. A second frame around that first one was the clearest
	// "box inside a box" on the site — see DECISIONS.md.
	return (
		<section id={id} className="mb-12 scroll-mt-[110px]">
			<h2 className="mb-6 border-b-2 border-border pb-3 font-serif text-2xl text-foreground">
				{t(title, lang)}
			</h2>
			<ContentRenderer blocks={blocks} lang={lang} />
		</section>
	)
}
