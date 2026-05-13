import Link from "next/link"

export default function NotFound() {
	return (
		<main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
			<div className="mb-4 font-mono text-sm text-go-cyan">404</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				Page not found
			</h1>
			<p className="mb-8 max-w-sm text-muted">
				That project or page doesn&apos;t exist yet. Check the full list
				of projects.
			</p>
			<div className="flex gap-3">
				<Link
					href="/"
					className="rounded border border-border px-4 py-2 font-mono text-sm text-muted transition-colors hover:text-foreground"
				>
					← Home
				</Link>
				<Link
					href="/projects"
					className="rounded bg-go-cyan px-4 py-2 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-85"
				>
					All projects
				</Link>
			</div>
		</main>
	)
}
