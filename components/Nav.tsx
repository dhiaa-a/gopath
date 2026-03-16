"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-mono text-lg font-semibold text-go-cyan">
          go<span className="text-muted">path</span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          <li>
            <Link
              href="/#path"
              className="text-sm font-medium text-muted transition-colors hover:text-white"
            >
              Learning path
            </Link>
          </li>
          <li>
            <Link
              href="/concepts"
              className="text-sm font-medium text-muted transition-colors hover:text-white"
            >
              Concepts
            </Link>
          </li>
          <li>
            <Link
              href="/projects"
              className="text-sm font-medium text-muted transition-colors hover:text-white"
            >
              All projects
            </Link>
          </li>
        </ul>

        <Link
          href="/projects/cli-renamer"
          className="rounded bg-go-cyan px-4 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-85"
        >
          Start building →
        </Link>
      </div>
    </nav>
  );
}
