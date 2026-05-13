import posthog from "posthog-js"

// Privacy posture (locked by DECISIONS 2026-05-13 — production-readiness):
// EU host, cookieless (localStorage only), autocapture OFF, replay OFF,
// surveys OFF, person profiles created only on explicit identify (we never identify).
// Reverse-proxied through /ingest to dodge ad-blockers.
//
// If you find yourself enabling any of these, write a DECISIONS entry first.
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
	api_host: "/ingest",
	ui_host: "https://eu.posthog.com",

	persistence: "localStorage",
	autocapture: false,
	disable_session_recording: true,
	disable_surveys: true,
	person_profiles: "identified_only",

	capture_exceptions: true,

	debug: process.env.NODE_ENV === "development",
})
