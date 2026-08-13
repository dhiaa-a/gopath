"use client"
import { useEffect, useState } from "react"

// How far through the page you are, drawn into the nav's own bottom rule rather
// than added as a separate bar. Modernist's 2px divider is already there and
// already spans the viewport; filling it with the accent says "you are here"
// without introducing a new element the system would have to justify.
//
// A 15,000px project page is the reason this exists: without it there is no
// way to tell a page you are a third of the way down from one you have nearly
// finished.
export function ReadingProgress() {
	const [progress, setProgress] = useState(0)

	useEffect(() => {
		let raf = 0
		const measure = () => {
			raf = 0
			const scrollable =
				document.documentElement.scrollHeight - window.innerHeight
			setProgress(
				scrollable > 8
					? Math.min(1, Math.max(0, window.scrollY / scrollable))
					: 0,
			)
		}
		// Schedules rather than measuring inline: this runs in an effect body,
		// and a synchronous setState here would be a cascading render.
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
	}, [])

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-x-0 bottom-[-2px] h-[2px] origin-left bg-m-accent"
			style={{ transform: `scaleX(${progress})` }}
		/>
	)
}
