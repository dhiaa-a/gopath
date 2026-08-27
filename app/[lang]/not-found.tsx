"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { localePath, toLang, ui } from "@/lib/i18n"

// A client component reading the pathname, because not-found is the one route
// file Next renders with no props at all — there is no `params` to take the
// language from, even though this page lives under [lang]. The pathname is the
// only signal available, and it is available statically.
export default function NotFound() {
	const pathname = usePathname()
	const lang = toLang(pathname.split("/")[1])
	const tr = ui(lang)
	const lp = (href: string) => localePath(href, lang)

	return (
		<main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
			<div className="mb-4 font-mono text-sm text-go-cyan">404</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				{tr.notFound.title}
			</h1>
			<p className="mb-8 max-w-sm text-muted">{tr.notFound.body}</p>
			<div className="flex gap-3">
				<Link
					href={lp("/")}
					className="group flex items-center gap-2 rounded border border-border px-4 py-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
				>
					<span aria-hidden="true" className="m-arrow">
						←
					</span>
					{tr.notFound.home}
				</Link>
				<Link
					href={lp("/projects")}
					className="rounded bg-go-cyan px-4 py-2 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-85"
				>
					{tr.notFound.allProjects}
				</Link>
			</div>
		</main>
	)
}
