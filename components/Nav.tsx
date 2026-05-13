"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ThemeToggle } from "@/components/ThemeToggle"

export default function Nav() {
	const pathname = usePathname()
	const [open, setOpen] = useState(false)

	const links = [
		{ href: "/orientation", label: "Orientation" },
		{ href: "/#path", label: "Learning path" },
		{ href: "/projects", label: "All projects" },
		{ href: "/concepts", label: "Concepts" },
	]

	return (
		<nav className="sticky top-0 z-50 border-b border-border bg-bg backdrop-blur-md">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
				<Link
					href="/"
					className="font-mono text-lg font-semibold text-go-cyan"
				>
					go<span className="text-muted">path</span>
				</Link>

				{/* Desktop links */}
				<ul className="hidden items-center gap-8 md:flex">
					{links.map((l) => (
						<li key={l.href}>
							<Link
								href={l.href}
								className={`text-sm font-medium transition-colors hover:text-foreground ${
									pathname === l.href
										? "text-foreground"
										: "text-muted"
								}`}
							>
								{l.label}
							</Link>
						</li>
					))}
				</ul>

				<div className="flex items-center gap-3">
					<ThemeToggle />
					<Link
						href="/projects/cli-renamer"
						className="hidden rounded bg-go-cyan px-4 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-85 md:block"
					>
						Start building →
					</Link>

					{/* Mobile menu button */}
					<button
						className="flex flex-col gap-1.5 p-1 md:hidden"
						onClick={() => setOpen((o) => !o)}
						aria-label="Toggle menu"
					>
						<span
							className={`block h-0.5 w-5 bg-muted transition-all ${open ? "translate-y-2 rotate-45" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-muted transition-all ${open ? "opacity-0" : ""}`}
						/>
						<span
							className={`block h-0.5 w-5 bg-muted transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`}
						/>
					</button>
				</div>
			</div>

			{/* Mobile menu */}
			{open && (
				<div className="border-t border-border bg-bg px-6 py-4 md:hidden">
					<ul className="flex flex-col gap-4">
						{links.map((l) => (
							<li key={l.href}>
								<Link
									href={l.href}
									className="text-sm font-medium text-muted hover:text-foreground"
									onClick={() => setOpen(false)}
								>
									{l.label}
								</Link>
							</li>
						))}
						<li>
							<Link
								href="/projects/cli-renamer"
								className="inline-block rounded bg-go-cyan px-4 py-2 font-mono text-xs font-semibold text-black"
								onClick={() => setOpen(false)}
							>
								Start building →
							</Link>
						</li>
					</ul>
				</div>
			)}
		</nav>
	)
}
