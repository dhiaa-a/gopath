import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
	title: "Privacy — GoPath",
	description:
		"What GoPath collects, what it doesn't, and how the analytics are configured.",
}

export default function PrivacyPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
				<Link href="/" className="transition-colors hover:text-foreground">
					GoPath
				</Link>
				<span className="text-faint">/</span>
				<span className="text-foreground">Privacy</span>
			</div>

			<h1 className="mb-4 font-serif text-4xl text-foreground">Privacy</h1>
			<p className="mb-10 text-lg leading-relaxed text-muted">
				GoPath is built for developers who read{" "}
				<code className="font-mono text-sm">noscript</code> tags. The
				analytics posture is deliberate, narrow, and listed below in full.
			</p>

			<section className="mb-10">
				<h2 className="mb-3 font-serif text-2xl text-foreground">
					What we collect
				</h2>
				<ul className="ml-5 list-disc space-y-2 text-muted">
					<li>
						Anonymous pageviews (which page, referrer, country derived from
						IP, then IP discarded).
					</li>
					<li>
						A handful of named events tied to learning behavior: CTA clicks,
						orientation page advances, project step scroll-reach, project
						completion (scroll proxy), retrieval-prompt reveals, Go Playground
						opens, theme toggle, concept-to-project clicks.
					</li>
					<li>Uncaught JavaScript errors, for fixing the site.</li>
					<li>
						Core Web Vitals (LCP / CLS / INP) via Vercel Speed Insights,
						aggregated and IP-stripped at the edge.
					</li>
				</ul>
			</section>

			<section className="mb-10">
				<h2 className="mb-3 font-serif text-2xl text-foreground">
					What we don't
				</h2>
				<ul className="ml-5 list-disc space-y-2 text-muted">
					<li>
						<strong className="text-foreground">No cookies.</strong> Analytics
						state lives in <code className="font-mono text-sm">localStorage</code>{" "}
						under a single key.
					</li>
					<li>
						<strong className="text-foreground">No session replay.</strong>{" "}
						We do not record your screen, keystrokes, or mouse movements.
					</li>
					<li>
						<strong className="text-foreground">No autocapture.</strong> Only
						the named events listed above are sent. Random clicks are not.
					</li>
					<li>
						<strong className="text-foreground">No identification.</strong>{" "}
						There is no account system, no email collection, no cross-site
						tracking. All events are anonymous.
					</li>
					<li>
						<strong className="text-foreground">No third-party ads.</strong>{" "}
						No ad networks, no marketing pixels, no social-media trackers.
					</li>
				</ul>
			</section>

			<section className="mb-10">
				<h2 className="mb-3 font-serif text-2xl text-foreground">
					Where the data lives
				</h2>
				<p className="text-muted">
					Analytics events are sent to{" "}
					<a
						href="https://posthog.com"
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						PostHog
					</a>
					, EU region (Frankfurt). Site hosting is on{" "}
					<a
						href="https://vercel.com"
						className="text-go-cyan underline decoration-go-cyan/40 hover:no-underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						Vercel
					</a>
					. Nothing else.
				</p>
			</section>

			<section className="mb-10">
				<h2 className="mb-3 font-serif text-2xl text-foreground">
					How to opt out
				</h2>
				<p className="text-muted">
					Block <code className="font-mono text-sm">gopath.dev/ingest</code>{" "}
					in your browser or extension. The site works fully without it.
				</p>
			</section>

			<p className="font-mono text-xs text-faint">
				Last updated 2026-05-13.
			</p>
		</main>
	)
}
