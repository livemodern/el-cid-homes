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
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
