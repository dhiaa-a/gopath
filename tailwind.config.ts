import type { Config } from "tailwindcss"

const config: Config = {
	darkMode: "class",
	content: [
		"./app/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./lib/**/*.{ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				// All semantic colors read from CSS variables so they flip
				// automatically when the `dark` class is toggled on <html>.
				bg: "rgb(var(--bg) / <alpha-value>)",
				surface: "var(--color-surface)",
				surface2: "var(--color-surface2)",
				border: "var(--color-border)",
				border2: "var(--color-border2)",
				foreground: "var(--color-fg)",
				muted: "var(--color-muted)",
				faint: "var(--color-faint)",
				// Go brand colors — RGB channels allow Tailwind opacity modifiers
				// (e.g. bg-go-cyan/10) to work against both dark and light backgrounds.
				"go-cyan": "rgb(var(--go-cyan) / <alpha-value>)",
				"go-teal": "rgb(var(--go-teal) / <alpha-value>)",
				"go-amber": "rgb(var(--go-amber) / <alpha-value>)",
				// Modernist — the redesigned homepage and the shared nav. Plain
				// var() rather than RGB channels because these carry color-mix()
				// tints; reach for the named step you want instead of an opacity
				// modifier (see the --m-* block in globals.css).
				"m-bg": "var(--m-bg)",
				"m-surface": "var(--m-surface)",
				"m-ink": "var(--m-ink)",
				"m-muted": "var(--m-muted)",
				"m-faint": "var(--m-faint)",
				"m-divider": "var(--m-divider)",
				"m-accent": "var(--m-accent)",
				"m-accent-ink": "var(--m-accent-ink)",
				"m-accent-hover": "var(--m-accent-hover)",
				"m-on-accent": "var(--m-on-accent)",
				"m-tag-bg": "var(--m-tag-bg)",
				"m-tag-fg": "var(--m-tag-fg)",
				"m-tag-neutral-bg": "var(--m-tag-neutral-bg)",
				"m-tag-neutral-fg": "var(--m-tag-neutral-fg)",
			},
			fontFamily: {
				sans: ["Outfit", "sans-serif"],
				serif: ["DM Serif Display", "serif"],
				mono: ["JetBrains Mono", "monospace"],
				// Modernist sets the whole system in one family at two weights.
				display: ["Archivo", "system-ui", "sans-serif"],
			},
			fontSize: {
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
