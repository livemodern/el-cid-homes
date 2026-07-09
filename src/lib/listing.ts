import { createClient } from '@supabase/supabase-js'

// COLS is built by joining an array — a missing comma at a string-concat seam is
// then structurally impossible (the d35491d 'updated_attrestle_raw' incident).
// Includes the denormalized flat field columns the hybrid engine reads first,
// plus trestle_raw for fallback while Claude Code's backfill is in flight. Once
// backfill is 100%, trestle_raw can be removed from this list for the speed win.
const COL_LIST = [
  'mls_id', 'listing_id', 'list_price', 'original_list_price', 'close_price',
  'beds', 'baths', 'sqft', 'building_area_total', 'unit_number', 'street_address',
  'city', 'state', 'zip', 'latitude', 'longitude', 'description', 'image_urls', 'status',
  'hoa_fee', 'days_on_market', 'year_built', 'property_subtype', 'property_type',
  'sale_or_lease', 'lease_amount_frequency', 'building_name', 'site_slug', 'community_slug',
  'list_office_name', 'list_agent_name', 'list_agent_email', 'list_agent_mls_id', 'co_list_agent_mls_id',
  'view', 'garage_spaces', 'furnished', 'created_at', 'updated_at',
  // hybrid-engine scalar inputs already columned
  'waterfront', 'waterfront_features', 'pool_private', 'parking_total',
  'subdivision_name', 'architectural_style', 'stories', 'tax_annual', 'tax_year',
  'lot_size_acres', 'lot_size_sqft', 'direction_faces', 'tenant_pays', 'availability_date',
  'lease_type', 'annual_rate', 'seasonal_rate', 'off_season_rate', 'seasonal_min_months',
  // denormalized flat field columns (Claude Code Phase 1+2 backfill)
  'flooring', 'hoa_includes', 'building_amenities', 'construction_materials', 'parking_features',
  'elementary_school', 'middle_school', 'high_school', 'entry_level',
  'pets_allowed_raw', 'max_pet_weight', 'max_pet_count', 'pet_deposit',
  'zoning', 'units_total', 'gross_income', 'net_operating_income', 'lot_size_dimensions',
  'lot_features', 'utilities', 'water_source', 'sewer', 'road_frontage', 'road_surface', 'number_of_lots',
  // Raw-only fields with no flat column — selected as JSONB sub-keys so the
  // ~80-field trestle_raw blob no longer ships on every detail fetch. Safe now
  // that TCP backfill is 100%. VirtualTour → tour button; SecurityDeposit → rentals.
  'vtour_unbranded:trestle_raw->>VirtualTourURLUnbranded',
  'vtour_branded:trestle_raw->>VirtualTourURLBranded',
  'security_deposit_raw:trestle_raw->>SecurityDeposit',
]
const COLS = COL_LIST.join(',')

export interface SimilarCard {
  mls_id: string; price: number | null; beds: number | null; baths: number | null
  sqft: number | null; unit_number: string | null; image: string | null
  images: string[]; photoCount: number; status: string
}
export interface ListingData { l: any; similar: SimilarCard[] }

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function getListing(mlsId: string): Promise<ListingData | null> {
  const sb = db()
  const { data: l } = await sb.from('properties').select(COLS).eq('mls_id', mlsId).maybeSingle()
  if (!l) return null

  // Similar = other El Cid homes, active, priciest first.
  const { data: sim } = await sb.from('properties')
    .select('mls_id,list_price,beds,baths,sqft,unit_number,image_urls,status')
    .eq('community_slug', 'el-cid-west-palm-beach').neq('mls_id', mlsId)
    .in('status', ['Active', 'ComingSoon'])
    .order('list_price', { ascending: false }).limit(8)

  const similar: SimilarCard[] = ((sim ?? []) as any[]).map(p => ({
    mls_id: p.mls_id, price: p.list_price, beds: p.beds, baths: p.baths, sqft: p.sqft,
    unit_number: p.unit_number, status: p.status,
    image: Array.isArray(p.image_urls) && p.image_urls[0] ? p.image_urls[0] : null,
    images: Array.isArray(p.image_urls) ? (p.image_urls as string[]).filter(Boolean).slice(0, 5) : [],
    photoCount: Array.isArray(p.image_urls) ? (p.image_urls as string[]).filter(Boolean).length : 0,
  })).slice(0, 4)

  return { l, similar }
}
