'use client';

/**
 * Mobile-only search page. Cards + Compass-style filter sheet, no map.
 *
 * Filter layout mirrors compass.com's mobile drawer:
 *   ┌───────────── Close · Filters · Reset ─────────────┐
 *   │ Location:        City dropdown · Zip input        │
 *   │ (primary)        Price · Beds · Baths · Type ☑    │
 *   │ Property Facts   Square Feet · Year Built · HOA   │
 *   │ Listing Status   Status ☑ · Time on Market        │
 *   │              [ See N Homes — black pill ]         │
 *   └───────────────────────────────────────────────────┘
 *
 * Skipped vs Compass (no DB data for these yet):
 *   Lot Size · GreatSchools · Open Houses · Listing Type
 *   Other Amenities (Parking · Stories · Pool · Garage · etc.)
 */

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { slugifyListing } from '@/lib/listing-slug';
import { AccountButton } from '@/components/AccountButton';
import { imgOpt, imgSrcSet } from '@/lib/img';
import LocationSearch, { LocationFilter } from '@/components/LocationSearch';

// ── Brand ────────────────────────────────────────────────────────────────
const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

// ── Pagination ───────────────────────────────────────────────────────────
// Initial fetch grabs PAGE_SIZE listings (~10 mobile viewports of cards),
// then we infinite-scroll the next PAGE_SIZE each time the sentinel near
// the bottom comes into view. Was previously 300 per request, which made
// first paint feel broken on slow connections — every byte had to land
// before any card rendered.
const PAGE_SIZE = 30;

// ── Types ────────────────────────────────────────────────────────────────
type Listing = {
  id: string; mls_id: string; status: string;
  property_type: string | null;       // 'Residential' | 'ResidentialLease' | 'Land' | ...
  property_subtype: string | null;
  list_price: number | null; beds: number | null; baths: number | null;
  sqft: number | null; unit_number: string | null; street_address: string | null;
  city: string | null; state: string | null; zip: string | null;
  latitude: number | null; longitude: number | null;
  image_urls: string[] | null; days_on_market: number | null;
  hoa_fee: number | null; year_built: number | null;
};

type Filters = {
  // Location — city is CSV when multiple selected (e.g. 'Wellington,Boca Raton'),
  // 'Any' (or empty) means no city filter. Mirrors desktop's storage shape.
  city: string;
  zip: string;
  // Primary — beds & baths are Min-only (the Max counterparts existed
  // briefly in 2026-05-26 but were removed 2026-05-27 — they enabled
  // impossible ranges like Min 3 + Max 2 = 0 results).
  priceMin: string; priceMax: string;
  bedsMin: string;
  bathsMin: string;
  propertyTypes: string[];   // labels — expanded to DB enums at fetch time
  // Property Facts
  sqftMin: string; sqftMax: string;
  yearBuiltMin: string; yearBuiltMax: string;
  newConstruction: boolean;
  hoaMax: string;
  // Listing Status
  statuses: string[];        // labels — expanded to DB enums at fetch time
  domMax: string;
};

const MLG_OFFICE_KEY     = '276548547';
const COMPASS_OFFICE_KEYS = new Set([
  '5925495','5920460','5934426','5934638',
  '5930346','5935212','5899875','5929314','5927007','5929702',
]);
function officeRank(key: string | null): number {
  if (key === MLG_OFFICE_KEY) return 0;
  if (key && COMPASS_OFFICE_KEYS.has(key)) return 1;
  return 2;
}

const DEFAULT_FILTERS: Filters = {
  city: 'Any', zip: '',
  priceMin: '', priceMax: '',
  bedsMin: '',
  bathsMin: '',
  propertyTypes: [],
  sqftMin: '', sqftMax: '',
  yearBuiltMin: '', yearBuiltMax: '',
  newConstruction: false,
  hoaMax: '',
  // Default = full On-Market set. Patrick's rule (2026-05-26): buyers
  // searching pre-contract want to see Coming Soon + Active + everything
  // under contract that could fall back to available; only Closed is hidden.
  statuses: ['Coming Soon', 'Active', 'Under Contract/Pending'],
  domMax: '',
};

// ── Option groups ────────────────────────────────────────────────────────
// Each label expands to one or more DB enum values.
const PROPERTY_TYPE_OPTIONS: { label: string; values: string[] }[] = [
  { label: 'Single Family', values: ['SingleFamilyResidence'] },
  { label: 'Condominium',   values: ['Condominium', 'Villa'] },  // Villa folded in
  { label: 'Townhouse',     values: ['Townhouse'] },
  { label: 'Land',          values: ['UnimprovedLand'] },
];

const STATUS_OPTIONS: { label: string; values: string[] }[] = [
  { label: 'Coming Soon',              values: ['ComingSoon'] },
  { label: 'Active',                   values: ['Active'] },
  { label: 'Under Contract/Pending',   values: ['Pending', 'ActiveUnderContract'] },
  { label: 'Sold',                     values: ['Closed'] },
];

// Beds — single Min dropdown. Whole numbers only; label shows '1+' style.
const BED_PRESETS: { label: string; value: string }[] = [
  { label: 'No Min', value: '' },
  { label: '1+', value: '1' }, { label: '2+', value: '2' },
  { label: '3+', value: '3' }, { label: '4+', value: '4' },
  { label: '5+', value: '5' }, { label: '6+', value: '6' },
  { label: '7+', value: '7' },
];

// Baths — Min only, includes half-baths. DB stores `baths` as a single
// decimal (2.5 = 2 full + 1 half), so 2.5+ filters via gte('baths', 2.5).
// No need to combine half-bath / full-bath columns in code.
const BATH_PRESETS: { label: string; value: string }[] = [
  { label: 'No Min', value: '' },
  { label: '1+',   value: '1' },
  { label: '1.5+', value: '1.5' },
  { label: '2+',   value: '2' },
  { label: '2.5+', value: '2.5' },
  { label: '3+',   value: '3' },
  { label: '3.5+', value: '3.5' },
  { label: '4+',   value: '4' },
  { label: '5+',   value: '5' },
];

// Price presets — tier-aware. Sale: $100K–$50M. Rent: $500–$50K/mo.
// Same lists as desktop's MinMaxSelect (SearchPageDesktop.tsx).
const PRICE_PRESETS_SALE = [
  '',
  '100000','125000','150000','175000','200000',
  '225000','250000','275000','300000','325000','350000',
  '375000','400000','425000','450000','475000','500000',
  '550000','600000','650000','700000','750000','800000','850000','900000','950000',
  '1000000','1250000','1500000','1750000','2000000',
  '2500000','3000000','3500000','4000000',
  '5000000','6000000','7500000','10000000',
  '12500000','15000000','20000000','25000000','50000000',
];
const PRICE_PRESETS_RENT = [
  '',
  '500','750','1000','1250','1500','1750','2000',
  '2250','2500','2750','3000','3250','3500','3750','4000',
  '4500','5000','6000','7000','8000','10000',
  '12500','15000','20000','25000','30000','40000','50000',
];

function fmtPricePreset(v: string): string {
  if (!v) return '';
  const n = Number(v);
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toLocaleString(undefined,    { maximumFractionDigits: 1 }) + 'K';
  return '$' + n.toLocaleString();
}

// Time on market presets (Compass uses "Less than N days")
const TIME_ON_MARKET_OPTIONS = [
  { label: 'No Max',         value: '' },
  { label: 'Less than 24h',  value: '1' },
  { label: 'Less than 3 days',  value: '3' },
  { label: 'Less than 7 days',  value: '7' },
  { label: 'Less than 14 days', value: '14' },
  { label: 'Less than 30 days', value: '30' },
  { label: 'Less than 60 days', value: '60' },
  { label: 'Less than 90 days', value: '90' },
];

const HOA_PRESETS = [
  { label: 'No Max',     value: '' },
  { label: '$100/mo',    value: '100' },
  { label: '$250/mo',    value: '250' },
  { label: '$500/mo',    value: '500' },
  { label: '$750/mo',    value: '750' },
  { label: '$1,000/mo',  value: '1000' },
  { label: '$1,500/mo',  value: '1500' },
  { label: '$2,000/mo',  value: '2000' },
];

// PBC cities with active inventory, ordered by listing count. Glades
// cities (Belle Glade, Pahokee, South Bay) excluded per Patrick
// (2026-05-28): nothing west of Wellington / Royal Palm Beach /
// Loxahatchee. Same list lives in SearchPageDesktop.tsx.
const CITY_OPTIONS: string[] = [
  'West Palm Beach', 'Boca Raton', 'Delray Beach', 'Boynton Beach',
  'Palm Beach Gardens', 'Jupiter', 'Wellington', 'Lake Worth',
  'Greenacres', 'Lake Worth Beach', 'Palm Beach', 'Royal Palm Beach',
  'North Palm Beach', 'Riviera Beach', 'Singer Island', 'Highland Beach',
  'Palm Springs', 'Lantana', 'The Acreage', 'Loxahatchee',
  'Juno Beach', 'Westlake', 'South Palm Beach', 'Lake Park',
  'Tequesta', 'Hypoluxo', 'Ocean Ridge', 'Loxahatchee Groves',
  'Atlantis', 'Palm Beach Shores', 'Gulf Stream', 'Lake Clarke Shores',
  'Manalapan', 'Briny Breezes', 'Mangonia Park', 'Haverhill',
  'Jupiter Inlet Colony', 'Stuart', 'Palm City'
];

// ── Default export ───────────────────────────────────────────────────────
export default function SearchPageMobile() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Inner />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: BODY, color: SLATE, fontSize: 14, background: '#f8fafc',
    }}>Loading search…</div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────
function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // CRM hand-off: when an agent on team.mlrecloud.com clicks "Build
  // search in portal" on a contact, the link sends them here with
  // ?contact_id and ?contact_name. We show a sticky banner so the
  // agent can't accidentally save for the wrong client, and pipe the
  // ids through to the save-search payload. Mirror of the desktop
  // contactForSearch.
  const contactForSearch = useMemo(() => {
    const id   = searchParams.get('contact_id');
    const name = searchParams.get('contact_name');
    return id && name ? { id, name } : null;
  }, [searchParams]);

  // Transaction mode is a top-level switch, not a filter — toggling it is
  // a fundamental UX gear shift (different price scales, different fields,
  // different defaults). Keeping it out of the Filters object also means it
  // survives a Reset.
  const [transaction, setTransactionState] = useState<'sale' | 'rent'>(
    () => (searchParams.get('transaction') === 'rent' ? 'rent' : 'sale')
  );
  // Wrapper: when switching modes, blow away price filters since the scales
  // are completely different ($500k vs $5k makes no sense to carry across).
  const setTransaction = (t: 'sale' | 'rent') => {
    if (t !== transaction) {
      setFilters(f => ({ ...f, priceMin: '', priceMax: '' }));
    }
    setTransactionState(t);
  };

  const [filters, setFilters] = useState<Filters>(() => hydrateFromUrl(searchParams));
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading]  = useState(false);          // initial / filter-change load
  const [loadingMore, setLoadingMore] = useState(false);    // scroll-triggered next page
  const [count,    setCount]    = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [location, setLocation] = useState<LocationFilter | null>(() => {
    // Deep link from the homepage hero search: ?loc=<encoded LocationFilter>.
    try {
      const u = new URLSearchParams(window.location.search).get('loc');
      if (u) return JSON.parse(u) as LocationFilter;
    } catch {}
    try {
      const saved = sessionStorage.getItem('mlg_mobile_search');
      if (saved) {
        const { location: loc } = JSON.parse(saved);
        return loc || null;
      }
    } catch {}
    return null;
  });

  // requestSeq is bumped on every filter/transaction/location change AND on
  // every loadMore. Inflight responses compare their captured seq to the
  // current seq when they resolve — stale results are dropped. This protects
  // against a slow page-2 fetch landing after the user has already changed
  // filters and started page-1 of a new search.
  const requestSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Sticky-header collapse: shrink to a tappable bar as the user scrolls
  // down into the results; restore on scroll-up or tap.
  const [hdrCollapsed, setHdrCollapsed] = useState(false);
  const [hdrExpanded, setHdrExpanded] = useState(false);

  // Drip-email deep link state — see SearchPageDesktop.tsx for the full
  // rationale. When ?drip=<uuid> is in the URL, resolve via the lookup
  // endpoint and override the result set to that exact MLS-ID list.
  const [drip, setDrip] = useState<{
    mls_ids: string[];
    search:  { name: string | null } | null;
    sent_at: string;
  } | null>(null);
  useEffect(() => {
    const dripId = searchParams.get('drip');
    if (!dripId) return;
    let cancelled = false;
    fetch(`/api/search/drip/${encodeURIComponent(dripId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.mls_ids?.length) setDrip(d); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync → URL. Preserve contact-attribution params so the banner stays
  // visible and the save-search payload still gets contact_id even after
  // the agent changes filters.
  useEffect(() => {
    const params = serializeToUrl(filters);
    if (transaction === 'rent') params.set('transaction', 'rent');
    if (contactForSearch) {
      params.set('contact_id',   contactForSearch.id);
      params.set('contact_name', contactForSearch.name);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filters, transaction, location, contactForSearch]);

  // Core fetcher. mode='replace' (default): reset listings + count, used on
  // first paint and any filter change. mode='append': preserve existing list
  // and tack new page on the end, used by infinite scroll.
  const runFetch = useCallback(async (offset: number, mode: 'replace' | 'append') => {
    const seq = ++requestSeq.current;
    if (mode === 'replace') setLoading(true); else setLoadingMore(true);

    const p = buildSearchParams(filters);
    if (offset > 0) p.set('offset', String(offset));
    if (location) {
      const f = location.filter;
      if (f.building_name)        p.set('building_name', f.building_name);
      // CMS-page primitives. community_slug scopes to a building/community
      // page; polygon scopes to a drawn boundary. Without these, picking a
      // page suggestion set no location param and searched the whole county.
      if (f.community_slug)       p.set('community_slug', f.community_slug);
      if (location.polygon && location.polygon.length >= 3) {
        p.set('polygon', JSON.stringify(location.polygon));
      }
      if (f.city)                 p.set('city', f.city);
      if (f.zip)                  p.set('zip', f.zip);
      if (f.subdivision_like)     p.set('subdivision_like', f.subdivision_like);
      if (f.subdivision_patterns)  p.set('subdivision_patterns', JSON.stringify(f.subdivision_patterns));
      if (f.street_address_like)   p.set('street_address_like', f.street_address_like);
      if (f.mls_id)                p.set('mls_id', f.mls_id);
    }
    p.set('transaction', transaction);  // sale is server default, but be explicit
    // Drip-email deep link override — fix the result set to the exact
    // MLS IDs sent in the email so the count matches.
    if (drip && drip.mls_ids.length > 0) {
      p.set('mls_ids', drip.mls_ids.join(','));
    }

    try {
      const res  = await fetch('/api/search?' + p.toString());
      const data = await res.json();
      if (seq !== requestSeq.current) return;  // a newer request superseded us — drop

      const items: Listing[] = Array.isArray(data.listings) ? data.listings : [];
      // Server now sorts MLG/priority offices first via the
      // properties_search view — no client-side reorder needed.
      // (Old mobile MLG_OFFICE_KEY was wrong anyway: '276548547' didn't
      // match anything in the DB, so this sort was a no-op for years.)

      if (mode === 'replace') {
        setListings(items);
      } else {
        // Dedupe by id when appending — guards against an edge case where a
        // listing's offset shifts between pages (e.g. status change mid-scroll)
        // and would otherwise show twice.
        setListings(prev => {
          const seen = new Set(prev.map(l => l.id));
          return [...prev, ...items.filter(l => !seen.has(l.id))];
        });
      }
      setCount(data.count ?? items.length);
    } catch (err) {
      console.error('Search fetch error:', err);
      if (seq !== requestSeq.current) return;
      if (mode === 'replace') { setListings([]); setCount(0); }
    } finally {
      if (seq === requestSeq.current) {
        if (mode === 'replace') setLoading(false); else setLoadingMore(false);
      }
    }
  }, [filters, transaction, location, drip]);

  // First page / filter-change reload
  useEffect(() => { runFetch(0, 'replace'); }, [runFetch]);

  // Infinite scroll — observe the sentinel that sits just below the card
  // list. When it enters the viewport (within 600px so we pre-fetch before
  // the user actually hits the bottom), grab the next page. Guards: there's
  // more to load, we're not already loading, no in-progress fetch.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const hasMore = listings.length > 0 && listings.length < count;
    if (!hasMore || loading || loadingMore) return;

    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        runFetch(listings.length, 'append');
      }
    }, { rootMargin: '600px 0px' });

    io.observe(el);
    return () => io.disconnect();
  }, [listings.length, count, loading, loadingMore, runFetch]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));

  const activeCount = countActiveFilters(filters);
  const compact = hdrCollapsed && !hdrExpanded;

  // Watch the nearest scrollable ancestor (the page shell's scroll container)
  // and collapse the header on downward scroll, restore on upward scroll / near top.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let sc: HTMLElement | null = root.parentElement;
    while (sc) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === 'auto' || oy === 'scroll') break;
      sc = sc.parentElement;
    }
    const getTop = () => (sc ? sc.scrollTop : (window.scrollY || 0));
    const target: any = sc || window;
    let last = getTop();
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const t = getTop();
        if (t < 60) { setHdrCollapsed(false); setHdrExpanded(false); }
        else if (t > last + 6) { setHdrCollapsed(true); setHdrExpanded(false); }
        else if (t < last - 6) { setHdrExpanded(true); }
        last = t;
        ticking = false;
      });
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={rootRef} style={{ minHeight: '100%', background: '#f0f4f8', fontFamily: BODY }}>
      {/* Sticky header */}
      <div
        onClick={compact ? () => setHdrExpanded(true) : undefined}
        style={{
          background: '#fff', borderBottom: '1px solid #e2e8f0',
          padding: compact ? '8px 14px' : '10px 14px 12px',
          position: 'sticky', top: 0, zIndex: 10,
          width: '100%', boxSizing: 'border-box', overflowX: 'hidden',
          cursor: compact ? 'pointer' : 'default',
          transition: 'padding 0.15s ease',
        }}>
        {compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" style={{ flexShrink: 0 }} aria-hidden="true">
              <path fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3" />
            </svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: DISPLAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {location ? location.name : (transaction === 'rent' ? 'For Rent' : 'For Sale')}
            </span>
            <span style={{ fontSize: 11, color: SLATE, flexShrink: 0 }}>{loading ? '…' : count.toLocaleString()}</span>
            <span
              onClick={(e) => { e.stopPropagation(); setFiltersOpen(true); }}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 8, border: `1px solid ${activeCount ? TEAL : '#e2e8f0'}`, background: activeCount ? '#e6f9fd' : '#fff', color: activeCount ? TEAL : NAVY, fontSize: 12, fontWeight: 700, fontFamily: BODY, display: 'flex', alignItems: 'center', gap: 5 }}
            >Filters{activeCount > 0 && (<span style={{ background: TEAL, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>{activeCount}</span>)}</span>
          </div>
        )}
        {!compact && (<>
        {/* Account row (MLG Search wordmark removed — site header has the real logo) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8, minWidth: 0 }}>
          <AccountButton />
        </div>
        {/* Search bar — full width on its own row */}
        <div style={{ marginBottom: 8 }}>
          <LocationSearch
            value={location}
            transaction={transaction}
            onChange={(loc) => {
              setLocation(loc);
              // Drill-ins (building / community / address) clear broad
              // filters so sticky $500K+/3BR+ presets don't hide the
              // listings the user came to see. ZIP and city are additive
              // filters — preserve everything the user already set.
              // (Patrick's bug, 2026-05-28: picking 33401 wiped his
              // price/beds/baths.)
              const isDrillIn = loc?.type === 'building' || loc?.type === 'community' || loc?.type === 'address' || (loc?.type === 'page' && loc?.page_type !== 'city');
              if (loc && isDrillIn) setFilters((f: any) => ({
                ...f,
                city:          'Any',
                priceMin:      '',
                priceMax:      '',
                bedsMin:       '',
                bathsMin:      '',
                sqftMin:       '',
                sqftMax:       '',
                yearBuiltMin:  '',
                yearBuiltMax:  '',
                hoaMax:        '',
                domMax:        '',
              }));
            }}
            placeholder="City, ZIP, building, or community..."
          />
        </div>
        {/* Sale / Rent toggle — the front-door choice. Drives transaction
            param in the API and which price/property-type defaults apply. */}
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: 999,
          padding: 3, marginBottom: 8, fontFamily: BODY,
        }}>
          {(['sale', 'rent'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => setTransaction(t)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: transaction === t ? '#fff' : 'transparent',
                color: transaction === t ? NAVY : SLATE,
                fontSize: 13, fontWeight: 700,
                boxShadow: transaction === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {t === 'sale' ? 'For Sale' : 'For Rent'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: SLATE }}>
            {loading ? 'Loading…' : `${count.toLocaleString()} ${transaction === 'rent' ? 'rentals' : 'listings'}`}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            style={{
              padding: '7px 13px', borderRadius: 8,
              border: `1px solid ${activeCount ? TEAL : '#e2e8f0'}`,
              background: activeCount ? '#e6f9fd' : '#fff',
              color: activeCount ? TEAL : NAVY,
              fontSize: 12, fontWeight: 700, fontFamily: BODY,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            Filters
            {activeCount > 0 && (
              <span style={{
                background: TEAL, color: '#fff', borderRadius: 10,
                padding: '1px 6px', fontSize: 10, fontWeight: 800,
              }}>{activeCount}</span>
            )}
          </button>
        </div>
        </>)}
      </div>

      {/* CRM hand-off banner — "Saving for [Contact]". Click X to break
          the association if the agent meant to save for themselves. */}
      {contactForSearch && (
        <div style={{
          background: '#ecfdf5', borderBottom: '1px solid #a7f3d0',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, fontFamily: BODY, color: '#065f46',
        }}>
          <span style={{ fontSize: 14 }}>👤</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            Saving for <strong>{contactForSearch.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => router.replace('/search', { scroll: false })}
            title="Clear contact"
            style={{
              flexShrink: 0, padding: '3px 8px', borderRadius: 999,
              border: '1px solid #a7f3d0', background: '#fff',
              color: '#047857', fontSize: 10, fontWeight: 600, fontFamily: BODY,
            }}
          >Clear</button>
        </div>
      )}

      {/* Cards */}
      <div style={{ padding: 12 }}>
        {drip && (
          <div style={{
            marginBottom: 12, padding: '12px 14px', borderRadius: 10,
            background: '#e6f9fd', border: '1px solid #b5e8f0', fontFamily: BODY,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, color: TEAL }}>
                  Saved Search Alert
                </div>
                <div style={{ fontSize: 12, color: NAVY, marginTop: 2 }}>
                  {drip.mls_ids.length} listing{drip.mls_ids.length === 1 ? '' : 's'} from your <strong>{drip.search?.name || 'saved search'}</strong> alert sent {new Date(drip.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setDrip(null); router.replace('/search', { scroll: false }); }}
                style={{
                  flexShrink: 0, background: '#fff', border: '1px solid #b5e8f0',
                  color: NAVY, padding: '6px 10px', borderRadius: 999,
                  fontSize: 11, fontWeight: 600, fontFamily: BODY,
                }}
              >Show all</button>
            </div>
          </div>
        )}
        {loading && listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: SLATE, fontSize: 13 }}>
            Loading listings…
          </div>
        )}
        {!loading && listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: SLATE, fontSize: 13 }}>
            No listings match these filters.
          </div>
        )}
        {listings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map((l, idx) => (
              <Card
                key={l.id} listing={l} eager={idx < 2}
                onClick={() => {
                try { sessionStorage.setItem('mlg_mobile_search', JSON.stringify({ filters, transaction, location })); } catch {}
                router.push('/listings/' + slugifyListing(l));
              }}
              />
            ))}
          </div>
        )}

        {/* Infinite-scroll sentinel + spinner. Sentinel sits just below the
            last card and triggers loadMore (via IntersectionObserver, set up
            in the parent) when it scrolls into view. */}
        {listings.length > 0 && listings.length < count && (
          <div ref={sentinelRef} style={{ padding: '20px 0 40px', textAlign: 'center', color: SLATE, fontSize: 12 }}>
            {loadingMore ? 'Loading more…' : `${count - listings.length} more homes`}
          </div>
        )}
      </div>

      {/* Filter sheet */}
      {filtersOpen && (
        <FilterSheet
          filters={filters} update={update}
          onReset={() => {
            try { sessionStorage.removeItem('mlg_mobile_search'); } catch {}
            setFilters(DEFAULT_FILTERS);
            setLocation(null);
          }}
          onClose={() => setFiltersOpen(false)}
          count={count} loading={loading}
          transaction={transaction}
        />
      )}
    </div>
  );
}

// ── Hydration / serialization / param building ───────────────────────────
function hydrateFromUrl(sp: URLSearchParams): Filters {
  const csv = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(',').filter(Boolean) : [];
  };
  return {
    city:            sp.get('city')           || DEFAULT_FILTERS.city,
    zip:             sp.get('zip')            || '',
    priceMin:        sp.get('priceMin')        || '',
    priceMax:        sp.get('priceMax')       || '',
    bedsMin:         sp.get('bedsMin')        || '',
    bathsMin:        sp.get('bathsMin')       || '',
    propertyTypes:   csv('propertyTypes').length ? csv('propertyTypes') : DEFAULT_FILTERS.propertyTypes,
    sqftMin:         sp.get('sqftMin')        || '',
    sqftMax:         sp.get('sqftMax')        || '',
    yearBuiltMin:    sp.get('yearBuiltMin')   || '',
    yearBuiltMax:    sp.get('yearBuiltMax')   || '',
    newConstruction: sp.get('newConstruction') === '1',
    hoaMax:          sp.get('hoaMax')         || '',
    statuses:        csv('statuses').length ? csv('statuses') : DEFAULT_FILTERS.statuses,
    domMax:          sp.get('domMax')         || '',
  };
}

function serializeToUrl(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.city !== DEFAULT_FILTERS.city) p.set('city', f.city);
  if (f.zip)           p.set('zip', f.zip);
  if (f.priceMin)      p.set('priceMin', f.priceMin);
  if (f.priceMax)      p.set('priceMax', f.priceMax);
  if (f.bedsMin)       p.set('bedsMin', f.bedsMin);
  if (f.bathsMin)      p.set('bathsMin', f.bathsMin);
  if (f.propertyTypes.length) p.set('propertyTypes', f.propertyTypes.join(','));
  if (f.sqftMin)       p.set('sqftMin', f.sqftMin);
  if (f.sqftMax)       p.set('sqftMax', f.sqftMax);
  if (f.yearBuiltMin)  p.set('yearBuiltMin', f.yearBuiltMin);
  if (f.yearBuiltMax)  p.set('yearBuiltMax', f.yearBuiltMax);
  if (f.newConstruction) p.set('newConstruction', '1');
  if (f.hoaMax)        p.set('hoaMax', f.hoaMax);
  // Only serialize statuses if it differs from default to keep URL clean
  if (f.statuses.join(',') !== DEFAULT_FILTERS.statuses.join(',')) {
    p.set('statuses', f.statuses.join(','));
  }
  if (f.domMax)        p.set('domMax', f.domMax);
  return p;
}

function buildSearchParams(f: Filters): URLSearchParams {
  // No map bounds — mobile shows all PBC. City/zip do geographic narrowing.
  // Page size kept small so first paint is fast on cellular; infinite scroll
  // (IntersectionObserver in Inner) fetches more as the user scrolls.
  const p = new URLSearchParams({ limit: String(PAGE_SIZE) });

  // Multi-status → comma-separated DB enums (API uses in() filter)
  // If "New" is selected, apply domMax=10 automatically
  if (f.statuses.includes('New')) {
    p.set('statuses', 'Active');
    p.set('domMax', '10');
  } else {
    const statusValues = f.statuses
      .flatMap(label => STATUS_OPTIONS.find(o => o.label === label)?.values || []);
    if (statusValues.length) p.set('statuses', statusValues.join(','));
  }

  // Property types → comma-separated DB enums
  const typeValues = f.propertyTypes
    .flatMap(label => PROPERTY_TYPE_OPTIONS.find(o => o.label === label)?.values || []);
  if (typeValues.length) p.set('property_subtype', typeValues.join(','));

  if (f.priceMin)     p.set('priceMin', f.priceMin);
  if (f.priceMax)     p.set('priceMax', f.priceMax);
  if (f.bedsMin)      p.set('beds_min',  f.bedsMin);
  if (f.bathsMin)     p.set('baths_min', f.bathsMin);
  if (f.sqftMin)      p.set('sqft_min',  f.sqftMin);
  if (f.sqftMax)      p.set('sqft_max',  f.sqftMax);
  if (f.hoaMax)       p.set('hoa_max',   f.hoaMax);
  if (f.domMax)       p.set('dom_max',   f.domMax);
  if (f.city !== 'Any') p.set('city', f.city);
  if (f.zip)          p.set('zip', f.zip.trim());

  // Year built — New Construction overrides min to 2025+
  const effectiveYearMin = f.newConstruction ? '2025' : f.yearBuiltMin;
  if (effectiveYearMin) p.set('year_built_min', effectiveYearMin);
  if (f.yearBuiltMax)   p.set('year_built_max', f.yearBuiltMax);

  return p;
}

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.city !== DEFAULT_FILTERS.city)            n++;
  if (f.zip)                                      n++;
  if (f.priceMin || f.priceMax)                   n++;
  if (f.bedsMin)                                  n++;
  if (f.bathsMin)                                 n++;
  if (f.propertyTypes.length > 0)                 n++;
  if (f.sqftMin || f.sqftMax)                     n++;
  if (f.yearBuiltMin || f.yearBuiltMax || f.newConstruction) n++;
  if (f.hoaMax)                                   n++;
  if (f.statuses.join(',') !== DEFAULT_FILTERS.statuses.join(',')) n++;
  // "New" status counts as a filter
  if (f.domMax)                                   n++;
  return n;
}

// ── Card ─────────────────────────────────────────────────────────────────
// `eager` is set on the first 2 cards in the list so above-fold images
// load immediately rather than waiting for the lazy intersection. This
// makes first-paint feel populated instead of grey-placeholder.
function Card({ listing: l, onClick, eager = false }: { listing: Listing; onClick: () => void; eager?: boolean }) {
  const img = l.image_urls && l.image_urls.length > 0 ? l.image_urls[0] : null;
  const addr = [
    (l.street_address || '').split(',')[0],
    l.unit_number ? '#' + l.unit_number : '',
    l.city || '',
  ].filter(Boolean).join(' ');

  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.09)', cursor: 'pointer',
    }}>
      <div style={{ height: 220, background: '#dde3ea', position: 'relative', overflow: 'hidden' }}>
        {img && (
          <img
            src={imgOpt(img, 800)}
            srcSet={imgSrcSet(img, [400, 640, 828])}
            sizes="100vw"
            alt={addr}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {(() => {
          // Status takes precedence over 'New'. Closed listings show
          // 'Closed' even when their cached DOM is small (sold in 2 days).
          const isOnMarket = l.status === 'Active' || l.status === 'ComingSoon';
          const isNew = isOnMarket && l.days_on_market != null && l.days_on_market <= 10;
          let badge: string; let bg: string;
          if (l.status === 'Closed')                                                          { badge = 'Closed';      bg = '#6b7280'; }
          else if (l.status === 'Pending' || l.status === 'ActiveUnderContract')              { badge = 'Pending';     bg = '#d97706'; }
          else if (l.status === 'ComingSoon')                                                 { badge = 'Coming Soon'; bg = '#7c3aed'; }
          else if (isNew)                                                                     { badge = 'New';         bg = TEAL;      }
          else                                                                                { badge = l.status || 'Active'; bg = '#16a34a'; }
          return (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: bg,
              color: '#fff', borderRadius: 4, padding: '3px 10px',
              fontSize: 11, fontWeight: 700,
            }}>{badge}</div>
          );
        })()}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, fontFamily: DISPLAY, marginBottom: 4 }}>
          {'$' + (l.list_price || 0).toLocaleString()}
          {l.property_type === 'ResidentialLease' && (
            <span style={{ fontSize: 13, fontWeight: 600, color: SLATE, marginLeft: 4 }}>/mo</span>
          )}
        </div>
        <div style={{
          fontSize: 13, color: SLATE, marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{addr}</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: NAVY, fontWeight: 600 }}>
          {l.beds  != null && <span>{l.beds} bd</span>}
          {l.baths != null && <span>{l.baths} ba</span>}
          {l.sqft  != null && <span>{l.sqft.toLocaleString()} sf</span>}
        </div>
        {/* DOM suffix only on truly on-market listings — Closed DOM is
            days-as-Active (a snapshot at off-market) and would look weird
            here. */}
        {l.days_on_market != null && l.days_on_market > 7 &&
         (l.status === 'Active' || l.status === 'ComingSoon') && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            {l.days_on_market} days on market
            {l.hoa_fee ? ` · HOA $${l.hoa_fee.toLocaleString()}/mo` : ''}
          </div>
        )}
        {/* Closed listings get the HOA fee inline without DOM. */}
        {l.hoa_fee && l.status === 'Closed' && (
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            HOA ${l.hoa_fee.toLocaleString()}/mo
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter sheet (Compass-style) ─────────────────────────────────────────
function FilterSheet({
  filters: f, update, onReset, onClose, count, loading, transaction,
}: {
  filters: Filters;
  update: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  onReset: () => void;
  onClose: () => void;
  count: number;
  loading: boolean;
  transaction: 'sale' | 'rent';
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#fff', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
      }}>
        <button type="button" onClick={onClose} style={{
          background: 'none', border: 'none', fontSize: 15, fontWeight: 600,
          color: NAVY, fontFamily: BODY, padding: 0, cursor: 'pointer',
        }}>Close</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, fontFamily: DISPLAY }}>
          Filters
        </div>
        <button type="button" onClick={onReset} style={{
          background: 'none', border: 'none', fontSize: 15, fontWeight: 600,
          color: SLATE, fontFamily: BODY, padding: 0, cursor: 'pointer',
        }}>Reset</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 100px' }}>

        {/* ── Location ── */}
        <SectionHeader>Location</SectionHeader>
        <Field label="City">
          {(() => {
            // City is stored as 'Any' (none) or a CSV ('Boca Raton,Jupiter').
            // Multi-select to match desktop (SearchPageDesktop.tsx). API
            // splits on comma — .in() for >1, .ilike() for 1.
            const selected = new Set(
              f.city && f.city !== 'Any'
                ? f.city.split(',').map(s => s.trim()).filter(Boolean)
                : []
            );
            const toggle = (city: string) => {
              const next = new Set(selected);
              if (next.has(city)) next.delete(city); else next.add(city);
              update('city', next.size === 0 ? 'Any' : Array.from(next).join(','));
            };
            return (
              <>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => update('city', 'Any')}
                    style={{
                      marginBottom: 10, padding: '6px 12px', borderRadius: 6,
                      border: '1px solid #e2e8f0', background: '#fff',
                      color: SLATE, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: BODY,
                    }}
                  >Clear cities ({selected.size})</button>
                )}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '4px 16px', maxHeight: 280, overflowY: 'auto',
                  paddingRight: 4,
                }}>
                  {CITY_OPTIONS.map(city => (
                    <Checkbox
                      key={city}
                      checked={selected.has(city)}
                      onChange={() => toggle(city)}
                      label={city}
                    />
                  ))}
                </div>
              </>
            );
          })()}
        </Field>
        <Field label="Zip Code">
          <input
            type="text" inputMode="numeric" maxLength={5}
            placeholder="e.g. 33480"
            value={f.zip}
            onChange={e => update('zip', e.target.value.replace(/[^0-9]/g, ''))}
            style={inputStyle}
          />
        </Field>

        {/* ── Primary (no header, like Compass) ── */}
        <Divider />
        {/* Price — preset Min/Max dropdowns. Tier-aware: sale presets
            ($100K-$50M) for For Sale, rent presets ($500-$50K/mo) for
            For Rent. Matches desktop's MinMaxSelect behavior. */}
        <Field label="Price">
          {(() => {
            const presets = transaction === 'rent' ? PRICE_PRESETS_RENT : PRICE_PRESETS_SALE;
            const minOptions = presets.map(v => ({
              value: v, label: v === '' ? 'No Min' : fmtPricePreset(v),
            }));
            const maxOptions = presets.map(v => ({
              value: v, label: v === '' ? 'No Max' : fmtPricePreset(v),
            }));
            return (
              <MinMaxRow>
                <NativeSelect value={f.priceMin} onChange={v => update('priceMin', v)} options={minOptions} />
                <NativeSelect value={f.priceMax} onChange={v => update('priceMax', v)} options={maxOptions} />
              </MinMaxRow>
            );
          })()}
        </Field>

        {/* Beds — single Min dropdown (parity with desktop, 2026-05-27).
            The earlier Min/Max enabled impossible combos like Min 3 + Max 2. */}
        <Field label="Beds">
          <NativeSelect
            value={f.bedsMin}
            onChange={v => update('bedsMin', v)}
            options={BED_PRESETS}
          />
        </Field>

        {/* Baths — single Min dropdown with half-bath options. DB `baths`
            is a single decimal (2.5 = 2 full + 1 half), so gte('baths', 2.5)
            handles half-baths without a separate column. */}
        <Field label="Baths">
          <NativeSelect
            value={f.bathsMin}
            onChange={v => update('bathsMin', v)}
            options={BATH_PRESETS}
          />
        </Field>

        <Field label="Property Type">
          <CheckboxList
            options={PROPERTY_TYPE_OPTIONS
              .filter(o => transaction === 'sale' || o.label !== 'Land')
              .map(o => o.label)}
            selected={f.propertyTypes}
            onToggle={(label) => {
              const next = f.propertyTypes.includes(label)
                ? f.propertyTypes.filter(l => l !== label)
                : [...f.propertyTypes, label];
              update('propertyTypes', next);
            }}
          />
        </Field>

        {/* ── Property Facts ── */}
        <Divider />
        <SectionHeader>Property Facts</SectionHeader>

        <Field label="Square Feet">
          <MinMaxRow>
            <PrefixInput placeholder="No Min" value={f.sqftMin}
                         onChange={v => update('sqftMin', v)} />
            <PrefixInput placeholder="No Max" value={f.sqftMax}
                         onChange={v => update('sqftMax', v)} />
          </MinMaxRow>
        </Field>

        <Field label="Year Built">
          <MinMaxRow>
            <PrefixInput placeholder="No Min" value={f.yearBuiltMin} maxLength={4}
                         onChange={v => update('yearBuiltMin', v.replace(/[^0-9]/g, '').slice(0, 4))}
                         disabled={f.newConstruction} />
            <PrefixInput placeholder="No Max" value={f.yearBuiltMax} maxLength={4}
                         onChange={v => update('yearBuiltMax', v.replace(/[^0-9]/g, '').slice(0, 4))} />
          </MinMaxRow>
          <div style={{ marginTop: 10 }}>
            <Checkbox
              checked={f.newConstruction}
              onChange={(c) => update('newConstruction', c)}
              label="New Construction (built 2025 or later)"
            />
          </div>
        </Field>

        <Field label="Max HOA Fees">
          <NativeSelect
            value={f.hoaMax}
            onChange={v => update('hoaMax', v)}
            options={HOA_PRESETS}
          />
        </Field>

        {/* ── Listing Status ── */}
        <Divider />
        <SectionHeader>Listing Status</SectionHeader>

        <Field label="Status">
          {/* "All On Market" — single-tap shortcut that selects all three
              on-market checkboxes. Matches the desktop default. Click while
              all three are already selected → no-op (passive label). */}
          {(() => {
            const onMarketLabels = ['Coming Soon', 'Active', 'Under Contract/Pending'];
            const allOnMarket = onMarketLabels.every(l => f.statuses.includes(l));
            return (
              <button
                type="button"
                onClick={() => {
                  if (allOnMarket) {
                    // toggle off → leave just Coming Soon (closest "fewest")
                    update('statuses', ['Coming Soon']);
                  } else {
                    // merge in any not-yet-selected on-market labels, keep extras (e.g. Sold)
                    const merged = Array.from(new Set([...f.statuses, ...onMarketLabels]));
                    update('statuses', merged);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', marginBottom: 6,
                  borderRadius: 10,
                  border: `2px solid ${allOnMarket ? TEAL : '#e2e8f0'}`,
                  background: allOnMarket ? '#e6f9fd' : '#fff',
                  color: allOnMarket ? TEAL : NAVY,
                  fontSize: 15, fontWeight: 700, fontFamily: BODY,
                  width: '100%', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {allOnMarket ? '✓' : '+'}
                </span>
                All On Market
                <span style={{
                  fontSize: 11, fontWeight: 600, color: SLATE,
                  marginLeft: 'auto',
                }}>Coming Soon + Active + Under Contract</span>
              </button>
            );
          })()}
          <CheckboxList
            options={STATUS_OPTIONS.map(o => o.label)}
            selected={f.statuses}
            onToggle={(label) => {
              const next = f.statuses.includes(label)
                ? f.statuses.filter(l => l !== label)
                : [...f.statuses, label];
              update('statuses', next);
            }}
          />
        </Field>

        <Field label="Time on Market">
          <NativeSelect
            value={f.domMax}
            onChange={v => update('domMax', v)}
            options={TIME_ON_MARKET_OPTIONS}
          />
        </Field>
      </div>

      {/* Sticky CTA — MLG teal pill */}
      <div style={{
        padding: '12px 18px 20px',
        background: '#fff',
        borderTop: '1px solid #f1f5f9',
      }}>
        <button
          type="button" onClick={onClose}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 999,
            border: 'none',
            background: TEAL,
            color: '#fff',
            fontSize: 16, fontWeight: 700, fontFamily: DISPLAY,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(0, 178, 204, 0.35)',
          }}
        >
          {loading
            ? 'Loading…'
            : `See ${count.toLocaleString()} ${transaction === 'rent' ? 'Rentals' : 'Homes'}`}
        </button>
      </div>
    </div>
  );
}

// ── Section / Field primitives ───────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 18, fontWeight: 800, color: NAVY, fontFamily: DISPLAY,
      marginBottom: 16, marginTop: 4,
    }}>{children}</div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 14, color: NAVY, marginBottom: 8,
        fontWeight: 600, fontFamily: BODY,
      }}>{label}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0 20px' }} />;
}

function MinMaxRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>{Array.isArray(children) ? children[0] : children}</div>
      <div style={{ color: SLATE, fontSize: 14 }}>—</div>
      <div style={{ flex: 1 }}>{Array.isArray(children) ? children[1] : null}</div>
    </div>
  );
}

// ── Form primitives ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 13px', borderRadius: 8,
  border: '1px solid #cbd5e1', fontSize: 16, fontFamily: BODY, color: NAVY,
  outline: 'none', boxSizing: 'border-box', background: '#fff',
};

function PrefixInput({
  prefix, value, onChange, placeholder, disabled, maxLength,
}: {
  prefix?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; maxLength?: number;
}) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          color: SLATE, fontSize: 15, fontFamily: BODY, pointerEvents: 'none',
        }}>{prefix}</span>
      )}
      <input
        type="text" inputMode="numeric"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        style={{
          ...inputStyle,
          paddingLeft: prefix ? 26 : 13,
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

function NativeSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        paddingRight: 36,
        appearance: 'none', WebkitAppearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 viewBox=%270 0 12 8%27%3E%3Cpath d=%27M1 1l5 5 5-5%27 stroke=%27%2364748b%27 stroke-width=%272%27 fill=%27none%27 stroke-linecap=%27round%27/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px center',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CheckboxList({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (label: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map(label => (
        <Checkbox
          key={label}
          checked={selected.includes(label)}
          onChange={() => onToggle(label)}
          label={label}
        />
      ))}
    </div>
  );
}

function Checkbox({
  checked, onChange, label,
}: { checked: boolean; onChange: (c: boolean) => void; label: string }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', cursor: 'pointer', fontSize: 15, color: NAVY,
      fontFamily: BODY,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 5,
        border: `2px solid ${checked ? NAVY : '#cbd5e1'}`,
        background: checked ? NAVY : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5 9-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <input
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span>{label}</span>
    </label>
  );
}

