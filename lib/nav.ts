import { getProjectsByTier } from "@/lib/projects"

// The redesigned nav carries four links and one action. Everything the old
// nine-link bar used to expose still needs a home, so it moves into a mega
// menu under Projects — the tracks and the on-ramp on the left, the eleven
// builds themselves on the right.
//
// This is derived on the server and handed to <Nav> as plain data. Nav is a
// client component, and importing the project modules there would ship every
// step of every project to the browser to render eleven link labels.

export type NavLink = {
	href: string
	label: string
	note: string
}

export type NavTier = {
	num: string
	name: string
	projects: { href: string; label: string }[]
}

export type NavMenu = {
	path: NavLink[]
	tracks: NavLink[]
	tiers: NavTier[]
}

const TIERS = [
	{ tier: 1, num: "Tier 01", name: "Foundations" },
	{ tier: 2, num: "Tier 02", name: "Systems" },
	{ tier: 3, num: "Tier 03", name: "Production" },
] as const

export function getNavMenu(): NavMenu {
	return {
		path: [
			{
				href: "/basics",
				label: "Basics",
				note: "14 micro-lessons — the syntax, taught in-house",
			},
			{
				href: "/projects",
				label: "All projects",
				note: "Eleven builds across three tiers, in order",
			},
			{
				href: "/capstone",
				label: "Capstone",
				note: "linkd: a spec, 34 black-box checks, no hints",
			},
		],
		tracks: [
			{
				href: "/failures",
				label: "Failure labs",
				note: "15 programs broken on purpose, symptom first",
			},
			{
				href: "/idioms",
				label: "Idiom exercises",
				note: "10 refactors a strict linter has to pass",
			},
			{
				href: "/concepts",
				label: "Go concepts",
				note: "61 entries on why Go is shaped this way",
			},
			{
				href: "/source",
				label: "Source walkthroughs",
				note: "5 annotated reads, checked against your GOROOT",
			},
		],
		tiers: TIERS.map(({ tier, num, name }) => ({
			num,
			name,
			projects: getProjectsByTier(tier).map((p) => ({
				href: `/projects/${p.slug}`,
				label: p.name,
			})),
		})),
	}
}
