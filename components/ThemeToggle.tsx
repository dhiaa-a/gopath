"use client"
import { useEffect, useState } from "react"
import posthog from "posthog-js"

export function ThemeToggle() {
	const [isDark, setIsDark] = useState(true)

	useEffect(() => {
		setIsDark(document.documentElement.classList.contains("dark"))
	}, [])

	function toggle() {
		const next = !isDark
		setIsDark(next)
		document.documentElement.classList.toggle("dark", next)
		try {
			localStorage.setItem("theme", next ? "dark" : "light")
		} catch {}
		posthog.capture("theme_toggled", { theme: next ? "dark" : "light" })
	}

	return (
		<button
			onClick={toggle}
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			className="flex h-8 w-8 items-center justify-center rounded border border-border text-muted transition-colors hover:border-go-cyan/40 hover:text-foreground"
		>
			{isDark ? (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
				</svg>
			) : (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
				</svg>
			)}
		</button>
	)
}
