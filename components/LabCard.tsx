import { ProjectLab, t } from "@/lib/content"

const REPO_TREE = "https://github.com/dhiaa-a/gopath/tree/main/"

const tierStyles = {
	1: { border: "border-go-cyan/25", accent: "text-go-cyan" },
	2: { border: "border-go-teal/25", accent: "text-go-teal" },
	3: { border: "border-go-amber/25", accent: "text-go-amber" },
} as const

export function LabCard({
	lab,
	tier,
	lang = "en",
}: {
	lab: ProjectLab
	tier: 1 | 2 | 3
	lang?: string
}) {
	const s = tierStyles[tier]
	return (
		<div className={`mb-10 rounded-lg border bg-surface p-5 ${s.border}`}>
			<div
				className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${s.accent}`}
			>
				lab
			</div>
			<p className="mb-3 text-sm leading-relaxed text-muted">
				{t(lab.summary, lang)}
			</p>
			<div className="flex flex-col gap-1.5 font-mono text-xs">
				<div>
					<span className="mr-2 text-[10px] uppercase tracking-widest text-muted">
						where
					</span>
					<a
						href={`${REPO_TREE}${lab.path}`}
						target="_blank"
						rel="noopener noreferrer"
						className={`${s.accent} hover:underline`}
					>
						{lab.path}
					</a>
				</div>
				<div>
					<span className="mr-2 text-[10px] uppercase tracking-widest text-muted">
						run
					</span>
					<code className="rounded bg-bg px-2 py-0.5 text-foreground">
						{lab.command}
					</code>
				</div>
			</div>
			<p className="mt-3 text-xs text-faint">
				Clone the repo once, then work inside the lab directory. Every
				lab is a plain Go module: the standard toolchain is all you
				need.
			</p>
		</div>
	)
}
