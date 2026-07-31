'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { attachUnloadFlush, captureAttribution, fire } from '@/lib/site-tracker';

/**
 * Mounted once from the root layout. Captures campaign attribution on landing,
 * fires a pageview on first load and on every client-side route change, and
 * flushes the queue when the tab is hidden or closed.
 *
 * This is what replaced the anonymous pixel.js: same pageviews, but the
 * identity cookie rides along so /api/track can resolve a contact_id.
 */
export default function SiteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    return attachUnloadFlush();
  }, []);

  useEffect(() => {
    fire('pageview');
  }, [pathname]);

  return null;
}
