import { ContentBlock, t } from "@/lib/content"
import { GoCodeBlock } from "./GoCode"
import { StructuredStep } from "./StructuredStep"

export function ContentRenderer({
	blocks,
	lang = "en",
}: {
	blocks: ContentBlock[]
	lang?: string
}) {
	return (
		<>
			{blocks.map((block, i) => {
				switch (block.type) {
					case "text":
						return (
							<p
								key={i}
								className="mb-4 text-base leading-relaxed text-muted"
							>
								{t(block.value, lang)}
							</p>
						)

					case "code":
						return (
							<GoCodeBlock
								key={i}
								code={block.value}
								filename={block.filename}
							/>
						)

					case "list":
						return (
							<ul key={i} className="mb-4 flex flex-col gap-2">
								{block.items.map((item, j) => (
									<li key={j} className="text-muted">
										{t(item, lang)}
									</li>
								))}
							</ul>
						)

					case "callout":
						return (
							<div
								key={i}
								className="mb-4 rounded border border-go-amber/20 bg-go-amber/5 p-4 text-sm text-muted"
							>
								{t(block.value, lang)}
							</div>
						)

					case "structured":
						return (
							<StructuredStep
								key={i}
								intent={block.intent}
								concept={block.concept}
								implementation={block.implementation}
								filename={block.filename}
								lang={lang}
							/>
						)

					default:
						return null
				}
			})}
		</>
	)
}
