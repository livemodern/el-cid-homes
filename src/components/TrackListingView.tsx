'use client';

import { useEffect } from 'react';
import { fire } from '@/lib/site-tracker';

/**
 * Fires an identified listing_view carrying the real mls_id.
 *
 * Deliberately its OWN component rather than living inside ListingGate. The
 * gate is a registration paywall — a product decision that some sites make and
 * others don't (Two City Plaza has no gate at all) — and hanging tracking off
 * it meant a site's analytics silently depended on whether it happened to sell
 * behind a wall. Tracking is not a paywall concern. Mounted on every listing
 * detail page in the fleet, gate or no gate.
 */
export default function TrackListingView({ mlsId }: { mlsId?: string | number | null }) {
  useEffect(() => {
    if (!mlsId) return;
    fire('listing_view', { data: { mls_id: String(mlsId) } });
  }, [mlsId]);

  return null;
}
