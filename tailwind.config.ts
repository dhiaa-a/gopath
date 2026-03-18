import type { Config } from "tailwindcss"

const config: Config = {
	content: [
		"./app/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./lib/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				bg: "#0a0e0a",
				surface: "#111611",
				surface2: "#161d16",
				border: "#1e2b1e",
				border2: "#2a3d2a",
				"go-cyan": "#00ADD8",
				"go-teal": "#16c79a",
				"go-amber": "#fbbf24",
				// brighter muted for readability
				muted: "#9ab89a",
				faint: "#4a6a4a",
			},
			fontFamily: {
				sans: ["Outfit", "sans-serif"],
				serif: ["DM Serif Display", "serif"],
				mono: ["JetBrains Mono", "monospace"],
			},
			fontSize: {
				// Slightly larger base sizes
				xs: ["0.75rem", { lineHeight: "1.5" }],
				sm: ["0.875rem", { lineHeight: "1.6" }],
				base: ["1rem", { lineHeight: "1.8" }],
				lg: ["1.125rem", { lineHeight: "1.75" }],
				xl: ["1.25rem", { lineHeight: "1.7" }],
				"2xl": ["1.5rem", { lineHeight: "1.4" }],
				"3xl": ["1.875rem", { lineHeight: "1.3" }],
				"4xl": ["2.25rem", { lineHeight: "1.2" }],
				"5xl": ["3rem", { lineHeight: "1.15" }],
			},
			spacing: {
				"18": "4.5rem",
			},
		},
	},
	plugins: [],
}
export default config
