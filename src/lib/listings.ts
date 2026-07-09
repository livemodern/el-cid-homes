import { createClient } from '@supabase/supabase-js'
import { trimCardPhotos } from './img'
import { unstable_cache } from 'next/cache'
import { TAGS } from '@/lib/cache-tags'

// Server-side equivalent of /api/listings, so grid pages can SSR their cards
// instead of fetching client-side. Query mirrors the API route exactly (same
// columns, filters, ordering, 3yr closed cutoff) so the rendered set is
// identical — this is a pure SSR/SEO change, no behavior change.
const BASE_COLS =
  'mls_id,listing_id,status,property_type,property_subtype,sale_or_lease,list_price,close_price,close_date,beds,baths,sqft,unit_number,street_address,city,state,zip,description,image_urls,days_on_market,hoa_fee,year_built,building_name,latitude,longitude'

type Params = {
  type: 'sale' | 'rent' | null
  status: string | null
  includeRaw: boolean
  closedCutoff: string | null
}

async function run({ type, status, includeRaw, closedCutoff }: Params) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const cols = includeRaw ? `${BASE_COLS},trestle_raw` : BASE_COLS

  let q = sb.from('properties')
    .select(cols)
    .eq('community_slug', 'el-cid-west-palm-beach')
    .eq('dup_suppressed', false)
    .order('status', { ascending: true })
    .order('list_price', { ascending: false })
    .limit(300)

  if (type === 'rent') q = q.lt('list_price', 50000)
  if (type === 'sale') q = q.gte('list_price', 50000)
  if (status) q = q.eq('status', status)

  if (closedCutoff) {
    if (status === 'Closed') q = q.gte('close_date', closedCutoff)
    else q = q.or(`status.neq.Closed,close_date.gte.${closedCutoff}`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = trimCardPhotos((data as any[]) || [])  // card payload cap — see img.ts
  return { listings: rows, count: rows.length }
}

// Cached for parity with the API route; same tag so the nightly sync's
// revalidation invalidates both. include_raw skips cache (entries >2MB).
// Key bumped :grid → :grid-v2 (2026-07-02) to flush pre-trim cached
// entries after the card-payload photo cap landed — otherwise stale
// full-gallery payloads serve for up to an hour post-deploy.
const cached = unstable_cache(run, ['listings:el-cid:grid-v2'], {
  tags: [TAGS.LISTINGS_TCP],
  revalidate: 3600,
})

export async function getGridListings(
  { type = null, status = null, includeRaw = false }:
  { type?: 'sale' | 'rent' | null; status?: string | null; includeRaw?: boolean },
): Promise<{ listings: any[]; count: number }> {
  // Compute the 3yr cutoff outside the cached fn so the cache key is stable
  // for the whole calendar day (matches the API handler).
  let closedCutoff: string | null = null
  if (status === 'Closed' || type === 'sale') {
    const t = new Date()
    t.setFullYear(t.getFullYear() - 3)
    closedCutoff = t.toISOString().slice(0, 10)
  }
  const params: Params = { type, status, includeRaw, closedCutoff }
  return includeRaw ? run(params) : cached(params)
}
