"use client"
import { useEffect, useState } from "react"
import { ui, type Lang } from "@/lib/i18n"

// Project and concept pages run long; this is the way back once you've read
// (or jumped) past the fold. Gated on scroll position rather than always
// rendered, so it never competes for attention on the pages short enough not
// to need it.
const SHOW_AFTER_PX = 500

export function BackToTop({ lang }: { lang: Lang }) {
	const [visible, setVisible] = useState(false)
	const s = ui(lang)

	useEffect(() => {
		let raf = 0
		const measure = () => {
			raf = 0
			setVisible(window.scrollY > SHOW_AFTER_PX)
		}
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(measure)
		}
		schedule()
		window.addEventListener("scroll", schedule, { passive: true })
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("scroll", schedule)
		}
	}, [])

	function scrollToTop() {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches
		window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })
	}

	return (
		<button
			onClick={scrollToTop}
			aria-label={s.common.backToTop}
			aria-hidden={!visible}
			tabIndex={visible ? 0 : -1}
			className={`fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-m-divider bg-m-bg text-m-ink shadow-card transition-[opacity,transform,box-shadow] duration-200 hover:border-m-accent hover:text-m-accent hover:shadow-elevated ${
				visible
					? "translate-y-0 opacity-100"
					: "pointer-events-none translate-y-2 opacity-0"
			}`}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 19V5M5 12l7-7 7 7" />
			</svg>
		</button>
	)
}
