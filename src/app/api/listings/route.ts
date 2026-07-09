import { NextRequest, NextResponse } from 'next/server';
import { trimCardPhotos } from '@/lib/img';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { TAGS } from '@/lib/cache-tags';

// Columns for cards/grids. close_date + sale_or_lease let /recent-sales
// show 'Sold MMM dd, yyyy' and filter rentals out without re-fetching.
// trestle_raw is opt-in (large, ~25KB/listing) — only /recent-sales uses it.
const BASE_COLS = 'mls_id,listing_id,status,property_type,property_subtype,sale_or_lease,list_price,close_price,close_date,beds,baths,sqft,unit_number,street_address,city,state,zip,description,image_urls,days_on_market,hoa_fee,year_built,building_name,latitude,longitude';

type Params = {
  type: string | null;       // 'sale' | 'rent' | null
  status: string | null;     // 'Active' | 'Pending' | 'Closed' | ...
  includeRaw: boolean;        // trestle_raw column toggle
  closedCutoff: string | null; // YYYY-MM-DD, computed in handler so cache key is stable per day
};

async function runQuery({ type, status, includeRaw, closedCutoff }: Params) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const cols = includeRaw ? `${BASE_COLS},trestle_raw` : BASE_COLS;

  // Primary filter is the indexed community_slug (El Cid is a neighborhood
  // of homes, so building_name is null — the tag lives on community_slug).
  let query = supabase
    .from('properties')
    .select(cols)
    .eq('community_slug', 'el-cid-west-palm-beach')
    .eq('dup_suppressed', false)
    .order('status',     { ascending: true })
    .order('list_price', { ascending: false })
    .limit(300);

  if (type === 'rent') query = query.lt('list_price', 50000);
  if (type === 'sale') query = query.gte('list_price', 50000);

  if (status) query = query.eq('status', status);

  // 3-year display limit for closed listings (older records stay in DB).
  // Patrick's rule (2026-05-26): user-facing pages should not show Sold
  // comps older than 3 years, and undated closings (46k rows from
  // incomplete Trestle imports) should also be hidden — they're almost
  // certainly old.
  //
  // Use status-aware logic:
  //  - status === 'Closed': all rows are Closed; can filter close_date directly.
  //  - type === 'sale' (Active+Pending+Closed mix): use OR so non-Closed rows
  //    (NULL close_date) pass through and only Closed rows get the cutoff.
  if (closedCutoff) {
    if (status === 'Closed') {
      query = query.gte('close_date', closedCutoff);
    } else {
      query = query.or(`status.neq.Closed,close_date.gte.${closedCutoff}`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];
  // Card payload cap (see src/lib/img.ts). include_raw callers get full
  // arrays — that mode exists precisely for complete data.
  if (!includeRaw) trimCardPhotos(rows);
  return { listings: rows, count: rows.length };
}

// Cached variant. Arg values become part of the cache key, so different
// status/type/cutoff combinations cache independently. Tag-invalidated by
// every sync route on writes; 1hr revalidate is the safety net.
//
// include_raw responses can exceed the Vercel Data Cache 2MB-per-entry limit
// (full TCP set with trestle_raw ≈ 2.2MB), so the handler below skips this
// path for include_raw=true and runs the query directly.
const cachedQuery = unstable_cache(
  runQuery,
  ['listings:el-cid-v2'],  // bumped 2026-07-02 to flush pre-trim cache
  {
    tags: [TAGS.LISTINGS_TCP],
    revalidate: 3600,
  },
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status     = searchParams.get('status');
  const type       = searchParams.get('type');
  const includeRaw = searchParams.get('include_raw') === 'true';

  // Compute the 3yr closed-cutoff in the handler (not in the cached fn) so
  // the cache key is stable for the whole calendar day.
  let closedCutoff: string | null = null;
  if (status === 'Closed' || type === 'sale') {
    const t = new Date();
    t.setFullYear(t.getFullYear() - 3);
    closedCutoff = t.toISOString().slice(0, 10);
  }

  const params: Params = { type, status, includeRaw, closedCutoff };

  try {
    const result = includeRaw
      ? await runQuery(params)        // skip cache, response too large
      : await cachedQuery(params);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
