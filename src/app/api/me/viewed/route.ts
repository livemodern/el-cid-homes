import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ ok: true });

  const token = auth.slice(7);
  const sb = getServiceClient();

  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const { mls_id, site_slug = 'mlg-search' } = body;
  if (!mls_id) return NextResponse.json({ ok: true });

  // 1. Record view in Supabase
  await sb.rpc('record_property_view', {
    p_user_id: user.id,
    p_mls_id: mls_id,
    p_site_slug: site_slug,
  });

  // 1b. Also write a native site_events listing_view. The external pixel
  // can't stamp auth on mini-sites (user_id stays null), so mini visits
  // never reached the CRM timeline ("Returned to <site>"), the Seen chip,
  // or session analytics. This authed endpoint IS the reliable signal —
  // stamping user_id here lights up the whole existing downstream (timeline
  // ORs on user_ids instantly; the 15-min backfill cron stamps contact_id
  // and advances last_on_site_at). Best-effort. Patrick 2026-07-11.
  try {
    await sb.from('site_events').insert({
      site_slug,
      event_type: 'listing_view',
      page_path: `/listings/${mls_id}`,
      page_url: `${req.nextUrl.origin}/listings/${mls_id}`,
      user_id: user.id,
      occurred_at: new Date().toISOString(),
      data: { mls_id: String(mls_id) },
    });
  } catch { /* view already recorded in property_views */ }

  // FUB per-view notes CUT (Patrick 2026-07-11): platform sites capture
  // views natively (property_views + site_events → Property Activity, Seen,
  // timeline) with their own alerts, so the downstream "Viewed Property"
  // FUB notes were pure noise on agents' FUB feeds. Registration + @-assign
  // notes stay until the FUB exit — the @-mention is still the lead
  // push-notification path.

  return NextResponse.json({ ok: true });
}
