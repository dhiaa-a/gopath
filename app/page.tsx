import Link from "next/link"
import { getProjectsByTier } from "@/lib/projects"
import { GoCodeBlock } from "@/components/GoCode"

const tierColors = {
	1: {
		accent: "text-go-cyan",
		border: "border-go-cyan/20",
		icon: "bg-go-cyan/15 text-go-cyan",
		hover: "hover:border-go-cyan/40",
	},
	2: {
		accent: "text-go-teal",
		border: "border-go-teal/20",
		icon: "bg-go-teal/15 text-go-teal",
		hover: "hover:border-go-teal/40",
	},
	3: {
		accent: "text-go-amber",
		border: "border-go-amber/20",
		icon: "bg-go-amber/15 text-go-amber",
		hover: "hover:border-go-amber/40",
	},
}

const tierMeta = {
	1: {
		num: "Tier 01",
		name: "Get Comfortable",
		desc: "Syntax, types, error handling, and the standard library",
	},
	2: {
		num: "Tier 02",
		name: "Go Idioms",
		desc: "Write code that feels native to Go, not translated from another language",
	},
	3: {
		num: "Tier 03",
		name: "Production Grade",
		desc: "Real-world architecture, databases, and performance tooling",
	},
}

export default function Home() {
	return (
		<main>
			{/* HERO */}
			<section className="bg-gradient-to-b from-go-cyan/5 to-transparent">
				<div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-20 pt-24 lg:grid-cols-2 lg:items-center">
					<div>
						<div className="mb-6 inline-flex items-center gap-2 rounded border border-go-cyan/25 bg-go-cyan/10 px-3 py-1.5 font-mono text-xs text-go-cyan">
							<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go-cyan" />
							For developers from other languages
						</div>
						<h1 className="mb-5 font-serif text-5xl leading-tight text-white">
							Learn Go by{" "}
							<em className="italic text-go-cyan">
								building real things
							</em>
						</h1>
						<p className="mb-8 max-w-lg text-lg leading-relaxed text-muted">
							No toy examples. No tutorial hell. Each project
							teaches you how Go actually thinks — through code
							you&apos;d write at a real job.
						</p>
						<div className="flex flex-wrap items-center gap-4">
							<Link
								href="/projects/cli-renamer"
								className="rounded bg-go-cyan px-6 py-3 font-mono text-sm font-semibold text-black transition-all hover:-translate-y-px hover:bg-sky-400"
							>
								Start the path →
							</Link>
							<Link
								href="#why"
								className="font-mono text-sm text-muted transition-colors hover:text-white"
							>
								Why this works
							</Link>
						</div>
					</div>

					{/* Code window */}
					<div className="overflow-hidden rounded-lg border border-border bg-surface font-mono text-sm">
						<div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-3">
							<span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
							<span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
							<span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
							<span className="ml-2 text-xs text-muted">
								main.go
							</span>
						</div>
						<GoCodeBlock
							code={`package main

import (
    "context"
    "log/slog"
    "net/http"
    "os/signal"
    "syscall"
)

func main() {
    ctx, stop := signal.NotifyContext(
        context.Background(),
        syscall.SIGINT, syscall.SIGTERM,
    )
    defer stop()

    mux := http.NewServeMux()
    mux.Handle("/api/", withAuth(
        withLogging(apiHandler),
    ))

    srv := &http.Server{Addr: ":8080", Handler: mux}
    go srv.ListenAndServe()

    <-ctx.Done()
    slog.Info("shutting down gracefully")
    srv.Shutdown(context.Background())
}`}
						/>
					</div>
				</div>
			</section>

			{/* STATS */}
			<div className="border-y border-border bg-surface">
				<div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-12 px-6 py-8 md:gap-20">
					{[
						{ n: "9", l: "Projects" },
						{ n: "3", l: "Tiers" },
						{ n: "40+", l: "Go concepts" },
						{ n: "0", l: "Toy examples" },
					].map((s) => (
						<div key={s.l} className="text-center">
							<div className="font-mono text-3xl font-semibold text-white">
								{s.n}
							</div>
							<div className="mt-1 text-xs uppercase tracking-widest text-muted">
								{s.l}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* PATH */}
			<section className="mx-auto max-w-6xl px-6 py-24" id="path">
				<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
					The path
				</div>
				<h2 className="mb-3 font-serif text-4xl text-white">
					Three tiers. Nine real projects.
				</h2>
				<p className="mb-12 max-w-xl text-muted">
					Each project unlocks the next. You&apos;ll never read ten
					pages of theory before writing a line of code.
				</p>

				<div className="flex flex-col gap-6">
					{([1, 2, 3] as const).map((tier) => {
						const c = tierColors[tier]
						const m = tierMeta[tier]
						const tierProjects = getProjectsByTier(tier)
						return (
							<div
								key={tier}
								className={`overflow-hidden rounded-lg border ${c.border} bg-surface`}
							>
								<div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
									<div className="border-b border-border bg-surface2 p-6 lg:border-b-0 lg:border-r">
										<div
											className={`mb-2 font-mono text-xs uppercase tracking-widest ${c.accent}`}
										>
											{m.num}
										</div>
										<div className="mb-1 font-semibold text-white">
											{m.name}
										</div>
										<div className="text-xs leading-relaxed text-muted">
											{m.desc}
										</div>
									</div>
									<div className="flex flex-col gap-3 p-4">
										{tierProjects.map((p) => (
											<Link
												key={p.slug}
												href={`/projects/${p.slug}`}
												className={`flex items-start gap-4 rounded-md border border-border bg-surface2 p-4 transition-all ${c.hover} hover:translate-x-1`}
											>
												<div
													className={`flex h-9 w-9 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${c.icon}`}
												>
													{p.code}
												</div>
												<div className="min-w-0">
													<div className="mb-0.5 font-semibold text-white">
														{p.name}
													</div>
													<div className="mb-2 text-xs text-muted">
														{p.tagline}
													</div>
													<div className="flex flex-wrap gap-1.5">
														{p.tags.map((t) => (
															<span
																key={t}
																className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-muted"
															>
																{t}
															</span>
														))}
													</div>
												</div>
												<div className="ml-auto shrink-0 font-mono text-[10px] text-faint">
													{p.estimatedTime}
												</div>
											</Link>
										))}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</section>

			{/* WHY */}
			<section className="border-t border-border bg-surface" id="why">
				<div className="mx-auto max-w-6xl px-6 py-24">
					<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
						Why GoPath
					</div>
					<h2 className="mb-3 font-serif text-4xl text-white">
						Built for people who already code.
					</h2>
					<p className="mb-12 max-w-xl text-muted">
						Tour of Go teaches syntax. Go by Example shows snippets.
						GoPath teaches you how to <em>think</em> in Go — by
						forcing you to build things.
					</p>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{[
							{
								h: "Structured progression",
								b: "Every project requires what the last one taught. No dead ends, no backtracking. The order is intentional.",
							},
							{
								h: "Concepts link to projects",
								b: "Every concept links to the project that teaches it best — not a docs page. Real code you can run.",
							},
							{
								h: '"Coming from X" sidebars',
								b: "Python dev? JS dev? Rust dev? Each project surfaces the key mental model shifts for where you're coming from.",
							},
							{
								h: "No fluff, no filler",
								b: "You write code in the first 5 minutes. Every page respects your time. Zero 'what is a variable' intros.",
							},
						].map((d) => (
							<div
								key={d.h}
								className="rounded-lg border border-border bg-bg p-6"
							>
								<h3 className="mb-2 font-semibold text-white">
									{d.h}
								</h3>
								<p className="text-sm leading-relaxed text-muted">
									{d.b}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="mx-auto max-w-2xl px-6 py-24 text-center">
				<h2 className="mb-4 font-serif text-4xl text-white">
					Ready to write real Go?
				</h2>
				<p className="mb-8 text-muted">
					Start with the File Renamer CLI — you&apos;ll be writing
					idiomatic Go within the first half hour.
				</p>
				<Link
					href="/projects/cli-renamer"
					className="inline-block rounded bg-go-cyan px-8 py-3 font-mono text-sm font-semibold text-black transition-all hover:-translate-y-px hover:bg-sky-400"
				>
					Start: File renamer CLI →
				</Link>
			</section>

			<footer className="border-t border-border py-8 text-center font-mono text-xs text-faint">
				gopath.dev — learn go by building real things
			</footer>
		</main>
	)
}
