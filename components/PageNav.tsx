"use client"
import { useEffect, useState } from "react"

export type PageNavItem = {
	id: string
	label: string
	/** Step number, rendered as the marker instead of a bullet. Authored as a
	 *  string in the content modules ("01", "02"), so it is taken as one. */
	n?: string
}

// A sticky contents rail for the long pages. Project pages run to ~15,000px —
// roughly seventeen screens — and before this the only way to reach step 8 was
// to scroll past steps 1 through 7 every single time.
//
// It tracks the section you are actually in rather than the one you last
// clicked, so it doubles as a position indicator: on a page this long, "how
// much of this is left" is a real question and the answer was invisible.
export function PageNav({ items }: { items: PageNavItem[] }) {
	const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "")

	useEffect(() => {
		const targets = items
			.map((i) => document.getElementById(i.id))
			.filter((el): el is HTMLElement => el !== null)
		if (!targets.length) return

		// The active section is the last one whose top has passed the reading
		// line — a band just below the sticky nav. Picking "topmost visible"
		// instead would flicker back to the previous section every time a tall
		// block scrolled through, and picking "most visible" would sit on a
		// long step while its successor filled the screen.
		let raf = 0
		const measure = () => {
			raf = 0
			const line = 140
			let current = targets[0]
			for (const el of targets) {
				if (el.getBoundingClientRect().top <= line) current = el
				else break
			}
			setActiveId(current.id)
		}
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(measure)
		}

		schedule()
		window.addEventListener("scroll", schedule, { passive: true })
		window.addEventListener("resize", schedule)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("scroll", schedule)
			window.removeEventListener("resize", schedule)
		}
	}, [items])

	return (
		<nav
			aria-label="On this page"
			className="sticky top-[110px] hidden max-h-[calc(100vh-150px)] overflow-y-auto xl:block"
		>
			<div className="mb-[16px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
				On this page
			</div>
			<ul className="flex flex-col border-l-2 border-border">
				{items.map((item) => {
					const active = item.id === activeId
					return (
						<li key={item.id}>
							<a
								href={`#${item.id}`}
								aria-current={active ? "true" : undefined}
								className={`-ml-[2px] flex items-center gap-[10px] border-l-2 py-[7px] pl-[14px] text-[13px] leading-[1.35] transition-colors duration-200 ${
									active
										? "border-m-accent text-m-ink"
										: "border-transparent text-m-faint hover:border-border2 hover:text-m-ink"
								}`}
							>
								{item.n !== undefined && (
									<span className="font-mono text-[10px] tabular-nums text-m-faint">
										{item.n.padStart(2, "0")}
									</span>
								)}
								<span className="min-w-0 flex-1">
									{item.label}
								</span>
							</a>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
