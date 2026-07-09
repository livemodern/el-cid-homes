import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── TCP search-suggest proxy ────────────────────────────────────────
// Sister to /api/search — proxies the typeahead endpoint through to
// mlg-site so building/community/city/zip suggestions stay in sync with
// the main site's source of truth. See `mini_sites_seo_strategy.md`
// memory for the broader pattern.
//
// Suggest doesn't need a building-scope filter — the typeahead is the
// search BOX, where the user might be typing anything; we still want
// to surface county-wide matches. Just forward params as-is.
// ─────────────────────────────────────────────────────────────────────

const MLG_SITE_URL = (process.env.MLG_SITE_URL || 'https://www.modernlivingre.com').replace(/\/+$/, '');

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const upstream = `${MLG_SITE_URL}/api/search/suggest${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Upstream suggest failed (${res.status})`, detail: body.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Upstream suggest unreachable', detail: err?.message || String(err) },
      { status: 502 }
    );
  }
}
