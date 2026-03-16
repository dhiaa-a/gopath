import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 font-mono text-sm text-go-cyan">404</div>
      <h1 className="mb-3 font-serif text-4xl text-white">Page not found</h1>
      <p className="mb-8 text-muted">
        That project or page doesn&apos;t exist yet.
      </p>
      <Link
        href="/"
        className="rounded bg-go-cyan px-5 py-2.5 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-85"
      >
        ← Back to GoPath
      </Link>
    </main>
  );
}
