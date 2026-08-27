"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Fuse from "fuse.js"
import type { SearchRecord } from "@/lib/search-index"
import { ui, type Lang } from "@/lib/i18n"

const MAX_RESULTS = 8

// Self-contained: owns its own trigger button, open state, and the ⌘K /
// Ctrl+K listener, the same way ThemeToggle owns its own click handler.
// Fuse is built once from `records` (a few hundred bytes each, ~116 rows
// today) — cheap enough that lazy construction on first open would only add
// complexity, not save anything measurable.
export function SearchPalette({
	records,
	lang,
}: {
	records: SearchRecord[]
	lang: Lang
}) {
	const s = ui(lang)
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [activeIndex, setActiveIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const router = useRouter()

	const fuse = useMemo(
		() =>
			new Fuse(records, {
				keys: [
					{ name: "title", weight: 3 },
					{ name: "subtitle", weight: 1 },
					{ name: "tags", weight: 1 },
				],
				threshold: 0.35,
				ignoreLocation: true,
			}),
		[records],
	)

	const results = useMemo(() => {
		if (!query.trim()) return []
		return fuse.search(query, { limit: MAX_RESULTS }).map((r) => r.item)
	}, [fuse, query])

	// ⌘K / Ctrl+K opens from anywhere on the site, registered once regardless
	// of open state — this is the one listener that has to outlive the panel.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault()
				setOpen((o) => !o)
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [])

	// Resetting query/selection when the panel opens is a reaction to `open`
	// changing, not a sync with anything outside React, so it happens during
	// render rather than in an effect — the same "adjust state when a value
	// changes" pattern Nav already uses to close its own menus on navigation.
	const [wasOpen, setWasOpen] = useState(false)
	if (open !== wasOpen) {
		setWasOpen(open)
		if (open) {
			setQuery("")
			setActiveIndex(0)
		}
	}

	// What's left is genuinely external-system work: focusing a DOM node,
	// locking body scroll, and subscribing to a native keydown event.
	useEffect(() => {
		if (!open) return
		inputRef.current?.focus()
		const prevOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false)
				triggerRef.current?.focus()
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => {
			window.removeEventListener("keydown", onKeyDown)
			document.body.style.overflow = prevOverflow
		}
	}, [open])

	function go(href: string) {
		setOpen(false)
		router.push(href)
	}

	function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setActiveIndex((i) => Math.min(i + 1, results.length - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter") {
			e.preventDefault()
			const target = results[activeIndex]
			if (target) go(target.href)
		}
	}

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen(true)}
				aria-label={s.nav.search}
				className="flex h-8 items-center gap-[8px] border border-m-divider px-[10px] text-m-muted transition-colors hover:border-m-accent hover:text-m-accent"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					aria-hidden="true"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<span className="hidden font-mono text-[11px] sm:inline">
					⌘K
				</span>
			</button>

			{open && (
				<div
					className="fixed inset-0 z-[100] flex justify-center bg-[color-mix(in_srgb,var(--m-ink)_55%,transparent)] px-[20px] pt-[12vh]"
					onClick={() => setOpen(false)}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-label={s.nav.search}
						onClick={(e) => e.stopPropagation()}
						className="m-scope h-fit w-full max-w-[600px] border-2 border-m-divider bg-m-bg font-display shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)]"
					>
						<div className="flex items-center gap-[12px] border-b-2 border-m-divider px-[20px]">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								className="shrink-0 text-m-faint"
								aria-hidden="true"
							>
								<circle cx="11" cy="11" r="7" />
								<path d="m21 21-4.3-4.3" />
							</svg>
							<input
								ref={inputRef}
								value={query}
								onChange={(e) => {
									setQuery(e.target.value)
									setActiveIndex(0)
								}}
								onKeyDown={onInputKeyDown}
								placeholder={s.search.placeholder}
								className="h-[56px] flex-1 bg-transparent text-[16px] text-m-ink outline-none placeholder:text-m-faint"
							/>
							<kbd className="hidden shrink-0 border border-m-divider px-[6px] py-[2px] font-mono text-[10px] text-m-faint sm:block">
								{s.search.escape}
							</kbd>
						</div>

						{query.trim() && (
							<div className="max-h-[50vh] overflow-y-auto py-[6px]">
								{results.length === 0 ? (
									<p className="px-[20px] py-[24px] text-[13px] text-m-faint">
										{s.search.noMatches} “{query}”.
									</p>
								) : (
									results.map((r, i) => (
										<button
											key={r.href}
											type="button"
											onClick={() => go(r.href)}
											onMouseEnter={() => setActiveIndex(i)}
											className={`flex w-full items-start gap-[12px] px-[20px] py-[12px] text-left transition-colors ${
												i === activeIndex
													? "bg-m-surface"
													: ""
											}`}
										>
											<span className="mt-[2px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-m-accent-ink">
												{s.search.types[r.type]}
											</span>
											<span className="min-w-0">
												<span className="block truncate text-[14px] font-extrabold text-m-ink">
													{r.title}
												</span>
												<span className="block truncate text-[12.5px] text-m-faint">
													{r.subtitle}
												</span>
											</span>
										</button>
									))
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</>
	)
}
