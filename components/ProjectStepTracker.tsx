"use client"
import { useEffect } from "react"
import posthog from "posthog-js"

// Fires `project_step_in_view` once per step per session as the learner scrolls,
// and `project_completed` when the final step crosses the viewport. Completion
// is a scroll proxy — not a strict "finished the work" signal — but without
// per-user state it's the best signal we have for the T1-anchor north-star.
export function ProjectStepTracker({
	projectSlug,
	totalSteps,
}: {
	projectSlug: string
	totalSteps: number
}) {
	useEffect(() => {
		const seen = new Set<number>()
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue
					const n = Number(entry.target.getAttribute("data-step-n"))
					if (Number.isNaN(n) || seen.has(n)) continue
					seen.add(n)
					posthog.capture("project_step_in_view", {
						project_slug: projectSlug,
						step_n: n,
					})
					if (n === totalSteps) {
						posthog.capture("project_completed", {
							project_slug: projectSlug,
						})
					}
				}
			},
			{ threshold: 0.5 }
		)
		document
			.querySelectorAll<HTMLElement>("[data-step-n]")
			.forEach((el) => observer.observe(el))
		return () => observer.disconnect()
	}, [projectSlug, totalSteps])
	return null
}
