"use client"
import Link from "next/link"
import posthog from "posthog-js"

export function OrientationNextLink({
	href,
	currentSlug,
	nextLabel,
	isLastPage,
	className,
}: {
	href: string
	currentSlug: string
	nextLabel: string
	isLastPage: boolean
	className: string
}) {
	return (
		<Link
			href={href}
			className={className}
			onClick={() =>
				posthog.capture("orientation_advanced", {
					from_slug: currentSlug,
					next_label: nextLabel,
					entering_tier1: isLastPage,
				})
			}
		>
			<span>{nextLabel}</span>
			<span>→</span>
		</Link>
	)
}
