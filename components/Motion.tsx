"use client"
import { useEffect, useRef, useState } from "react"

// Entrance on scroll. The hidden state, the easing and the reduced-motion
// escape all live in globals.css (`.m-appear` / `.m-stagger` / `.is-in`), so
// this only decides *when* — it never has to know whether motion is wanted.
//
// Pass `stagger` and the container's own children inherit the entrance one
// after another, which means grids and divider grids keep their real children
// instead of gaining a wrapper element that would break the layout.
export function Appear({
	children,
	className = "",
	stagger = false,
	delay = 0,
}: {
	children: React.ReactNode
	className?: string
	stagger?: boolean
	delay?: number
}) {
	const ref = useRef<HTMLDivElement>(null)
	const [shown, setShown] = useState(false)

	useEffect(() => {
		const el = ref.current
		if (!el) return

		// Fail-safe. The entrance hides its content until the observer says
		// otherwise, which means a observer that never delivers leaves the page
		// permanently blank — an unacceptable failure mode for a statically
		// generated site whose whole point is that it is readable.
		//
		// IntersectionObserver always delivers an initial callback per observed
		// element, intersecting or not, so "nothing has arrived at all" is a
		// reliable signal that it is not working. Only that case reveals
		// early; when the observer is healthy, scroll-triggered entrances are
		// left exactly as they are. A page loaded in a background tab gets no
		// frames and so no callback, and lands here too — timers still run
		// there, so the reader returns to a visible page rather than an empty
		// one.
		let delivered = false
		const io = new IntersectionObserver(
			([entry]) => {
				delivered = true
				if (!entry.isIntersecting) return
				setShown(true)
				io.disconnect()
			},
			{ rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
		)
		io.observe(el)

		const failsafe = setTimeout(() => {
			if (delivered) return
			setShown(true)
			io.disconnect()
		}, 1500)

		return () => {
			io.disconnect()
			clearTimeout(failsafe)
		}
	}, [])

	return (
		<div
			ref={ref}
			className={`${stagger ? "m-stagger" : "m-appear"} ${shown ? "is-in" : ""} ${className}`}
			style={delay ? { transitionDelay: `${delay}ms` } : undefined}
		>
			{children}
		</div>
	)
}

// Counts up to the number when it first scrolls into view.
//
// The initial state is the real number, not zero, so the server-rendered HTML
// and a JavaScript-less reader both show the truth — this site's numbers are
// claims, and a stat bar that reads "0 programs shipped" until a script runs is
// a worse failure than no animation. The count-down to zero happens inside the
// observer callback, one frame before the animation starts.
export function CountUp({
	to,
	duration = 1000,
	className = "",
}: {
	to: number
	duration?: number
	className?: string
}) {
	const ref = useRef<HTMLSpanElement>(null)
	const [value, setValue] = useState(to)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		let raf = 0
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				io.disconnect()
				if (
					window.matchMedia("(prefers-reduced-motion: reduce)").matches
				)
					return
				const start = performance.now()
				const tick = (now: number) => {
					const t = Math.min(1, (now - start) / duration)
					// Cubic ease-out: fast off the line, settles on the value.
					setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
					if (t < 1) raf = requestAnimationFrame(tick)
				}
				setValue(0)
				raf = requestAnimationFrame(tick)
			},
			{ threshold: 0.5 },
		)
		io.observe(el)
		return () => {
			io.disconnect()
			cancelAnimationFrame(raf)
		}
	}, [to, duration])

	return (
		<span ref={ref} className={className}>
			{value}
		</span>
	)
}
