"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { GoPathMark } from "@/components/GoPathMark"
import { ReadingProgress } from "@/components/ReadingProgress"
import { useProgress } from "@/lib/progress"
import type { NavMenu } from "@/lib/nav"

const START_CTA = { href: "/projects/cli-renamer", label: "Start the path" }

export default function Nav({ menu }: { menu: NavMenu }) {
	const pathname = usePathname()
	// Server render (and the client's first hydration pass) always sees the
	// empty snapshot, so the CTA starts as "Start the path" and swaps to
	// "Continue: X" once the real client snapshot lands — no mismatch, the
	// same swap ThemeToggle already does for the theme icon.
	const progress = useProgress()
	const cta = progress.last
		? { href: progress.last.href, label: `Continue: ${progress.last.label}` }
		: START_CTA
	const [mobileOpen, setMobileOpen] = useState(false)
	const [megaOpen, setMegaOpen] = useState(false)
	const megaRef = useRef<HTMLDivElement>(null)
	const megaTriggerRef = useRef<HTMLAnchorElement>(null)
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	// The panel sits below the whole nav bar, but the trigger's hover box ends
	// with the text — leaving ~20px of nav padding that belongs to neither. A
	// pointer travelling from "Projects" down into the panel crosses that dead
	// strip, which fires mouseleave and closes the menu before it is reachable.
	// Two things fix it together: the trigger's hit area is padded down to the
	// nav's bottom edge (see `-my-` below), and closing is deferred so a brief
	// excursion or a diagonal approach does not count as leaving.
	const openMega = useCallback(() => {
		if (closeTimer.current) clearTimeout(closeTimer.current)
		setMegaOpen(true)
	}, [])

	const closeMega = useCallback((delay = 220) => {
		if (closeTimer.current) clearTimeout(closeTimer.current)
		closeTimer.current = setTimeout(() => setMegaOpen(false), delay)
	}, [])

	useEffect(() => () => {
		if (closeTimer.current) clearTimeout(closeTimer.current)
	}, [])

	// Navigating is the one close the user never asks for explicitly. Both
	// panels are derived from "where we were when they opened it", so this is a
	// render-time adjustment rather than a synchronization with anything
	// outside React — an effect here would only buy a second render.
	const [lastPathname, setLastPathname] = useState(pathname)
	if (lastPathname !== pathname) {
		setLastPathname(pathname)
		setMobileOpen(false)
		setMegaOpen(false)
	}

	// Escape returns focus to the trigger; a click anywhere else just closes.
	useEffect(() => {
		if (!megaOpen) return

		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Escape") return
			setMegaOpen(false)
			megaTriggerRef.current?.focus()
		}
		function onPointerDown(e: PointerEvent) {
			if (!megaRef.current?.contains(e.target as Node)) setMegaOpen(false)
		}

		document.addEventListener("keydown", onKeyDown)
		document.addEventListener("pointerdown", onPointerDown)
		return () => {
			document.removeEventListener("keydown", onKeyDown)
			document.removeEventListener("pointerdown", onPointerDown)
		}
	}, [megaOpen])

	const navLink = (href: string, label: string) => {
		const active = pathname === href
		return (
			<Link
				href={href}
				data-active={active}
				aria-current={active ? "page" : undefined}
				className="m-navlink font-display text-[14px] text-m-ink transition-colors hover:text-m-accent"
			>
				{label}
			</Link>
		)
	}

	const projectsActive = pathname.startsWith("/projects") || megaOpen

	return (
		<nav className="m-scope sticky top-0 z-50 border-b-2 border-m-divider bg-m-bg font-display">
			<ReadingProgress />
			<div className="mx-auto flex max-w-[1160px] items-center gap-[36px] px-[24px] py-[16px] lg:px-[40px]">
				<Link
					href="/"
					className="group mr-auto flex items-center gap-[10px] text-[18px] font-extrabold text-m-ink"
				>
					<GoPathMark
						size={20}
						strokeWidth={5}
						className="text-m-accent transition-transform duration-300 group-hover:-translate-y-px"
					/>
					GoPath
				</Link>

				{/* Desktop links */}
				<div className="hidden items-center gap-[36px] lg:flex">
					{navLink("/orientation", "Orientation")}
					{navLink("/#path", "Path")}

					{/* Projects reveals the mega menu. It stays a real link rather
					    than a toggle button: a trigger that opens on hover and
					    toggles on click fights itself, since the pointer opens the
					    panel on the way to the click and the click then reads as
					    "close". As a link every input lands somewhere — hover and
					    keyboard focus reveal the panel, a tap or click goes to
					    /projects, which matters most for touch, where nothing
					    hovers at all. */}
					<div
						ref={megaRef}
						className="-my-[16px] py-[16px]"
						onMouseEnter={openMega}
						onMouseLeave={() => closeMega()}
						onFocus={openMega}
						onBlur={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget))
								closeMega(0)
						}}
					>
						<Link
							ref={megaTriggerRef}
							href="/projects"
							data-active={projectsActive}
							aria-expanded={megaOpen}
							aria-controls="nav-mega"
							className={`m-navlink flex items-center gap-[7px] font-display text-[14px] transition-colors hover:text-m-accent ${
								projectsActive ? "text-m-accent" : "text-m-ink"
							}`}
						>
							Projects
							<span
								aria-hidden="true"
								className={`text-[9px] transition-transform duration-300 ${megaOpen ? "rotate-180" : ""}`}
							>
								▼
							</span>
						</Link>

						<MegaMenu menu={menu} open={megaOpen} />
					</div>

					{navLink("/concepts", "Concepts")}
				</div>

				<div className="flex items-center gap-[14px]">
					<ThemeToggle />
					<Link
						href={cta.href}
						className="group hidden max-w-[220px] items-center gap-[8px] bg-m-accent px-[20px] py-[11px] text-[13px] font-extrabold text-m-on-accent transition-colors duration-300 hover:bg-m-accent-hover lg:flex"
					>
						<span className="truncate">{cta.label}</span>
						<span aria-hidden="true" className="m-arrow shrink-0">
							→
						</span>
					</Link>

					{/* Mobile menu button */}
					<button
						className="flex flex-col gap-[5px] p-1 lg:hidden"
						onClick={() => setMobileOpen((o) => !o)}
						aria-expanded={mobileOpen}
						aria-label="Toggle menu"
					>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all duration-300 ${mobileOpen ? "translate-y-[7px] rotate-45" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all duration-300 ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
						/>
					</button>
				</div>
			</div>

			{/* Mobile drawer — nothing hovers on touch, so the same destinations
			    flatten into labelled groups. */}
			{mobileOpen && (
				<div className="border-t-2 border-m-divider bg-m-bg px-[24px] py-[28px] lg:hidden">
					<div className="flex flex-col gap-[26px]">
						<MobileGroup
							heading="Start here"
							links={[
								{ href: "/orientation", label: "Orientation" },
								{ href: "/#path", label: "Path" },
								{ href: "/concepts", label: "Concepts" },
							]}
						/>
						<MobileGroup heading="The path" links={menu.path} />
						<MobileGroup
							heading="Beyond the path"
							links={menu.tracks}
						/>
						<Link
							href={cta.href}
							className="inline-block max-w-full truncate self-start bg-m-accent px-[20px] py-[12px] text-[13px] font-extrabold text-m-on-accent"
						>
							{cta.label} →
						</Link>
					</div>
				</div>
			)}
		</nav>
	)
}

function MegaMenu({ menu, open }: { menu: NavMenu; open: boolean }) {
	return (
		<div
			id="nav-mega"
			data-open={open}
			className="m-mega absolute left-0 right-0 top-full border-b-2 border-m-divider bg-m-bg shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]"
		>
			<div className="mx-auto grid max-w-[1160px] grid-cols-[1fr_1fr_1fr] gap-[48px] px-[40px] py-[40px]">
				<MegaColumn heading="The path" links={menu.path} />
				<MegaColumn heading="Beyond the path" links={menu.tracks} />

				{/* Tier-level entries, not all eleven projects. The full list is
				    one click away at /projects — which is where the trigger
				    itself goes — and eleven more links here was the single
				    biggest source of clutter in the panel. */}
				<div>
					<div className="mb-[20px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
						By tier
					</div>
					<div className="flex flex-col gap-[2px]">
						{menu.tiers.map((t) => (
							<Link
								key={t.num}
								href={t.projects[0].href}
								className="group -mx-[12px] flex items-baseline gap-[10px] px-[12px] py-[10px] transition-colors hover:bg-m-surface"
							>
								<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-m-faint">
									{t.num.replace("Tier ", "")}
								</span>
								<span className="text-[14px] font-extrabold text-m-ink transition-colors group-hover:text-m-accent">
									{t.name}
								</span>
								<span className="ml-auto text-[12px] text-m-faint">
									{t.projects.length}
								</span>
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

function MegaColumn({
	heading,
	links,
}: {
	heading: string
	links: { href: string; label: string; note: string }[]
}) {
	return (
		<div>
			<div className="mb-[20px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
				{heading}
			</div>
			<div className="flex flex-col gap-[2px]">
				{links.map((l) => (
					<Link
						key={l.href}
						href={l.href}
						className="group -mx-[12px] block px-[12px] py-[10px] transition-colors hover:bg-m-surface"
					>
						<div className="text-[14px] font-extrabold text-m-ink transition-colors group-hover:text-m-accent">
							{l.label}
						</div>
						<div className="mt-[2px] text-[12px] leading-[1.5] text-m-faint">
							{l.note}
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}

function MobileGroup({
	heading,
	links,
}: {
	heading: string
	links: { href: string; label: string }[]
}) {
	return (
		<div>
			<div className="mb-[12px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
				{heading}
			</div>
			<div className="flex flex-col gap-[12px]">
				{links.map((l) => (
					<Link
						key={l.href}
						href={l.href}
						className="text-[15px] text-m-ink transition-colors hover:text-m-accent"
					>
						{l.label}
					</Link>
				))}
			</div>
		</div>
	)
}
