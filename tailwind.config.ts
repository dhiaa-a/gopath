import type { Config } from "tailwindcss";

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
        muted: "#7a9a7a",
        faint: "#3a5a3a",
      },
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        serif: ["DM Serif Display", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
