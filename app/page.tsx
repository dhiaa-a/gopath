import Link from "next/link"
import { getProjectsByTier } from "@/lib/projects"
import { GoCode } from "@/components/GoCode"

// Short enough to sit in the 200px label cell. The longer forms the project
// pages use stay on the project pages.
const tierMeta = {
	1: {
		num: "Tier 01",
		name: "Foundations",
		desc: "Syntax, types, error handling, standard library",
	},
	2: {
		num: "Tier 02",
		name: "Systems",
		desc: "Concurrency, networking, programs under load",
	},
	3: {
		num: "Tier 03",
		name: "Production",
		desc: "Real architecture, databases, a measured gate",
	},
} as const

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

const why = [
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
]

// Shown at rest on the homepage of a site that teaches Go, so it has to be real
// Go: every import is used, every identifier is defined, it builds, vet is
// quiet and gofmt leaves it alone. Indented with tabs for that last reason —
// `pre` sets tab-size: 4, so it renders exactly as the design draws it.
const heroCode = `package main

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
	srv := &http.Server{Addr: ":8080", Handler: mux}
	go srv.ListenAndServe()

	<-ctx.Done()
	slog.Info("shutting down gracefully")
	srv.Shutdown(context.Background())
}`

// Spacing is written in explicit px rather than on Tailwind's rem scale. The
// site sets html { font-size: 17px }, so every rem utility lands 6.25% off the
// values this design specifies, and it specifies them as final.
const SHELL = "mx-auto max-w-[1160px] px-[24px] lg:px-[32px]"
// accent-700, not the raw accent the proof draws. The system's own readme is
// explicit that the accent-to-ground pair only reaches 3:1 — "enough for icons,
// large text and interface chrome, not for body copy" — and names this ramp
// step as the fix for accent text at paragraph size. An 11px label is not large
// text: in the raw accent it measures 3.76:1 and fails AA, and at -700 it
// measures 6.4:1 while still reading as the accent.
const KICKER = "mb-[12px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink"
const H2 =
	"mb-[12px] text-[26px] font-extrabold leading-[1.12] tracking-[-0.015em] text-m-ink lg:text-[32px]"
const LEAD = "mb-[32px] text-[15px] leading-[1.65] text-m-muted"

export default function Home() {
	return (
		<main className="m-scope bg-m-bg font-display text-m-ink">
			{/* HERO */}
			<div
				className={`${SHELL} grid grid-cols-1 gap-[40px] pb-[40px] pt-[40px] lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-[64px] lg:pt-[56px]`}
			>
				<div>
					<span className="mb-[22px] inline-flex bg-m-tag-bg px-[10px] py-[3px] text-[11px] tracking-[0.02em] text-m-tag-fg">
						For developers from other languages
					</span>
					<h1 className="mb-[20px] max-w-[13ch] text-[34px] font-extrabold leading-[1.08] tracking-[-0.015em] text-m-ink sm:text-[42px] lg:text-[52px]">
						Learn Go here, and{" "}
						<span className="text-m-accent-ink">nowhere else.</span>
					</h1>
					<p className="mb-[28px] max-w-[44ch] text-[16px] leading-[1.65] text-m-muted">
						Syntax to production, in one place. Twelve programs you
						actually build, fifteen bugs you diagnose yourself, and a
						final spec graded by a suite that never reads your code.
					</p>
					<div className="flex flex-wrap items-center gap-[24px]">
						<Link
							href="/projects/cli-renamer"
							className="bg-m-accent px-[26px] py-[13px] text-[14px] font-extrabold text-m-on-accent transition-colors hover:bg-m-accent-hover"
						>
							Start the path →
						</Link>
						<Link
							href="/basics"
							className="border-b border-m-divider pb-px text-[13px] text-m-ink transition-colors hover:border-m-accent hover:text-m-accent"
						>
							New to Go? Start with Basics →
						</Link>
					</div>
				</div>

				{/* Code window */}
				<div className="m-code border-2 border-m-divider bg-m-surface">
					<div className="border-b-2 border-m-divider px-[16px] py-[9px]">
						<span className="font-mono text-[11px] text-m-faint">
							main.go
						</span>
					</div>
					<pre className="overflow-x-auto p-[22px] font-mono text-[12.5px] leading-[1.75]">
						<GoCode code={heroCode} />
					</pre>
				</div>
			</div>

			{/* STATS */}
			<div className="border-y-2 border-m-divider bg-m-surface">
				<div
					className={`${SHELL} flex flex-wrap items-baseline justify-center gap-[12px] py-[22px]`}
				>
					<span className="text-[18px] font-extrabold">
						12 programs shipped
					</span>
					<span aria-hidden="true" className="text-m-faint">
						·
					</span>
					<span className="text-[18px] font-extrabold">
						61 concepts explained
					</span>
					<span aria-hidden="true" className="text-m-faint">
						·
					</span>
					<span className="text-[18px] font-extrabold">
						15 failure labs
					</span>
				</div>
			</div>

			{/* PATH */}
			<section className={`${SHELL} py-[64px]`} id="path">
				<div className={KICKER}>The path</div>
				<h2 className={`${H2} max-w-[22ch]`}>
					Start at{" "}
					<span className="font-mono text-[0.85em] font-normal">
						package main
					</span>
					. Finish at a graded spec.
				</h2>
				<p className={`${LEAD} max-w-[56ch]`}>
					Tier 0 teaches the syntax here instead of linking you out for
					it. Eleven projects then build on each other in order. The
					twelfth hands you a specification and no help at all.
				</p>

				<div>
					<PathRow href="/basics" num="Tier 00" name="Basics" muted>
						<span className="text-[14px] text-m-muted">
							14 micro-lessons teaching the syntax in-house, about
							3 hours
						</span>
					</PathRow>

					{([1, 2, 3] as const).map((tier) => {
						const m = tierMeta[tier]
						const projects = getProjectsByTier(tier)
						return (
							<PathRow
								key={tier}
								href={`/projects/${projects[0].slug}`}
								num={m.num}
								name={m.name}
								desc={m.desc}
							>
								{projects.map((p) => (
									<span
										key={p.slug}
										className="bg-m-tag-neutral-bg px-[10px] py-[3px] text-[11px] tracking-[0.02em] text-m-tag-neutral-fg"
									>
										{p.name}
									</span>
								))}
							</PathRow>
						)
					})}

					<PathRow
						href="/capstone"
						num="Capstone"
						name="linkd"
						desc="Zero guidance"
						last
					>
						<span className="text-[14px] text-m-muted">
							A link shortener: auth, rate limiting, durable
							storage, metrics — a spec, 34 black-box checks, no
							hints
						</span>
					</PathRow>
				</div>
			</section>

			{/* TRACKS */}
			<section className="border-t-2 border-m-divider bg-m-surface">
				<div className={`${SHELL} py-[64px]`}>
					<div className={KICKER}>Beyond the path</div>
					<h2 className={`${H2} max-w-[24ch]`}>
						The parts you would have gone looking for elsewhere.
					</h2>
					<p className={`${LEAD} max-w-[60ch]`}>
						Debugging, idiom, and reading real source are what
						separate someone who knows Go from someone who works in
						it. None of them fit at the end of a chapter, so each one
						is its own track.
					</p>
					<div className="grid grid-cols-1 gap-[2px] border-2 border-m-divider bg-m-divider sm:grid-cols-2">
						{tracks.map((t) => (
							<Link
								key={t.href}
								href={t.href}
								className="group bg-m-bg p-[24px] transition-colors hover:bg-m-surface"
							>
								<div className="mb-[10px] flex items-baseline gap-[10px]">
									<span className="text-[22px] font-extrabold">
										{t.n}
									</span>
									<span className="text-[11px] uppercase tracking-[0.08em] text-m-faint">
										{t.label}
									</span>
									<span
										aria-hidden="true"
										className="ml-auto font-mono text-[12px] text-m-faint transition-transform group-hover:translate-x-1 group-hover:text-m-accent"
									>
										→
									</span>
								</div>
								<p className="text-[13px] leading-[1.65] text-m-muted">
									{t.body}
								</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* WHY */}
			<section className={`${SHELL} py-[64px]`} id="why">
				<div className={KICKER}>Why GoPath</div>
				<h2 className={`${H2} max-w-[26ch]`}>
					One resource, because assembling five was the actual problem.
				</h2>
				<p className={`${LEAD} max-w-[60ch]`}>
					The usual route is a tour for the syntax, a book for the
					idiom, a conference talk for the concurrency bugs, and a job
					for everything after that. Nothing here sends you away to
					finish a lesson, and every claim on this site is one you can
					run yourself.
				</p>
				<div className="grid grid-cols-1 gap-[32px] sm:grid-cols-2 sm:gap-x-[48px]">
					{why.map((d) => (
						<div key={d.h}>
							<h3 className="mb-[8px] text-[17px] font-extrabold leading-[1.2] text-m-ink">
								{d.h}
							</h3>
							<p className="text-[13px] leading-[1.65] text-m-muted">
								{d.b}
							</p>
						</div>
					))}
				</div>
			</section>

			<footer className="border-t-2 border-m-divider">
				<div
					className={`${SHELL} py-[24px] font-mono text-[12px] text-m-faint`}
				>
					gopath.dev · learn go by building real things
				</div>
			</footer>
		</main>
	)
}

// One row, one destination. The project names read as what you will build
// rather than as eleven separate things to choose between — the mega menu and
// /projects are where you pick one out.
function PathRow({
	href,
	num,
	name,
	desc,
	muted,
	last,
	children,
}: {
	href: string
	num: string
	name: string
	desc?: string
	muted?: boolean
	last?: boolean
	children: React.ReactNode
}) {
	return (
		<Link
			href={href}
			className={`group grid grid-cols-1 gap-[8px] border-t-2 border-m-divider py-[22px] transition-colors hover:bg-m-surface lg:grid-cols-[200px_1fr] lg:gap-[24px] ${
				last ? "border-b-2" : ""
			}`}
		>
			<div>
				<div
					className={`mb-[4px] font-mono text-[11px] uppercase tracking-[0.08em] ${
						muted ? "text-m-faint" : "text-m-accent-ink"
					}`}
				>
					{num}
				</div>
				<div className="text-[15px] font-extrabold">{name}</div>
				{desc && (
					<div className="mt-[2px] text-[12px] text-m-faint">
						{desc}
					</div>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-[10px]">
				{children}
				<span
					aria-hidden="true"
					className="ml-auto font-mono text-[12px] text-m-faint transition-transform group-hover:translate-x-1 group-hover:text-m-accent"
				>
					→
				</span>
			</div>
		</Link>
	)
}
