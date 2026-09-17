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
			// Modernist sets the whole system in one family at two weights, so
			// `sans` and `serif` both resolve to Archivo: the ~29 `font-serif`
			// headings across the site convert without being edited, and the
			// three-family look the redesign's critique called out ("together
			// they read as three different sites") goes away everywhere rather
			// than only on the homepage. `mono` stays real — code is functional.
			// IBM Plex Sans Arabic sits behind Archivo in every stack rather than
			// being switched on by a [lang="ar"] rule. Font fallback is per-glyph:
			// Archivo has no Arabic coverage, so Arabic characters resolve to Plex
			// on their own while Latin keeps Archivo — which means mixed lines
			// (Arabic prose around `go run` or `sync.WaitGroup`, the house style
			// for the whole Arabic translation) render correctly with no
			// conditional CSS and no chance of a page being switched to the wrong
			// family. Plex Arabic is the closest grotesque match to Archivo's tone
			// and carries the same flat, unornamented character the Modernist
			// system is built on.
			fontFamily: {
				sans: [
					"Archivo",
					"IBM Plex Sans Arabic",
					"system-ui",
					"sans-serif",
				],
				serif: [
					"Archivo",
					"IBM Plex Sans Arabic",
					"system-ui",
					"sans-serif",
				],
				display: [
					"Archivo",
					"IBM Plex Sans Arabic",
					"system-ui",
					"sans-serif",
				],
				mono: ["JetBrains Mono", "monospace"],
			},
			// 2026-09-16: the zero-radius rule softened. It converted every
			// `rounded*` use at once when it was introduced, and the same lever
			// now does the opposite job — a real scale reaches the same ~100
			// call sites without editing markup. See DECISIONS.md.
			borderRadius: {
				none: "0",
				sm: "6px",
				DEFAULT: "8px",
				md: "10px",
				lg: "14px",
				xl: "18px",
				"2xl": "22px",
				"3xl": "28px",
				full: "9999px",
			},
			boxShadow: {
				card: "var(--shadow-card)",
				elevated: "var(--shadow-elevated)",
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
