"use client"
import { useSyncExternalStore } from "react"
import { ui, type Lang } from "@/lib/i18n"

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

export function ThemeToggle({ lang }: { lang: Lang }) {
	const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
	const s = ui(lang)

	function toggle() {
		const next = !isDark
		document.documentElement.classList.toggle("dark", next)
		try {
			localStorage.setItem("theme", next ? "dark" : "light")
		} catch {}
	}

	// Lives in the redesigned nav, so it takes the Modernist tokens: no radius,
	// a divider for its edge, accent on hover.
	return (
		<button
			onClick={toggle}
			aria-label={isDark ? s.theme.toLight : s.theme.toDark}
			className="flex h-8 w-8 items-center justify-center border border-m-divider text-m-muted transition-colors hover:border-m-accent hover:text-m-accent"
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
