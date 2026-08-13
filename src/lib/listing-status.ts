// Canonical status bucketing for the public grids.
//
// Why this exists: BeachesMLS delivers `ComingSoon` for listings that are
// pre-marketed before they go fully Active, and `ActiveUnderContract` for
// accepted-offer-but-still-showing. The grids used to filter with an exact
// `l.status === 'Active'` match, so a ComingSoon unit was invisible on every
// tab except "All" — it existed in the payload, it just never rendered.
// (Found 2026-08-13: 5000 N Ocean #603, $6,495,000, showed on the main site
// but not on the mini-site.)
//
// `Withdrawn` is OUR sentinel, not a feed status — the sync stamps it when a
// listing disappears from the feed. It must never render on a public grid.

export const ON_MARKET_STATUSES = ['Active', 'ComingSoon'] as const
export const UNDER_CONTRACT_STATUSES = ['Pending', 'ActiveUnderContract'] as const
export const OFF_MARKET_STATUSES = [
  'Withdrawn', 'Expired', 'Canceled', 'Cancelled',
  'Hold', 'Terminated', 'Incomplete', 'Delete', 'Deleted',
] as const

export type StatusBucket = 'Active' | 'Pending' | 'Closed' | 'Off'

/** Collapse a raw MLS status into the bucket the grid tabs are built on. */
export function statusBucket(status?: string | null): StatusBucket {
  const s = String(status || '')
  if ((ON_MARKET_STATUSES as readonly string[]).includes(s)) return 'Active'
  if ((UNDER_CONTRACT_STATUSES as readonly string[]).includes(s)) return 'Pending'
  if (s === 'Closed') return 'Closed'
  return 'Off'
}

/** True for anything that belongs on a public for-sale / for-rent grid. */
export function isMarketable(status?: string | null): boolean {
  return statusBucket(status) !== 'Off'
}

/** True when the listing is live on the market right now. */
export function isOnMarket(status?: string | null): boolean {
  return statusBucket(status) === 'Active'
}

/** Human-facing badge text for a raw MLS status. */
export function statusLabel(status?: string | null): string {
  const s = String(status || '')
  if (s === 'ComingSoon') return 'Coming Soon'
  if (s === 'ActiveUnderContract') return 'Under Contract'
  return s
}

/** Human-facing badge text on a rentals grid. */
export function rentStatusLabel(status?: string | null): string {
  const s = String(status || '')
  if (s === 'ComingSoon') return 'Coming Soon'
  if (s === 'Active') return 'Available'
  if (s === 'Closed') return 'Leased'
  if (s === 'ActiveUnderContract') return 'Under Contract'
  return s
}
