import type { Metadata } from "next"
import "./globals.css"
import Nav from "@/components/Nav"
import { getNavMenu } from "@/lib/nav"

export const metadata: Metadata = {
	title: "GoPath — Learn Go by Building Real Things",
	description:
		"Learn Go in one place: syntax, twelve programs you build and run, fifteen bugs you diagnose yourself, and a final spec graded by a suite that never reads your code. For developers coming from other languages.",
	openGraph: {
		title: "GoPath — Learn Go by Building Real Things",
		description:
			"Syntax to production, in one place. 12 programs, 61 concepts, 15 failure labs, and a graded capstone.",
		type: "website",
	},
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Runs before React hydrates to avoid a light-flash on dark-mode users */}
				<script
					dangerouslySetInnerHTML={{
						__html: `try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.add('dark')}`,
					}}
				/>
			</head>
			<body>
				{/* Derived here rather than inside Nav: Nav is a client component,
				    and importing the project modules there would ship every step
				    of every project to the browser to label eleven links. */}
				<Nav menu={getNavMenu()} />
				{children}
			</body>
		</html>
	)
}
