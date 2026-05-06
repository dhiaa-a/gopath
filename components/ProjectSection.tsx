import { ContentRenderer } from "./ContentRenderer"
import { ContentBlock } from "@/lib/content"

export function ProjectSection({
	title,
	blocks,
}: {
	title: string
	blocks?: ContentBlock[]
}) {
	if (!blocks) return null

	return (
		<section className="mb-10 rounded-xl border border-border bg-surface p-7">
			<h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
				{title}
			</h2>
			<ContentRenderer blocks={blocks} />
		</section>
	)
}
