import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// (FUB Saved Property note deleted 2026-07-23 — the wall record is written natively below.)

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = auth.slice(7);
  const sb = getServiceClient();

  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { data: savedRows, error: savedErr } = await sb
    .from('saved_listings')
    .select('mls_id, site_slug, saved_at')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  if (savedErr) {
    return NextResponse.json({ error: savedErr.message }, { status: 500 });
  }

  if (!savedRows || savedRows.length === 0) {
    return NextResponse.json({ listings: [] });
  }

  const mlsIds = savedRows.map((r: any) => r.mls_id);
  const { data: props } = await sb
    .from('properties')
    .select('mls_id, listing_id, status, list_price, beds, baths, sqft, street_address, city, state, zip, image_urls, property_type')
    .in('mls_id', mlsIds);

  const propMap: Record<string, any> = {};
  for (const p of props || []) propMap[p.mls_id] = p;

  const listings = savedRows.map((r: any) => ({
    ...r,
    properties: propMap[r.mls_id] || null,
  }));

  return NextResponse.json({ listings });
}

// POST — called when user saves a listing (from lib/auth.ts saveListing)
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ ok: true });

  const token = auth.slice(7);
  const sb = getServiceClient();

  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user?.email) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const { mls_id, site_slug = 'mlg-search' } = body;
  if (!mls_id) return NextResponse.json({ ok: true });

  // Native "Saved Property" wall activity — the record used to be a 📝 note
  // posted to Follow Up Boss and classified back into contact_activity by
  // fub-sync up to an hour later. FUB is deleted from the consumer sites
  // (Patrick 2026-07-23), so we write the same lead_event row directly:
  // instant on the wall, no third-party round-trip, same shape fub-sync
  // produced. Fire-and-forget; a failure never affects the save itself
  // (saved_listings is the durable record).
  (async () => {
    try {
      const { data: crmContact } = await sb
        .from('contacts')
        .select('id')
        .ilike('email', user.email!)
        .is('archived_at', null)
        .maybeSingle();
      if (!crmContact?.id) return; // not a CRM contact (yet) — nothing to attach to

      const { data: prop } = await sb.from('properties')
        .select('street_address, city, mls_id, listing_id, list_price')
        .eq('mls_id', mls_id)
        .maybeSingle();

      const propertyUrl = prop ? `https://elcidhomes.com/listings/${prop.listing_id || mls_id}` : null;
      const bits = [
        `MLS# ${prop?.mls_id || mls_id}`,
        prop?.street_address || null,
        prop?.city || null,
        typeof prop?.list_price === 'number' ? '$' + Number(prop.list_price).toLocaleString() : null,
      ].filter(Boolean);
      const lines = [
        '📝 Saved Property',
        'Source: elcidhomes.com',
        `Property: ${bits.join(' · ')}`,
        ...(propertyUrl ? [`Link: ${propertyUrl}`] : []),
      ];

      await sb.from('contact_activity').insert({
        contact_id:          crmContact.id,
        type:                'lead_event',
        event_type:          'Saved Property',
        body:                lines.join('\n'),
        created_by:          'system:mlg-admin',
        created_by_user_id:  null,
        created_by_agent_id: null,
        activity_at:         new Date().toISOString(),
      });
    } catch (e) {
      console.error('native saved-property activity failed (non-fatal):', e);
    }
  })();

  return NextResponse.json({ ok: true });
}
