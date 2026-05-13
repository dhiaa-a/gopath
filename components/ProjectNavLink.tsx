"use client"
import Link from "next/link"
import posthog from "posthog-js"

export function ProjectNavLink({
	href,
	projectSlug,
	direction,
	label,
	className,
	children,
}: {
	href: string
	projectSlug: string
	direction: "prev" | "next"
	label: string
	className: string
	children: React.ReactNode
}) {
	return (
		<Link
			href={href}
			className={className}
			onClick={() =>
				posthog.capture("project_navigation_clicked", {
					direction,
					project_slug: projectSlug,
					label,
				})
			}
		>
			{children}
		</Link>
	)
}
