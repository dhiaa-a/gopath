"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { GoPathMark } from "@/components/GoPathMark"
import type { NavMenu } from "@/lib/nav"

const TOP_LINKS = [
	{ href: "/orientation", label: "Orientation" },
	{ href: "/#path", label: "Path" },
	{ href: "/concepts", label: "Concepts" },
]

export default function Nav({ menu }: { menu: NavMenu }) {
	const pathname = usePathname()
	const [mobileOpen, setMobileOpen] = useState(false)
	const [megaOpen, setMegaOpen] = useState(false)
	const megaRef = useRef<HTMLDivElement>(null)
	const megaTriggerRef = useRef<HTMLAnchorElement>(null)

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

	const linkClass = (href: string) =>
		`font-display text-[14px] transition-colors hover:text-m-accent ${
			pathname === href ? "text-m-accent" : "text-m-ink"
		}`

	return (
		<nav className="m-scope sticky top-0 z-50 border-b-2 border-m-divider bg-m-bg font-display">
			<div className="mx-auto flex max-w-[1160px] items-center gap-[32px] px-[24px] py-[12px] lg:px-[32px]">
				<Link
					href="/"
					className="mr-auto flex items-center gap-[9px] text-[18px] font-extrabold text-m-ink"
				>
					<GoPathMark size={20} strokeWidth={5} className="text-m-accent" />
					GoPath
				</Link>

				{/* Desktop links */}
				<div className="hidden items-center gap-[32px] lg:flex">
					<Link
						href="/orientation"
						className={linkClass("/orientation")}
						aria-current={pathname === "/orientation" ? "page" : undefined}
					>
						Orientation
					</Link>
					<Link href="/#path" className={linkClass("/#path")}>
						Path
					</Link>

					{/* Projects opens the mega menu: the redesign cuts the bar to four
					    links, and everything it drops lives in here rather than
					    nowhere.

					    It stays a real link rather than becoming a toggle button.
					    A trigger that opens on hover and toggles on click fights
					    itself — the pointer opens the panel on the way to the
					    click, so the click reads as "close" — and a toggle leaves
					    touch users, who never hover, tapping a control that only
					    ever opens a menu. As a link, every input lands somewhere:
					    hover and keyboard focus reveal the panel, a tap or a click
					    goes to /projects. */}
					<div
						ref={megaRef}
						onMouseEnter={() => setMegaOpen(true)}
						onMouseLeave={() => setMegaOpen(false)}
						onFocus={() => setMegaOpen(true)}
						onBlur={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget))
								setMegaOpen(false)
						}}
					>
						<Link
							ref={megaTriggerRef}
							href="/projects"
							aria-expanded={megaOpen}
							aria-controls="nav-mega"
							className={`flex items-center gap-[6px] font-display text-[14px] transition-colors hover:text-m-accent ${
								pathname.startsWith("/projects") || megaOpen
									? "text-m-accent"
									: "text-m-ink"
							}`}
						>
							Projects
							<span
								aria-hidden="true"
								className={`text-[10px] transition-transform ${megaOpen ? "rotate-180" : ""}`}
							>
								▾
							</span>
						</Link>

						{megaOpen && <MegaMenu menu={menu} />}
					</div>

					<Link
						href="/concepts"
						className={linkClass("/concepts")}
						aria-current={pathname === "/concepts" ? "page" : undefined}
					>
						Concepts
					</Link>
				</div>

				<div className="flex items-center gap-[12px]">
					<ThemeToggle />
					<Link
						href="/projects/cli-renamer"
						className="hidden bg-m-accent px-[18px] py-[9px] text-[13px] font-extrabold text-m-on-accent transition-colors hover:bg-m-accent-hover lg:block"
					>
						Start the path →
					</Link>

					{/* Mobile menu button */}
					<button
						className="flex flex-col gap-1.5 p-1 lg:hidden"
						onClick={() => setMobileOpen((o) => !o)}
						aria-expanded={mobileOpen}
						aria-label="Toggle menu"
					>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all ${mobileOpen ? "opacity-0" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-m-ink transition-all ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
						/>
					</button>
				</div>
			</div>

			{/* Mobile drawer — no hover affordance to hang a mega menu on, so the
			    same destinations flatten into labelled groups. */}
			{mobileOpen && (
				<div className="border-t-2 border-m-divider bg-m-bg px-[24px] py-[24px] lg:hidden">
					<div className="flex flex-col gap-[20px]">
						<MobileGroup
							heading="Start here"
							links={TOP_LINKS.map((l) => ({ ...l, note: "" }))}
						/>
						<MobileGroup heading="The path" links={menu.path} />
						<MobileGroup heading="Beyond the path" links={menu.tracks} />
						<Link
							href="/projects/cli-renamer"
							className="mt-1 inline-block self-start bg-m-accent px-[18px] py-[9px] text-[13px] font-extrabold text-m-on-accent"
						>
							Start the path →
						</Link>
					</div>
				</div>
			)}
		</nav>
	)
}

function MegaMenu({ menu }: { menu: NavMenu }) {
	return (
		<div
			id="nav-mega"
			className="absolute left-0 right-0 top-full border-b-2 border-m-divider bg-m-bg"
		>
			<div className="mx-auto max-w-[1160px] px-[24px] lg:px-[32px]">
				<div className="grid grid-cols-[1fr_1fr_1.15fr] gap-[2px] bg-m-divider">
					<MegaColumn heading="The path" links={menu.path} />
					<MegaColumn heading="Beyond the path" links={menu.tracks} />

					<div className="bg-m-bg py-[28px] pl-[28px]">
						<div className="mb-[16px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
							The eleven builds
						</div>
						<div className="flex flex-col gap-[16px]">
							{menu.tiers.map((t) => (
								<div key={t.num}>
									<div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.08em] text-m-faint">
										{t.num} · {t.name}
									</div>
									<div className="flex flex-col gap-[2px]">
										{t.projects.map((p) => (
											<Link
												key={p.href}
												href={p.href}
												className="text-[13px] text-m-muted transition-colors hover:text-m-accent"
											>
												{p.label}
											</Link>
										))}
									</div>
								</div>
							))}
						</div>
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
		<div className="bg-m-bg py-[28px] pr-[28px]">
			<div className="mb-[16px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
				{heading}
			</div>
			<div className="flex flex-col gap-[16px]">
				{links.map((l) => (
					<Link key={l.href} href={l.href} className="group block">
						<div className="text-[14px] font-extrabold text-m-ink transition-colors group-hover:text-m-accent">
							{l.label}
						</div>
						<div className="text-[12px] leading-[1.5] text-m-faint">
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
	links: { href: string; label: string; note: string }[]
}) {
	return (
		<div>
			<div className="mb-[8px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink">
				{heading}
			</div>
			<div className="flex flex-col gap-[8px]">
				{links.map((l) => (
					<Link
						key={l.href}
						href={l.href}
						className="text-[14px] text-m-ink hover:text-m-accent"
					>
						{l.label}
					</Link>
				))}
			</div>
		</div>
	)
}
