import { projects } from "./projects"
import { concepts } from "./concepts"
import { failures } from "./failures"
import { idioms } from "./idioms"
import { sourceWalkthroughs } from "./source"
import { tier0Lessons } from "./tier0"
import { capstone } from "./capstone"

// The backlog item that asked for this ("search across projects and
// concepts") predates four of the site's six content types. The reason it
// exists — "the site is now large enough that browsing is slow" — applies
// exactly as much to a failure lab or an idiom exercise as to a project, so
// the index covers everything with its own page rather than the original
// two types literally named.
//
// Deliberately just {type, title, subtitle, href, tags}: full step content,
// concept prose, and diagnosis HTML never enter this array. That keeps the
// index a few hundred records at a few hundred bytes each — trivial to embed
// in a page — and keeps every project's full lesson text out of the search
// palette's client bundle, which is the thing that would actually be heavy.

export type SearchRecord = {
	type:
		| "Project"
		| "Concept"
		| "Failure lab"
		| "Idiom exercise"
		| "Source walkthrough"
		| "Basics lesson"
		| "Capstone"
	title: string
	subtitle: string
	href: string
	tags: string[]
}

export function buildSearchIndex(): SearchRecord[] {
	const records = [
		...projects.map(
			(p): SearchRecord => ({
				type: "Project",
				title: p.name,
				subtitle: p.tagline,
				href: `/projects/${p.slug}`,
				tags: [p.tierLabel, ...p.tags],
			}),
		),
		...concepts.map(
			(c): SearchRecord => ({
				type: "Concept",
				title: c.name,
				subtitle: c.tagline,
				href: `/concepts/${c.slug}`,
				tags: [],
			}),
		),
		...failures.map(
			(f): SearchRecord => ({
				type: "Failure lab",
				title: f.name,
				subtitle: f.tagline,
				href: `/failures/${f.slug}`,
				tags: [f.category],
			}),
		),
		...idioms.map(
			(i): SearchRecord => ({
				type: "Idiom exercise",
				title: i.name,
				subtitle: i.tagline,
				href: `/idioms/${i.slug}`,
				tags: [i.accent],
			}),
		),
		...sourceWalkthroughs.map(
			(w): SearchRecord => ({
				type: "Source walkthrough",
				title: w.name,
				subtitle: w.tagline,
				href: `/source/${w.slug}`,
				tags: [w.pkg],
			}),
		),
		...tier0Lessons.map(
			(l): SearchRecord => ({
				type: "Basics lesson",
				title: l.title,
				subtitle: l.tagline,
				href: `/basics/${l.slug}`,
				tags: [],
			}),
		),
		// The one entity in the content model that isn't an array — the path's
		// own ending, and the record that would have been silently missing if
		// this file only mapped over collections.
		{
			type: "Capstone",
			title: capstone.name,
			subtitle: capstone.tagline,
			href: `/${capstone.slug}`,
			tags: [],
		} satisfies SearchRecord,
	]

	// A record's own type name is otherwise not searchable text anywhere on
	// it — the field that says "Capstone" is metadata, not something Fuse
	// looks at. Without this, querying "capstone" itself finds nothing: the
	// slug is "capstone" but the title is "linkd" and neither shares enough
	// characters with the query to fuzzy-match. Folded into `tags` for every
	// record, not just the capstone, so "concept" or "failure" work as
	// type-name searches too.
	return records.map((r) => ({ ...r, tags: [...r.tags, r.type] }))
}
