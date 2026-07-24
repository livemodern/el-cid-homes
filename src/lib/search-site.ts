/**
 * Per-site search configuration.
 *
 * THIS IS THE ONLY FILE IN THE /search EXPERIENCE THAT MAY DIFFER BETWEEN
 * MINI-SITES. SearchPageDesktop.tsx, SearchPageMobile.tsx,
 * SearchPageClient.tsx and components/LocationSearch.tsx are byte-identical
 * across the whole fleet and are synced from the canonical copy in
 * livemodern/cityplace-south-tower. Do not hand-edit them in a clone — the
 * edit will be silently reverted by the next sync, and
 * scripts/check-search-drift.py will fail in the meantime.
 *
 * Why this file exists: the search UI had drifted into 9 different versions
 * of the same 1,950-line file. The differences turned out to be ONE real
 * value (the map viewport) plus a pile of clone-transform damage.
 */

export const SEARCH_SITE = {
  /** Initial map viewport as "minLng,minLat,maxLng,maxLat". Panning and
   *  filtering still reach the entire Palm Beach + Martin County database;
   *  this only decides where the first paint lands. */
  defaultBounds: '-80.0640,26.6800,-80.0410,26.7030',

  /** Human-readable market name for this viewport (comments / a11y copy). */
  marketLabel: 'El Cid',
} as const;

/**
 * Map centre, DERIVED from the bounds rather than configured.
 *
 * It used to be a second hand-maintained constant, and on nautilus-220 and
 * rocky-point-stuart it had drifted to a centre sitting outside that site's
 * own bbox — so the map opened on the right bounds, then immediately jumped
 * ~45 miles to downtown West Palm Beach and re-queried the wrong market.
 * Deriving it makes that class of bug impossible to reintroduce.
 */
export function defaultCenter(): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = SEARCH_SITE.defaultBounds
    .split(',')
    .map(Number);
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
