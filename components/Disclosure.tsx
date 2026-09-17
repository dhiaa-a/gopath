// One control for every "closed by default, click to see more" interaction
// on the site — hints, recap answers, "why does it do that?", benchmark
// caveats. Before this, five components each rolled their own toggle at
// 10px mono with an 18px tap target and no aria-expanded. A native
// <details>/<summary> gets the accessibility for free (keyboard support,
// correct exposure to screen readers, closed content genuinely hidden from
// assistive tech rather than just visually) and needs no client JS.
const TONE_CLASS = {
	muted: "text-muted hover:text-foreground",
	cyan: "text-go-cyan",
	teal: "text-go-teal",
	amber: "text-go-amber",
} as const

export function Disclosure({
	label,
	children,
	defaultOpen = false,
	count,
	tone = "muted",
}: {
	label: string
	children: React.ReactNode
	defaultOpen?: boolean
	// Small badge after the label, e.g. a hint count.
	count?: number
	tone?: keyof typeof TONE_CLASS
}) {
	return (
		<details open={defaultOpen}>
			<summary
				className={`flex min-h-[36px] w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 font-mono text-xs font-medium transition-colors hover:border-border2 ${TONE_CLASS[tone]}`}
			>
				<span aria-hidden="true" className="m-disclosure-arrow text-sm leading-none">
					▸
				</span>
				<span>{label}</span>
				{typeof count === "number" && (
					<span className="rounded-full bg-bg px-1.5 py-0.5 text-[10px] text-faint">
						{count}
					</span>
				)}
			</summary>
			<div className="mt-2">{children}</div>
		</details>
	)
}
