import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submitPropertyView } from '@/lib/fub';

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

  // 2. Send "Viewed Property" event to FUB (fire-and-forget)
  // Only fires if user has email — anonymous/partial accounts skip
  if (user.email) {
    (async () => {
      try {
        // Get property details from Supabase for rich FUB event
        const { data: prop } = await sb
          .from('properties')
          .select('street_address, city, state, zip, mls_id, listing_id, list_price, beds, baths, sqft')
          .eq('mls_id', mls_id)
          .maybeSingle();

        // Get user profile for name
        const { data: reg } = await sb
          .from('registrations')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();

        // Build property URL
        const baseUrl = site_slug === 'twocityplaza'
          ? 'https://elcidhomes.com'
          : 'https://elcidhomes.com';
        const propertyUrl = prop ? `${baseUrl}/listings/${prop.listing_id || mls_id}` : undefined;

        await submitPropertyView({
          contact: {
            firstName: reg?.first_name || undefined,
            lastName:  reg?.last_name  || undefined,
            email:     user.email,
          },
          property: {
            mlsId:         prop?.mls_id || mls_id,
            streetAddress: prop?.street_address,
            city:          prop?.city,
            state:         prop?.state,
            zip:           prop?.zip,
            listPrice:     prop?.list_price,
            beds:          prop?.beds,
            baths:         prop?.baths,
            sqft:          prop?.sqft,
            url:           propertyUrl,
          },
          siteSlug: site_slug,
        });
      } catch (e) {
        // Non-fatal — view is already recorded in Supabase
        console.error('FUB property view event failed:', e);
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
