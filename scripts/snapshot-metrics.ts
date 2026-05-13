/**
 * Pulls a weekly metrics snapshot from PostHog and writes it to
 * `data/metrics/YYYY-Www.md`. Run manually (`npm run snapshot`) or via cron.
 *
 * Future Claude sessions read these files for trend history without needing
 * live API access. Source of truth for "how is the site doing over time."
 *
 * Required env vars:
 *   POSTHOG_PROJECT_ID        — numeric, from the PostHog project URL
 *   POSTHOG_PERSONAL_API_KEY  — created at posthog.com/project/settings → Personal API keys
 *
 * The script intentionally fails loud if either is missing — partial snapshots
 * are worse than no snapshots because they look like real data.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const HOST = process.env.POSTHOG_HOST || "https://eu.posthog.com"

if (!PROJECT_ID || !API_KEY) {
	console.error(
		"snapshot-metrics: POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY required"
	)
	process.exit(1)
}

const EVENTS = [
	"$pageview",
	"cta_clicked",
	"nav_cta_clicked",
	"playground_opened",
	"retrieval_prompt_revealed",
	"theme_toggled",
	"project_navigation_clicked",
	"orientation_advanced",
	"concept_practice_link_clicked",
	"project_step_in_view",
	"project_completed",
] as const

async function trend(event: string) {
	const url = `${HOST}/api/projects/${PROJECT_ID}/insights/trend/?events=${encodeURIComponent(
		JSON.stringify([{ id: event, type: "events" }])
	)}&date_from=-7d`
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${API_KEY}` },
	})
	if (!res.ok) {
		console.error(`  ${event}: ${res.status} ${res.statusText}`)
		return { event, count: null as number | null }
	}
	const json = (await res.json()) as {
		result?: { count?: number }[]
	}
	return { event, count: json.result?.[0]?.count ?? 0 }
}

function isoWeek(d: Date): string {
	const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
	const day = t.getUTCDay() || 7
	t.setUTCDate(t.getUTCDate() + 4 - day)
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
	const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
	return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

async function main() {
	const now = new Date()
	const tag = isoWeek(now)
	console.log(`snapshot-metrics: pulling ${tag} from ${HOST}`)
	const rows = await Promise.all(EVENTS.map(trend))

	const lines = [
		`# Metrics snapshot — ${tag}`,
		``,
		`_Generated ${now.toISOString()} from PostHog project ${PROJECT_ID}._`,
		``,
		`Window: rolling 7 days ending now.`,
		``,
		`| Event | Count (7d) |`,
		`|---|---|`,
		...rows.map(
			(r) =>
				`| \`${r.event}\` | ${r.count === null ? "_error_" : r.count} |`
		),
		``,
		`> Add hand-written context here when something interesting changed.`,
		``,
	]
	const out = join("data", "metrics", `${tag}.md`)
	await mkdir(dirname(out), { recursive: true })
	await writeFile(out, lines.join("\n"))
	console.log(`snapshot-metrics: wrote ${out}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
