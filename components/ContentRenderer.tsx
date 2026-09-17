"use client"
import { useId, useState } from "react"
import Link from "next/link"
import { ContentBlock, Hint, t } from "@/lib/content"
import { localePath, localizeHtml, toLang, ui } from "@/lib/i18n"
import { GoCodeBlock } from "./GoCode"
import { Disclosure } from "./Disclosure"

// A handful of stdlib symbols this site has already annotated line by line —
// worth a second link straight to the walkthrough, not just the godoc entry.
const WALKTHROUGH_FOR_FUNC: Record<string, string> = {
	"sync.WaitGroup": "sync-waitgroup",
	"errors.Is": "errors",
	"context.WithValue": "context",
	"context.WithTimeout": "context",
	"Context.Value": "context",
}

// One chip per package. An empty `funcs` marks a bare mention that isn't an
// importable package at all (a keyword like `defer`, or a shell command like
// `go test -race`) — there is nowhere on pkg.go.dev for that to link to, so
// it renders as plain text instead of a broken or misleading link.
function StdlibChip({
	pkg,
	funcs,
	lang,
}: {
	pkg: string
	funcs: string[]
	lang: string
}) {
	const L = toLang(lang)
	const tr = ui(L)
	if (funcs.length === 0) {
		return <span className="font-mono text-xs text-muted">{pkg}</span>
	}
	const walkthrough = funcs.map((f) => WALKTHROUGH_FOR_FUNC[f]).find(Boolean)
	return (
		<span className="inline-flex flex-wrap items-baseline gap-x-1.5">
			<a
				href={`https://pkg.go.dev/${pkg}`}
				target="_blank"
				rel="noopener noreferrer"
				className="font-mono text-xs font-semibold text-go-cyan hover:underline"
			>
				{pkg}
			</a>
			<span className="font-mono text-xs text-muted">{funcs.join(", ")}</span>
			{walkthrough && (
				<Link
					href={localePath(`/source/${walkthrough}`, L)}
					className="font-mono text-[10px] text-go-teal hover:underline"
				>
					{tr.common.readTheSource}{" "}
					<span aria-hidden="true" className="m-arrow">
						→
					</span>
				</Link>
			)}
		</span>
	)
}

// Real prose explaining a specific third-party choice, not a compressed
// reference list — it was rendered in a monospace <code> tag regardless,
// which reads as a code snippet split across three lines instead of the
// sentence it actually is. This keeps the package name (when the text leads
// with "pkg/path: ...") as a link and lets the rest wrap as a normal sentence.
function ThirdPartyHint({ text }: { text: string }) {
	const colonIdx = text.indexOf(":")
	if (colonIdx === -1) {
		return <p className="text-sm leading-relaxed text-muted">{text}</p>
	}
	const pkg = text.slice(0, colonIdx).trim()
	const rest = text.slice(colonIdx + 1).trim()
	return (
		<p className="text-sm leading-relaxed text-muted">
			<a
				href={`https://pkg.go.dev/${pkg}`}
				target="_blank"
				rel="noopener noreferrer"
				className="font-mono font-semibold text-go-teal hover:underline"
			>
				{pkg}
			</a>
			{": "}
			{rest}
		</p>
	)
}

function HintPill({ hint }: { hint: Hint }) {
	const [open, setOpen] = useState(false)
	const id = useId()
	return (
		<span className="inline-flex items-center">
			<button
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-controls={id}
				className="flex min-h-[32px] items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-go-cyan/40 hover:text-go-cyan"
			>
				<span aria-hidden="true">{open ? "▾" : "▸"}</span>
				{hint.label}
			</button>
			{open && (
				<span id={id} className="ml-2 font-mono text-[11px] text-go-cyan">
					{hint.value}
				</span>
			)}
		</span>
	)
}

function HintRow({ hints }: { hints: Hint[] }) {
	if (!hints.length) return null
	return (
		<div className="mt-2 flex flex-wrap gap-1.5">
			{hints.map((h, i) => (
				<HintPill key={i} hint={h} />
			))}
		</div>
	)
}

function AssessmentBlock({
	block,
}: {
	block: ContentBlock & { type: "assessment" }
}) {
	const a = block.assessment

	const palette: Record<string, string> = {
		unit: "border-go-cyan/25 bg-go-cyan/5",
		benchmark: "border-go-amber/25 bg-go-amber/5",
		metrics: "border-go-amber/25 bg-go-amber/5",
		integration: "border-go-teal/25 bg-go-teal/5",
		system: "border-go-teal/25 bg-go-teal/5",
	}
	const accent: Record<string, string> = {
		unit: "text-go-cyan",
		benchmark: "text-go-amber",
		metrics: "text-go-amber",
		integration: "text-go-teal",
		system: "text-go-teal",
	}

	return (
		<div
			className={`mb-10 rounded-lg border border-s-4 border-s-go-amber p-5 ${palette[a.kind] ?? "border-border bg-surface"}`}
		>
			<div
				className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${accent[a.kind] ?? "text-muted"}`}
			>
				{a.kind} assessment
			</div>
			<div className="mb-2 font-semibold text-foreground">{a.title}</div>
			<p className="mb-4 text-sm leading-relaxed text-muted">
				{a.description}
			</p>

			{a.labPath && (
				<div className="mb-4 font-mono text-xs">
					<span className="mr-2 text-[10px] uppercase tracking-widest text-muted">
						the real suite
					</span>
					<a
						href={`https://github.com/dhiaa-a/gopath/tree/main/${a.labPath}`}
						target="_blank"
						rel="noopener noreferrer"
						className={`${accent[a.kind] ?? "text-go-cyan"} hover:underline`}
					>
						{a.labPath}
					</a>
				</div>
			)}

			{a.testCases && a.testCases.length > 0 && (
				<div className="mb-4">
					<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
						test cases
					</div>
					<div className="flex flex-col gap-2">
						{a.testCases.map((tc, i) => (
							<div
								key={i}
								className="rounded border border-border bg-bg p-4"
							>
								<div className="mb-1 text-xs text-muted">
									{tc.description}
								</div>
								{tc.input && (
									<div className="mb-1 font-mono text-sm text-go-cyan">
										in: {tc.input}
									</div>
								)}
								<div className="font-mono text-sm text-go-teal">
									want: {tc.expected}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{a.desiredOutput && (
				<div className="mb-4">
					<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
						expected output
					</div>
					<pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-go-teal">
						{a.desiredOutput}
					</pre>
				</div>
			)}

			{a.desiredMetrics && (
				<div className="mb-3">
					<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
						target metrics
					</div>
					<div className="rounded border border-border bg-bg px-3 py-2 font-mono text-xs text-go-amber">
						{a.desiredMetrics}
					</div>
					{a.metricsAchievable && (
						<div className="mt-2">
							<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
								is this actually achievable?
							</div>
							<div className="rounded border border-go-amber/20 bg-go-amber/5 px-3 py-2 text-sm leading-relaxed text-muted">
								{a.metricsAchievable}
							</div>
						</div>
					)}
				</div>
			)}

			{a.hints && <HintRow hints={a.hints} />}
		</div>
	)
}

function VerifyBlock({
	block,
	lang,
}: {
	block: ContentBlock & { type: "verify" }
	lang: string
}) {
	const L = toLang(lang)
	const tr = ui(L)
	return (
		<div className="mb-10 rounded-lg border border-border border-s-4 border-s-go-teal bg-go-teal/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-teal">
				{tr.blocks.verify}
			</div>
			{block.where && (
				<div className="mb-1 font-mono text-[11px] text-faint">
					{tr.blocks.from} {block.where}
				</div>
			)}
			<pre className="mb-3 overflow-x-auto rounded bg-bg p-3 font-mono text-xs text-foreground">
				{block.command}
			</pre>
			<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
				{tr.blocks.youShouldSee}
			</div>
			<p
				className="text-sm leading-relaxed text-muted"
				dangerouslySetInnerHTML={{ __html: localizeHtml(t(block.expect, lang), L) }}
			/>
			{block.note && (
				<p
					className="mt-2 text-sm leading-relaxed text-muted"
					dangerouslySetInnerHTML={{ __html: localizeHtml(t(block.note, lang), L) }}
				/>
			)}
			{block.labPath && (
				<div className="mt-3 font-mono text-xs">
					<a
						href={`https://github.com/dhiaa-a/gopath/tree/main/${block.labPath}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-go-teal hover:underline"
					>
						{block.labPath}
					</a>
				</div>
			)}
		</div>
	)
}

function BreakItBlock({
	block,
	lang,
}: {
	block: ContentBlock & { type: "breakIt" }
	lang: string
}) {
	const L = toLang(lang)
	const tr = ui(L)
	return (
		<div className="mb-10 rounded-lg border border-border border-s-4 border-s-go-amber bg-go-amber/5 px-5 py-4">
			<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-go-amber">
				{tr.blocks.breakIt}
			</div>
			<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
				{tr.blocks.change}
			</div>
			<p
				className="mb-3 text-sm leading-relaxed text-foreground"
				dangerouslySetInnerHTML={{ __html: localizeHtml(t(block.change, lang), L) }}
			/>
			<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
				{tr.blocks.whatHappens}
			</div>
			<p
				className="text-sm leading-relaxed text-muted"
				dangerouslySetInnerHTML={{ __html: localizeHtml(t(block.observe, lang), L) }}
			/>
			<div className="mt-3">
				<Disclosure label={tr.blocks.whyDoesItDoThat} tone="amber">
					<div
						className="rounded border border-go-amber/20 bg-bg px-3 py-2 text-sm leading-relaxed text-muted"
						dangerouslySetInnerHTML={{
							__html: localizeHtml(t(block.why, lang), L),
						}}
					/>
				</Disclosure>
			</div>
		</div>
	)
}

export function ContentRenderer({
	blocks,
	lang = "en",
}: {
	blocks: ContentBlock[]
	lang?: string
}) {
	const L = toLang(lang)
	const tr = ui(L)
	return (
		<>
			{blocks.map((block, i) => {
				switch (block.type) {
					case "text":
						return (
							<p
								key={i}
								className="mb-4 max-w-[70ch] text-base leading-relaxed text-muted"
								dangerouslySetInnerHTML={{
									__html: localizeHtml(t(block.value, lang), L),
								}}
							/>
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
							<ul
								key={i}
								className="mb-4 max-w-[70ch] list-disc space-y-3 pl-5 marker:text-muted"
							>
								{block.items.map((item, j) => (
									<li key={j} className="text-base text-muted">
										{item.title && (
											<span
												className="mb-0.5 block font-semibold text-foreground"
												dangerouslySetInnerHTML={{
													__html: localizeHtml(t(item.title, lang), L),
												}}
											/>
										)}
										<span
											dangerouslySetInnerHTML={{
												__html: localizeHtml(t(item.body, lang), L),
											}}
										/>
									</li>
								))}
							</ul>
						)

					case "callout":
						return (
							<div
								key={i}
								className={`mb-4 rounded-lg border border-s-4 p-4 text-sm leading-relaxed text-muted ${
									block.variant === "warning"
										? "border-border border-s-go-amber bg-go-amber/5"
										: "border-border border-s-go-cyan bg-go-cyan/5"
								}`}
								dangerouslySetInnerHTML={{
									__html: localizeHtml(t(block.value, lang), L),
								}}
							/>
						)

					// T1 pattern block
					case "pattern":
						return (
							<div
								key={i}
								className="mb-10 overflow-hidden rounded-xl border border-border border-t-4 border-t-go-cyan bg-surface"
							>
								<div className="border-b border-border px-5 py-5">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-cyan">
										{tr.blocks.concept}
									</div>
									<p
										className="text-sm leading-relaxed text-muted"
										dangerouslySetInnerHTML={{
											__html: localizeHtml(t(block.concept, lang), L),
										}}
									/>
								</div>
								<div className="border-b border-border px-5 py-5">
									<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
										{tr.blocks.pattern}
									</div>
									<GoCodeBlock code={block.pattern} bare />
								</div>
								<div className="border-b border-border px-5 py-5">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-teal">
										{tr.blocks.similarExample}
									</div>
									<p
										className="text-sm leading-relaxed text-muted"
										dangerouslySetInnerHTML={{
											__html: localizeHtml(t(block.example, lang), L),
										}}
									/>
								</div>
								<div className="px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-amber">
										{tr.blocks.yourTask}
									</div>
									<p
										className="text-sm leading-relaxed text-foreground"
										dangerouslySetInnerHTML={{
											__html: localizeHtml(t(block.task, lang), L),
										}}
									/>
									{block.hints && (
										<HintRow hints={block.hints} />
									)}
								</div>
							</div>
						)

					// T2 requirement block
					case "requirement":
						return (
							<div
								key={i}
								className="mb-10 overflow-hidden rounded-xl border border-border border-t-4 border-t-go-teal bg-surface"
							>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-teal">
										{tr.blocks.requirement}
									</div>
									<p
										className="text-sm font-medium leading-relaxed text-foreground"
										dangerouslySetInnerHTML={{
											__html: localizeHtml(t(block.what, lang), L),
										}}
									/>
								</div>
								<div className="border-b border-border px-5 py-4">
									<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">
										{tr.blocks.why}
									</div>
									<p
										className="text-sm leading-relaxed text-muted"
										dangerouslySetInnerHTML={{
											__html: localizeHtml(t(block.why, lang), L),
										}}
									/>
								</div>
								{(block.stdlibHint || block.thirdPartyHint) && (
									<div className="flex flex-col gap-3 border-b border-border px-5 py-4">
										{block.stdlibHint && block.stdlibHint.length > 0 && (
											<div>
												<div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
													{tr.blocks.stdlib}
												</div>
												<div className="flex flex-wrap gap-x-4 gap-y-1.5">
													{block.stdlibHint.map((ref, k) => (
														<StdlibChip
															key={k}
															pkg={ref.pkg}
															funcs={ref.funcs}
															lang={lang}
														/>
													))}
												</div>
											</div>
										)}
										{block.thirdPartyHint && (
											<div>
												<div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
													{tr.blocks.thirdParty}
												</div>
												<ThirdPartyHint text={block.thirdPartyHint} />
											</div>
										)}
									</div>
								)}
								{block.complexSnippet && (
									<div className="border-b border-border px-5 py-4">
										<div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
											{tr.blocks.apiShape}
										</div>
										<GoCodeBlock
											code={block.complexSnippet}
											bare
										/>
									</div>
								)}
								{block.hints && (
									<div className="px-5 py-3">
										<HintRow hints={block.hints} />
									</div>
								)}
							</div>
						)

					// T3 constraint block
					case "constraint":
						return (
							<div
								key={i}
								className="mb-10 rounded-lg border border-border border-s-4 border-s-go-amber bg-go-amber/5 px-5 py-4"
							>
								<div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-go-amber">
									{tr.blocks.constraint}
								</div>
								<p
									className="mb-2 text-sm font-medium text-foreground"
									dangerouslySetInnerHTML={{
										__html: localizeHtml(t(block.what, lang), L),
									}}
								/>
								<p
									className="text-sm leading-relaxed text-muted"
									dangerouslySetInnerHTML={{
										__html: localizeHtml(t(block.rationale, lang), L),
									}}
								/>
								{block.hints && (
									<div className="mt-3">
										<HintRow hints={block.hints} />
									</div>
								)}
							</div>
						)

					case "verify":
						return <VerifyBlock key={i} block={block} lang={lang} />

					case "breakIt":
						return <BreakItBlock key={i} block={block} lang={lang} />

					case "assessment":
						return <AssessmentBlock key={i} block={block} />

					default:
						return null
				}
			})}
		</>
	)
}
