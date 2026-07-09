// Cache tags shared across the TCP app. Used with Next.js `unstable_cache`
// (in route handlers that read from Supabase) and `revalidateTag` (in sync
// routes after writes).
//
// Mirrors the mlg-admin pattern at lib/cache-tags.ts. Keep tag strings stable
// — they're persisted across deploys and bumped by long-running cron jobs.

export const TAGS = {
  // All El Cid listings (Active/Pending/Closed/etc). Bumped after any
  // sync route that may have changed the properties table for El Cid.
  LISTINGS_TCP: 'listings:el-cid',
} as const;
