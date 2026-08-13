"use client"
import { useEffect } from "react"
import { recordVisit } from "@/lib/progress"

// Invisible. Records "you were here" into the shared progress store on
// mount — a genuine sync with an external system (localStorage), which is
// what useEffect is for, unlike a render-time state derivation.
export function VisitTracker({
	href,
	label,
}: {
	href: string
	label: string
}) {
	useEffect(() => {
		recordVisit(href, label)
	}, [href, label])

	return null
}
