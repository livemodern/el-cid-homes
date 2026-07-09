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
