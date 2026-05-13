"use client"
import Link from "next/link"
import posthog from "posthog-js"

export function HomeCta({
	href,
	label,
	location,
	className,
}: {
	href: string
	label: string
	location: string
	className: string
}) {
	return (
		<Link
			href={href}
			className={className}
			onClick={() =>
				posthog.capture("cta_clicked", { label, location })
			}
		>
			{label}
		</Link>
	)
}
