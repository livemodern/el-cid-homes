// ─── View tracker — counts unique listings a visitor has seen ────────
// localStorage-backed, runs entirely in the browser. Used by the
// listing-view paywall to gate access after N unique listings.
//
// Why localStorage and not the DB? Compass / Zillow / Realtor.com all do
// this client-side. Server-side tracking adds complexity (IP-based, since
// no user_id exists pre-signup) and is easily defeated by anyone willing
// to clear cookies anyway. The point isn't lockdown — it's friction at
// the moment of high engagement. Anonymous viewer who's seen 3 listings
// is a hot lead; pop the wall, capture them.

'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/auth';

const STORAGE_KEY = 'mlg.viewed_listings';

// ─── Reading + recording views ────────────────────────────────────────

function readViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeViewed(ids: string[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

// Record a listing view. Returns the resulting unique-view count.
// De-duped — re-viewing the same listing doesn't increment the count.
export function recordView(mlsId: string): number {
  const cur = readViewed();
  if (cur.includes(mlsId)) return cur.length;
  cur.push(mlsId);
  writeViewed(cur);
  return cur.length;
}

export function getViewCount(): number {
  return readViewed().length;
}

// Called after successful signup. Doesn't actually clear — keeps the
// history so we know what they saw before registering (useful for the
// admin / FUB feed of "what listings did this lead browse"), but the
// paywall logic skips the check entirely for authenticated users.
export function clearViewedCount(): void {
  // No-op for now. Keeping history is more valuable than resetting.
}

// ─── Settings (cached) ────────────────────────────────────────────────
// Reads `site_settings` from Supabase. Tries per-site key first
// (`listing_view_limit:<slug>`), falls back to the shared
// `listing_view_limit` key, then a hard default. Cached for the life of
// the page since admins changing the limit shouldn't surprise active
// visitors mid-session anyway.

type ViewLimitConfig = { limit: number; enabled: boolean };

const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid-homes';

let _cached: ViewLimitConfig | null = null;
let _cachedPromise: Promise<ViewLimitConfig> | null = null;

async function fetchConfig(): Promise<ViewLimitConfig> {
  if (_cached) return _cached;
  if (_cachedPromise) return _cachedPromise;

  _cachedPromise = (async () => {
    try {
      const sb = getSupabase();
      const { data } = await sb
        .from('site_settings')
        .select('key,value')
        .in('key', [`listing_view_limit:${SITE_SLUG}`, 'listing_view_limit']);
      const rows = (data ?? []) as Array<{ key: string; value: ViewLimitConfig | null }>;
      const perSite = rows.find(r => r.key === `listing_view_limit:${SITE_SLUG}`)?.value;
      const shared  = rows.find(r => r.key === 'listing_view_limit')?.value;
      const cfg = perSite || shared || { limit: 3, enabled: true };
      _cached = cfg;
      return cfg;
    } catch {
      // Fallback if Supabase is unreachable — gentle default that's never
      // accidentally restrictive (don't lock people out due to network
      // hiccups), but matches the desired UX when network is fine.
      const cfg = { limit: 3, enabled: true };
      _cached = cfg;
      return cfg;
    }
  })();

  return _cachedPromise;
}

// ─── Hook: should we show the paywall? ───────────────────────────────
// Returns { shouldShow, limit }. shouldShow becomes true once the user
// has viewed >= limit listings AND is not signed in AND the feature is
// enabled in site_settings.

export function useViewPaywall(opts: { isSignedIn: boolean; currentMlsId?: string }) {
  const { isSignedIn, currentMlsId } = opts;
  const [config, setConfig] = useState<ViewLimitConfig | null>(null);
  const [viewCount, setViewCount] = useState(0);

  // Load the limit setting once
  useEffect(() => {
    let mounted = true;
    fetchConfig().then(cfg => { if (mounted) setConfig(cfg); });
    return () => { mounted = false; };
  }, []);

  // Record this listing view (if any) and refresh local counter
  useEffect(() => {
    if (!currentMlsId) return;
    const n = recordView(currentMlsId);
    setViewCount(n);
  }, [currentMlsId]);

  const limit = config?.limit ?? 3;
  const enabled = config?.enabled ?? true;
  const shouldShow = enabled && !isSignedIn && viewCount >= limit;

  return { shouldShow, limit, viewCount };
}
