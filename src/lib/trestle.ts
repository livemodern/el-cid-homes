const TOKEN_URL = 'https://api.cotality.com/trestle/oidc/connect/token';
const DATA_URL  = 'https://api.cotality.com/trestle/odata/Property';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) return cachedToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.TRESTLE_CLIENT_ID!,
    client_secret: process.env.TRESTLE_CLIENT_SECRET!,
    scope: 'api',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) throw new Error('Trestle auth failed: ' + res.status + ' ' + await res.text());
  const data: any = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return cachedToken as string;
}


// Async generator — yields each page of Trestle results as soon as it arrives,
// instead of buffering everything in memory. The sync route processes each
// page (upsert to DB) before pulling the next, so peak memory stays bounded
// regardless of total inventory size. This is the OOM fix for storing
// trestle_raw with all ~750 fields per record.
//
// Yielded value: { page, batch, hasMore } so the caller can checkpoint a
// resume cursor after each successful page-write.
export async function* paginatedFetchStream(
  filter: string,
  includeMedia: boolean,
  maxPages: number,
  startPage: number = 0,
  // 'desc' (default) = newest-modified first. The nightly ACTIVE stream
  // passes 'asc' (stale-first): the least-recently-modified listings are
  // exactly the ones delta sync never touches, so they must be scanned
  // FIRST. If the time budget truncates the run, the lost tail is then
  // the recently-modified set, which delta re-covers within 15 minutes.
  // CLOSED stays desc: 580k+ records vs a 20k/night window means we want
  // the most recent modifications, not 2009's.
  orderBy: 'ModificationTimestamp desc' | 'ModificationTimestamp asc' = 'ModificationTimestamp desc',
): AsyncGenerator<{ page: number; batch: any[]; hasMore: boolean; capped: boolean }, void, unknown> {
  const pageSize = 100;
  let url: string | null = null;

  // If resuming from page N, fast-forward URL to the right $skip cursor.
  // Trestle's @odata.nextLink isn't deterministic across requests, so we
  // build the skip param ourselves on the first call.

  for (let page = startPage; page < maxPages; page++) {
    const params = new URLSearchParams({
      '$filter': filter,
      '$top': String(pageSize),
      '$orderby': orderBy,
    });
    if (includeMedia) params.set('$expand', 'Media($select=MediaURL,Order;$orderby=Order asc)');

    // First iteration of this generator call: build URL with $skip from startPage.
    // After that, follow @odata.nextLink which Trestle returns.
    if (page === startPage) {
      const skip = startPage * pageSize;
      url = skip > 0
        ? DATA_URL + '?' + params.toString() + '&$skip=' + skip
        : DATA_URL + '?' + params.toString();
    }
    if (!url) break;

    // H2 fix (2026-06-06 audit): a non-2xx mid-pagination used to
    // console.error + break, which returned a PARTIAL set that callers
    // logged as a successful 'full' sync — silent data loss. Retry
    // transient failures with backoff, then THROW so callers fail loudly
    // (the sync routes catch stream errors, log 'partial-error', and keep
    // the cursor so the next run resumes from the failed page).
    //
    // getToken() is called per attempt (cached, so usually free): the old
    // capture-once-per-stream token expired mid-run on long 720s syncs
    // and every later page 401'd into the silent-break path. A 401 now
    // clears the cache and re-auths.
    let res: Response | null = null;
    for (let attempt = 0; ; attempt++) {
      const token = await getToken();
      res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
      if (res.ok) break;
      if (res.status === 401) {
        cachedToken = null;  // force re-auth on the retry
      }
      if (attempt >= 3) {
        throw new Error(`Trestle fetch failed at page ${page} after ${attempt + 1} attempts: ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
    const data: any = await res.json();
    const batch: any[] = data.value || [];

    // Determine if more pages exist before yielding (so consumer can decide to stop)
    const nextLink = data['@odata.nextLink'];
    const moreDataExists = !!nextLink && batch.length === pageSize;
    const hasMore = moreDataExists && page + 1 < maxPages;
    // M1: hitting maxPages with data still remaining used to be
    // indistinguishable from a natural end — callers cleared their resume
    // cursor and logged 'full' while silently truncating. `capped` lets
    // them log 'partial-cap' and keep the cursor instead.
    const capped = moreDataExists && page + 1 >= maxPages;

    yield { page, batch, hasMore, capped };

    if (!hasMore) break;
    url = nextLink;
  }
}

// Backward-compat wrapper — buffers all pages. Kept for delta sync (small
// payload, fits in memory easily). Full sync should use paginatedFetchStream.
async function paginatedFetch(filter: string, includeMedia: boolean, maxPages: number) {
  const all: any[] = [];
  for await (const { batch } of paginatedFetchStream(filter, includeMedia, maxPages)) {
    all.push(...batch);
  }
  return all;
}

export async function fetchTwoPlazaListings() {
  return paginatedFetch("OriginatingSystemSubName eq 'BEACH_BEACH' and PostalCode eq '33401'", true, 5);
}

export async function fetchPBCActive() {
  return paginatedFetch(
    "OriginatingSystemSubName eq 'BEACH_BEACH' and (CountyOrParish eq 'Palm Beach' or CountyOrParish eq 'Martin' or City eq 'Palm City') and (StandardStatus eq 'Active' or StandardStatus eq 'Pending')",
    true, 60
  );
}

export async function fetchPBCAll() {
  const [active, historical] = await Promise.all([
    paginatedFetch(PBC_ACTIVE_FILTER,  true,  PBC_ACTIVE_MAX_PAGES),
    paginatedFetch(PBC_CLOSED_FILTER,  false, PBC_CLOSED_MAX_PAGES),
  ]);
  return [...active, ...historical];
}

// NOTE (pinned 2026-06-03, county scope updated 2026-06-06): All Property
// queries stay scoped to OriginatingSystemSubName eq 'BEACH_BEACH' so the June 9
// 2026 Trestle BEACH+SEFMIAMI unification does NOT leak Broward/Miami in.
// Geographic scope: CountyOrParish in (Palm Beach, Martin) PLUS City eq Palm City.
// 2026-06-20: BeachesMLS tags the North-Fork communities physically in Palm City
// (Harbour Ridge Yacht and CC + ~240 others) with CountyOrParish St Lucie, so the
// county-only gate dropped them. City eq Palm City (still BEACH_BEACH-pinned)
// recovers exactly those without importing the rest of St Lucie (124k rows).
// Do NOT add 'BEACH_MIAMI'/Broward here (deliberately excluded ahead of the merge).
// ─── Filter constants used by both buffered and streaming paths ───────
// EXCLUDED AREAS (Patrick, 2026-06-06): we don't do business in the Glades /
// Lake Okeechobee communities — Belle Glade (33430), Pahokee (33476),
// South Bay (33493), Canal Point (33438). Zip-based (city spellings vary in
// MLS data). Null PostalCode rows pass `ne` in OData and stay included.
// Also excluded in: scripts/migrate-images-to-r2.mjs, scripts/
// backfill-closed-photos.mjs, api/sync/closed-photo-backfill-cron.
export const EXCLUDED_ZIPS = ['33430', '33476', '33493', '33438'];
const ZIP_EXCLUSION = EXCLUDED_ZIPS.map(z => `PostalCode ne '${z}'`).join(' and ');

export const PBC_ACTIVE_FILTER =
  `OriginatingSystemSubName eq 'BEACH_BEACH' and (CountyOrParish eq 'Palm Beach' or CountyOrParish eq 'Martin' or City eq 'Palm City') and ${ZIP_EXCLUSION} and (StandardStatus eq 'Active' or StandardStatus eq 'Pending' or StandardStatus eq 'ActiveUnderContract' or StandardStatus eq 'ComingSoon')`;
export const PBC_CLOSED_FILTER =
  `OriginatingSystemSubName eq 'BEACH_BEACH' and (CountyOrParish eq 'Palm Beach' or CountyOrParish eq 'Martin' or City eq 'Palm City') and ${ZIP_EXCLUSION} and (StandardStatus eq 'Closed' or StandardStatus eq 'Withdrawn' or StandardStatus eq 'Expired')`;
// Page size is 100 (see paginatedFetchStream), so MAX_PAGES x 100 = row cap.
// 2026-06-05: county active-filter count is 22,171 — the old 160-page cap
// (16,000 rows) silently cut off ~6,200 actives every night, and with desc
// ordering the cut fell on the least-recently-modified listings (the Unit
// 117 staleness bug). 240 pages = 24,000 cap with growth headroom. Revisit
// if the active count approaches 24k (check sync_log 'partial-time' rates).
export const PBC_ACTIVE_MAX_PAGES  = 280;   // 28,000 cap — PB+Martin active = 24,139 (2026-06-06), headroom for growth
export const PBC_CLOSED_MAX_PAGES  = 230;   // 23,000 cap — PB+Martin + Palm City (St-Lucie-tagged North Fork incl. Harbour Ridge)

const toInt = (v: any) => (v == null ? null : Math.round(Number(v)));
// Drop bogus MLS values that overflow the column (e.g. $12M HOA fees)
const sane = (v: number | null, max: number) => (v == null || v > max || v < 0 ? null : v);
// H4: agents fat-finger impossible dates into the MLS (CloseDate years
// 1899/2104/2899 verified live) and they poison close_date DESC sales
// sorts. Reject anything outside a plausible window → null.
const saneDate = (v: any) => {
  if (!v) return null;
  const y = new Date(v).getFullYear();
  return Number.isFinite(y) && y >= 1990 && y <= new Date().getFullYear() + 1 ? v : null;
};


// Palm Beach County — Active listings modified in last N hours (hourly delta sync)
export async function fetchPBCDelta(hoursBack: number = 0.5) {  // 30 min — runs every 15 min so 2x overlap is plenty
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, 'Z');
  // Old filter was narrowed to StandardStatus='Active' + ModificationTimestamp,
  // which missed two real photo-update cases:
  //   1. Listings whose photos changed but whose ModificationTimestamp didn't
  //      tick (PhotosChangeTimestamp is independent in BeachesMLS).
  //   2. Photo edits on Pending / AUC / ComingSoon listings — these had to
  //      wait up to 24h for the next full sync.
  // New filter catches either-or, regardless of status. Volume goes up a
  // modest 2-3x, still well under the cap.
  return paginatedFetch(
    `OriginatingSystemSubName eq 'BEACH_BEACH' and (CountyOrParish eq 'Palm Beach' or CountyOrParish eq 'Martin' or City eq 'Palm City') and ${ZIP_EXCLUSION} and (ModificationTimestamp gt ${since} or PhotosChangeTimestamp gt ${since})`,
    true,
    // M8: was 20 pages (2,000 rows) while the comment claimed 4,000. Now
    // that the lookback is anchored to the last logged delta (it can
    // stretch to 24h after an outage), give it real headroom: 40 pages =
    // 4,000 rows. A capped fetch is no longer silent either (H2/M1).
    40
  );
}


// ─── Building Registry ────────────────────────────────────────────────
// Source of truth is the `building_registry` table in Supabase. Admins
// (or a future mlg-admin UI) add rows there without code deploys.
//
// Hot path: processListing() runs sync against an in-memory copy of the
// registry. ensureBuildingRegistry() refreshes that copy with a 60s TTL —
// long enough that a multi-minute sync only hits the DB once, short
// enough that a SQL-editor INSERT shows up on the next sync run.
//
// Match precedence: street_patterns (startsWith on UnparsedAddress, with
// optional city safety) → mls_name_aliases (substring on SubdivisionName).
// First hit wins.

type BuildingEntry = {
  canonical_name:   string;
  street_patterns:  string[];
  city:             string | null;
  site_slug:        string | null;
  mls_name_aliases: string[] | null;
};

let registryEntries: BuildingEntry[] = [];
let registryLoadedAt = 0;
let registryReady = false;     // flips true on the first successful load
const REGISTRY_TTL_MS = 60_000;

export async function ensureBuildingRegistry(force = false): Promise<void> {
  if (!force && Date.now() - registryLoadedAt < REGISTRY_TTL_MS && registryReady) return;
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await sb
    .from('building_registry')
    .select('canonical_name, street_patterns, city, site_slug, mls_name_aliases')
    .eq('active', true);
  if (error) {
    // Keep the prior cache rather than wipe it — a single failed refresh
    // shouldn't drop building_name to null on every listing of the run.
    // If we've never had a successful load, processListing will detect
    // !registryReady and omit building_name from the upsert so the
    // existing value in Postgres is preserved (see below).
    console.error('[trestle] building_registry refresh failed:', error.message);
    return;
  }
  registryEntries = (data || []) as BuildingEntry[];
  registryLoadedAt = Date.now();
  registryReady = true;
}

// Exposed for processListing's preservation guard — kept internal,
// not re-exported.
function isRegistryReady() { return registryReady; }

function matchBuilding(addr: string, subdivisionName: string | null, city: string | null) {
  // Address pattern path — primary.
  for (const b of registryEntries) {
    if (b.city && city && b.city.toLowerCase() !== city.toLowerCase()) continue;
    for (const pat of b.street_patterns) {
      if (pat && addr.startsWith(pat)) return b;
    }
  }
  // MLS-name fallback — only checked when address didn't match. Catches
  // transitional listings whose street_pattern hasn't been added yet
  // but whose MLS SubdivisionName / developer record we recognize.
  if (subdivisionName) {
    const sub = subdivisionName.toLowerCase();
    for (const b of registryEntries) {
      if (!b.mls_name_aliases) continue;
      for (const alias of b.mls_name_aliases) {
        if (alias && sub.includes(alias.toLowerCase())) return b;
      }
    }
  }
  return null;
}

export function processListing(raw: any) {
  const imageUrlsArr = (raw.Media || [])
    .sort((a: any, b: any) => (a.Order || 0) - (b.Order || 0))
    .map((m: any) => m.MediaURL)
    .filter(Boolean);
  // Store null (not []) when no photos — lets the backfill query find them via IS NULL
  const imageUrls = imageUrlsArr.length > 0 ? imageUrlsArr : null;
  const addr = raw.UnparsedAddress || '';
  // Match against the cached building_registry. The async loader
  // ensureBuildingRegistry() must run before any sync route enters
  // its processListing loop (call sites at api/sync/*).
  //
  // Safety: if the registry has never loaded successfully (table missing,
  // initial deploy before migration, transient DB failure), we omit
  // building_name + site_slug from the returned object so the upsert
  // doesn't blow away the values already in Postgres. This makes the
  // migration → deploy ordering forgiving.
  const building = isRegistryReady()
    ? matchBuilding(addr, raw.SubdivisionName || null, raw.City || null)
    : null;
  const buildingFields = isRegistryReady()
    ? { building_name: building?.canonical_name || null, site_slug: building?.site_slug || null }
    : {};
  return {
    mls_id:                     raw.ListingKey,
    listing_id:                 raw.ListingId,
    ...buildingFields,
    status:                     raw.StandardStatus || 'Unknown',
    list_price:                 raw.ListPrice || null,
    close_price:                raw.ClosePrice || null,
    original_list_price:        raw.OriginalListPrice || null,
    // ?? not ||: studios have BedroomsTotal=0 and `0 || null` erased them
    // (1,200 active null-beds rows verified live before this fix — M2).
    beds:                       raw.BedroomsTotal ?? null,
    baths:                      raw.BathroomsTotalInteger ?? null,
    sqft:                       sane(toInt(raw.LivingArea), 1_000_000),
    unit_number:                raw.UnitNumber || null,
    street_address:             addr || null,
    city:                       raw.City || null,
    state:                      raw.StateOrProvince || 'FL',
    zip:                        raw.PostalCode || null,
    latitude:                   raw.Latitude || null,
    longitude:                  raw.Longitude || null,
    description:                raw.PublicRemarks || null,
    image_urls:                 imageUrls,
    // DOM is a two-mode value. Patrick's pair of bugs (2026-05-26..27):
    //   • Active / ComingSoon: Trestle's DaysOnMarket only refreshes when
    //     the listing is modified, so it goes stale and the 'New' badge
    //     (<=7) sticks on listings that have actually been sitting for
    //     weeks. For these we compute today − OnMarketDate ourselves.
    //   • Pending / AUC / Closed: Trestle's DaysOnMarket is correctly
    //     frozen at the value it had when the listing went off-market,
    //     which is what users expect to see ("this sold after 2 days").
    //     Our earlier "compute from OnMarketDate" formula kept climbing
    //     past the freeze, so a 2-day Pending looked like 27.
    // Number.isFinite guard: a malformed OnMarketDate parsed to NaN and
    // NaN'd the whole expression. Falls back to Trestle's own value.
    days_on_market:             (raw.StandardStatus === 'Active' || raw.StandardStatus === 'ComingSoon') && Number.isFinite(new Date(raw.OnMarketDate ?? NaN).getTime())
                                  ? Math.max(0, Math.floor((Date.now() - new Date(raw.OnMarketDate).getTime()) / 86_400_000))
                                  : (raw.DaysOnMarket ?? raw.CumulativeDaysOnMarket ?? null),
    hoa_fee:                    sane(toInt(raw.AssociationFee), 100_000),
    year_built:                 raw.YearBuilt || null,
    property_subtype:           raw.PropertySubType || null,
    list_agent_name:            raw.ListAgentFullName || null,
    list_agent_mls_id:          raw.ListAgentMlsId || null,
    co_list_agent_mls_id:       raw.CoListAgentMlsId || null,
    co_list_agent_name:         raw.CoListAgentFullName || null,
    list_agent_phone:           raw.ListAgentDirectPhone || null,
    list_agent_email:           raw.ListAgentEmail || null,
    co_list_agent_phone:        raw.CoListAgentDirectPhone || null,
    co_list_agent_email:        raw.CoListAgentEmail || null,
    buyer_agent_phone:          raw.BuyerAgentDirectPhone || null,
    buyer_agent_email:          raw.BuyerAgentEmail || null,
    buyer_agent_mls_id:         raw.BuyerAgentMlsId || null,
    buyer_agent_name:           raw.BuyerAgentFullName || null,
    co_buyer_agent_mls_id:      raw.CoBuyerAgentMlsId || null,
    list_office_name:           raw.ListOfficeName || null,
    list_office_key:            raw.ListOfficeKey || null,
    mls_modification_timestamp: raw.ModificationTimestamp || null,
    close_date:                 saneDate(raw.CloseDate),
    lease_close_date:           saneDate(raw.LeaseSignedDate) || saneDate(raw.OffMarketDate),

    // ── Phase 1: detail-page foundation ──────────────────────────────────
    // Top-level type — distinguishes sale ('Residential') from rental
    // ('Residential Lease') from raw land ('Land'). Drives template routing.
    property_type:              raw.PropertyType || null,

    // Lot size — both representations stored. Trestle returns acres as a
    // float (0.25) and sqft as an integer; we coerce defensively.
    lot_size_acres:             raw.LotSizeAcres != null ? Number(raw.LotSizeAcres) : null,
    lot_size_sqft:              toInt(raw.LotSizeSquareFeet),

    // Pool — boolean for filtering, features string for display.
    pool_private:               raw.PoolPrivateYN != null ? Boolean(raw.PoolPrivateYN) : null,
    pool_features:              raw.PoolFeatures || null,

    // Waterfront — same pattern.
    waterfront:                 raw.WaterfrontYN != null ? Boolean(raw.WaterfrontYN) : null,
    waterfront_features:        raw.WaterfrontFeatures || null,

    // View — comma-joined string (e.g. 'Ocean,Pool,Garden').
    view:                       raw.View || null,

    // Parking — both reported separately. ParkingTotal is the headline number.
    garage_spaces:              toInt(raw.GarageSpaces),
    parking_total:              toInt(raw.ParkingTotal),

    // Building structure.
    stories:                    toInt(raw.StoriesTotal),

    // Rental-relevant on lease listings, harmless on sales.
    furnished:                  raw.Furnished || null,

    // Tax info — sane() guards against the rare $99M tax bug we've seen.
    tax_annual:                 raw.TaxAnnualAmount != null ? Number(raw.TaxAnnualAmount) : null,
    tax_year:                   toInt(raw.TaxYear),

    // Condo / development metadata.
    subdivision_name:           raw.SubdivisionName || null,
    direction_faces:            raw.DirectionFaces || null,
    architectural_style:        raw.ArchitecturalStyle || null,

    // ── Phase 1.5: cleaner rent/sale signal + total sqft + rental basics ──
    // SaleOrLeaseIndicator is the canonical Trestle signal — atomic 'Sale' or
    // 'Lease', not muddled with property kind. Detail page uses this as the
    // primary rent/sale check, with property_type as fallback for old data.
    sale_or_lease:              raw.SaleOrLeaseIndicator || null,

    // BuildingAreaTotal = total under roof (garage, lanai included).
    // LivingArea (already mapped to sqft above) = interior heated/cooled.
    // Detail page labels these 'Inside Sq Ft' and 'Total Sq Ft'.
    building_area_total:        toInt(raw.BuildingAreaTotal),

    // Rental-specific. Harmless null on sale listings.
    lease_amount_frequency:     raw.LeaseAmountFrequency || null,
    availability_date:          raw.AvailabilityDate || null,
    tenant_pays:                raw.TenantPays || null,

    // ── Phase 4: derived boolean amenity flags used by /search filters ──
    // These power the "Must Have Pool / Waterfront / etc." checkboxes in
    // the search drawer. Stage 1 of the amenity filter used description
    // ILIKE; these structured columns let us flip to fast indexed lookups.
    // Critical: ALWAYS return a boolean (never null) so missing Trestle
    // data shows as 'doesn't have it' instead of 'unknown', and so a
    // bulk SQL UPDATE never leaves the column null.
    parking_spaces:             toInt(raw.ParkingTotal) ?? toInt(raw.GarageSpaces),
    // Boolean() wrap: the trailing &&-chain evaluates to undefined when
    // the source field is missing, and undefined keys get DROPPED from
    // the upsert payload — violating the always-boolean invariant above
    // and making row shapes diverge (see groupByShape in lib/db.ts).
    has_pool:                   Boolean(raw.PoolPrivateYN === true || raw.PoolPrivateYN === 'true'
                                  || (raw.PoolFeatures && String(raw.PoolFeatures).length > 0
                                      && !/^none$/i.test(String(raw.PoolFeatures)))),
    has_waterfront:             raw.WaterfrontYN === true || raw.WaterfrontYN === 'true',
    has_garage:                 raw.GarageYN === true || raw.GarageYN === 'true'
                                  || (Number(raw.GarageSpaces) || 0) > 0,
    has_elevator:               hasCsv(raw.InteriorFeatures, 'Elevator')
                                  || hasCsv(raw.AssociationAmenities, 'Elevator'),
    has_dock:                   hasCsv(raw.WaterfrontFeatures, 'Dock')
                                  || hasCsv(raw.ExteriorFeatures, 'Dock'),
    has_gated:                  hasCsv(raw.SecurityFeatures, 'Gated'),
    has_hurricane_impact:       hasCsv(raw.WindowFeatures, 'Impact')
                                  || hasCsv(raw.WindowFeatures, 'Hurricane')
                                  || hasCsv(raw.ExteriorFeatures, 'Impact')
                                  || hasCsv(raw.ExteriorFeatures, 'Hurricane'),
    has_furnished:              /^furnished$/i.test(String(raw.Furnished || '')),
    has_washer_dryer:           hasCsv(raw.LaundryFeatures, 'WasherDryer')
                                  || (hasCsv(raw.Appliances, 'Washer') && hasCsv(raw.Appliances, 'Dryer')),
    has_air_conditioning:       Boolean(raw.CoolingYN === true || raw.CoolingYN === 'true'
                                  || (raw.Cooling && String(raw.Cooling).length > 0
                                      && !/^none$/i.test(String(raw.Cooling)))),

    // ── Win 3 / Phase 1: flat columns for the listing-detail engine ────────
    // The mlg-site engine used to read these from listing.trestle_raw.* at
    // every render — fat JSON pulled into a hot SSR path. These columns
    // mirror the raw values so the SELECT on the detail page can stay
    // lean. CSV arrays get joined verbatim; strings pass through. The
    // rendering layer humanizes ("CeramicTile,Wood" → "Ceramic Tile, Wood").
    // Patrick 2026-06-18.
    flooring:                   _csvOrText(raw.Flooring),
    hoa_includes:               _csvOrText(raw.AssociationFeeIncludes),
    building_amenities:         _csvOrText(raw.AssociationAmenities),
    construction_materials:     _csvOrText(raw.ConstructionMaterials),
    parking_features:           _csvOrText(raw.ParkingFeatures),
    elementary_school:          raw.ElementarySchool || null,
    middle_school:              raw.MiddleOrJuniorSchool || null,
    high_school:                raw.HighSchool || null,
    entry_level:                raw.EntryLevel != null && raw.EntryLevel !== '' ? String(raw.EntryLevel) : null,
    pets_allowed_raw:           raw.PetsAllowed || null,
    max_pet_weight:             toInt(raw.MaximumPetWeight),
    max_pet_count:              toInt(raw.MaximumNumberOfPets),

    // Win 3 / Phase 2 — multifamily / land / rental fields the engine
    // also reads from raw. Without these flat, dropping trestle_raw from
    // the listing detail SELECT would blank out multifamily + land
    // pages. Patrick 2026-06-18.
    security_deposit:           _toNum(raw.SecurityDeposit),
    pet_deposit:                _toNum(raw.PetDeposit),
    gross_income:               _toNum(raw.GrossIncome),
    net_operating_income:       _toNum(raw.NetOperatingIncome),
    units_total:                toInt(raw.NumberOfUnitsTotal),
    zoning:                     raw.Zoning || null,
    lot_size_dimensions:        raw.LotSizeDimensions || null,
    lot_features:               _csvOrText(raw.LotFeatures),
    number_of_lots:             toInt(raw.NumberOfLots),
    utilities:                  _csvOrText(raw.Utilities),
    water_source:               _csvOrText(raw.WaterSource),
    sewer:                      _csvOrText(raw.Sewer),
    road_surface:               _csvOrText(raw.RoadSurfaceType),
    road_frontage:              _csvOrText(raw.RoadFrontageType),

    // ── Phase 3+: store entire Trestle record as JSONB ────────────────────
    // Still here — the engine needs it during the transition window
    // (until mlg-site refactors to read from flat columns above and the
    // backfill catches up). Patrick 2026-06-18: target is to drop this
    // from the listing-detail SELECT entirely. Will stay in the sync
    // payload for the foreseeable future as a debug + future-proofing
    // safety net.
    trestle_raw:                raw,
  };
}

// Trestle returns CSV-ish fields sometimes as `string`, sometimes as
// `string[]`. processListing's flat-column branch normalizes them all
// to a single comma-joined string (or null).
function _csvOrText(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const joined = v.filter(x => x != null && String(x).trim() !== '').join(',');
    return joined.length > 0 ? joined : null;
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

// Numeric coerce that tolerates string / numeric / null / '' inputs.
// Used by the Phase 2 dollar / count fields (gross_income, NOI, deposits,
// units_total when float). Returns null on any non-finite result so the
// column stays clean for downstream BI.
function _toNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Case-insensitive substring check on a comma-or-array CSV field.
// Returns false (not undefined) when the source is missing — so the
// has_* derivations above always end up boolean.
function hasCsv(val: any, needle: string): boolean {
  if (!val) return false;
  const s = Array.isArray(val) ? val.join(',') : String(val);
  return s.toLowerCase().includes(needle.toLowerCase());
}