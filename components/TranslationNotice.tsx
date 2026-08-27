import { ui, type Lang } from "@/lib/i18n"

/**
 * Says, in the reader's own language, that the body of this page has not been
 * translated yet.
 *
 * The alternative was letting an Arabic reader open a lesson, read an Arabic
 * nav and an Arabic heading, and then hit a wall of English with nothing
 * telling them whether that is deliberate, broken, or their own mistake. The
 * site's whole argument is that a learner should always know where they are
 * and what comes next; a page that silently changes language mid-scroll breaks
 * that harder than an honest sentence does.
 *
 * Renders nothing when the page IS translated, and nothing at all in English,
 * so it costs nothing on the pages that do not need it.
 */
export function TranslationNotice({
	lang,
	translated,
}: {
	lang: Lang
	translated: boolean
}) {
	if (lang === "en" || translated) return null
	const tr = ui(lang)

	return (
		<div className="mb-8 border-s-2 border-m-accent bg-m-surface px-4 py-3 text-sm text-m-muted">
			{tr.fallback.notice}
		</div>
	)
}
