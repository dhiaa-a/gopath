import type { Metadata } from "next"
import "../globals.css"
import Nav from "@/components/Nav"
import { getNavMenu } from "@/lib/nav"
import { buildSearchIndex } from "@/lib/search-index"
import { LANGS, toLang, dirOf, type Lang } from "@/lib/i18n"

// Unknown language segments 404 rather than rendering at request time. Without
// this, /garbage matches [lang] and would be served as a language.
export const dynamicParams = false

export function generateStaticParams() {
	return LANGS.map((lang) => ({ lang }))
}

const meta: Record<Lang, { title: string; description: string; og: string }> = {
	en: {
		title: "GoPath — Learn Go by Building Real Things",
		description:
			"Learn Go in one place: syntax, twelve programs you build and run, fifteen bugs you diagnose yourself, and a final spec graded by a suite that never reads your code. For developers coming from other languages.",
		og: "Syntax to production, in one place. 12 programs, 61 concepts, 15 failure labs, and a graded capstone.",
	},
	ar: {
		title: "GoPath — تعلّم Go ببناء أشياء حقيقية",
		description:
			"تعلّم Go في مكان واحد: الصياغة، واثنا عشر برنامجاً تبنيها وتشغّلها، وخمسة عشر عطلاً تشخّصها بنفسك، ومواصفات ختامية يصحّحها فاحص لا يقرأ شيفرتك. لمن يبرمج بلغة أخرى.",
		og: "من أول سطر إلى الإنتاج، في مكان واحد. 12 برنامجاً، و61 مفهوماً، و15 مختبر أعطال، ومشروع ختامي مقيّم.",
	},
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string }>
}): Promise<Metadata> {
	const lang = toLang((await params).lang)
	const m = meta[lang]
	return {
		title: m.title,
		description: m.description,
		openGraph: { title: m.title, description: m.og, type: "website" },
		// Tells search engines the two versions are the same page in two
		// languages rather than duplicates competing with each other.
		alternates: {
			canonical: `/${lang}`,
			languages: { en: "/en", ar: "/ar" },
		},
	}
}

export default async function RootLayout({
	children,
	params,
}: {
	children: React.ReactNode
	params: Promise<{ lang: string }>
}) {
	const lang = toLang((await params).lang)

	return (
		<html lang={lang} dir={dirOf(lang)} suppressHydrationWarning>
			<head>
				{/* Runs before React hydrates to avoid a light-flash on dark-mode users */}
				<script
					dangerouslySetInnerHTML={{
						__html: `try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.add('dark')}`,
					}}
				/>
				{/* Scroll-entrance starts hidden and is revealed by an observer.
				    These pages are statically generated and perfectly readable
				    without JavaScript, so if the observer never runs the content
				    must not stay invisible. */}
				<noscript
					dangerouslySetInnerHTML={{
						__html: `<style>.m-appear,.m-stagger>*{opacity:1!important;transform:none!important}</style>`,
					}}
				/>
			</head>
			<body>
				{/* Derived here rather than inside Nav: Nav is a client component,
				    and importing the project modules there would ship every step
				    of every project to the browser to label eleven links. */}
				<Nav
					menu={getNavMenu(lang)}
					searchRecords={buildSearchIndex(lang)}
					lang={lang}
				/>
				{children}
			</body>
		</html>
	)
}
