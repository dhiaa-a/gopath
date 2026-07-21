import Link from "next/link"
import { failures, failureCategories } from "@/lib/failures"

// Colour per category is presentation, so it lives here; the category list
// itself is data (lib/content/failures) where validate.ts can hold it to
// "every failure sits in exactly one known category". The fallback exists so
// a future category renders in a default colour instead of crashing the
// static export (the /concepts page taught that lesson the hard way).
const categoryStyles: Record<string, { color: string; border: string }> = {
	Concurrency: { color: "text-go-cyan", border: "border-go-cyan/20" },
	"Memory and aliasing": { color: "text-go-amber", border: "border-go-amber/20" },
	"Language semantics": { color: "text-go-teal", border: "border-go-teal/20" },
	"Standard library": { color: "text-go-cyan", border: "border-go-cyan/20" },
}
const fallbackStyle = { color: "text-muted", border: "border-border" }

export default function FailuresPage() {
	return (
		<main className="mx-auto max-w-4xl px-6 py-16">
			<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
				Failure labs
			</div>
			<h1 className="mb-3 font-serif text-4xl text-foreground">
				Scar tissue, on purpose.
			</h1>
			<p className="mb-6 max-w-2xl text-muted">
				Each lab is a program that compiles and looks plausible but is
				broken, plus the symptom the way an on-call engineer would
				report it. Run it, watch it fail, and work the diagnosis before
				you read the answer. The page teaches the path: which tool to
				reach for, what its output means, and only then the fix.
			</p>
			<p className="mb-12 max-w-2xl text-sm text-faint">
				Every lab lives in{" "}
				<code className="font-mono text-muted">labs/failures/</code>{" "}
				and reproduces on demand with a stock toolchain. None of them
				gate anything: the tier note on each is a suggestion about when
				it will teach the most, nothing more.
			</p>

			<div className="flex flex-col gap-10">
				{failureCategories.map((category) => {
					const style = categoryStyles[category] ?? fallbackStyle
					const group = failures.filter(
						(f) => f.category === category,
					)
					if (group.length === 0) return null

					return (
						<div key={category}>
							<div
								className={`mb-4 font-mono text-xs uppercase tracking-widest ${style.color}`}
							>
								{category}
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								{group.map((f) => (
									<Link
										key={f.slug}
										href={`/failures/${f.slug}`}
										className={`group rounded-lg border ${style.border} bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm`}
									>
										<div className="mb-1 flex items-baseline justify-between gap-3">
											<span className="font-semibold text-foreground group-hover:text-go-cyan">
												{f.name}
											</span>
											<span className="shrink-0 font-mono text-[10px] text-faint">
												T{f.unlockTier}+
											</span>
										</div>
										<div className="text-xs leading-relaxed text-muted">
											{f.tagline}
										</div>
									</Link>
								))}
							</div>
						</div>
					)
				})}
			</div>

			<div className="mt-12 rounded-lg border border-border bg-surface p-6">
				<p className="mb-1 font-semibold text-foreground">
					How to use a failure lab
				</p>
				<p className="text-sm text-muted">
					From the lab directory: run the broken program, read
					SYMPTOM.md, and commit to a diagnosis before opening the
					lab&apos;s page here. Then check yourself with{" "}
					<code className="font-mono">go run -tags fixed .</code>,
					which runs the corrected variant of the same program.
				</p>
			</div>
		</main>
	)
}
