# GoPath — Learn Go by Building Real Things

A Next.js site for learning Go through curated real-world projects, built for developers coming from other languages.

## Stack

- **Next.js 14** (App Router, static generation)
- **TypeScript**
- **Tailwind CSS**
- **Google Fonts** — DM Serif Display, JetBrains Mono, Outfit

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
gopath/
├── app/
│   ├── layout.tsx              # Root layout (Nav + fonts)
│   ├── page.tsx                # Homepage (hero, path, why)
│   ├── not-found.tsx           # 404 page
│   ├── globals.css             # Global styles + Tailwind
│   ├── concepts/
│   │   └── page.tsx            # Concepts index → projects
│   └── projects/
│       ├── page.tsx            # All projects listing
│       └── [slug]/
│           └── page.tsx        # Individual project page
├── components/
│   └── Nav.tsx                 # Sticky nav bar
└── lib/
    └── projects.ts             # All project data (single source of truth)
```

## Adding a new project

All content lives in `lib/projects.ts`. Add a new object to the `projects` array:

```ts
{
  slug: "my-project",           // URL: /projects/my-project
  tier: 1,                      // 1 | 2 | 3
  tierLabel: "Tier 01 — Get Comfortable",
  code: "XYZ",                  // 3-letter icon shown on cards
  name: "My Project",
  tagline: "One sentence description.",
  estimatedTime: "2–3 hours",
  what: "Longer description of what you build.",
  learn: [
    "Concept one",
    "Concept two with <code>inline code</code>",
  ],
  fromOtherLang: "Coming from Python: ...",
  steps: [
    { n: "01", heading: "Step title", body: "Step description." },
  ],
  tags: ["goroutines", "channels"],
  nextSlug: "next-project-slug",   // optional
  nextName: "Next Project Name",   // optional
}
```

The project page at `/projects/[slug]` is generated automatically from this data.

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

No configuration needed — Next.js on Vercel works out of the box.

## Roadmap

- [ ] Inline code runner (Go Playground iframe or Sandpack)
- [ ] Progress tracking (localStorage)
- [ ] Search across projects and concepts
- [ ] "Coming from X" filter on project listing
- [ ] Dark/light mode toggle
