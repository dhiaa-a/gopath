import Link from "next/link"
import { getProjectsByTier } from "@/lib/projects"
import { GoCode } from "@/components/GoCode"
import { Appear, CountUp } from "@/components/Motion"

// Short enough to sit in the label cell. The longer forms the project pages use
// stay on the project pages.
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

const stats = [
	{ n: 12, label: "programs shipped" },
	{ n: 61, label: "concepts explained" },
	{ n: 15, label: "failure labs" },
]

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
// value intended, and this layout is built on a 4/8/12/16/24/32 rhythm.
const SHELL = "mx-auto max-w-[1160px] px-[24px] lg:px-[40px]"
const SECTION = "py-[80px] lg:py-[112px]"
const KICKER =
	"mb-[16px] text-[11px] uppercase tracking-[0.08em] text-m-accent-ink"
const H2 =
	"mb-[16px] text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-m-ink lg:text-[36px]"
const LEAD = "mb-[48px] text-[16px] leading-[1.7] text-m-muted"

export default function Home() {
	return (
		<main className="m-scope bg-m-bg font-display text-m-ink">
			{/* HERO */}
			<div
				className={`${SHELL} grid grid-cols-1 items-center gap-[48px] pb-[80px] pt-[56px] lg:grid-cols-[1.05fr_1fr] lg:gap-[80px] lg:pb-[104px] lg:pt-[88px]`}
			>
				<Appear stagger>
					<div>
						<span className="inline-flex bg-m-tag-bg px-[12px] py-[5px] text-[11px] tracking-[0.02em] text-m-tag-fg">
							For developers from other languages
						</span>
					</div>
					<h1 className="mt-[26px] max-w-[13ch] text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-m-ink sm:text-[46px] lg:text-[54px] xl:text-[58px]">
						Learn Go here, and{" "}
						<span className="text-m-accent-ink">nowhere else.</span>
					</h1>
					<p className="mt-[24px] max-w-[46ch] text-[17px] leading-[1.7] text-m-muted">
						Syntax to production, in one place. Twelve programs you
						actually build, fifteen bugs you diagnose yourself, and a
						final spec graded by a suite that never reads your code.
					</p>
					<div className="mt-[36px] flex flex-wrap items-center gap-[28px]">
						<Link
							href="/projects/cli-renamer"
							className="group flex items-center gap-[10px] bg-m-accent px-[28px] py-[15px] text-[15px] font-extrabold text-m-on-accent transition-colors duration-300 hover:bg-m-accent-hover"
						>
							Start the path
							<span aria-hidden="true" className="m-arrow">
								→
							</span>
						</Link>
						<Link
							href="/basics"
							className="group flex items-center gap-[8px] border-b-2 border-m-divider pb-[3px] text-[14px] text-m-ink transition-colors duration-300 hover:border-m-accent hover:text-m-accent"
						>
							New to Go? Start with Basics
							<span aria-hidden="true" className="m-arrow">
								→
							</span>
						</Link>
					</div>
				</Appear>

				{/* Code window */}
				<Appear delay={140}>
					<div className="m-code border-2 border-m-divider bg-m-surface">
						<div className="flex items-center gap-[10px] border-b-2 border-m-divider px-[18px] py-[11px]">
							<span
								aria-hidden="true"
								className="h-[7px] w-[7px] bg-m-accent"
							/>
							<span className="font-mono text-[11px] tracking-[0.04em] text-m-faint">
								main.go
							</span>
						</div>
						<pre className="overflow-x-auto p-[24px] font-mono text-[12.5px] leading-[1.75]">
							<GoCode code={heroCode} />
							<span aria-hidden="true" className="m-caret" />
						</pre>
					</div>
				</Appear>
			</div>

			{/* STATS */}
			<div className="border-y-2 border-m-divider bg-m-surface">
				<Appear
					stagger
					className={`${SHELL} flex flex-wrap items-center justify-center gap-x-[56px] gap-y-[20px] py-[32px]`}
				>
					{stats.map((s) => (
						<div
							key={s.label}
							className="flex items-baseline gap-[10px]"
						>
							<CountUp
								to={s.n}
								className="text-[30px] font-extrabold leading-none tracking-[-0.02em] text-m-accent-ink"
							/>
							<span className="text-[14px] text-m-muted">
								{s.label}
							</span>
						</div>
					))}
				</Appear>
			</div>

			{/* PATH */}
			<section className={`${SHELL} ${SECTION}`} id="path">
				<Appear>
					<div className={KICKER}>The path</div>
					<h2 className={`${H2} max-w-[22ch]`}>
						Start at{" "}
						<span className="font-mono text-[0.82em] font-normal">
							package main
						</span>
						. Finish at a graded spec.
					</h2>
					<p className={`${LEAD} max-w-[58ch]`}>
						Tier 0 teaches the syntax here instead of linking you out
						for it. Eleven projects then build on each other in
						order. The twelfth hands you a specification and no help
						at all.
					</p>
				</Appear>

				<Appear stagger>
					<PathRow href="/basics" num="Tier 00" name="Basics" muted>
						<span className="text-[15px] text-m-muted">
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
										className="bg-m-tag-neutral-bg px-[12px] py-[5px] text-[12px] tracking-[0.01em] text-m-tag-neutral-fg"
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
						<span className="text-[15px] text-m-muted">
							A link shortener: auth, rate limiting, durable
							storage, metrics — a spec, 34 black-box checks, no
							hints
						</span>
					</PathRow>
				</Appear>
			</section>

			{/* TRACKS */}
			<section className="border-t-2 border-m-divider bg-m-surface">
				<div className={`${SHELL} ${SECTION}`}>
					<Appear>
						<div className={KICKER}>Beyond the path</div>
						<h2 className={`${H2} max-w-[24ch]`}>
							The parts you would have gone looking for elsewhere.
						</h2>
						<p className={`${LEAD} max-w-[62ch]`}>
							Debugging, idiom, and reading real source are what
							separate someone who knows Go from someone who works
							in it. None of them fit at the end of a chapter, so
							each one is its own track.
						</p>
					</Appear>
					<Appear
						stagger
						className="grid grid-cols-1 gap-[2px] border-2 border-m-divider bg-m-divider sm:grid-cols-2"
					>
						{tracks.map((t) => (
							<Link
								key={t.href}
								href={t.href}
								className="m-card group bg-m-bg p-[32px] hover:bg-m-surface"
							>
								<div>
									<div className="mb-[14px] flex items-baseline gap-[12px]">
										<span className="text-[26px] font-extrabold leading-none tracking-[-0.02em] transition-colors duration-300 group-hover:text-m-accent-ink">
											{t.n}
										</span>
										<span className="text-[11px] uppercase tracking-[0.08em] text-m-faint">
											{t.label}
										</span>
										<span
											aria-hidden="true"
											className="m-arrow ml-auto font-mono text-[13px] text-m-faint group-hover:text-m-accent"
										>
											→
										</span>
									</div>
									<p className="text-[14px] leading-[1.7] text-m-muted">
										{t.body}
									</p>
								</div>
							</Link>
						))}
					</Appear>
				</div>
			</section>

			{/* WHY */}
			<section className={`${SHELL} ${SECTION}`} id="why">
				<Appear>
					<div className={KICKER}>Why GoPath</div>
					<h2 className={`${H2} max-w-[26ch]`}>
						One resource, because assembling five was the actual
						problem.
					</h2>
					<p className={`${LEAD} max-w-[62ch]`}>
						The usual route is a tour for the syntax, a book for the
						idiom, a conference talk for the concurrency bugs, and a
						job for everything after that. Nothing here sends you
						away to finish a lesson, and every claim on this site is
						one you can run yourself.
					</p>
				</Appear>
				<Appear
					stagger
					className="grid grid-cols-1 gap-[44px] sm:grid-cols-2 sm:gap-x-[64px]"
				>
					{why.map((d, i) => (
						<div key={d.h}>
							<div className="mb-[14px] flex items-center gap-[14px]">
								<span className="font-mono text-[11px] text-m-accent-ink">
									{String(i + 1).padStart(2, "0")}
								</span>
								<span className="h-[2px] flex-1 bg-m-divider" />
							</div>
							<h3 className="mb-[10px] text-[18px] font-extrabold leading-[1.25] text-m-ink">
								{d.h}
							</h3>
							<p className="text-[14px] leading-[1.7] text-m-muted">
								{d.b}
							</p>
						</div>
					))}
				</Appear>
			</section>

			<footer className="border-t-2 border-m-divider bg-m-surface">
				<div
					className={`${SHELL} flex flex-wrap items-center gap-[16px] py-[32px]`}
				>
					<span className="font-mono text-[12px] text-m-faint">
						gopath.dev · learn go by building real things
					</span>
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
			className={`m-row group grid grid-cols-1 gap-[12px] border-t-2 border-m-divider py-[28px] pl-0 pr-[8px] transition-colors duration-300 hover:bg-m-surface lg:grid-cols-[210px_1fr] lg:gap-[32px] lg:py-[32px] ${
				last ? "border-b-2" : ""
			}`}
		>
			<div className="pl-[16px] transition-[padding] duration-300 group-hover:pl-[24px]">
				<div
					className={`mb-[6px] font-mono text-[11px] uppercase tracking-[0.08em] ${
						muted ? "text-m-faint" : "text-m-accent-ink"
					}`}
				>
					{num}
				</div>
				<div className="text-[17px] font-extrabold leading-[1.2]">
					{name}
				</div>
				{desc && (
					<div className="mt-[6px] text-[12.5px] leading-[1.5] text-m-faint">
						{desc}
					</div>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-[10px] pl-[16px] lg:pl-0">
				{children}
				<span
					aria-hidden="true"
					className="m-arrow ml-auto font-mono text-[13px] text-m-faint group-hover:text-m-accent"
				>
					→
				</span>
			</div>
		</Link>
	)
}
