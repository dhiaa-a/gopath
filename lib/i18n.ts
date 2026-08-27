// Bilingual support: English and Arabic.
//
// Two different completeness rules, on purpose.
//
// **Chrome must be complete.** Every string in the `ui` dictionary below is
// type-enforced: `ar` is declared as `typeof en`, so a missing or misspelled
// key is a compile error, not a page that silently renders English in the
// middle of an Arabic layout. Navigation, buttons, section labels and page
// furniture are small, bounded, and read on every page — there is no excuse
// for a hole in them.
//
// **Content may lag.** `LocalizedString` (lib/content.ts) makes `ar` optional
// and `t()` falls back to English, because the corpus is ~150k words of
// technical prose and translating it is staged work. A half-translated
// concept page is worth shipping; a half-translated nav bar is not.

export const LANGS = ["en", "ar"] as const
export type Lang = (typeof LANGS)[number]

export const DEFAULT_LANG: Lang = "en"

export function isLang(value: string): value is Lang {
	return (LANGS as readonly string[]).includes(value)
}

/** Falls back rather than throwing: a bad `[lang]` segment renders English. */
export function toLang(value: string | undefined): Lang {
	return value && isLang(value) ? value : DEFAULT_LANG
}

export function dirOf(lang: Lang): "ltr" | "rtl" {
	return lang === "ar" ? "rtl" : "ltr"
}

/**
 * Prefix an internal href with the active language.
 *
 * Every route lives under /<lang>/, so a bare "/concepts" written in a content
 * file or a nav table has to be rewritten per language rather than hardcoded.
 *
 * Two things are deliberately left alone. Anything not starting with a single
 * "/" is external or protocol-relative. And a bare "#anchor" is a jump within
 * the current page — prefixing it would turn a scroll into a navigation.
 * "/#path" is NOT that case: it means the home page at an anchor, so it does
 * take the prefix and becomes "/en#path".
 */
export function localePath(href: string, lang: Lang): string {
	if (!href.startsWith("/") || href.startsWith("//")) return href
	if (href === "/") return `/${lang}`
	if (href.startsWith("/#")) return `/${lang}${href.slice(1)}`
	return `/${lang}${href}`
}

/**
 * Rewrite internal hrefs inside an HTML content string.
 *
 * A lot of prose ships as HTML and is injected with dangerouslySetInnerHTML —
 * orientation pages, concept bodies, failure diagnoses — and those strings
 * carry links written bare, as `<a href="/concepts/slices">`. Under /<lang>/
 * routing every one of them would 404. Rewriting at render time keeps the
 * content files free of language plumbing, which matters because they are the
 * files a content author edits.
 *
 * Delegates each href to localePath rather than splicing the prefix in with a
 * pattern, so the edge cases stay in one place: "/" becoming "/en" rather than
 * "//", and "/#path" becoming "/en#path". Hrefs that already carry a language
 * prefix are skipped, which makes this idempotent — applying it twice cannot
 * produce "/en/en/concepts".
 */
export function localizeHtml(html: string, lang: Lang): string {
	return html.replace(/href="(\/[^"]*)"/g, (match, path: string) => {
		if (path.startsWith("//")) return match
		const first = path.split("/")[1]
		if (first && isLang(first)) return match
		return `href="${localePath(path, lang)}"`
	})
}

/**
 * The same path in another language, for the language switcher.
 * "/ar/concepts/slices" -> "/en/concepts/slices".
 */
export function swapLangInPath(pathname: string, next: Lang): string {
	const segments = pathname.split("/").filter(Boolean)
	if (segments.length && isLang(segments[0])) {
		segments[0] = next
		return `/${segments.join("/")}`
	}
	return `/${next}${pathname === "/" ? "" : pathname}`
}

/** Shown in the language switcher, each in its own script. */
export const LANG_LABELS: Record<Lang, { short: string; full: string }> = {
	en: { short: "EN", full: "English" },
	ar: { short: "ع", full: "العربية" },
}

// ─── UI dictionary ──────────────────────────────────────────────────────────
//
// Arabic technical-writing convention, applied throughout: code identifiers,
// Go keywords, package names, commands and API surface stay in Latin script
// (`go run`, `package main`, `sync.WaitGroup`). Only the prose around them is
// translated. A learner has to read English identifiers in their editor and in
// the standard library regardless, so transliterating them here would teach a
// vocabulary that exists nowhere else and make the pages harder to act on, not
// easier. Numerals stay Western (0-9), matching how Arabic technical material
// and every Go tool actually prints them.

const en = {
	nav: {
		orientation: "Orientation",
		path: "Path",
		projects: "Projects",
		concepts: "Concepts",
		search: "Search the site",
		toggleMenu: "Toggle menu",
		startCta: "Start the path",
		continueCta: "Continue",
		thePath: "The path",
		beyondThePath: "Beyond the path",
		byTier: "By tier",
		startHere: "Start here",
		language: "Language",
		switchTo: "العربية",
	},
	search: {
		placeholder: "Search projects, concepts, failure labs…",
		noMatches: "No matches for",
		escape: "Esc",
		types: {
			Project: "Project",
			Concept: "Concept",
			"Failure lab": "Failure lab",
			"Idiom exercise": "Idiom exercise",
			"Source walkthrough": "Source walkthrough",
			"Basics lesson": "Basics lesson",
			Capstone: "Capstone",
		},
	},
	theme: {
		toLight: "Switch to light mode",
		toDark: "Switch to dark mode",
	},
	progress: {
		markLessonComplete: "Mark lesson complete",
		lessonComplete: "Lesson complete",
	},
	common: {
		minutes: "min",
		lesson: "Lesson",
		of: "of",
		step: "Step",
		steps: "Steps",
		clickToReveal: "click to reveal",
		clickToFlipBack: "click to flip back",
		retrievalPractice: "Retrieval practice",
		retrievalIntro: "Think of your answer, then click the card to reveal it.",
		readyCheck: "Ready check",
		tier1FirstProject: "Tier 1 — CLI renamer",
	},
	blocks: {
		concept: "concept",
		pattern: "pattern",
		similarExample: "similar example",
		yourTask: "your task",
		requirement: "requirement",
		why: "why",
		stdlib: "stdlib",
		thirdParty: "third-party",
		apiShape: "api shape",
		constraint: "constraint",
		rationale: "rationale",
		verify: "verify",
		from: "from",
		youShouldSee: "you should see",
		breakIt: "break it",
		change: "change",
		whatHappens: "what happens",
		whyDoesItDoThat: "why does it do that?",
		assessment: "assessment",
		theRealSuite: "the real suite",
		testCases: "test cases",
		expectedOutput: "expected output",
		targetMetrics: "target metrics",
		isThisAchievable: "is this actually achievable?",
		in: "in",
		want: "want",
	},
	lab: {
		label: "lab",
		where: "where",
		run: "run",
		note: "Clone the repo once, then work inside the lab directory. Every lab is a plain Go module: the standard toolchain is all you need.",
	},
	home: {
		badge: "For developers from other languages",
		// Split so the accent colour lands on the second half in both
		// languages. Keeping it one string with markup inside would mean
		// translating markup; keeping it two strings means a translator only
		// has to decide where the emphasis falls in their own grammar.
		h1Lead: "Learn Go here, and",
		h1Accent: "nowhere else.",
		// "package main" renders in mono between these two halves.
		pathTitleLead: "Start at",
		pathTitleTail: ". Finish at a graded spec.",
		heroLead:
			"Syntax to production, in one place. Twelve programs you actually build, fifteen bugs you diagnose yourself, and a final spec graded by a suite that never reads your code.",
		newToGo: "New to Go? Start with Orientation",
		statPrograms: "programs shipped",
		statConcepts: "concepts explained",
		statFailures: "failure labs",
		pathKicker: "The path",
		pathLead:
			"Tier 0 teaches the syntax here instead of linking you out for it. Eleven projects then build on each other in order. The twelfth hands you a specification and no help at all.",
		orientationRow:
			"Six short pages if you've never written Go, about 30 minutes — install, a first look at the syntax, and a readiness check",
		basicsName: "Basics",
		basicsRow: "14 micro-lessons teaching the syntax in-house, about 3 hours",
		capstoneRow:
			"A link shortener: auth, rate limiting, durable storage, metrics — a spec, 34 black-box checks, no hints",
		zeroGuidance: "Zero guidance",
		tracksKicker: "Beyond the path",
		tracksTitle: "The parts you would have gone looking for elsewhere.",
		tracksLead:
			"Debugging, idiom, and reading real source are what separate someone who knows Go from someone who works in it. None of them fit at the end of a chapter, so each one is its own track.",
		whyKicker: "Why GoPath",
		whyTitle: "One resource, because assembling five was the actual problem.",
		whyLead:
			"The usual route is a tour for the syntax, a book for the idiom, a conference talk for the concurrency bugs, and a job for everything after that. Nothing here sends you away to finish a lesson, and every claim on this site is one you can run yourself.",
		footer: "gopath.dev · learn go by building real things",
		// Ordered to match the `tracks` table in the homepage, which holds the
		// href and the count. Only the prose lives here.
		tracks: [
			{
				label: "Failure labs",
				body: "Programs broken on purpose. You get the symptom the way an on-call engineer would report it and work back to the cause. The harness holds every lab to reproducing, so one that stops failing is as red as a test that stops passing.",
			},
			{
				label: "Idiom exercises",
				body: "Working Go with an accent: Java getters, Python exceptions, C index-juggling. Refactor until the tests stay green and a strict linter goes quiet. Idiom you clear, not idiom you read about.",
			},
			{
				label: "Go concepts",
				body: "Not what compiles, but why Go is shaped this way: no exceptions, no inheritance, channels over locks. Each one links to the project that teaches it best rather than to a docs page.",
			},
			{
				label: "Source walkthroughs",
				body: "Annotated reads of errors, bytes.Buffer, sync.WaitGroup, context, and the net/http accept loop. Every excerpt is checked against the copy of Go on your own machine, so nothing here can drift.",
			},
		],
		why: [
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
		],
	},
	tiers: {
		t1Name: "Foundations",
		t1Desc: "Syntax, types, error handling, standard library",
		t2Name: "Systems",
		t2Desc: "Concurrency, networking, programs under load",
		t3Name: "Production",
		t3Desc: "Real architecture, databases, a measured gate",
	},
	// Index-page furniture: the kicker, the headline and the lead paragraph
	// that open each track. Counts are interpolated at the call site so the
	// numbers stay derived from the content rather than written twice.
	index: {
		orientationTitle: "The airlock before Tier 1.",
		orientationLead:
			"Six short pages for newcomers. What Go is, what it isn't, where to learn syntax, and a readiness check before you start building. About {n} minutes total.",
		orientationSkipTitle: "Already comfortable with Go?",
		orientationSkipBody: "Skip orientation and start with",
		basicsKicker: "Basics · Tier 0",
		basicsTitle: "Go syntax, taught by typing it.",
		basicsLead:
			"Fourteen micro-lessons for developers who already program. Each one teaches a syntax cluster through a single small program you type, run, and often deliberately break, then locks it in with retrieval prompts. About {n} hours total, and you leave ready for Tier 1.",
		basicsSkipTitle: "Already read Go without squinting?",
		basicsSkipBody: "Take the",
		basicsSkipBody2: "and skip straight to",
		conceptsTitle: "Every concept, explained clearly.",
		conceptsLead:
			"Hit a wall while building? Find the concept, read the mental model, run the example, get unstuck.",
		failuresTitle: "Scar tissue, on purpose.",
		failuresLead:
			"Each lab is a program that compiles and looks plausible but is broken, plus the symptom the way an on-call engineer would report it. Run it, watch it fail, and work the diagnosis before you read the answer. The page teaches the path: which tool to reach for, what its output means, and only then the fix.",
		idiomsKicker: "Idiom track",
		idiomsTitle: "Accent removal.",
		idiomsLead:
			"Every exercise is working Go with a green test suite, written the way you would write it coming from another language. Your job is to refactor until the tests stay green and a strict linter comes up clean, then compare your calls against a senior reviewer's walkthrough in the exercise's REVIEW.md. You do not read about idiom here; you refactor toward it under mechanical enforcement.",
		projectsKicker: "All projects",
		projectsTitle: "Eleven projects. One path.",
		projectsLead: "Work through them in order. Each one builds on the last.",
		sourceKicker: "Source reading",
		sourceTitle: "Read the code you already depend on.",
		sourceLead:
			"Every working Go programmer eventually reads the standard library, and almost nothing teaches you how. Each walkthrough here takes one real file and reads it the way an experienced Go programmer would: where to enter, what to skip, what to notice, and what the code is defending against. The skill you are practising is not memorising these files. It is being able to open the next one on your own.",
	},
	notFound: {
		title: "Page not found",
		body: "That project or page doesn't exist yet. Check the full list of projects.",
		home: "Home",
		allProjects: "All projects",
	},
	fallback: {
		notice: "This page has not been translated into Arabic yet, so it is shown in English.",
		short: "English",
	},
}

// `typeof en` rather than a hand-written interface: adding an English string
// makes its Arabic counterpart a compile error until it is written.
//
// Deliberately NOT `as const` above. A const assertion would type every entry
// as its own string literal ("Orientation" rather than string), and the Arabic
// dictionary — whose whole job is to hold different values under the same keys
// — would fail to typecheck on every single line. Without it the inferred type
// is still the exact key structure, which is the half that has to be enforced.
type Dict = typeof en

const ar: Dict = {
	nav: {
		orientation: "التمهيد",
		path: "المسار",
		projects: "المشاريع",
		concepts: "المفاهيم",
		search: "ابحث في الموقع",
		toggleMenu: "القائمة",
		startCta: "ابدأ المسار",
		continueCta: "تابع",
		thePath: "المسار",
		beyondThePath: "ما بعد المسار",
		byTier: "حسب المستوى",
		startHere: "ابدأ من هنا",
		language: "اللغة",
		switchTo: "English",
	},
	search: {
		placeholder: "ابحث في المشاريع والمفاهيم ومختبرات الأعطال…",
		noMatches: "لا نتائج لـ",
		escape: "Esc",
		types: {
			Project: "مشروع",
			Concept: "مفهوم",
			"Failure lab": "مختبر أعطال",
			"Idiom exercise": "تمرين أسلوب",
			"Source walkthrough": "قراءة مصدر",
			"Basics lesson": "درس أساسيات",
			Capstone: "المشروع الختامي",
		},
	},
	theme: {
		toLight: "التبديل إلى الوضع الفاتح",
		toDark: "التبديل إلى الوضع الداكن",
	},
	progress: {
		markLessonComplete: "اعتبر الدرس مكتملاً",
		lessonComplete: "اكتمل الدرس",
	},
	common: {
		minutes: "دقيقة",
		lesson: "الدرس",
		of: "من",
		step: "الخطوة",
		steps: "الخطوات",
		clickToReveal: "اضغط للكشف",
		clickToFlipBack: "اضغط للعودة",
		retrievalPractice: "تمرين الاسترجاع",
		retrievalIntro: "استحضر إجابتك أولاً، ثم اضغط البطاقة لكشفها.",
		readyCheck: "اختبار الجاهزية",
		tier1FirstProject: "المستوى الأول — مُعيد تسمية الملفات",
	},
	blocks: {
		concept: "المفهوم",
		pattern: "النمط",
		similarExample: "مثال مشابه",
		yourTask: "مهمتك",
		requirement: "المطلوب",
		why: "لماذا",
		stdlib: "المكتبة القياسية",
		thirdParty: "مكتبة خارجية",
		apiShape: "شكل الواجهة",
		constraint: "القيد",
		rationale: "المبرر",
		verify: "تحقّق",
		from: "من",
		youShouldSee: "ما ينبغي أن تراه",
		breakIt: "اكسرها",
		change: "غيّر",
		whatHappens: "ماذا يحدث",
		whyDoesItDoThat: "لماذا يحدث ذلك؟",
		assessment: "تقييم",
		theRealSuite: "الاختبارات الحقيقية",
		testCases: "حالات الاختبار",
		expectedOutput: "المخرج المتوقع",
		targetMetrics: "المقاييس المستهدفة",
		isThisAchievable: "هل هذا قابل للتحقيق فعلاً؟",
		in: "المدخل",
		want: "المتوقع",
	},
	lab: {
		label: "المختبر",
		where: "الموقع",
		run: "التشغيل",
		note: "استنسخ المستودع مرة واحدة، ثم اعمل داخل مجلد المختبر. كل مختبر وحدة Go عادية: أدوات Go القياسية هي كل ما تحتاجه.",
	},
	home: {
		badge: "لمن يبرمج بلغة أخرى",
		h1Lead: "تعلّم Go هنا،",
		h1Accent: "ولا مكان سواه.",
		pathTitleLead: "ابدأ من",
		pathTitleTail: ". وانتهِ عند مواصفات مُقيَّمة.",
		heroLead:
			"من أول سطر إلى الإنتاج، في مكان واحد. اثنا عشر برنامجاً تبنيها بنفسك، وخمسة عشر عطلاً تشخّصها بيدك، ومواصفات ختامية يصحّحها فاحص لا يقرأ شيفرتك.",
		newToGo: "جديد على Go؟ ابدأ بالتمهيد",
		statPrograms: "برنامجاً تبنيه",
		statConcepts: "مفهوماً مشروحاً",
		statFailures: "مختبر أعطال",
		pathKicker: "المسار",
		pathLead:
			"المستوى صفر يعلّمك الصياغة هنا بدل أن يحيلك إلى موقع آخر. ثم أحد عشر مشروعاً يبني كل منها على ما قبله بالترتيب. والثاني عشر يسلّمك مواصفات ولا يساعدك إطلاقاً.",
		orientationRow:
			"ست صفحات قصيرة إن لم تكتب Go من قبل، نحو ثلاثين دقيقة — التثبيت، ونظرة أولى على الصياغة، واختبار جاهزية",
		basicsName: "الأساسيات",
		basicsRow: "أربعة عشر درساً مصغّراً تعلّم الصياغة هنا، نحو ثلاث ساعات",
		capstoneRow:
			"مختصِر روابط: مصادقة، وتحديد معدّل، وتخزين دائم، ومقاييس — مواصفات و34 فحصاً من الخارج، بلا تلميحات",
		zeroGuidance: "بلا أي إرشاد",
		tracksKicker: "ما بعد المسار",
		tracksTitle: "الأجزاء التي كنت ستبحث عنها في مكان آخر.",
		tracksLead:
			"التشخيص، والأسلوب، وقراءة شيفرة حقيقية: هذا ما يفصل من يعرف Go عمّن يعمل بها. ولا يصلح أيٌّ منها أن يكون خاتمة فصل، فصار لكل واحد مساره الخاص.",
		whyKicker: "لماذا GoPath",
		whyTitle: "مرجع واحد، لأن تجميع خمسة مراجع كان هو المشكلة أصلاً.",
		whyLead:
			"الطريق المعتاد: جولة للصياغة، وكتاب للأسلوب، ومحاضرة لأخطاء التزامن، ووظيفة لكل ما تبقّى. لا شيء هنا يحيلك إلى مكان آخر لتُكمل درساً، وكل ادّعاء في هذا الموقع يمكنك تشغيله بنفسك.",
		footer: "gopath.dev · تعلّم Go ببناء أشياء حقيقية",
		tracks: [
			{
				label: "مختبرات الأعطال",
				body: "برامج مكسورة عمداً. يصلك العَرَض كما يصفه مهندس مناوب، ثم تعود منه إلى السبب. والفاحص يُلزم كل مختبر بأن يظل يُنتج عطله، فالمختبر الذي يتوقف عن الفشل خطأ تماماً كاختبار توقّف عن النجاح.",
			},
			{
				label: "تمارين الأسلوب",
				body: "شيفرة Go سليمة لكن بلكنة: أساليب Java، واستثناءات Python، وعدّادات C اليدوية. أعد صياغتها حتى تبقى الاختبارات خضراء ويصمت مدقّق صارم. أسلوب تجتازه، لا أسلوب تقرأ عنه.",
			},
			{
				label: "مفاهيم Go",
				body: "ليس ما يُصرَّف، بل لماذا صُمّمت Go هكذا: بلا استثناءات، وبلا وراثة، وقنوات بدل الأقفال. كل مفهوم يحيلك إلى المشروع الذي يعلّمه خير تعليم، لا إلى صفحة توثيق.",
			},
			{
				label: "قراءات المصدر",
				body: "قراءات مشروحة في errors، وbytes.Buffer، وsync.WaitGroup، وcontext، وحلقة القبول في net/http. كل مقتطف مُقابَل بنسخة Go على جهازك أنت، فلا شيء هنا يمكن أن ينحرف.",
			},
		],
		why: [
			{
				h: "كل شيء هنا يعمل فعلاً",
				b: "كل مشروع يأتي بمختبر قابل للتشغيل: وحدة Go حقيقية تبنيها وتشغّلها، لا مقتطفاً على صفحة. وسكربت واحد ينسّق ويفحص ويبني ويختبر ويقيس الجميع معاً، فلا يمكن لشيء هنا أن يتعفّن بصمت إلى ادّعاء لم يعد صحيحاً.",
			},
			{
				h: "تتعلّم التشخيص، لا البناء فقط",
				b: "خمسة عشر مختبراً تسلّمك برنامجاً مكسوراً وعَرَضاً بدل الدرس. والعودة من أثر المكدّس إلى السبب تحت الضغط مهارة، وهي المهارة التي لا تدرّبها الدروس أبداً لأن شيفرتها تعمل دائماً.",
			},
			{
				h: "الأسلوب مفروض، لا موصوف",
				b: "مسار الأسلوب يقيّمه مدقّق صارم، فتصير كتابة Go بطريقتها بوابة تجتازها لا نصيحة تومئ لها بالموافقة. وعلى الاختبارات أن تبقى خضراء بينما تعيد الصياغة.",
			},
			{
				h: "ينتهي بالبرهان",
				b: "المشروع الختامي يعطيك مواصفات ولا شيء غيرها: 34 فحصاً من الخارج وأربعة أهداف مقيسة. ولا يقرأ شيفرتك أبداً، فأي تصميم يحقّق المواصفات ينجح، ولا ينجح تصميم يخالفها.",
			},
		],
	},
	tiers: {
		t1Name: "الأسس",
		t1Desc: "الصياغة، والأنواع، ومعالجة الأخطاء، والمكتبة القياسية",
		t2Name: "الأنظمة",
		t2Desc: "التزامن، والشبكات، وبرامج تحت الحِمل",
		t3Name: "الإنتاج",
		t3Desc: "معمارية حقيقية، وقواعد بيانات، وبوابة مقيسة",
	},
	index: {
		orientationTitle: "الغرفة التي تسبق المستوى الأول.",
		orientationLead:
			"ست صفحات قصيرة للمبتدئين. ما هي Go، وما ليست، وأين تتعلّم الصياغة، واختبار جاهزية قبل أن تبدأ البناء. نحو {n} دقيقة إجمالاً.",
		orientationSkipTitle: "تُتقن Go أصلاً؟",
		orientationSkipBody: "تجاوز التمهيد وابدأ بـ",
		basicsKicker: "الأساسيات · المستوى صفر",
		basicsTitle: "صياغة Go، تتعلّمها بكتابتها.",
		basicsLead:
			"أربعة عشر درساً مصغّراً لمن يبرمج أصلاً. كل درس يعلّم مجموعة صياغة عبر برنامج صغير واحد تكتبه وتشغّله وتكسره عمداً في الغالب، ثم يثبّته بأسئلة استرجاع. نحو {n} ساعة إجمالاً، وتخرج منها جاهزاً للمستوى الأول.",
		basicsSkipTitle: "تقرأ Go دون عناء؟",
		basicsSkipBody: "أدِّ",
		basicsSkipBody2: "وانتقل مباشرة إلى",
		conceptsTitle: "كل مفهوم، مشروحاً بوضوح.",
		conceptsLead:
			"اصطدمت بحائط أثناء البناء؟ جد المفهوم، واقرأ نموذجه الذهني، وشغّل المثال، وتابع طريقك.",
		failuresTitle: "ندوب، عن قصد.",
		failuresLead:
			"كل مختبر برنامج يُصرَّف ويبدو سليماً لكنه مكسور، ومعه العَرَض كما يصفه مهندس مناوب. شغّله، وراقبه يفشل، واعمل على التشخيص قبل أن تقرأ الجواب. والصفحة تعلّمك الطريق: أي أداة تمسك، وماذا يعني خرجها، وبعد ذلك فقط الإصلاح.",
		idiomsKicker: "مسار الأسلوب",
		idiomsTitle: "إزالة اللكنة.",
		idiomsLead:
			"كل تمرين شيفرة Go تعمل ومعها اختبارات خضراء، مكتوبة بالطريقة التي ستكتبها بها قادماً من لغة أخرى. مهمتك أن تعيد الصياغة حتى تبقى الاختبارات خضراء ويخرج مدقّق صارم نظيفاً، ثم تقارن قراراتك بمراجعة مهندس خبير في ملف REVIEW.md الخاص بالتمرين. أنت لا تقرأ هنا عن الأسلوب؛ بل تعيد الصياغة نحوه تحت إلزام آليّ.",
		projectsKicker: "كل المشاريع",
		projectsTitle: "أحد عشر مشروعاً. مسار واحد.",
		projectsLead: "اعمل عليها بالترتيب. كل مشروع يبني على سابقه.",
		sourceKicker: "قراءة المصدر",
		sourceTitle: "اقرأ الشيفرة التي تعتمد عليها أصلاً.",
		sourceLead:
			"كل مبرمج Go عامل ينتهي به الأمر إلى قراءة المكتبة القياسية، ولا شيء تقريباً يعلّمك كيف. كل قراءة هنا تأخذ ملفاً حقيقياً واحداً وتقرأه كما يقرأه مبرمج Go متمرّس: من أين تدخل، وما الذي تتخطّاه، وما الذي تنتبه له، ومِمّ تدافع الشيفرة عن نفسها. والمهارة التي تتدرّب عليها ليست حفظ هذه الملفات، بل قدرتك على فتح الملف التالي وحدك.",
	},
	notFound: {
		title: "الصفحة غير موجودة",
		body: "هذا المشروع أو هذه الصفحة غير موجودة بعد. اطّلع على قائمة المشاريع كاملة.",
		home: "الرئيسية",
		allProjects: "كل المشاريع",
	},
	fallback: {
		notice: "لم تُترجَم هذه الصفحة إلى العربية بعد، لذا تظهر بالإنجليزية.",
		short: "بالإنجليزية",
	},
}

const dictionaries: Record<Lang, Dict> = { en, ar }

export function ui(lang: Lang): Dict {
	return dictionaries[lang]
}
