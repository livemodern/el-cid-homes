// Canonical PUBLIC mlg-site URL — the listings/search site users actually
// see (modernlivingre.com
// the brand cutover).
//
// Mini-sites (TCP and siblings) build their cross-link URLs (footer columns
// pointing at the umbrella site's communities/about/blog) off this constant
// rather than hardcoding the host. At cutover time set
// NEXT_PUBLIC_MLG_SITE_URL on Vercel TCP Production and redeploy — no code
// change needed.
//
// NEXT_PUBLIC_ prefix is intentional so client components (tsx) can read
// it too — same value resolves on both server and client.
//
// Returned WITHOUT a trailing slash so callers can do `${URL}/path`.

const RAW = process.env.NEXT_PUBLIC_MLG_SITE_URL || 'https://www.modernlivingre.com'

export const MLG_SITE_URL = RAW.replace(/\/+$/, '')
