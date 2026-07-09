import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submitSavedProperty } from '@/lib/fub';

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

  // Fire "Saved Property" event to FUB
  (async () => {
    try {
      const [{ data: prop }, { data: reg }] = await Promise.all([
        sb.from('properties')
          .select('street_address, city, state, zip, mls_id, listing_id, list_price, beds, baths, sqft')
          .eq('mls_id', mls_id)
          .maybeSingle(),
        sb.from('registrations')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const baseUrl = site_slug === 'twocityplaza'
        ? 'https://elcidhomes.com'
        : 'https://elcidhomes.com';
      const propertyUrl = prop ? `${baseUrl}/listings/${prop.listing_id || mls_id}` : undefined;

      await submitSavedProperty({
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
      console.error('FUB saved property event failed:', e);
    }
  })();

  return NextResponse.json({ ok: true });
}
