"use client"
import { useSyncExternalStore } from "react"

// The `dark` class on <html> is the source of truth — the inline script in the
// root layout sets it before hydration. Subscribe to it instead of mirroring it
// into local state, so the button can never disagree with the document.
function subscribe(onStoreChange: () => void) {
	const observer = new MutationObserver(onStoreChange)
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	})
	return () => observer.disconnect()
}

function getSnapshot() {
	return document.documentElement.classList.contains("dark")
}

// Server HTML is rendered dark; the inline script corrects it before first paint.
function getServerSnapshot() {
	return true
}

export function ThemeToggle() {
	const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

	function toggle() {
		const next = !isDark
		document.documentElement.classList.toggle("dark", next)
		try {
			localStorage.setItem("theme", next ? "dark" : "light")
		} catch {}
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
