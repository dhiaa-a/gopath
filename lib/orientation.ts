import { ContentBlock, LocalizedString } from "./content"

// Orientation is the first thing a newcomer reads, so it is the first track
// whose headings and prompts are localized rather than only its body prose:
// an Arabic reader arriving here should not meet an English title above an
// Arabic paragraph. The rest of the content model still carries plain strings
// and is translated in later passes.
export type OrientationPage = {
	slug: string
	order: number
	title: LocalizedString
	tagline: LocalizedString
	estimatedMinutes: number
	blocks: ContentBlock[]
	// Only ready-check uses these; left undefined elsewhere.
	// "question || answer", the form the flip cards already parse.
	retrievalPrompts?: LocalizedString[]
	cta?: { href: string; label: LocalizedString }
}

// Inline-link styling for concept and external links inside text blocks.
// Kept identical across all orientation pages so links read consistently.
const LINK = "text-go-cyan underline decoration-go-cyan/40 hover:no-underline"

export const orientationPages: OrientationPage[] = [
	{
		slug: "what-is-go",
		order: 1,
		title: { en: "Is Go right for you right now?", ar: "هل Go مناسبة لك الآن؟" },
		tagline: {
			en: "What Go is built for, what it isn't, and how to know if it's the right tool for the work you actually do.",
			ar: "لماذا بُنيت Go، وما ليست له، وكيف تعرف إن كانت الأداة الصحيحة للعمل الذي تقوم به فعلاً.",
		},
		estimatedMinutes: 4,
		blocks: [
			{
				type: "text",
				value: {
					en: "Go is a small, statically-typed language built by Google in 2009. It was designed for a specific kind of work, and that's the most important thing to know before you commit to learning it.",
					ar: "Go لغة صغيرة ذات أنواع ثابتة، بنتها Google عام 2009. صُمّمت لنوع محدّد من العمل، وهذا أهم ما ينبغي أن تعرفه قبل أن تلتزم بتعلّمها.",
				},
			},
			{
				type: "text",
				value: {
					en: "Go's sweet spot is <strong>code that runs on a server</strong>. The language was built by engineers who needed reliable backend services, and that bias shows up on every page of the language spec.",
					ar: "موطن قوة Go هو <strong>الشيفرة التي تعمل على خادم</strong>. بناها مهندسون كانوا بحاجة إلى خدمات خلفية موثوقة، وهذا الميل ظاهر في كل صفحة من مواصفات اللغة.",
				},
			},
			{
				type: "text",
				value: { en: "<strong>Where Go shines:</strong>", ar: "<strong>أين تتألّق Go:</strong>" },
			},
			{
				type: "list",
				items: [
					{
						en: "Backend services: HTTP APIs, gRPC, microservices. The standard library alone gets you a production-grade web server.",
						ar: "الخدمات الخلفية: واجهات HTTP، وgRPC، والخدمات المصغّرة. المكتبة القياسية وحدها تعطيك خادم ويب صالحاً للإنتاج.",
					},
					{
						en: "CLIs and developer tools: Docker, Kubernetes, Terraform, Hugo, and most of the modern cloud-native ecosystem are written in Go.",
						ar: "أدوات سطر الأوامر وأدوات المطورين: Docker وKubernetes وTerraform وHugo ومعظم منظومة السحابة الحديثة مكتوبة بـ Go.",
					},
					{
						en: "Concurrent systems: goroutines and channels make concurrency feel native, not bolted on.",
						ar: "الأنظمة المتزامنة: goroutines والقنوات تجعل التزامن يبدو أصيلاً في اللغة لا مُلحقاً بها.",
					},
					{
						en: "Deployment simplicity: Go compiles to a single static binary. No runtime, no interpreter, no dependency hell.",
						ar: "بساطة النشر: Go تُصرَّف إلى ملف تنفيذي واحد ساكن. بلا بيئة تشغيل، وبلا مفسّر، وبلا جحيم اعتماديات.",
					},
					{
						en: "Stable, long-lived codebases: the language barely changes. Code written in 2015 still compiles cleanly today.",
						ar: "شيفرة مستقرة طويلة العمر: اللغة تكاد لا تتغيّر. شيفرة كُتبت عام 2015 ما زالت تُصرَّف نظيفة اليوم.",
					},
				],
			},
			{
				type: "text",
				value: { en: "<strong>Where Go is the wrong tool:</strong>", ar: "<strong>أين تكون Go الأداة الخطأ:</strong>" },
			},
			{
				type: "list",
				items: [
					{
						en: "Mobile UI: there's no native UI toolkit. Use Swift, Kotlin, React Native, or Flutter.",
						ar: "واجهات الهاتف: لا توجد أدوات واجهة أصيلة. استخدم Swift أو Kotlin أو React Native أو Flutter.",
					},
					{
						en: "Data science and ML: the ecosystem is thin. Python's libraries dominate for a reason.",
						ar: "علم البيانات وتعلّم الآلة: المنظومة ضعيفة. مكتبات Python تهيمن هنا لسبب وجيه.",
					},
					{
						en: "Game engines and graphics-heavy desktop apps: Go's runtime and GC aren't optimized for frame-rate-sensitive work.",
						ar: "محرّكات الألعاب وتطبيقات سطح المكتب كثيفة الرسوميات: بيئة تشغيل Go وجامع القمامة فيها غير مهيّأين للعمل الحسّاس لمعدّل الإطارات.",
					},
					{
						en: "Tiny one-off scripts: Bash, Python, or Node are faster to write for throwaway glue code.",
						ar: "السكربتات الصغيرة العابرة: Bash أو Python أو Node أسرع في الكتابة لشيفرة لاصقة تُرمى بعد استخدامها.",
					},
					{
						en: "Frontend web: that's JavaScript and TypeScript's turf.",
						ar: "واجهات الويب الأمامية: هذا ملعب JavaScript وTypeScript.",
					},
				],
			},
			{
				type: "callout",
				variant: "info",
				value: {
					en: "If you're here for backend services, CLIs, or systems work... keep going. If your day job is mobile, ML, or frontend, you might find another language fits the work better.",
					ar: "إن كنت هنا من أجل الخدمات الخلفية أو أدوات سطر الأوامر أو عمل الأنظمة... فتابع. أما إن كان عملك اليومي في الهاتف أو تعلّم الآلة أو الواجهات الأمامية، فقد تجد لغة أخرى أنسب لعملك.",
				},
			},
		],
	},
	{
		slug: "reading-go",
		order: 2,
		title: { en: "What Go code looks like", ar: "كيف تبدو شيفرة Go" },
		tagline: {
			en: "A short annotated program (not a syntax tutorial). What to notice before you start writing it.",
			ar: "برنامج قصير مشروح (لا درس صياغة). ما ينبغي أن تنتبه له قبل أن تبدأ الكتابة.",
		},
		estimatedMinutes: 6,
		blocks: [
			{
				type: "text",
				value: {
					en: "Here is a tiny HTTP server written in Go. Read it once. Don't worry about syntax you don't recognize yet, that comes later. Focus on the shape.",
					ar: "إليك خادم HTTP صغيراً مكتوباً بـ Go. اقرأه مرة واحدة. لا تشغل بالك بصياغة لم تتعرّف عليها بعد، فذلك يأتي لاحقاً. ركّز على الشكل العام.",
				},
			},
			{
				type: "code",
				filename: "main.go",
				value: `package main

import (
	"fmt"
	"log"
	"net/http"
)

type server struct {
	greeting string
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "stranger"
	}
	fmt.Fprintf(w, "%s, %s!\\n", s.greeting, name)
}

func main() {
	s := &server{greeting: "Hello"}
	mux := http.NewServeMux()
	mux.Handle("/", s)
	log.Println("listening on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}`,
			},
			{
				type: "text",
				value: {
					en: "Now look at what's worth noticing, and no... not the mechanics but the choices the program makes.",
					ar: "انظر الآن إلى ما يستحق الانتباه، لا إلى الآليات بل إلى الخيارات التي يتّخذها البرنامج.",
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>It's small.</strong> Twenty-five lines run a real HTTP server. No framework, no setup, no boilerplate. The whole web stack is in the standard library, <a href="/concepts/http-handler" class="${LINK}">net/http</a> ships with every Go install!`,
					ar: `<strong>إنه صغير.</strong> خمسة وعشرون سطراً تُشغّل خادم HTTP حقيقياً. بلا إطار عمل، وبلا تهيئة، وبلا حشو. حزمة الويب كاملة في المكتبة القياسية، و<a href="/concepts/http-handler" class="${LINK}">net/http</a> تأتي مع كل تثبيت لـ Go!`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>The server is a struct with a method.</strong> No class, no inheritance... just a <a href="/concepts/structs" class="${LINK}">struct</a> holding data and a method attached to it. That's how Go models "objects."`,
					ar: `<strong>الخادم بنية (struct) لها تابع.</strong> بلا صنف، وبلا وراثة... مجرد <a href="/concepts/structs" class="${LINK}">بنية</a> تحمل بيانات وتابع مرتبط بها. هكذا تمثّل Go "الكائنات".`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>Nobody declares that <code>server</code> implements <code>http.Handler</code>.</strong> Because the type happens to have a <code>ServeHTTP</code> method with the right signature, Go considers the contract satisfied. This is <a href="/concepts/interfaces" class="${LINK}">interface satisfaction by implication</a>, this is one of Go's defining choices.`,
					ar: `<strong>لا أحد يصرّح بأن <code>server</code> يحقّق <code>http.Handler</code>.</strong> لأن النوع صادف أن له تابع <code>ServeHTTP</code> بالبصمة الصحيحة، تعتبر Go العقد محقّقاً. هذا <a href="/concepts/interfaces" class="${LINK}">تحقيق الواجهات بالضمن</a>، وهو أحد خيارات Go المميّزة.`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>Errors travel as return values.</strong> Look at <code>if err := http.ListenAndServe(...)</code>. There's no try/catch in the language. Every fallible function returns an <code>error</code> alongside its result, and the caller decides what to do. That's <a href="/concepts/error-handling" class="${LINK}">error handling as values</a>, and you'll see this pattern on nearly every page.`,
					ar: `<strong>الأخطاء تنتقل كقيم مُعادة.</strong> انظر إلى <code>if err := http.ListenAndServe(...)</code>. لا يوجد try/catch في اللغة. كل دالة قابلة للفشل تُعيد <code>error</code> إلى جانب نتيجتها، والمستدعي هو من يقرّر ما يفعل. هذا <a href="/concepts/error-handling" class="${LINK}">معالجة الأخطاء كقيم</a>، وسترى هذا النمط في كل صفحة تقريباً.`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>The imports are explicit.</strong> Three lines, three packages and Go won't compile if you import something you don't use. The compiler's strictness here pushes you toward small, intentional dependencies. See <a href="/concepts/packages" class="${LINK}">packages</a>.`,
					ar: `<strong>الاستيرادات صريحة.</strong> ثلاثة أسطر، وثلاث حزم، وGo لن تُصرِّف إن استوردت شيئاً لا تستعمله. صرامة المصرّف هنا تدفعك نحو اعتماديات قليلة ومقصودة. انظر <a href="/concepts/packages" class="${LINK}">الحزم</a>.`,
				},
			},
			{
				type: "text",
				value: {
					en: "Don't try to read this as code yet, you'll fight the syntax and miss the structure. Read it as architecture. After the syntax pages, the syntax becomes invisible, and these design choices are what you'll see.",
					ar: "لا تحاول قراءة هذا كشيفرة بعد، فستصارع الصياغة وتفوتك البنية. اقرأه كمعمار. وبعد صفحات الصياغة تصير الصياغة غير مرئية، وتبقى هذه الخيارات التصميمية هي ما تراه.",
				},
			},
		],
	},
	{
		slug: "surprises",
		order: 3,
		title: { en: "Five things that will surprise you", ar: "خمسة أمور ستفاجئك" },
		tagline: {
			en: "Design decisions that will trip you up if you're coming from another language.",
			ar: "قرارات تصميمية ستعثّرك إن كنت قادماً من لغة أخرى.",
		},
		estimatedMinutes: 7,
		blocks: [
			{
				type: "text",
				value: {
					en: "Five design decisions that catch most newcomers off guard. None are accidents. Go's authors chose each one deliberately, often in reaction to languages they had worked in before.",
					ar: "خمسة قرارات تصميمية تباغت معظم القادمين الجدد. وليس فيها شيء عرضي. اختار مؤلفو Go كل واحد منها عن عمد، وغالباً ردّاً على لغات عملوا بها من قبل.",
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>1. No exceptions. Errors are values.</strong> Go has no <code>try</code>/<code>catch</code>/<code>throw</code>. Functions that can fail return an <code>error</code> alongside their result, and the caller checks it explicitly. This makes every failure path visible in the function signature, and yes, you will write <code>if err != nil</code> a lot. That verbosity is the point.<br/><em class="text-faint">If this is new, see: <a href="/concepts/error-handling" class="${LINK}">error handling</a>.</em>`,
					ar: `<strong>1. لا استثناءات. الأخطاء قيم.</strong> ليس في Go <code>try</code> أو <code>catch</code> أو <code>throw</code>. الدوال التي قد تفشل تُعيد <code>error</code> إلى جانب نتيجتها، والمستدعي يفحصه صراحة. هذا يجعل كل مسار فشل ظاهراً في بصمة الدالة، ونعم، ستكتب <code>if err != nil</code> كثيراً. وهذا الإسهاب هو المقصود.<br/><em class="text-faint">إن كان هذا جديداً عليك، انظر: <a href="/concepts/error-handling" class="${LINK}">معالجة الأخطاء</a>.</em>`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>2. No classes. No inheritance.</strong> Go has structs (data) and methods (behavior attached to a type), but nothing called a class. There's no <code>extends</code>. Shared behavior comes from embedding one type inside another, or from satisfying an interface. If you're coming from Java, C#, or Python, your first instinct will be to look for class hierarchies. There aren't any, and once that clicks the code gets simpler.<br/><em class="text-faint">If this is new, see: <a href="/concepts/structs" class="${LINK}">structs</a> and <a href="/concepts/interfaces" class="${LINK}">interfaces</a>.</em>`,
					ar: `<strong>2. لا أصناف. لا وراثة.</strong> في Go بنى (بيانات) وتوابع (سلوك مرتبط بنوع)، لكن لا شيء اسمه صنف. ولا يوجد <code>extends</code>. السلوك المشترك يأتي من تضمين نوع داخل آخر، أو من تحقيق واجهة. إن كنت قادماً من Java أو C# أو Python فأول ما ستبحث عنه هو تسلسل الأصناف. لا وجود له، وحين تستوعب ذلك تصير الشيفرة أبسط.<br/><em class="text-faint">إن كان هذا جديداً عليك، انظر: <a href="/concepts/structs" class="${LINK}">البنى</a> و<a href="/concepts/interfaces" class="${LINK}">الواجهات</a>.</em>`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>3. Capitalization controls visibility.</strong> If an identifier starts with an uppercase letter, it's exported (visible to other packages). Lowercase, it's private to its package. No <code>public</code>, <code>private</code>, or <code>export</code> keywords: just the first letter of the name. Renaming a field from <code>name</code> to <code>Name</code> changes its visibility across the whole codebase.<br/><em class="text-faint">If this is new, see: <a href="/concepts/packages" class="${LINK}">packages</a>.</em>`,
					ar: `<strong>3. حالة الحرف الأول تتحكّم بالظهور.</strong> إن بدأ المعرّف بحرف كبير فهو مُصدَّر (مرئي للحزم الأخرى). وإن بدأ بحرف صغير فهو خاص بحزمته. بلا كلمات <code>public</code> أو <code>private</code> أو <code>export</code>: الحرف الأول من الاسم وحده. وتغيير حقل من <code>name</code> إلى <code>Name</code> يغيّر ظهوره في الشيفرة كلها.<br/><em class="text-faint">إن كان هذا جديداً عليك، انظر: <a href="/concepts/packages" class="${LINK}">الحزم</a>.</em>`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>4. Every type has a zero value, and it's usable.</strong> An <code>int</code> starts at 0. A string starts at the empty string. A struct starts with every field at its own zero value. You rarely need constructors; declaring a variable gives you something safe to use immediately. This eliminates a whole category of "uninitialized state" bugs.<br/><em class="text-faint">If this is new, see: <a href="/concepts/structs" class="${LINK}">structs</a>.</em>`,
					ar: `<strong>4. لكل نوع قيمة صفرية، وهي صالحة للاستعمال.</strong> <code>int</code> يبدأ من 0. والنص يبدأ فارغاً. والبنية تبدأ بكل حقل عند قيمته الصفرية. نادراً ما تحتاج بانيات؛ فمجرد تصريح متغيّر يعطيك شيئاً آمناً تستعمله فوراً. وهذا يلغي صنفاً كاملاً من أخطاء "الحالة غير المهيّأة".<br/><em class="text-faint">إن كان هذا جديداً عليك، انظر: <a href="/concepts/structs" class="${LINK}">البنى</a>.</em>`,
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>5. <code>gofmt</code> ends formatting debates.</strong> Go ships with an official formatter, and the community uses it without exception. Tabs vs spaces, brace placement, line length: all decided. Every Go codebase you read is formatted the same way, because the tool runs on save and nobody bikesheds about it.<br/><em class="text-faint">If this is new, you'll see <code>gofmt</code> in the setup page. Just trust it and don't fight it.</em>`,
					ar: `<strong>5. <code>gofmt</code> ينهي جدال التنسيق.</strong> تأتي Go بمنسّق رسمي، والمجتمع يستعمله بلا استثناء. المسافات أم الجدولة، وموضع الأقواس، وطول السطر: كلها محسومة. وكل شيفرة Go تقرأها منسّقة بالطريقة نفسها، لأن الأداة تعمل عند الحفظ ولا أحد يجادل فيها.<br/><em class="text-faint">إن كان هذا جديداً عليك، فسترى <code>gofmt</code> في صفحة التثبيت. ثق بها ولا تصارعها.</em>`,
				},
			},
			{
				type: "text",
				value: {
					en: "If any of these feel wrong to you right now, good. Sit with that discomfort. Go's design is opinionated on purpose, and the parts that feel uncomfortable at first are usually the parts you'll appreciate most later.",
					ar: "إن بدا لك أيٌّ من هذه خطأً الآن، فهذا جيّد. اجلس مع هذا الانزعاج. تصميم Go متحيّز عن قصد، والأجزاء التي تبدو مزعجة أول الأمر هي عادةً ما ستقدّره أكثر لاحقاً.",
				},
			},
		],
	},
	{
		slug: "setup",
		order: 4,
		title: { en: "Install Go and run your first program", ar: "ثبّت Go وشغّل أول برنامج لك" },
		tagline: {
			en: "Get Go installed, write a 5-line program, run it. No project structure, no frameworks.",
			ar: "ثبّت Go، واكتب برنامجاً من خمسة أسطر، وشغّله. بلا بنية مشروع، وبلا أطر عمل.",
		},
		estimatedMinutes: 8,
		blocks: [
			{
				type: "text",
				value: {
					en: "This page takes you from zero to a running Go program. Three commands and a five-line file.",
					ar: "تأخذك هذه الصفحة من الصفر إلى برنامج Go يعمل. ثلاثة أوامر وملف من خمسة أسطر.",
				},
			},
			{
				type: "text",
				value: {
					en: `<strong>1. Install Go.</strong> Download the installer for your OS from <a href="https://go.dev/dl" target="_blank" rel="noopener" class="${LINK}">go.dev/dl</a>. The site walks you through it. The steps differ enough between Windows, macOS, and Linux that linking is more honest than reproducing them here.`,
					ar: `<strong>1. ثبّت Go.</strong> نزّل المثبّت الخاص بنظامك من <a href="https://go.dev/dl" target="_blank" rel="noopener" class="${LINK}">go.dev/dl</a>. الموقع يرشدك خطوة بخطوة. والخطوات تختلف بين Windows وmacOS وLinux بما يكفي لأن تكون الإحالة أصدق من إعادة كتابتها هنا.`,
				},
			},
			{
				type: "text",
				value: {
					en: "<strong>2. Verify the install.</strong> Open a terminal and run:",
					ar: "<strong>2. تحقّق من التثبيت.</strong> افتح طرفية وشغّل:",
				},
			},
			{
				type: "code",
				value: "go version",
			},
			{
				type: "text",
				value: {
					en: "You should see output like <code>go version go1.22.0 darwin/arm64</code>. The exact version doesn't matter; anything 1.20 or newer works for this site.",
					ar: "ينبغي أن ترى خرجاً مثل <code>go version go1.22.0 darwin/arm64</code>. النسخة بالضبط لا تهم؛ فأي إصدار 1.20 أو أحدث يكفي لهذا الموقع.",
				},
			},
			{
				type: "callout",
				variant: "warning",
				value: {
					en: "If go isn't found, your PATH isn't set. See go.dev/doc/install for the steps specific to your OS.",
					ar: "إن لم يُعثر على go فمتغيّر PATH غير مضبوط. انظر go.dev/doc/install للخطوات الخاصة بنظامك.",
				},
			},
			{
				type: "text",
				value: {
					en: "<strong>3. Create a module.</strong> Make a directory and initialize it:",
					ar: "<strong>3. أنشئ وحدة.</strong> أنشئ مجلداً وهيّئه:",
				},
			},
			{
				type: "code",
				value: `mkdir hello && cd hello
go mod init example/hello`,
			},
			{
				type: "text",
				value: {
					en: "This creates a <code>go.mod</code> file, Go's package manifest. The path <code>example/hello</code> is just a name; for real projects you'd use something like <code>github.com/you/project</code>.",
					ar: "هذا يُنشئ ملف <code>go.mod</code>، وهو بيان الحزم في Go. والمسار <code>example/hello</code> مجرد اسم؛ أما في المشاريع الحقيقية فتستعمل شيئاً مثل <code>github.com/you/project</code>.",
				},
			},
			{
				type: "text",
				value: {
					en: "<strong>4. Write the program.</strong> Save the following as <code>main.go</code> in the same directory:",
					ar: "<strong>4. اكتب البرنامج.</strong> احفظ ما يلي باسم <code>main.go</code> في المجلد نفسه:",
				},
			},
			{
				type: "code",
				filename: "main.go",
				value: `package main

import "fmt"

func main() {
	fmt.Println("hello from Go")
}`,
			},
			{
				type: "text",
				value: { en: "<strong>5. Run it.</strong>", ar: "<strong>5. شغّله.</strong>" },
			},
			{
				type: "code",
				value: "go run .",
			},
			{
				type: "text",
				value: {
					en: "You should see <code>hello from Go</code>. That's the full loop: write code, run it, see output. Same loop you'll use for every project on this site.",
					ar: "ينبغي أن ترى <code>hello from Go</code>. هذه هي الدورة كاملة: تكتب شيفرة، وتشغّلها، وترى الخرج. وهي الدورة نفسها التي ستستعملها في كل مشروع على هذا الموقع.",
				},
			},
		],
	},
	{
		slug: "learn-syntax",
		order: 5,
		title: { en: "Learn Go syntax here", ar: "تعلّم صياغة Go هنا" },
		tagline: {
			en: "The Basics track teaches every syntax pattern Tier 1 assumes, in about three hours of typing.",
			ar: "مسار الأساسيات يعلّمك كل نمط صياغة يفترضه المستوى الأول، في نحو ثلاث ساعات من الكتابة.",
		},
		estimatedMinutes: 3,
		blocks: [
			{
				type: "text",
				value: {
					en: `Syntax is taught on this site. The <a href="/basics" class="${LINK}">Basics track</a> is fourteen micro-lessons, each under twenty minutes: one syntax cluster, taught through a single small program you type, run, and often deliberately break, then locked in with retrieval prompts. It's written for developers who already program in Python, JavaScript, Java, or C#, so it spends its time on what Go does differently, not on what a variable is.`,
					ar: `الصياغة تُدرَّس في هذا الموقع. <a href="/basics" class="${LINK}">مسار الأساسيات</a> أربعة عشر درساً مصغّراً، كل منها دون عشرين دقيقة: مجموعة صياغة واحدة، تُدرَّس عبر برنامج صغير واحد تكتبه وتشغّله وتكسره عمداً في الغالب، ثم تُثبَّت بأسئلة استرجاع. وهو مكتوب لمن يبرمج أصلاً بـ Python أو JavaScript أو Java أو C#، فيصرف وقته على ما تفعله Go بشكل مختلف، لا على تعريف المتغيّر.`,
				},
			},
			{
				type: "text",
				value: {
					en: "The track runs from your first compiled binary through variables and zero values, types, functions, control flow, pointers, structs, methods, slices, maps, strings, closures, error handling, and packages with Go's capital-letter visibility rule. That's every syntax pattern the Tier 1 projects assume. The one deliberate omission is interfaces: Tier 1 introduces them in context, with the concept page, at the moment a project first needs one.",
					ar: "يمتد المسار من أول ملف تنفيذي تُصرِّفه، مروراً بالمتغيّرات والقيم الصفرية، والأنواع، والدوال، وبنى التحكّم، والمؤشّرات، والبنى، والتوابع، والشرائح، والخرائط، والنصوص، والمغلِفات، ومعالجة الأخطاء، والحزم مع قاعدة الظهور بالحرف الكبير في Go. وهذه كل أنماط الصياغة التي تفترضها مشاريع المستوى الأول. والاستثناء الوحيد المقصود هو الواجهات: يقدّمها المستوى الأول في سياقها، مع صفحة المفهوم، في اللحظة التي يحتاجها فيها مشروع لأول مرة.",
				},
			},
			{
				type: "text",
				value: {
					en: "<strong>Before starting Tier 1, you should be able to:</strong>",
					ar: "<strong>قبل أن تبدأ المستوى الأول، ينبغي أن تكون قادراً على:</strong>",
				},
			},
			{
				type: "list",
				items: [
					{
						en: "Declare variables, write functions, and write a for loop without looking anything up.",
						ar: "تصريح المتغيّرات، وكتابة الدوال، وكتابة حلقة for دون أن تبحث عن شيء.",
					},
					{ en: "Define a struct and add a method to it.", ar: "تعريف بنية وإضافة تابع إليها." },
					{
						en: "Read code that returns (value, error) and handle the error correctly.",
						ar: "قراءة شيفرة تُعيد (قيمة، خطأ) ومعالجة الخطأ معالجة صحيحة.",
					},
					{
						en: "Explain what <code>&x</code> and <code>*p</code> do, and when a function needs a pointer parameter.",
						ar: "شرح ما يفعله <code>&x</code> و<code>*p</code>، ومتى تحتاج الدالة إلى معامل مؤشّر.",
					},
					{
						en: "Initialize a slice and a map, and iterate over them with range.",
						ar: "تهيئة شريحة وخريطة، والمرور عليهما بـ range.",
					},
				],
			},
			{
				type: "callout",
				variant: "info",
				value: {
					en: `If you can't do all five from memory, work through the <a href="/basics" class="${LINK}">Basics track</a> first, then take the ready check on the next page. The projects assume you can read Go before you start writing it.`,
					ar: `إن لم تستطع أداء الخمسة من الذاكرة، فاعمل على <a href="/basics" class="${LINK}">مسار الأساسيات</a> أولاً، ثم أدِّ اختبار الجاهزية في الصفحة التالية. المشاريع تفترض أنك تقرأ Go قبل أن تبدأ كتابتها.`,
				},
			},
			{
				type: "text",
				value: {
					en: `<em>Other angles, if you want a second voice:</em> <a href="https://go.dev/tour" target="_blank" rel="noopener" class="${LINK}">Tour of Go</a> (official, interactive) and <a href="https://gobyexample.com" target="_blank" rel="noopener" class="${LINK}">Go by Example</a> (flat reference). Neither is required; everything Tier 1 needs is in Basics.`,
					ar: `<em>زوايا أخرى، إن أردت صوتاً ثانياً:</em> <a href="https://go.dev/tour" target="_blank" rel="noopener" class="${LINK}">جولة Go</a> (رسمية وتفاعلية) و<a href="https://gobyexample.com" target="_blank" rel="noopener" class="${LINK}">Go by Example</a> (مرجع مسطّح). وليس أيٌّ منهما مطلوباً؛ فكل ما يحتاجه المستوى الأول موجود في الأساسيات.`,
				},
			},
		],
	},
	{
		slug: "ready-check",
		order: 6,
		title: { en: "Are you ready for Tier 1?", ar: "هل أنت جاهز للمستوى الأول؟" },
		tagline: {
			en: "Five retrieval prompts. If you can answer all of them without looking, you're ready.",
			ar: "خمسة أسئلة استرجاع. إن أجبت عنها كلها دون أن تنظر، فأنت جاهز.",
		},
		estimatedMinutes: 5,
		blocks: [
			{
				type: "text",
				value: {
					en: "Five questions. Answer each one in your head (out loud is better) before flipping the card. If you can answer all five without looking anything up, you're ready for Tier 1.",
					ar: "خمسة أسئلة. أجب عن كل واحد في ذهنك (والجهر بالإجابة أفضل) قبل أن تقلب البطاقة. إن أجبت عن الخمسة دون أن تبحث عن شيء، فأنت جاهز للمستوى الأول.",
				},
			},
			{
				type: "text",
				value: {
					en: `If you stall on more than one, go back to the <a href="/basics" class="${LINK}">Basics track</a> and redo the lessons you stalled on; each is under twenty minutes. The projects assume this baseline.`,
					ar: `إن تعثّرت في أكثر من واحد، فعد إلى <a href="/basics" class="${LINK}">مسار الأساسيات</a> وأعِد الدروس التي تعثّرت فيها؛ كل درس دون عشرين دقيقة. المشاريع تفترض هذا الأساس.`,
				},
			},
		],
		retrievalPrompts: [
			{
				en: "Without looking: what does `:=` do, and how is it different from `var x = ...`? || `:=` is short variable declaration: it declares a new variable and infers its type from the right-hand side. `var x = ...` does the same inference but is a full declaration usable at package scope (`:=` only works inside functions). In practice you'll use `:=` for nearly every local variable.",
				ar: "دون أن تنظر: ماذا يفعل `:=`، وكيف يختلف عن `var x = ...`؟ || `:=` تصريح متغيّر مختصر: يصرّح متغيّراً جديداً ويستنتج نوعه من الطرف الأيمن. و`var x = ...` يستنتج النوع كذلك لكنه تصريح كامل صالح على مستوى الحزمة (`:=` يعمل داخل الدوال فقط). وعملياً ستستعمل `:=` لكل متغيّر محلي تقريباً.",
			},
			{
				en: "If a function returns `(string, error)`, what's the idiomatic way to call it? || `s, err := fn()` immediately followed by `if err != nil { return ... }` (or some other handling). Always check the error before using the value; the value is only meaningful when err is nil. Ignoring the error with `_` is a code smell unless you're certain the error can't happen.",
				ar: "إن كانت دالة تُعيد `(string, error)`، فما الطريقة الاصطلاحية لاستدعائها؟ || `s, err := fn()` يليها مباشرة `if err != nil { return ... }` (أو معالجة أخرى). افحص الخطأ دائماً قبل استعمال القيمة؛ فالقيمة لا معنى لها إلا حين يكون err يساوي nil. وتجاهل الخطأ بـ `_` رائحة شيفرة سيئة إلا إن كنت واثقاً أن الخطأ لا يمكن أن يقع.",
			},
			{
				en: "Write the syntax for a method on a struct type Counter that increments a field. Why does the receiver type matter? || `func (c *Counter) Inc() { c.count++ }`. The `*Counter` pointer receiver matters because a value receiver would receive a copy: the increment would mutate the copy, and the caller's Counter would be unchanged. For any method that mutates state, use a pointer receiver.",
				ar: "اكتب صياغة تابع على البنية Counter يزيد حقلاً. ولماذا يهم نوع المستقبِل؟ || `func (c *Counter) Inc() { c.count++ }`. المستقبِل المؤشّر `*Counter` يهم لأن المستقبِل بالقيمة يتلقّى نسخة: فتُعدَّل النسخة ويبقى Counter عند المستدعي دون تغيير. ولأي تابع يعدّل الحالة، استعمل مستقبِلاً مؤشّراً.",
			},
			{
				en: "A function needs to double its caller's int variable. Why doesn't `func double(n int) { n = n * 2 }` work, and what's the fix? || Go copies every argument, so the function doubles its own copy and the caller sees nothing. Fix: take a pointer, `func double(n *int) { *n = *n * 2 }`, and call it as `double(&x)`. The `&` hands over x's address; the `*` writes through it.",
				ar: "دالة تحتاج إلى مضاعفة متغيّر int عند مستدعيها. لماذا لا ينجح `func double(n int) { n = n * 2 }`، وما الإصلاح؟ || Go تنسخ كل وسيط، فتضاعف الدالة نسختها الخاصة ولا يرى المستدعي شيئاً. الإصلاح: خذ مؤشّراً، `func double(n *int) { *n = *n * 2 }`، واستدعها هكذا `double(&x)`. فـ `&` تسلّم عنوان x، و`*` تكتب عبره.",
			},
			{
				en: 'Initialize a slice of strings and a map from string to int, then write a for loop that iterates over the map. What goes wrong with `var m map[string]int` followed by `m["a"] = 1`? || Slice: `s := []string{"a", "b"}`. Map: `m := map[string]int{"a": 1}`. Iterate: `for k, v := range m { ... }` (order is randomized; never rely on it). The var form panics on write: a map\'s zero value is nil, readable but not writable. Initialize with a literal or make() first.',
				ar: "هيّئ شريحة نصوص وخريطة من string إلى int، ثم اكتب حلقة for تمر على الخريطة. وما الخطأ في `var m map[string]int` متبوعاً بـ `m[\"a\"] = 1`؟ || الشريحة: `s := []string{\"a\", \"b\"}`. الخريطة: `m := map[string]int{\"a\": 1}`. المرور: `for k, v := range m { ... }` (الترتيب عشوائي؛ لا تعتمد عليه أبداً). أما صيغة var فتُحدث ذعراً عند الكتابة: القيمة الصفرية للخريطة هي nil، تُقرأ ولا يُكتب فيها. هيّئها بقيمة حرفية أو بـ make() أولاً.",
			},
		],
		cta: {
			href: "/projects/cli-renamer",
			label: {
				en: "I'm ready: start Tier 1 →",
				ar: "أنا جاهز: ابدأ المستوى الأول →",
			},
		},
	},
]

export function getOrientationPage(slug: string): OrientationPage | undefined {
	return orientationPages.find((p) => p.slug === slug)
}
