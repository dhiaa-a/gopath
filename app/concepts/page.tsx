import Link from "next/link";
import { projects } from "@/lib/projects";

// Build a concepts → projects map from tag data
const conceptMap: Record<string, { projectSlug: string; projectName: string; tier: number }[]> = {};

for (const project of projects) {
  for (const tag of project.tags) {
    if (!conceptMap[tag]) conceptMap[tag] = [];
    conceptMap[tag].push({
      projectSlug: project.slug,
      projectName: project.name,
      tier: project.tier,
    });
  }
}

const tierColors = {
  1: "text-go-cyan",
  2: "text-go-teal",
  3: "text-go-amber",
};

const sortedConcepts = Object.entries(conceptMap).sort(([a], [b]) =>
  a.localeCompare(b)
);

export default function ConceptsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-cyan">
        Concepts
      </div>
      <h1 className="mb-3 font-serif text-4xl text-white">
        Every concept, linked to the project that teaches it.
      </h1>
      <p className="mb-12 text-muted">
        Not a docs page. Not a blog post. Real code you can run.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sortedConcepts.map(([concept, projs]) => (
          <div
            key={concept}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-3 font-mono text-sm font-semibold text-white">
              {concept}
            </div>
            <div className="flex flex-col gap-1.5">
              {projs.map((p) => (
                <Link
                  key={p.projectSlug}
                  href={`/projects/${p.projectSlug}`}
                  className="flex items-center gap-2 text-xs text-muted transition-colors hover:text-white"
                >
                  <span
                    className={`font-mono ${tierColors[p.tier as 1 | 2 | 3]}`}
                  >
                    →
                  </span>
                  {p.projectName}
                  <span className="ml-auto font-mono text-[10px] text-faint">
                    T{p.tier}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
