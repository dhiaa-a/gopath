import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/lib/projects";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

const tierColors = {
  1: { accent: "text-go-cyan", badge: "bg-go-cyan/10 border-go-cyan/25 text-go-cyan" },
  2: { accent: "text-go-teal", badge: "bg-go-teal/10 border-go-teal/25 text-go-teal" },
  3: { accent: "text-go-amber", badge: "bg-go-amber/10 border-go-amber/25 text-go-amber" },
};

export default function ProjectPage({ params }: { params: { slug: string } }) {
  const project = getProject(params.slug);
  if (!project) notFound();

  const c = tierColors[project.tier];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 font-mono text-xs text-muted">
        <Link href="/" className="hover:text-white transition-colors">GoPath</Link>
        <span>/</span>
        <Link href="/projects" className="hover:text-white transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-white">{project.name}</span>
      </div>

      {/* Header */}
      <div className={`mb-1 font-mono text-xs uppercase tracking-widest ${c.accent}`}>
        {project.tierLabel}
      </div>
      <h1 className="mb-3 font-serif text-4xl text-white">{project.name}</h1>
      <p className="mb-6 text-lg text-muted">{project.tagline}</p>

      {/* Meta badges */}
      <div className="mb-10 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs ${c.badge}`}>
          ⏱ {project.estimatedTime}
        </span>
        {project.tags.map((t) => (
          <span
            key={t}
            className="rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      {/* What you'll build */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-6">
        <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          What you'll build
        </div>
        <p
          className="text-sm leading-relaxed text-muted"
          dangerouslySetInnerHTML={{ __html: project.what }}
        />
      </div>

      {/* What you'll learn */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-6">
        <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
          What you'll learn
        </div>
        <ul className="flex flex-col gap-2">
          {project.learn.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted">
              <span className={`mt-0.5 shrink-0 font-mono ${c.accent}`}>→</span>
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ul>
      </div>

      {/* Coming from another language */}
      <div className="mb-10 rounded-lg border border-go-amber/20 bg-go-amber/5 p-6">
        <div className="mb-2 font-mono text-xs uppercase tracking-widest text-go-amber">
          Coming from another language?
        </div>
        <p
          className="text-sm leading-relaxed text-muted"
          dangerouslySetInnerHTML={{ __html: project.fromOtherLang }}
        />
      </div>

      {/* Steps */}
      <h2 className="mb-1 font-serif text-2xl text-white">Steps</h2>
      <p className="mb-6 font-mono text-xs text-faint">
        Guided, not hand-holding.
      </p>
      <div className="flex flex-col divide-y divide-border">
        {project.steps.map((step) => (
          <div key={step.n} className="flex gap-6 py-6">
            <div className={`shrink-0 pt-0.5 font-mono text-sm font-semibold ${c.accent}`}>
              {step.n}
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">{step.heading}</h3>
              <p
                className="text-sm leading-relaxed text-muted"
                dangerouslySetInnerHTML={{ __html: step.body }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Next project */}
      {project.nextSlug && (
        <div className="mt-12 border-t border-border pt-8">
          <Link
            href={`/projects/${project.nextSlug}`}
            className={`font-mono text-sm font-semibold transition-opacity hover:opacity-75 ${c.accent}`}
          >
            Next: {project.nextName} →
          </Link>
        </div>
      )}
    </main>
  );
}
