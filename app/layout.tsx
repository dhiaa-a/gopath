import type { Metadata } from "next"
import "./globals.css"
import Nav from "@/components/Nav"

export const metadata: Metadata = {
	title: "GoPath — Learn Go by Building Real Things",
	description:
		"No toy examples. No tutorial hell. Learn Go through curated real-world projects built for developers coming from other languages.",
	openGraph: {
		title: "GoPath — Learn Go by Building Real Things",
		description: "9 real projects. 3 tiers. Zero toy examples.",
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
				<Nav />
				{children}
			</body>
		</html>
	)
}
