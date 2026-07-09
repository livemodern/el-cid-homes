// Type-specific listing detail field engine — ported from twocityplazacondos /
// mlg-search so the server-rendered main site surfaces the same fields.
// Pure functions, no React: safe to call from a server component.

type ListingKind = 'rental' | 'land' | 'sfr' | 'condo' | 'townhouse' | 'multifamily';

function getListingKind(l: any): ListingKind {
  if (l?.sale_or_lease === 'Lease')             return 'rental';
  if (l?.property_type === 'ResidentialLease')  return 'rental';
  if (l?.property_type === 'ResidentialIncome') return 'multifamily';
  if (l?.property_type === 'Land')              return 'land';
  const sub = l?.property_subtype;
  if (sub === 'UnimprovedLand')                 return 'land';
  if (sub === 'Duplex' || sub === 'Triplex' || sub === 'Quadruplex' || sub === 'MultiFamily') return 'multifamily';
  if (sub === 'Condominium' || sub === 'Villa') return 'condo';
  if (sub === 'Townhouse')                      return 'townhouse';
  return 'sfr';
}

function _rentSuffix(freq: string | null): string {
  if (freq === 'Annually') return '/yr';
  if (freq === 'Seasonal') return '/season';
  if (freq === 'OneTime')  return '';
  return '/mo';
}

function _fmtDate(s: any): string | null {
  if (!s) return null;
  try {
    const d = new Date(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

function _humanizeCsv(s: any): string | null {
  if (!s || typeof s !== 'string') return null;
  return s.split(',')
    .map(p => p.trim()
      .replace(/CableTv/gi, 'Cable TV')
      .replace(/([a-z])([A-Z])/g, '$1 $2'))
    .filter(Boolean)
    .join(', ');
}

// Pets — single merged smart label. Accepts the trestle_raw object (preferred, so it
// can fold in the real MaximumPetWeight / MaximumNumberOfPets when present) or a bare
// PetsAllowed string (back-compat). BeachesMLS has no standalone numeric size field on
// most listings, so the SizeLimit/NumberLimit flags are surfaced as words and replaced
// by the actual figure whenever the listing carries one.
function _petsLabel(input: any): string | null {
  const raw: any = (input && typeof input === 'object') ? input : null;
  const s: any = raw ? raw.PetsAllowed : input;
  if (!s || typeof s !== 'string') return null;
  const tokens = s.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  const v = tokens.join(' ');
  const allowed = tokens.includes('yes') || /allowed|true/.test(v);
  if (!allowed && (tokens.includes('no') || /not allowed/.test(v))) return 'Not allowed';
  const wt  = raw ? Number(raw.MaximumPetWeight)    : 0;
  const num = raw ? Number(raw.MaximumNumberOfPets) : 0;
  const notes: string[] = [];
  if (/sizelimit|size limit/.test(v))     notes.push(wt  > 0 ? 'max ' + wt + ' lbs'                       : 'size limit');
  else if (wt  > 0)                        notes.push('max ' + wt + ' lbs');
  if (/numberlimit|number limit/.test(v)) notes.push(num > 0 ? 'max ' + num + (num === 1 ? ' pet' : ' pets') : 'number limit');
  else if (num > 0)                        notes.push('max ' + num + (num === 1 ? ' pet' : ' pets'));
  if (/restrict/.test(v))                 notes.push('restrictions');
  if (/breed/.test(v))                    notes.push('breed restrictions');
  if (/petfee|fee/.test(v))               notes.push('fee');
  if (allowed) return notes.length ? 'Allowed (' + notes.join(', ') + ')' : 'Allowed';
  return _humanizeCsv(s);
}

function _fmtLotSize(l: any): string | null {
  if (l?.lot_size_acres) {
    const a = Number(l.lot_size_acres);
    if (a >= 1)   return a.toFixed(2).replace(/\.?0+$/, '') + ' acres';
    if (a > 0)    return a.toFixed(2) + ' acres';
  }
  if (l?.lot_size_sqft) return Number(l.lot_size_sqft).toLocaleString() + ' sq ft';
  return null;
}

// ── Multifamily investor helpers ──────────────────────────────────────────
// Cap rate + GRM are NOT in the BeachesMLS feed, but are derivable from
// NetOperatingIncome / GrossIncome against list price. Both are gated to a
// believable band so the occasional junk income value (e.g. NOI = 3) is dropped.
function _money(n: any): string { return '$' + Math.round(Number(n)).toLocaleString(); }
function _sanePos(n: any, min = 1): number | null {
  const x = Number(n);
  return isFinite(x) && x >= min ? x : null;
}
function _capRate(l: any): string | null {
  const raw = _hy(l);
  const noi = Number(raw.NetOperatingIncome);
  const price = Number(l?.list_price);
  if (!(noi > 0) || !(price > 0)) return null;
  const r = noi / price;
  if (r < 0.005 || r > 0.20) return null;
  return (r * 100).toFixed(2) + '%';
}
function _grm(l: any): string | null {
  const raw = _hy(l);
  const gi = Number(raw.GrossIncome);
  const price = Number(l?.list_price);
  if (!(gi >= 1000) || !(price > 0)) return null;
  const g = price / gi;
  if (g < 1 || g > 50) return null;
  return g.toFixed(1);
}

type DetailResult = {
  kind: ListingKind;
  heroPills: { l: string; v: any }[];
  mainFields: [string, string | number][];
  moreFields: [string, string | number][];
};

// ── Hybrid field source ───────────────────────────────────────────────────
// Prefer denormalized flat columns (fast, no JSONB parse); fall back to the
// trestle_raw key while the backfill is in flight. Once every rendered field is
// backfilled, trestle_raw can be dropped from the listing query entirely.
function _hy(l: any): any {
  const r = (l && l.trestle_raw) || {};
  return {
    ...r,
    Flooring:               l?.flooring               ?? r.Flooring,
    AssociationFeeIncludes: l?.hoa_includes           ?? r.AssociationFeeIncludes,
    AssociationAmenities:   l?.building_amenities      ?? r.AssociationAmenities,
    ConstructionMaterials:  l?.construction_materials  ?? r.ConstructionMaterials,
    ParkingFeatures:        l?.parking_features        ?? r.ParkingFeatures,
    ElementarySchool:       l?.elementary_school       ?? r.ElementarySchool,
    MiddleOrJuniorSchool:   l?.middle_school           ?? r.MiddleOrJuniorSchool,
    HighSchool:             l?.high_school             ?? r.HighSchool,
    EntryLevel:             l?.entry_level             ?? r.EntryLevel,
    PetsAllowed:            l?.pets_allowed_raw         ?? r.PetsAllowed,
    MaximumPetWeight:       l?.max_pet_weight           ?? r.MaximumPetWeight,
    MaximumNumberOfPets:    l?.max_pet_count            ?? r.MaximumNumberOfPets,
    PetDeposit:             l?.pet_deposit              ?? r.PetDeposit,
    Zoning:                 l?.zoning                   ?? r.Zoning,
    NumberOfUnitsTotal:     l?.units_total              ?? r.NumberOfUnitsTotal,
    GrossIncome:            l?.gross_income             ?? r.GrossIncome,
    NetOperatingIncome:     l?.net_operating_income     ?? r.NetOperatingIncome,
    LotSizeDimensions:      l?.lot_size_dimensions      ?? r.LotSizeDimensions,
    LotFeatures:            l?.lot_features             ?? r.LotFeatures,
    Utilities:              l?.utilities                ?? r.Utilities,
    WaterSource:            l?.water_source             ?? r.WaterSource,
    Sewer:                  l?.sewer                    ?? r.Sewer,
    RoadSurfaceType:        l?.road_surface             ?? r.RoadSurfaceType,
    RoadFrontageType:       l?.road_frontage            ?? r.RoadFrontageType,
    NumberOfLots:           l?.number_of_lots           ?? r.NumberOfLots,
    TenantPays:             l?.tenant_pays              ?? r.TenantPays,
    Stories:                l?.stories                  ?? r.Stories,
    SecurityDeposit:        l?.security_deposit_raw     ?? r.SecurityDeposit,
  };
}

export function propertyDetailsFor(l: any): DetailResult {
  const kind = getListingKind(l);
  const _fmt = (n: any) => (n != null ? '$' + Math.round(Number(n)).toLocaleString() : 'N/A');
  const _ppsf = l?.list_price && l?.sqft ? Math.round(l.list_price / l.sqft) : null;
  const _lot  = _fmtLotSize(l);
  const raw = _hy(l);

  if (kind === 'land')        return _landDetails(l, _fmt, _lot, raw);
  if (kind === 'rental')      return _rentalDetails(l, _fmt, raw);
  if (kind === 'multifamily') return _mfDetails(l, _fmt, raw);

  // ── SFR / CONDO / TOWNHOUSE (for-sale) ──
  const heroPills: { l: string; v: any }[] = [{ l: 'Price', v: _fmt(l?.list_price) }];
  if (l?.beds)  heroPills.push({ l: 'Beds',    v: l.beds });
  if (l?.baths) heroPills.push({ l: 'Baths',   v: l.baths });
  if (l?.sqft)  heroPills.push({ l: 'Sq. Ft.', v: l.sqft.toLocaleString() });

  const mainFields: [string, string | number][] = [];
  mainFields.push(['List Price',    _fmt(l?.list_price)]);
  mainFields.push(['Price / Sq Ft', _ppsf ? '$' + _ppsf : 'N/A']);
  mainFields.push(['Bedrooms',  l?.beds  ?? 'N/A']);
  mainFields.push(['Bathrooms', l?.baths ?? 'N/A']);
  mainFields.push(['Inside Sq Ft', l?.sqft ? l.sqft.toLocaleString() : 'N/A']);

  if (kind === 'condo') {
    mainFields.push(['HOA Fee', l?.hoa_fee ? _money(l.hoa_fee) + '/mo' : 'N/A']);
    if (raw.EntryLevel != null && raw.EntryLevel !== '') mainFields.push(['Floor', String(raw.EntryLevel)]);
    mainFields.push(['Year Built', l?.year_built ?? 'N/A']);
    const fl = _humanizeCsv(raw.Flooring); if (fl) mainFields.push(['Flooring', fl]);
    const pets = _petsLabel(raw); if (pets) mainFields.push(['Pets', pets]);
    if (l?.building_name || l?.subdivision_name) mainFields.push(['Building', l.building_name || l.subdivision_name]);
  } else if (kind === 'townhouse') {
    mainFields.push(['HOA Fee', l?.hoa_fee ? _money(l.hoa_fee) + '/mo' : 'N/A']);
    if (_lot) mainFields.push(['Lot Size', _lot]);
    mainFields.push(['Year Built', l?.year_built ?? 'N/A']);
    const fl = _humanizeCsv(raw.Flooring); if (fl) mainFields.push(['Flooring', fl]);
    const pets = _petsLabel(raw); if (pets) mainFields.push(['Pets', pets]);
    if (l?.building_name || l?.subdivision_name) mainFields.push(['Building', l.building_name || l.subdivision_name]);
  } else {
    if (_lot) mainFields.push(['Lot Size', _lot]);
    mainFields.push(['Year Built', l?.year_built ?? 'N/A']);
    mainFields.push(['Pool', l?.pool_private ? 'Yes' : 'No']);
    mainFields.push(['Garage', l?.garage_spaces ? String(l.garage_spaces) : (l?.parking_total ? String(l.parking_total) : 'None')]);
    const con = _humanizeCsv(raw.ConstructionMaterials); if (con) mainFields.push(['Construction', con]);
    const fl  = _humanizeCsv(raw.Flooring); if (fl) mainFields.push(['Flooring', fl]);
  }
  mainFields.push(['Days on Market', l?.days_on_market ?? 'N/A']);
  mainFields.push(['Property Type',  l?.property_subtype || '—']);
  mainFields.push(['MLS #',          l?.listing_id || l?.mls_id || 'N/A']);

  const moreFields: [string, string | number][] = [];
  moreFields.push(['Status', l?.status || '—']);
  if (l?.original_list_price) moreFields.push(['Original List Price', _fmt(l.original_list_price)]);
  if (l?.close_price)         moreFields.push(['Close Price', _fmt(l.close_price)]);
  if (l?.building_area_total && l.building_area_total !== l.sqft) moreFields.push(['Total Sq Ft', Number(l.building_area_total).toLocaleString()]);
  if (l?.subdivision_name && kind !== 'condo') moreFields.push(['Subdivision', l.subdivision_name]);
  if (kind === 'sfr' && l?.architectural_style) moreFields.push(['Style', l.architectural_style]);
  if (kind === 'sfr') { const pets = _petsLabel(raw); if (pets) moreFields.push(['Pets', pets]); }
  if (l?.stories) moreFields.push(['Stories', l.stories]);
  if (l?.waterfront != null) moreFields.push(['Waterfront', l.waterfront ? 'Yes' : 'No']);
  if (l?.waterfront_features && l.waterfront_features !== 'None') moreFields.push(['Waterfront Features', l.waterfront_features]);
  if (l?.view) moreFields.push(['View', l.view]);
  if (kind === 'condo' || kind === 'townhouse') {
    const inc = _humanizeCsv(raw.AssociationFeeIncludes); if (inc) moreFields.push(['HOA Includes', inc]);
    const am  = _humanizeCsv(raw.AssociationAmenities);   if (am)  moreFields.push(['Building Amenities', am]);
    const pf  = _humanizeCsv(raw.ParkingFeatures); if (pf && !l?.garage_spaces && !l?.parking_total) moreFields.push(['Parking', pf]);
  }
  if (kind !== 'sfr' && l?.garage_spaces)      moreFields.push(['Garage Spaces', l.garage_spaces]);
  else if (kind !== 'sfr' && l?.parking_total) moreFields.push(['Parking', l.parking_total]);
  if (l?.direction_faces) moreFields.push(['Direction Faces', l.direction_faces]);
  if (l?.hoa_fee && kind !== 'condo' && kind !== 'townhouse') moreFields.push(['HOA Fee', _money(l.hoa_fee) + '/mo']);
  if (l?.tax_annual) moreFields.push([l?.tax_year ? 'Annual Taxes (' + l.tax_year + ')' : 'Annual Taxes', _money(l.tax_annual)]);
  if (raw.ElementarySchool)     moreFields.push(['Elementary School', raw.ElementarySchool]);
  if (raw.MiddleOrJuniorSchool) moreFields.push(['Middle School',     raw.MiddleOrJuniorSchool]);
  if (raw.HighSchool)           moreFields.push(['High School',       raw.HighSchool]);
  moreFields.push(['City', l?.city || '—']);
  moreFields.push(['Zip Code', l?.zip || '—']);

  return { kind, heroPills, mainFields, moreFields };
}

// ── MULTIFAMILY (investor sheet) ──────────────────────────────────────────
function _mfDetails(l: any, _fmt: (n: any) => string, raw: any): DetailResult {
  const units = Number(raw.NumberOfUnitsTotal) || null;
  const heroPills: { l: string; v: any }[] = [{ l: 'Price', v: _fmt(l?.list_price) }];
  if (units)   heroPills.push({ l: 'Units',   v: units });
  if (l?.sqft) heroPills.push({ l: 'Sq. Ft.', v: l.sqft.toLocaleString() });

  const mainFields: [string, string | number][] = [];
  mainFields.push(['List Price', _fmt(l?.list_price)]);
  if (units && l?.list_price) mainFields.push(['Price / Unit', _money(l.list_price / units)]);
  if (units) mainFields.push(['Units', units]);
  const _mfPrice = Number(l?.list_price) || 0;
  const cr = _capRate(l); if (cr) mainFields.push(['Cap Rate', cr]);
  const gi = _sanePos(raw.GrossIncome, 1000);
  if (gi && _mfPrice > 0 && _mfPrice / gi >= 1 && _mfPrice / gi <= 50) mainFields.push(['Gross Income', _money(gi) + '/yr']);
  const noi = _sanePos(raw.NetOperatingIncome, 1000);
  if (noi && _mfPrice > 0 && noi <= _mfPrice && noi / _mfPrice >= 0.005 && noi / _mfPrice <= 0.20) mainFields.push(['Net Operating Income', _money(noi)]);
  mainFields.push(['Inside Sq Ft', l?.sqft ? l.sqft.toLocaleString() : 'N/A']);
  mainFields.push(['Year Built', l?.year_built ?? 'N/A']);
  const con = _humanizeCsv(raw.ConstructionMaterials); if (con) mainFields.push(['Construction', con]);
  const fl  = _humanizeCsv(raw.Flooring); if (fl) mainFields.push(['Flooring', fl]);
  if (raw.Zoning) mainFields.push(['Zoning', String(raw.Zoning)]);
  if (raw.LotSizeDimensions) mainFields.push(['Lot Dimensions', String(raw.LotSizeDimensions)]);
  mainFields.push(['Property Type', l?.property_subtype || 'Multi-Family']);
  mainFields.push(['MLS #', l?.listing_id || l?.mls_id || 'N/A']);

  const moreFields: [string, string | number][] = [];
  moreFields.push(['Status', l?.status || '—']);
  if (l?.original_list_price) moreFields.push(['Original List Price', _fmt(l.original_list_price)]);
  if (l?.close_price)         moreFields.push(['Close Price', _fmt(l.close_price)]);
  const grm = _grm(l); if (grm) moreFields.push(['GRM', grm]);
  if (raw.TenantPays) moreFields.push(['Tenant Pays', (String(raw.TenantPays) === 'None') ? 'Owner pays all utilities' : (_humanizeCsv(raw.TenantPays) || 'Owner pays all utilities')]);
  const _st = l?.stories ?? raw.Stories; if (_st) moreFields.push(['Stories', _st]);
  const _lot = _fmtLotSize(l); if (_lot) moreFields.push(['Lot Size', _lot]);
  if (l?.waterfront != null) moreFields.push(['Waterfront', l.waterfront ? 'Yes' : 'No']);
  if (l?.waterfront_features && l.waterfront_features !== 'None') moreFields.push(['Waterfront Features', l.waterfront_features]);
  if (l?.view) moreFields.push(['View', l.view]);
  moreFields.push(['Days on Market', l?.days_on_market ?? 'N/A']);
  if (l?.tax_annual) moreFields.push(['Annual Taxes', _money(l.tax_annual)]);
  moreFields.push(['City', l?.city || '—']);
  moreFields.push(['Zip Code', l?.zip || '—']);

  return { kind: 'multifamily', heroPills, mainFields, moreFields };
}

// ── LAND (rebuilt: dimensions, zoning, lot features, utilities, water, sewer) ──
function _landDetails(l: any, _fmt: (n: any) => string, _lot: string | null, raw: any): DetailResult {
  const heroPills: { l: string; v: any }[] = [{ l: 'Price', v: _fmt(l?.list_price) }];
  if (_lot) heroPills.push({ l: 'Lot Size', v: _lot });

  const mainFields: [string, string | number][] = [];
  mainFields.push(['Price', _fmt(l?.list_price)]);
  if (l?.lot_size_acres) mainFields.push(['Lot Size', Number(l.lot_size_acres).toFixed(2).replace(/\.?0+$/, '') + ' acres']);
  if (l?.lot_size_sqft)  mainFields.push(['Lot Sq Ft', Number(l.lot_size_sqft).toLocaleString()]);
  if (raw.LotSizeDimensions) mainFields.push(['Lot Dimensions', String(raw.LotSizeDimensions)]);
  if (l?.lot_size_acres && l?.list_price) {
    const ppa = Math.round(l.list_price / Number(l.lot_size_acres));
    if (ppa) mainFields.push(['Price / Acre', '$' + ppa.toLocaleString()]);
  }
  if (raw.Zoning) mainFields.push(['Zoning', String(raw.Zoning)]);
  const lf = _humanizeCsv(raw.LotFeatures);  if (lf) mainFields.push(['Lot Features', lf]);
  const ut = _humanizeCsv(raw.Utilities);    if (ut) mainFields.push(['Utilities', ut]);
  const ws = _humanizeCsv(raw.WaterSource);  if (ws) mainFields.push(['Water Source', ws]);
  const sw = _humanizeCsv(raw.Sewer);        if (sw) mainFields.push(['Sewer', sw]);
  mainFields.push(['Days on Market', l?.days_on_market ?? 'N/A']);
  mainFields.push(['Property Type', 'Land']);
  mainFields.push(['Status', l?.status || '—']);
  mainFields.push(['MLS #', l?.listing_id || l?.mls_id || 'N/A']);

  const moreFields: [string, string | number][] = [];
  if (l?.original_list_price) moreFields.push(['Original List Price', _fmt(l.original_list_price)]);
  if (l?.close_price)         moreFields.push(['Close Price', _fmt(l.close_price)]);
  if (l?.subdivision_name)    moreFields.push(['Subdivision', l.subdivision_name]);
  const rs = _humanizeCsv(raw.RoadSurfaceType);  if (rs) moreFields.push(['Road Surface', rs]);
  const rf = _humanizeCsv(raw.RoadFrontageType); if (rf) moreFields.push(['Road Frontage', rf]);
  if (raw.NumberOfLots) moreFields.push(['Number of Lots', raw.NumberOfLots]);
  if (l?.waterfront != null) moreFields.push(['Waterfront', l.waterfront ? 'Yes' : 'No']);
  if (l?.waterfront_features && l.waterfront_features !== 'None') moreFields.push(['Waterfront Features', l.waterfront_features]);
  if (l?.view) moreFields.push(['View', l.view]);
  if (l?.tax_annual) moreFields.push(['Annual Taxes', _money(l.tax_annual)]);
  if (l?.direction_faces) moreFields.push(['Direction Faces', l.direction_faces]);
  moreFields.push(['City', l?.city || '—']);
  moreFields.push(['Zip Code', l?.zip || '—']);

  return { kind: 'land', heroPills, mainFields, moreFields };
}

// ── RENTAL (held at current behavior pending AI seasonal/annual extraction) ──
function _rentalDetails(l: any, _fmt: (n: any) => string, raw: any): DetailResult {
  const heroPills: { l: string; v: any }[] = [{ l: 'Per Month', v: _fmt(l?.list_price) }];
  if (l?.beds)  heroPills.push({ l: 'Beds',    v: l.beds });
  if (l?.baths) heroPills.push({ l: 'Baths',   v: l.baths });
  if (l?.sqft)  heroPills.push({ l: 'Sq. Ft.', v: l.sqft.toLocaleString() });

  const mainFields: [string, string | number][] = [];
  const _suffix = _rentSuffix(l?.lease_amount_frequency);
  const _label = l?.lease_amount_frequency === 'Annually' ? 'Annual Rent'
               : l?.lease_amount_frequency === 'Seasonal' ? 'Seasonal Rent'
               : 'Monthly Rent';
  mainFields.push([_label, _fmt(l?.list_price) + _suffix]);
  mainFields.push(['Bedrooms',  l?.beds  ?? 'N/A']);
  mainFields.push(['Bathrooms', l?.baths ?? 'N/A']);
  mainFields.push(['Inside Sq Ft', l?.sqft ? l.sqft.toLocaleString() : 'N/A']);
  if (l?.building_area_total && l.building_area_total !== l.sqft) {
    mainFields.push(['Total Sq Ft', Number(l.building_area_total).toLocaleString()]);
  }
  mainFields.push(['Year Built', l?.year_built ?? 'N/A']);
  const _avail = _fmtDate(l?.availability_date);
  if (_avail) mainFields.push(['Available', _avail]);
  if (l?.furnished) mainFields.push(['Furnished', l.furnished]);
  if (l?.lease_amount_frequency) mainFields.push(['Lease Term', l.lease_amount_frequency]);
  if (raw.SecurityDeposit) mainFields.push(['Security Deposit', '$' + Math.round(Number(raw.SecurityDeposit)).toLocaleString()]);
  if (raw.PetsAllowed) mainFields.push(['Pets', _petsLabel(raw) || raw.PetsAllowed]);
  if (raw.PetDeposit) mainFields.push(['Pet Deposit', '$' + Math.round(Number(raw.PetDeposit)).toLocaleString()]);
  mainFields.push(['Days on Market', l?.days_on_market ?? 'N/A']);
  mainFields.push(['Property Type',  l?.property_subtype || '—']);
  mainFields.push(['MLS #',          l?.listing_id || l?.mls_id || 'N/A']);

  const moreFields: [string, string | number][] = [];
  moreFields.push(['Status', l?.status || '—']);
  if (l?.subdivision_name) moreFields.push(['Subdivision', l.subdivision_name]);
  if (l?.stories) moreFields.push(['Stories', l.stories]);
  if (l?.pool_private != null) moreFields.push(['Pool', l.pool_private ? 'Yes' : 'No']);
  if (l?.waterfront != null && l.waterfront) moreFields.push(['Waterfront', 'Yes']);
  if (l?.waterfront_features && l.waterfront_features !== 'None') moreFields.push(['Waterfront Features', l.waterfront_features]);
  if (l?.view) moreFields.push(['View', l.view]);
  if (l?.garage_spaces)      moreFields.push(['Garage Spaces', l.garage_spaces]);
  else if (l?.parking_total) moreFields.push(['Parking', l.parking_total]);
  if (l?.direction_faces) moreFields.push(['Direction Faces', l.direction_faces]);
  if (l?.hoa_fee) moreFields.push(['HOA Fee', '$' + Math.round(l.hoa_fee).toLocaleString() + '/mo']);
  const _tp = _humanizeCsv(l?.tenant_pays);
  if (_tp) moreFields.push(['Tenant Pays', _tp]);
  moreFields.push(['City', l?.city || '—']);
  moreFields.push(['Zip Code', l?.zip || '—']);

  return { kind: 'rental', heroPills, mainFields, moreFields };
}
