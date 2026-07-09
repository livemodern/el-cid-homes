import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = new Set(['patrick@modernlivingre.com', 'patrick@livemodern.com']);

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = auth.slice(7);
  const sb = getServiceClient();

  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user?.email || !ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = params;

  // Profile FIRST — the leads query below filters by profile.email. This
  // used to sit inside the same Promise.all it was destructured from, i.e.
  // `profile` was referenced before its own declaration: a guaranteed TDZ
  // ReferenceError (endpoint 500'd whenever hit). Surfaced the moment
  // typescript.ignoreBuildErrors was removed (2026-07-05).
  const { data: profile } = await sb
    .from('registrations').select('*').eq('user_id', userId).maybeSingle();
  const [
    { data: views },
    { data: saved },
    { data: inquiries },
  ] = await Promise.all([
    sb.from('property_views')
      .select('mls_id, view_count, first_viewed_at, last_viewed_at, site_slug')
      .eq('user_id', userId)
      .order('last_viewed_at', { ascending: false }),
    sb.from('saved_listings')
      .select('mls_id, site_slug, saved_at')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false }),
    sb.from('leads')
      .select('*')
      .or(`email.eq.${profile?.email || 'noemail'}`)
      .order('created_at', { ascending: false }),
  ]);

  // Enrich views with property details
  const viewMlsIds = (views || []).map((v: any) => v.mls_id);
  const savedMlsIds = (saved || []).map((s: any) => s.mls_id);
  const allMlsIds = [...new Set([...viewMlsIds, ...savedMlsIds])];

  let propMap: Record<string, any> = {};
  if (allMlsIds.length > 0) {
    const { data: props } = await sb
      .from('properties')
      .select('mls_id, listing_id, street_address, city, state, zip, list_price, beds, baths, sqft, status, image_urls, property_type')
      .in('mls_id', allMlsIds);
    for (const p of props || []) propMap[p.mls_id] = p;
  }

  return NextResponse.json({
    profile,
    views: (views || []).map((v: any) => ({ ...v, property: propMap[v.mls_id] || null })),
    saved: (saved || []).map((s: any) => ({ ...s, property: propMap[s.mls_id] || null })),
    inquiries: inquiries || [],
  });
}
