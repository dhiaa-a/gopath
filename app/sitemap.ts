import type { MetadataRoute } from "next"
import { projects } from "@/lib/projects"
import { concepts } from "@/lib/concepts"
import { orientationPages } from "@/lib/orientation"

const BASE =
	process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
	"https://gopath.dev"

export default function sitemap(): MetadataRoute.Sitemap {
	const now = new Date()
	const top: MetadataRoute.Sitemap = [
		{ url: `${BASE}/`, lastModified: now, priority: 1 },
		{ url: `${BASE}/projects`, lastModified: now, priority: 0.9 },
		{ url: `${BASE}/concepts`, lastModified: now, priority: 0.8 },
		{ url: `${BASE}/orientation`, lastModified: now, priority: 0.8 },
		{ url: `${BASE}/privacy`, lastModified: now, priority: 0.2 },
	]
	const project = projects.map((p) => ({
		url: `${BASE}/projects/${p.slug}`,
		lastModified: now,
		priority: 0.9,
	}))
	const concept = concepts.map((c) => ({
		url: `${BASE}/concepts/${c.slug}`,
		lastModified: now,
		priority: 0.7,
	}))
	const orientation = orientationPages.map((o) => ({
		url: `${BASE}/orientation/${o.slug}`,
		lastModified: now,
		priority: 0.6,
	}))
	return [...top, ...project, ...concept, ...orientation]
}
