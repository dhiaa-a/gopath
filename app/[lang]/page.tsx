import Link from "next/link"
import { getProjectsByTier } from "@/lib/projects"
import { tier0Lessons } from "@/lib/tier0"
import { GoCode } from "@/components/GoCode"
import { ProgressBadge } from "@/components/ProgressBadge"
import { lessonId, stepId } from "@/lib/progress-ids"
import { Appear, CountUp } from "@/components/Motion"
import { localePath, toLang, ui } from "@/lib/i18n"

// Href and count stay here (structure); the label and body come from the
// dictionary, index-matched. Splitting it this way keeps a translator out of
// the routing table and keeps the routing table out of the translation.
const TRACK_LINKS = [
	{ href: "/failures", n: "15" },
	{ href: "/idioms", n: "10" },
	{ href: "/concepts", n: "61" },
	{ href: "/source", n: "5" },
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

export default async function Home({
	params,
}: {
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)
	const s = ui(lang)
	const p = (href: string) => localePath(href, lang)
	const stats = [
		{ n: 12, label: s.home.statPrograms },
		{ n: 61, label: s.home.statConcepts },
		{ n: 15, label: s.home.statFailures },
	]
	const tierMeta = {
		1: { num: "Tier 01", name: s.tiers.t1Name, desc: s.tiers.t1Desc },
		2: { num: "Tier 02", name: s.tiers.t2Name, desc: s.tiers.t2Desc },
		3: { num: "Tier 03", name: s.tiers.t3Name, desc: s.tiers.t3Desc },
	} as const

	return (
		<main className="m-scope bg-m-bg font-display text-m-ink">
			{/* HERO */}
			<div
				className={`${SHELL} grid grid-cols-1 items-center gap-[48px] pb-[80px] pt-[56px] lg:grid-cols-[1.05fr_1fr] lg:gap-[80px] lg:pb-[104px] lg:pt-[88px]`}
			>
				<Appear stagger>
					<div>
						<span className="inline-flex bg-m-tag-bg px-[12px] py-[5px] text-[11px] tracking-[0.02em] text-m-tag-fg">
							{s.home.badge}
						</span>
					</div>
					<h1 className="mt-[26px] max-w-[13ch] text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-m-ink sm:text-[46px] lg:text-[54px] xl:text-[58px]">
						{s.home.h1Lead}{" "}
						<span className="text-m-accent-ink">
							{s.home.h1Accent}
						</span>
					</h1>
					<p className="mt-[24px] max-w-[46ch] text-[17px] leading-[1.7] text-m-muted">
						{s.home.heroLead}
					</p>
					<div className="mt-[36px] flex flex-wrap items-center gap-[28px]">
						<Link
							href={p("/projects/cli-renamer")}
							className="group flex items-center gap-[10px] bg-m-accent px-[28px] py-[15px] text-[15px] font-extrabold text-m-on-accent transition-colors duration-300 hover:bg-m-accent-hover"
						>
							{s.nav.startCta}
							<span aria-hidden="true" className="m-arrow">
								→
							</span>
						</Link>
						<Link
							href={p("/orientation")}
							className="group flex items-center gap-[8px] border-b-2 border-m-divider pb-[3px] text-[14px] text-m-ink transition-colors duration-300 hover:border-m-accent hover:text-m-accent"
						>
							{s.home.newToGo}
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
					<div className={KICKER}>{s.home.pathKicker}</div>
					<h2 className={`${H2} max-w-[22ch]`}>
						{s.home.pathTitleLead}{" "}
						<span className="font-mono text-[0.82em] font-normal">
							package main
						</span>
						{s.home.pathTitleTail}
					</h2>
					<p className={`${LEAD} max-w-[58ch]`}>
						{s.home.pathLead}
					</p>
				</Appear>

				<Appear stagger>
					<PathRow
						href={p("/orientation")}
						num={s.nav.startHere}
						name={s.nav.orientation}
						muted
					>
						<span className="text-[15px] text-m-muted">
							{s.home.orientationRow}
						</span>
					</PathRow>

					<PathRow
						href={p("/basics")}
						num="Tier 00"
						name={s.home.basicsName}
						muted
						progressIds={tier0Lessons.map((l) => lessonId(l.slug))}
					>
						<span className="text-[15px] text-m-muted">
							{s.home.basicsRow}
						</span>
					</PathRow>

					{([1, 2, 3] as const).map((tier) => {
						const m = tierMeta[tier]
						const projects = getProjectsByTier(tier)
						return (
							<PathRow
								key={tier}
								href={p(`/projects/${projects[0].slug}`)}
								num={m.num}
								name={m.name}
								desc={m.desc}
								progressIds={projects.flatMap((p) =>
									p.steps.map((s) => stepId(p.slug, s.n)),
								)}
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
						href={p("/capstone")}
						num={s.search.types.Capstone}
						name="linkd"
						desc={s.home.zeroGuidance}
						last
					>
						<span className="text-[15px] text-m-muted">
							{s.home.capstoneRow}
						</span>
					</PathRow>
				</Appear>
			</section>

			{/* TRACKS */}
			<section className="border-t-2 border-m-divider bg-m-surface">
				<div className={`${SHELL} ${SECTION}`}>
					<Appear>
						<div className={KICKER}>{s.home.tracksKicker}</div>
						<h2 className={`${H2} max-w-[24ch]`}>
							{s.home.tracksTitle}
						</h2>
						<p className={`${LEAD} max-w-[62ch]`}>{s.home.tracksLead}</p>
					</Appear>
					<Appear
						stagger
						className="grid grid-cols-1 gap-[2px] border-2 border-m-divider bg-m-divider sm:grid-cols-2"
					>
						{TRACK_LINKS.map((t, i) => (
							<Link
								key={t.href}
								href={p(t.href)}
								className="m-card group bg-m-bg p-[32px] hover:bg-m-surface"
							>
								<div>
									<div className="mb-[14px] flex items-baseline gap-[12px]">
										<span className="text-[26px] font-extrabold leading-none tracking-[-0.02em] transition-colors duration-300 group-hover:text-m-accent-ink">
											{t.n}
										</span>
										<span className="text-[11px] uppercase tracking-[0.08em] text-m-faint">
											{s.home.tracks[i].label}
										</span>
										<span
											aria-hidden="true"
											className="m-arrow ms-auto font-mono text-[13px] text-m-faint group-hover:text-m-accent"
										>
											→
										</span>
									</div>
									<p className="text-[14px] leading-[1.7] text-m-muted">
										{s.home.tracks[i].body}
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
					<div className={KICKER}>{s.home.whyKicker}</div>
					<h2 className={`${H2} max-w-[26ch]`}>{s.home.whyTitle}</h2>
					<p className={`${LEAD} max-w-[62ch]`}>{s.home.whyLead}</p>
				</Appear>
				<Appear
					stagger
					className="grid grid-cols-1 gap-[44px] sm:grid-cols-2 sm:gap-x-[64px]"
				>
					{s.home.why.map((d, i) => (
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
						{s.home.footer}
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
	progressIds,
	children,
}: {
	href: string
	num: string
	name: string
	desc?: string
	muted?: boolean
	last?: boolean
	// Step or lesson ids this row's progress badge counts against. Omitted
	// for the capstone — zero guidance means no steps to check off.
	progressIds?: string[]
	children: React.ReactNode
}) {
	return (
		<Link
			href={href}
			className={`m-row group grid grid-cols-1 gap-[12px] border-t-2 border-m-divider py-[28px] pe-[8px] ps-0 transition-colors duration-300 hover:bg-m-surface lg:grid-cols-[210px_1fr] lg:gap-[32px] lg:py-[32px] ${
				last ? "border-b-2" : ""
			}`}
		>
			<div className="ps-[16px] transition-[padding] duration-300 group-hover:ps-[24px]">
				<div
					className={`mb-[6px] flex items-center gap-[10px] font-mono text-[11px] uppercase tracking-[0.08em] ${
						muted ? "text-m-faint" : "text-m-accent-ink"
					}`}
				>
					<span>{num}</span>
					{progressIds && <ProgressBadge ids={progressIds} />}
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
			<div className="flex flex-wrap items-center gap-[10px] ps-[16px] lg:ps-0">
				{children}
				<span
					aria-hidden="true"
					className="m-arrow ms-auto font-mono text-[13px] text-m-faint group-hover:text-m-accent"
				>
					→
				</span>
			</div>
		</Link>
	)
}
