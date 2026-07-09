import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── TCP search proxy ────────────────────────────────────────────────
// Per the mini-sites SEO strategy (memory: mini_sites_seo_strategy.md),
// TCP keeps its own branded UI but routes all data fetches through
// mlg-site's /api/search so we have ONE source of truth for SELECT
// shape, filter logic, view-vs-table column drift, dup_suppressed
// handling, and multi-family/triplex/quadruplex taxonomy expansion.
// Today's audit (2026-06-18) fixed 4 search bugs in mlg-site; the
// proxy means TCP picks them up automatically with no port-and-pray.
//
// This is a SERVER-SIDE fetch — the user's browser stays on
// elcidhomes.com the entire time.
//
// MLG_SITE_URL is intentionally env-driven so the modernlivingre.com
// cutover is one Vercel env flip — no code change here.
//
// ── Default scope on initial load ──
// When a user lands on /search fresh, surface the comparable inventory
// shoppers actually want to see in this building's neighborhood:
// 33401 condos $500k+. This is BROADER than just 'CityPlace South Tower' on
// purpose — the mini-site is the entry point but the visitor is
// usually shopping the area. Defaults fire ONLY when the user hasn't
// engaged any filter control yet. The moment they touch beds, baths,
// price, type, map, etc., defaults step aside so they can search the
// full DB unrestricted (every county zip, every property type).
// ─────────────────────────────────────────────────────────────────────

const MLG_SITE_URL = (process.env.MLG_SITE_URL || 'https://www.modernlivingre.com').replace(/\/+$/, '');

// El Cid landing defaults. Geography is set by the UI's DEFAULT_BOUNDS
// (El Cid bbox in SearchPageDesktop) so the proxy doesn't need to inject
// location or a property-type default — El Cid is a neighborhood of homes,
// so the initial view shows everything inside the El Cid map bounds and the
// visitor can filter/pan freely across the full county DB from there.

export async function GET(req: NextRequest) {
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());

  const upstream = `${MLG_SITE_URL}/api/search?${params.toString()}`;

  try {
    const res = await fetch(upstream, {
      // Search results are time-sensitive (status, price, photos). Bypass
      // any edge cache; mlg-site's own caching wins.
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Upstream search failed (${res.status})`, detail: body.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Upstream search unreachable', detail: err?.message || String(err) },
      { status: 502 }
    );
  }
}
