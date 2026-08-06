// Flat config. Next 16 removed the `next lint` subcommand, so `npm run lint`
// invokes eslint directly and this file is what it reads.
// `eslint-config-next/core-web-vitals` is a native flat-config array and is the
// drop-in replacement for the old `.eslintrc.json` `extends: next/core-web-vitals`.
// It already ignores .next/, out/, build/, and next-env.d.ts.
import coreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
	// The inherited ignores only cover build output at the repo root, so a
	// nested one (a git worktree under .claude/, a vendored example) gets
	// linted as if it were source and fails on generated code nobody wrote.
	// A gate that goes red for reasons unrelated to the change is a gate people
	// learn to ignore, which is how the last one died.
	{ ignores: ['**/.next/**', '**/node_modules/**', '.claude/**'] },
	...coreWebVitals,
]

export default config
