/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		// Every route lives under /<lang>/. The bare root has to land somewhere,
		// and it lands on English deterministically rather than sniffing
		// Accept-Language: a redirect that varies by request header cannot be
		// cached at the edge as one response, and a reader who wants Arabic has
		// a switcher in the nav on every page. Permanent, because this is the
		// shape the site keeps.
		return [{ source: "/", destination: "/en", permanent: true }]
	},
}
module.exports = nextConfig
