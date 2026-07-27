import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'
const INDEXABLE = process.env.SITE_INDEXABLE === 'true'

// Dynamic robots so cutover is an env flip, not a file edit. Staging stays
// fully blocked; production (SITE_INDEXABLE=true) opens to all crawlers —
// including AI agents (GPTBot, ClaudeBot, PerplexityBot, etc., which honor the
// `*` rule) — and advertises the sitemap.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Crawler-only; never affects how pages render for real users.
      //  /_next/image = optimized MLS-photo variants walked through the
      //    optimizer -> /api/proxy/image -> a function invocation + Cotality
      //    fetch each; never indexable, pure wasted crawl + cost.
      //  /api/ = all API routes.
      //  /search = the county-wide MLS search. On a single-building mini it's
      //    client-rendered (ssr:false, no crawlable state) and has no SEO
      //    value — the building's own pages are the money pages — so keep it
      //    out of the index and off the crawl budget.
      // Fleet crawl/cost hygiene, Patrick 2026-07-27 (matches mlg-site 0e8a3ef).
      disallow: ['/_next/image', '/api/', '/search'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
