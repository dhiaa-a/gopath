import { Disclosure } from "./Disclosure"
import { toLang, ui } from "@/lib/i18n"

// The closing beat of a step: one retrieval prompt. Deliberately smaller than
// the RetrievalPrompts flip cards, which end a whole concept or lesson. This
// one is a single line you answer in your head before clicking, so it costs a
// few seconds and still forces the recall.
//
// Format matches the flip cards: "question || answer".
export function StepRecap({
	prompt,
	lang = "en",
}: {
	prompt: string
	lang?: string
}) {
	const [question, answer = ""] = prompt.split("||").map((s) => s.trim())
	const tr = ui(toLang(lang))

	return (
		<div className="mt-6 rounded-lg border border-border border-s-4 border-s-go-cyan bg-go-cyan/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-cyan">
				recap
			</div>
			<p className="mb-3 text-sm leading-relaxed text-foreground">
				{question}
			</p>
			<Disclosure label={tr.common.answerItThenCheck} tone="cyan">
				<p className="rounded border border-go-cyan/20 bg-bg px-3 py-2 text-sm leading-relaxed text-muted">
					{answer}
				</p>
			</Disclosure>
		</div>
	)
}
