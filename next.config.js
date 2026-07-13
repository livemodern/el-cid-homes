/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from these domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.mlrecloud.com' },
      // Agent headshots live in Supabase Storage (agents.photo_url), NOT on R2 —
      // they are the canonical copy and must never be duplicated to R2, because
      // the Cloudflare cache would pin a stale headshot for a month. imgOpt()
      // therefore falls through to /_next/image for them, and without this
      // pattern the optimizer 400s and every team photo silently renders as an
      // empty gradient block. That is exactly what shipped on Bristol, City Palms
      // and El Cid: config.team had the right URLs, the page had no <img> at all.
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.cotality.com' },
      { protocol: 'https', hostname: '**.trestle-prod.apicache.com' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: 'properties.modernlivingre.com' },
      { protocol: 'https', hostname: 'twocityplazacondos.com' },
      { protocol: 'https', hostname: 'elcidhomes.com' },
      { protocol: 'https', hostname: '**.beachesmls.com' },
      { protocol: 'https', hostname: '**.mlsmatrix.com' },
      { protocol: 'https', hostname: '**.paragonrels.com' },
    ],
    // Widths used in our srcSets — both lists must include sizes we request,
    // or /_next/image rejects the request with 400.
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    imageSizes:  [16, 32, 48, 64, 96, 128, 256, 384, 400, 500, 800],
    formats: ['image/avif', 'image/webp'],
    // Cache the resized variant at the edge for a year. Source URLs (R2 hash
    // path or Cotality content-hash URL) include change-detection in the
    // path itself, so a real photo change always produces a new URL.
    minimumCacheTTL: 31536000,
  },

  // Security headers
  async headers() {
    // Non-production deployments must never be indexed — Vercel only
    // auto-noindexes *.vercel.app URLs, not custom domains. Two gates:
    //  1. VERCEL_ENV !== 'production' — branch/preview domains.
    //  2. SITE_INDEXABLE === 'false' — mini-site clones running on an
    //     mlrecloud.com staging subdomain as their *production* deployment
    //     before cutover to the real domain. Set SITE_INDEXABLE=false in the
    //     clone's env; remove it (or set 'true') at domain cutover.
    // Unset SITE_INDEXABLE = indexable, so this is a no-op for live sites.
    const noindex = (process.env.VERCEL_ENV !== 'production' || process.env.SITE_INDEXABLE === 'false')
      ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
      : [];
    return [
      {
        source: '/(.*)',
        headers: [
          ...noindex,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/(.*)\\.(jpg|jpeg|png|gif|webp|avif|svg|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Redirects from old WP URLs to new structure
  async redirects() {
    return [
      {
        source: '/myaccount',
        destination: '/account',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
