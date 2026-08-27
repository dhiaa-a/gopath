import { getProjectsByTier } from "@/lib/projects"
import { localePath, ui, type Lang } from "@/lib/i18n"

// The redesigned nav carries four links and one action. Everything the old
// nine-link bar used to expose still needs a home, so it moves into a mega
// menu under Projects — the tracks and the on-ramp on the left, the eleven
// builds themselves on the right.
//
// This is derived on the server and handed to <Nav> as plain data. Nav is a
// client component, and importing the project modules there would ship every
// step of every project to the browser to render eleven link labels.
//
// Every href is written bare here and run through localePath, so the table
// stays readable and the language prefix cannot be forgotten on one row.

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

const NOTES = {
	en: {
		basics: "14 micro-lessons — the syntax, taught in-house",
		projects: "Eleven builds across three tiers, in order",
		capstone: "linkd: a spec, 34 black-box checks, no hints",
		failures: "15 programs broken on purpose, symptom first",
		idioms: "10 refactors a strict linter has to pass",
		concepts: "61 entries on why Go is shaped this way",
		source: "5 annotated reads, checked against your GOROOT",
		allProjects: "All projects",
	},
	ar: {
		basics: "14 درساً مصغّراً — الصياغة، تُدرَّس هنا",
		projects: "أحد عشر مشروعاً عبر ثلاثة مستويات، بالترتيب",
		capstone: "linkd: مواصفات، و34 فحصاً من الخارج، بلا تلميحات",
		failures: "15 برنامجاً مكسوراً عمداً، العَرَض أولاً",
		idioms: "10 عمليات تحسين عليها أن تُرضي مدقّقاً صارماً",
		concepts: "61 مدخلاً في سبب تصميم Go على هذا النحو",
		source: "5 قراءات مشروحة، مقابَلة بنسخة Go على جهازك",
		allProjects: "كل المشاريع",
	},
} as const

const TIERS = [
	{ tier: 1, num: "Tier 01", nameKey: "t1Name" },
	{ tier: 2, num: "Tier 02", nameKey: "t2Name" },
	{ tier: 3, num: "Tier 03", nameKey: "t3Name" },
] as const

export function getNavMenu(lang: Lang): NavMenu {
	const n = NOTES[lang]
	const s = ui(lang)
	const p = (href: string) => localePath(href, lang)

	return {
		path: [
			{ href: p("/basics"), label: s.home.basicsName, note: n.basics },
			{ href: p("/projects"), label: n.allProjects, note: n.projects },
			{
				href: p("/capstone"),
				label: s.search.types.Capstone,
				note: n.capstone,
			},
		],
		tracks: [
			{
				href: p("/failures"),
				label: lang === "ar" ? "مختبرات الأعطال" : "Failure labs",
				note: n.failures,
			},
			{
				href: p("/idioms"),
				label: lang === "ar" ? "تمارين الأسلوب" : "Idiom exercises",
				note: n.idioms,
			},
			{
				href: p("/concepts"),
				label: lang === "ar" ? "مفاهيم Go" : "Go concepts",
				note: n.concepts,
			},
			{
				href: p("/source"),
				label: lang === "ar" ? "قراءات المصدر" : "Source walkthroughs",
				note: n.source,
			},
		],
		tiers: TIERS.map(({ tier, num, nameKey }) => ({
			num,
			name: s.tiers[nameKey],
			projects: getProjectsByTier(tier).map((proj) => ({
				href: p(`/projects/${proj.slug}`),
				label: proj.name,
			})),
		})),
	}
}
