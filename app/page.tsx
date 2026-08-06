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

// Names match each project page's own tierLabel (FOUNDATIONS / SYSTEMS /
// PRODUCTION) so the homepage and the pages it links to agree.
const tierMeta = {
	1: {
		num: "Tier 01",
		name: "Foundations",
		desc: "Syntax, types, error handling, and the standard library",
	},
	2: {
		num: "Tier 02",
		name: "Systems",
		desc: "Concurrency, networking, and programs that hold up under load",
	},
	3: {
		num: "Tier 03",
		name: "Production",
		desc: "Real architecture, databases, and a measured gate on every project",
	},
}

const tracks = [
	{
		href: "/failures",
		n: "15",
		label: "Failure labs",
		body: "Programs broken on purpose. You get the symptom the way an on-call engineer would report it and work back to the cause. The harness holds every lab to reproducing, so one that stops failing is as red as a test that stops passing.",
	},
	{
		href: "/idioms",
		n: "10",
		label: "Idiom exercises",
		body: "Working Go with an accent: Java getters, Python exceptions, C index-juggling. Refactor until the tests stay green and a strict linter goes quiet. Idiom you clear, not idiom you read about.",
	},
	{
		href: "/concepts",
		n: "61",
		label: "Go concepts",
		body: "Not what compiles, but why Go is shaped this way: no exceptions, no inheritance, channels over locks. Each one links to the project that teaches it best rather than to a docs page.",
	},
	{
		href: "/source",
		n: "5",
		label: "Source walkthroughs",
		body: "Annotated reads of errors, bytes.Buffer, sync.WaitGroup, context, and the net/http accept loop. Every excerpt is checked against the copy of Go on your own machine, so nothing here can drift.",
	},
]

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
						<h1 className="mb-5 font-serif text-5xl leading-tight text-foreground">
							Learn Go here, and{" "}
							<em className="italic text-go-cyan">
								nowhere else
							</em>
							.
						</h1>
						<p className="mb-8 max-w-lg text-lg leading-relaxed text-muted">
							Syntax to production, in one place. Twelve programs
							you actually build, fifteen bugs you diagnose
							yourself, and a final spec graded by a suite that
							never reads your code.
						</p>
						<div className="flex flex-wrap items-center gap-4">
							<Link
								href="/projects/cli-renamer"
								className="rounded bg-go-cyan px-6 py-3 font-mono text-sm font-semibold text-black transition-all hover:-translate-y-px hover:bg-sky-400"
							>
								Start the path →
							</Link>
							<Link
								href="/orientation"
								className="font-mono text-sm text-muted transition-colors hover:text-foreground"
							>
								New to Go? Start with Orientation →
							</Link>
							<Link
								href="#why"
								className="font-mono text-sm text-muted transition-colors hover:text-foreground"
							>
								Why this works
							</Link>
						</div>
					</div>

					{/* Code window */}
					<div className="overflow-hidden rounded-lg border border-border bg-surface font-mono text-sm">
						<div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-1">
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
						{ n: "14", l: "Basics lessons" },
						{ n: "12", l: "Programs you ship" },
						{ n: "61", l: "Go concepts" },
						{ n: "15", l: "Failure labs" },
						{ n: "10", l: "Idiom exercises" },
						{ n: "5", l: "Source walkthroughs" },
					].map((s) => (
						<div key={s.l} className="text-center">
							<div className="font-mono text-3xl font-semibold text-foreground">
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
				<h2 className="mb-3 font-serif text-4xl text-foreground">
					Start at <code className="font-mono">package main</code>.
					Finish at a graded spec.
				</h2>
				<p className="mb-12 max-w-xl text-muted">
					Tier 0 teaches the syntax here instead of linking you out
					for it. Eleven projects then build on each other in order.
					The twelfth hands you a specification and no help at all.
				</p>

				<div className="flex flex-col gap-6">
					{/* Tier 0: the on-ramp */}
					<Link
						href="/basics"
						className="group grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border2 lg:grid-cols-[220px_1fr]"
					>
						<div className="border-b border-border bg-surface2 p-6 lg:border-b-0 lg:border-r">
							<div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
								Tier 00
							</div>
							<div className="mb-1 font-semibold text-foreground">
								Basics
							</div>
							<div className="text-xs leading-relaxed text-muted">
								The syntax, taught in-house
							</div>
						</div>
						<div className="flex items-center gap-4 p-6">
							<div className="min-w-0">
								<div className="mb-1 font-semibold text-foreground">
									14 micro-lessons, about 3 hours
								</div>
								<div className="text-sm leading-relaxed text-muted">
									Every lesson is one program under 30 lines
									that you type out and run. Skip it if you
									can already read Go. Start here if this is
									your first compiled language.
								</div>
							</div>
							<div className="ml-auto shrink-0 font-mono text-xs text-muted transition-transform group-hover:translate-x-1">
								→
							</div>
						</div>
					</Link>

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
										<div className="mb-1 font-semibold text-foreground">
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
													<div className="mb-0.5 font-semibold text-foreground">
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
												<div className="ml-auto shrink-0 font-mono text-[10px] text-muted">
													{p.estimatedTime}
												</div>
											</Link>
										))}
									</div>
								</div>
							</div>
						)
					})}

					{/* The capstone: the end of the path */}
					<Link
						href="/capstone"
						className="group grid grid-cols-1 overflow-hidden rounded-lg border border-go-amber/30 bg-surface transition-colors hover:border-go-amber/60 lg:grid-cols-[220px_1fr]"
					>
						<div className="border-b border-border bg-surface2 p-6 lg:border-b-0 lg:border-r">
							<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
								Capstone
							</div>
							<div className="mb-1 font-semibold text-foreground">
								linkd
							</div>
							<div className="text-xs leading-relaxed text-muted">
								Zero guidance
							</div>
						</div>
						<div className="flex items-center gap-4 p-6">
							<div className="min-w-0">
								<div className="mb-1 font-semibold text-foreground">
									A link shortener, specified and graded
								</div>
								<div className="text-sm leading-relaxed text-muted">
									Auth, rate limiting, durable storage and
									metrics. No steps, no starter functions, no
									hints: a spec, 34 black-box checks that
									never read your source, and four objectives
									measured under load.
								</div>
							</div>
							<div className="ml-auto shrink-0 font-mono text-xs text-go-amber transition-transform group-hover:translate-x-1">
								→
							</div>
						</div>
					</Link>
				</div>
			</section>

			{/* TRACKS */}
			<section className="border-t border-border bg-surface">
				<div className="mx-auto max-w-6xl px-6 py-24">
					<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
						Beyond the path
					</div>
					<h2 className="mb-3 font-serif text-4xl text-foreground">
						The parts you would have gone looking for elsewhere.
					</h2>
					<p className="mb-12 max-w-2xl text-muted">
						Debugging, idiom, and reading real source are what
						separate someone who knows Go from someone who works in
						it. None of them fit at the end of a chapter, so each
						one is its own track.
					</p>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{tracks.map((t) => (
							<Link
								key={t.href}
								href={t.href}
								className="group rounded-lg border border-border bg-bg p-6 transition-colors hover:border-border2"
							>
								<div className="mb-3 flex items-baseline gap-3">
									<span className="font-mono text-2xl font-semibold text-foreground">
										{t.n}
									</span>
									<span className="text-xs uppercase tracking-widest text-muted">
										{t.label}
									</span>
									<span className="ml-auto font-mono text-xs text-muted transition-transform group-hover:translate-x-1">
										→
									</span>
								</div>
								<p className="text-sm leading-relaxed text-muted">
									{t.body}
								</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* WHY */}
			<section className="border-t border-border" id="why">
				<div className="mx-auto max-w-6xl px-6 py-24">
					<div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
						Why GoPath
					</div>
					<h2 className="mb-3 font-serif text-4xl text-foreground">
						One resource, because assembling five was the actual
						problem.
					</h2>
					<p className="mb-12 max-w-2xl text-muted">
						The usual route is a tour for the syntax, a book for the
						idiom, a conference talk for the concurrency bugs, and a
						job for everything after that. Nothing here sends you
						away to finish a lesson, and every claim on this site is
						one you can run yourself.
					</p>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{[
							{
								h: "Everything here runs",
								b: "Every project ships an executable lab: a real Go module you build and run, not a snippet on a page. One script formats, vets, builds, tests and gates every one of them together, so nothing here can quietly rot into a claim that stopped being true.",
							},
							{
								h: "You learn to debug, not just to build",
								b: "Fifteen labs hand you a broken program and a symptom instead of a lesson. Working back from a stack trace under pressure is a skill, and it is the one tutorials never train because their code always works.",
							},
							{
								h: "Idiom is enforced, not described",
								b: "The idiom track is graded by a strict linter, so writing it the Go way stops being advice you nod at and becomes a gate you clear. The tests must stay green while you refactor.",
							},
							{
								h: "It ends with proof",
								b: "The capstone gives you a specification and nothing else: 34 black-box checks and four measured objectives. It never reads your source, so any design that meets the spec passes and no design that misses it does.",
							},
						].map((d) => (
							<div
								key={d.h}
								className="rounded-lg border border-border bg-surface p-6"
							>
								<h3 className="mb-2 font-semibold text-foreground">
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
				<h2 className="mb-4 font-serif text-4xl text-foreground">
					Ready to write real Go?
				</h2>
				<p className="mb-8 text-muted">
					If you can already read a loop in another language, start
					with the File Renamer CLI. If Go is your first compiled
					language, spend three hours in Basics first.
				</p>
				<div className="flex flex-wrap items-center justify-center gap-4">
					<Link
						href="/projects/cli-renamer"
						className="inline-block rounded bg-go-cyan px-8 py-3 font-mono text-sm font-semibold text-black transition-all hover:-translate-y-px hover:bg-sky-400"
					>
						Start: File renamer CLI →
					</Link>
					<Link
						href="/basics"
						className="inline-block rounded border border-border px-8 py-3 font-mono text-sm text-muted transition-colors hover:border-border2 hover:text-foreground"
					>
						Start with Basics →
					</Link>
				</div>
			</section>

			<footer className="border-t border-border py-8 text-center font-mono text-xs text-muted">
				gopath.dev · learn go by building real things
			</footer>
		</main>
	)
}
