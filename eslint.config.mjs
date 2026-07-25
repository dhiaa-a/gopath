// Flat config. Next 16 removed the `next lint` subcommand, so `npm run lint`
// invokes eslint directly and this file is what it reads.
// `eslint-config-next/core-web-vitals` is a native flat-config array and is the
// drop-in replacement for the old `.eslintrc.json` `extends: next/core-web-vitals`.
// It already ignores .next/, out/, build/, and next-env.d.ts.
import coreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [...coreWebVitals]

export default config
