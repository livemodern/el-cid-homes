'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import LocationSearch, { LocationFilter } from '@/components/LocationSearch';
import SaveSearchModal from '@/components/SaveSearchModal';
import { IconBell, IconCheck } from '@/components/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { slugifyListing } from '@/lib/listing-slug';
import { AccountButton } from '@/components/AccountButton';
import { imgOpt, imgSrcSet } from '@/lib/img';
import { SEARCH_SITE, defaultCenter } from '@/lib/search-site';

mapboxgl.accessToken = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '');

const TEAL  = '#00B2CC';
const NAVY  = '#0D173B';
const SLATE = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

// Mapbox popup chrome — soft shadow, brand-tinted close button, transparent tip.
// Injected once on first import (browser-only).
if (typeof document !== 'undefined' && !document.getElementById('mlg-popup-style')) {
  const s = document.createElement('style');
  s.id = 'mlg-popup-style';
  s.textContent = `
    .mlg-listing-popup .mapboxgl-popup-content {
      padding: 0; border-radius: 8px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      font-family: 'Poppins', sans-serif;
    }
    .mlg-listing-popup .mapboxgl-popup-close-button {
      font-size: 18px; padding: 4px 8px; color: #fff;
      background: rgba(13,23,59,0.6); border-radius: 4px;
      top: 4px; right: 4px; line-height: 1;
    }
    .mlg-listing-popup .mapboxgl-popup-close-button:hover {
      background: rgba(13,23,59,0.85);
    }
    .mlg-listing-popup .mapboxgl-popup-tip { border-top-color: #fff; }
  `;
  document.head.appendChild(s);
}

type Listing = {
  id: string; mls_id: string; status: string;
  property_type: string | null;
  list_price: number | null; beds: number | null; baths: number | null;
  sqft: number | null; unit_number: string | null; street_address: string | null;
  city: string | null; state: string | null; zip: string | null;
  latitude: number | null; longitude: number | null;
  image_urls: string[] | null; days_on_market: number | null;
  hoa_fee: number | null; year_built: number | null;
  property_subtype: string | null; list_agent_name: string | null;
  building_name: string | null;
};

type Filters = {
  status: string;
  // Min-only (e.g. '3+'). The Max counterparts existed briefly in
  // 2026-05-26 but were removed 2026-05-27 — they enabled impossible
  // ranges (Min 3 + Max 2 = 0 results) and the Compass-style range
  // wasn't matching how buyers actually search. Min is what 95% of
  // people want.
  beds: string;
  baths: string;
  priceMin: string; priceMax: string;
  city: string;
  sqftMin: string; sqftMax: string;
  domMax: string; hoaMax: string;
  // `subtype` is the CSV the API receives — kept as a single string so
  // the existing URL serialization, server query (.in/.eq), and shared
  // URLs all keep working. The drawer UI now toggles individual labels
  // and rebuilds the CSV on each change.
  subtype: string;
  yearBuiltMin: string; yearBuiltMax: string;
  newConstruction: boolean;
  // Free-form text matched against listing descriptions. Stage 1 is a
  // simple server-side ILIKE; Stage 2 will swap in semantic search.
  keywords: string;
  // Multi-select Status as a CSV of DB enum values (e.g. "Active,ComingSoon").
  // When non-empty this OVERRIDES the simple `status` label from the top bar
  // — matches the Compass drawer pattern. The API already supports `statuses`
  // as a comma-list and gives it precedence over the single `status` param.
  statusesCsv: string;
  // "Must Have X" amenity checkboxes — each value (e.g. "pool", "waterfront")
  // contributes one description-ILIKE filter on the server. Multiple selected
  // amenities AND together. Stage 1 lives on description text; Stage 2 will
  // use structured amenity columns once we extract them from trestle_raw.
  amenitiesCsv: string;
};

// Office priority for default view: MLG first, then Compass, then all
const MLG_OFFICE_KEY     = '5929314';
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
  status: 'On Market', beds: 'Any', baths: 'Any',
  priceMin: '500000', priceMax: '', city: 'Any',
  sqftMin: '', sqftMax: '', domMax: '', hoaMax: '',
  subtype: '', yearBuiltMin: '', yearBuiltMax: '',
  newConstruction: false,
  keywords: '',
  statusesCsv: '',
  amenitiesCsv: '',
};

// Status checkbox options for the drawer (multi-select). Maps friendly
// labels to one or more DB enum values, joined into a CSV on the wire.
const STATUS_CHECKBOX_OPTIONS: { label: string; values: string[] }[] = [
  { label: 'Coming Soon',            values: ['ComingSoon'] },
  { label: 'Active',                 values: ['Active'] },
  { label: 'Under Contract/Pending', values: ['Pending', 'ActiveUnderContract'] },
  { label: 'Sold',                   values: ['Closed'] },
];

// Compass-style "Must Have X" checkboxes. Each value is the keyword we ILIKE
// against the description column. Tuned for Florida real estate (skipping
// Basement, Doorman — rare in FL). Easy to swap to structured columns later.
const AMENITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Must Have Pool',                 value: 'pool' },
  { label: 'Must Have Waterfront',           value: 'waterfront' },
  { label: 'Must Have Garage',               value: 'garage' },
  { label: 'Must Have Elevator',             value: 'elevator' },
  { label: 'Must Have Private Outdoor Space',value: 'patio' },
  { label: 'Must Have Air Conditioning',     value: 'air conditioning' },
  { label: 'Must Have Washer / Dryer',       value: 'washer' },
  { label: 'Must Have Dock',                 value: 'dock' },
  { label: 'Must Have Hurricane Impact',     value: 'impact' },
  { label: 'Must Have Gated',                value: 'gated' },
];

// ── Drawer preset buckets ─────────────────────────────────────────────
// Native <select> options for min/max range fields. Compass-style: bucket
// values rather than free-text so users don't have to guess what's
// reasonable. Empty string = "No Min" / "No Max".
const SQFT_PRESETS = ['', '500', '750', '1000', '1250', '1500', '1750', '2000', '2500', '3000', '4000', '5000', '7500', '10000'];
const YEAR_PRESETS = ['', '1900', '1925', '1950', '1970', '1980', '1990', '2000', '2010', '2015', '2020', '2025'];
const HOA_PRESETS  = ['', '100', '250', '500', '750', '1000', '1500', '2000', '3000', '5000'];

// Price preset buckets — split by transaction. Compass-style step-by-tier:
// tight increments at the entry-level price points, coarser as price climbs.
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

// Pretty-print: $1M / $1.25M / $500K / $850 — small enough for top-bar pills.
function fmtPricePreset(v: string): string {
  if (!v) return '';
  const n = Number(v);
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toLocaleString(undefined,    { maximumFractionDigits: 1 }) + 'K';
  return '$' + n.toLocaleString();
}

// Property Type checkboxes. Each label maps to one or more
// `property_subtype` enum values. The drawer toggles labels; on
// change we rebuild the CSV stored in filters.subtype.
const PROPERTY_TYPES: { label: string; values: string[] }[] = [
  { label: 'Single Family', values: ['SingleFamilyResidence'] },
  { label: 'Condo/Villa',   values: ['Condominium', 'Villa'] },
  { label: 'Townhouse',     values: ['Townhouse'] },
  { label: 'Multi-Family',  values: ['MultiFamilyResidence', 'Duplex'] },
  { label: 'Land',          values: ['UnimprovedLand'] },
];

// Time-on-market dropdown options.
const DOM_OPTIONS: { label: string; value: string }[] = [
  { label: 'Any',           value: ''   },
  { label: 'New (≤10 days)', value: '10'  },
  { label: '≤14 days',      value: '14' },
  { label: '≤30 days',      value: '30' },
  { label: '≤60 days',      value: '60' },
  { label: '≤90 days',      value: '90' },
];

// Status filter labels shown in the dropdown. Each maps to an API
// status group via STATUS_LABEL_TO_API below.
const STATUS_OPTIONS_V2 = ['On Market', 'New', 'Coming Soon', 'Active', 'Pending', 'Closed', 'All Statuses'];

// Label → API status param. Keep this aligned with the branches in
// /api/search/route.ts.
const STATUS_LABEL_TO_API: Record<string, string> = {
  'On Market':    'OnMarket',
  'New':          'New',
  'Coming Soon':  'ComingSoon',
  'Active':       'Active',
  'Pending':      'Pending',
  'Closed':       'Closed',
  'All Statuses': 'All',
};

// Initial map viewport comes from the per-site config module — the
// ONLY search value allowed to differ between mini-sites.
const DEFAULT_BOUNDS = SEARCH_SITE.defaultBounds;

// A URL `bounds` string is only honored if it actually overlaps our service
// area (Palm Beach + Martin counties). Stale or shared links can carry a
// viewport sitting out in the Atlantic or otherwise far off-region — fitting
// the map to it strands the user on a blank, resultless view. Reject those
// and fall back to the default county-wide view instead.
function boundsUsable(b: number[]): boolean {
  if (b.length !== 4 || !b.every(Number.isFinite)) return false;
  const [w, s, e, n] = b;
  if (e <= w || n <= s) return false;            // degenerate / inverted
  const W = -80.95, S = 26.30, E = -80.00, N = 27.40;  // generous PBC+Martin envelope
  return !(e < W || w > E || n < S || s > N);    // must intersect the envelope
}

// STATUS_OPTIONS_V2 (defined above) is the source of truth — this stub
// keeps any legacy refs from breaking until they're swept.
const STATUS_OPTIONS = STATUS_OPTIONS_V2;
const BED_OPTIONS    = ['Any', '1+', '2+', '3+', '4+', '5+'];
// Half-baths included so '2.5+' filters correctly via gte('baths', 2.5).
// DB `baths` is a single decimal column (2.5 = 2 full + 1 half) so no
// separate full/half columns to merge. Same set as BATH_PRESETS on mobile.
const BATH_OPTIONS   = ['Any', '1+', '1.5+', '2+', '2.5+', '3+', '3.5+', '4+', '5+'];
// PBC cities with active inventory, ordered by listing count.
// Multi-select. Glades cities (Belle Glade, Pahokee, South Bay) excluded
// per Patrick (2026-05-28): nothing west of Wellington / Royal Palm Beach
// / Loxahatchee. Same list lives in SearchPageMobile.tsx.
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

function fmtPrice(n: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  return '$' + Math.round(n / 1_000) + 'K';
}

function priceLabel(min: string, max: string): string {
  if (!min && !max) return '';
  const fmt = (s: string) => {
    const n = Number(s);
    if (!n) return '';
    return n >= 1_000_000 ? '$' + (n / 1_000_000).toFixed(1) + 'M' : '$' + Math.round(n / 1_000) + 'K';
  };
  if (min && max) return `${fmt(min)} to ${fmt(max)}`;
  if (min)        return `${fmt(min)}+`;
  return `< ${fmt(max)}`;
}

// ─── Reusable dropdown ────────────────────────────────────────────────────
function Dropdown({
  label, value, isActive, children, width,
}: {
  label: string;
  value: string;
  isActive: boolean;
  children: (close: () => void) => React.ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '7px 12px', borderRadius: 6,
          border: `1px solid ${isActive ? TEAL : '#e2e8f0'}`,
          background: isActive ? '#e6f9fd' : '#fff',
          color: isActive ? TEAL : NAVY,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: BODY, whiteSpace: 'nowrap',
        }}
      >
        <span>{label}</span>
        {value && (
          <span style={{ color: isActive ? TEAL : SLATE, fontWeight: 500 }}>· {value}</span>
        )}
        <span style={{ marginLeft: 2, fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          padding: 12, zIndex: 50, minWidth: width ?? 200,
        }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// Vertical option list inside a dropdown
function OptionList({
  options, value, onPick,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {options.map(o => {
        const sel = o === value;
        return (
          <button
            key={o} type="button" onClick={() => onPick(o)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: 'none',
              background: sel ? TEAL : 'transparent',
              color: sel ? '#fff' : NAVY,
              fontFamily: BODY, fontSize: 13, fontWeight: sel ? 600 : 500,
              cursor: 'pointer', textAlign: 'left',
            }}
          >{o === 'Any' ? 'Any' : o}</button>
        );
      })}
    </div>
  );
}

// ─── Listing card ─────────────────────────────────────────────────────────
function ListingCard({
  listing: l, active, onHover, onClick,
}: {
  listing: Listing;
  active: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const img = l.image_urls && l.image_urls.length > 0 ? l.image_urls[0] : null;
  const addr = [
    (l.street_address || '').split(',')[0],
    l.unit_number ? '#' + l.unit_number : '',
    l.city || '',
  ].filter(Boolean).join(' ');

  return (
    <div
      id={'card-' + l.id}
      onMouseEnter={() => onHover(l.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 10, overflow: 'hidden',
        boxShadow: active
          ? '0 0 0 2px ' + TEAL + ', 0 4px 20px rgba(0,178,204,0.18)'
          : '0 1px 4px rgba(0,0,0,0.09)',
        transition: 'box-shadow 0.15s', cursor: 'pointer', width: '100%',
      }}
    >
      <div style={{ height: 220, background: '#dde3ea', position: 'relative', overflow: 'hidden' }}>
        {img && (
          <img
            src={imgOpt(img, 640)}
            srcSet={imgSrcSet(img, [400, 640, 800])}
            sizes="(max-width: 768px) 100vw, 23vw"
            alt={addr} loading="lazy" decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {(() => {
          // Badge precedence: status FIRST, then "New" only for on-market
          // listings ≤10 days. Closed always shows Closed; Pending/AUC show
          // Pending — never "New", even if their cached DOM is low.
          const isOnMarket = l.status === 'Active' || l.status === 'ComingSoon';
          const isNew = isOnMarket && l.days_on_market != null && l.days_on_market <= 10;
          let badge: string; let bg: string;
          if (l.status === 'Closed')                                 { badge = 'Closed';       bg = '#6b7280'; }
          else if (l.status === 'Pending' || l.status === 'ActiveUnderContract') { badge = 'Pending'; bg = '#d97706'; }
          else if (l.status === 'ComingSoon')                        { badge = 'Coming Soon';  bg = '#7c3aed'; }
          else if (isNew)                                            { badge = 'New';          bg = TEAL;      }
          else                                                       { badge = l.status || 'Active'; bg = '#16a34a'; }
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: bg,
              color: '#fff', borderRadius: 4, padding: '2px 8px',
              fontSize: 10, fontWeight: 700, fontFamily: BODY,
            }}>{badge}</div>
          );
        })()}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, fontFamily: DISPLAY, marginBottom: 3 }}>
          {'$' + (l.list_price || 0).toLocaleString()}
          {l.property_type === 'ResidentialLease' && (
            <span style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginLeft: 3 }}>/mo</span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: SLATE, marginBottom: 6, fontFamily: BODY,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{addr}</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: NAVY, fontWeight: 600, fontFamily: BODY }}>
          {l.beds  != null && <span>{l.beds} bd</span>}
          {l.baths != null && <span>{l.baths} ba</span>}
          {l.sqft  != null && <span>{l.sqft.toLocaleString()} sf</span>}
        </div>
        {/* DOM suffix — only meaningful for on-market listings. Closed/Pending
            see DOM as days-as-Active (a snapshot from when they went off market),
            which would read "1,420 days on market" oddly on a card. */}
        {l.days_on_market != null && l.days_on_market > 7 &&
         (l.status === 'Active' || l.status === 'ComingSoon') && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontFamily: BODY }}>
            {l.days_on_market} days on market
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter section in drawer ─────────────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: SLATE, marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Drawer primitives (Compass-style filter panel) ────────────────────
// Section header (big, e.g. "Property Facts"). Includes a soft top divider
// for visual separation from the previous section — matches the Compass
// pattern where each named group sits in its own card-like band.
function DrawerSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div style={{
        height: 1, background: '#eef1f5',
        margin: '4px 0 18px',
      }} />
      <div style={{
        fontSize: 16, fontWeight: 800, color: NAVY, fontFamily: DISPLAY,
        marginBottom: 14,
        letterSpacing: '-0.01em',
      }}>{children}</div>
    </>
  );
}

// Section with a single small heading + children (used for the very top
// section like "Property Type" that doesn't share a header bucket).
// First-in-drawer Sections skip the top divider since there's nothing
// above them to separate from.
function DrawerSection({ label, children, first = false }: {
  label: string; children: React.ReactNode; first?: boolean;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {!first && (
        <div style={{
          height: 1, background: '#eef1f5',
          margin: '4px 0 18px',
        }} />
      )}
      <div style={{
        fontSize: 16, fontWeight: 800, color: NAVY, fontFamily: DISPLAY,
        marginBottom: 14,
        letterSpacing: '-0.01em',
      }}>{label}</div>
      {children}
    </div>
  );
}

// A labeled field inside a Section (e.g. "Square Feet" under "Property Facts").
function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: BODY,
        marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

// Custom-styled select with chevron. Native <select> for accessibility +
// mobile-friendly native picker, but with our typography + chevron icon.
function SelectDropdown({
  value, onChange, options, disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 36px 10px 14px',
          border: '1px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, fontFamily: BODY, color: disabled ? SLATE : NAVY,
          background: disabled ? '#f8fafc' : '#fff',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {/* Chevron */}
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: SLATE,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    </div>
  );
}

// Min–Max select pair (used for Sq Ft, Year Built, etc.). Renders two
// dropdowns separated by an em dash. Both share the same preset list.
function MinMaxSelect({
  minVal, maxVal, presets, formatPreset, onMin, onMax, disabledMin = false,
}: {
  minVal: string; maxVal: string;
  presets: string[];
  formatPreset: (v: string) => string;
  onMin: (v: string) => void; onMax: (v: string) => void;
  disabledMin?: boolean;
}) {
  const minOpts = presets.map(v => ({ value: v, label: v === '' ? 'No Min' : formatPreset(v) }));
  const maxOpts = presets.map(v => ({ value: v, label: v === '' ? 'No Max' : formatPreset(v) }));
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <SelectDropdown value={minVal} onChange={onMin} options={minOpts} disabled={disabledMin} />
      <span style={{ color: SLATE, fontSize: 14 }}>to</span>
      <SelectDropdown value={maxVal} onChange={onMax} options={maxOpts} />
    </div>
  );
}

// Checkbox with our NAVY/TEAL palette (the mobile sheet uses the same
// visual treatment — keeping them aligned so users feel one product).
function DrawerCheckbox({
  checked, onChange, label,
}: { checked: boolean; onChange: (c: boolean) => void; label: string }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer', userSelect: 'none',
      padding: '4px 0',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 5,
        border: `2px solid ${checked ? TEAL : '#cbd5e1'}`,
        background: checked ? TEAL : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5 9-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span style={{ fontSize: 13, color: NAVY, fontWeight: 600, fontFamily: BODY }}>
        {label}
      </span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function SearchPageClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const panelRef     = useRef<HTMLDivElement | null>(null);
  // Updated whenever listings state changes; consulted by the map-init
  // useEffect's onLoad callback so markers can be drawn for the most recent
  // fetch even though that fetch happened before the map was ready.
  const latestListingsRef = useRef<Listing[]>([]);

  // ── State, initialized from URL on mount ──
  const [filters, setFilters] = useState<Filters>(() => ({
    status:        searchParams.get('status')        || DEFAULT_FILTERS.status,
    beds:          searchParams.get('beds')          || DEFAULT_FILTERS.beds,
    baths:         searchParams.get('baths')         || DEFAULT_FILTERS.baths,
    priceMin:      searchParams.get('priceMin')      ?? DEFAULT_FILTERS.priceMin,
    priceMax:      searchParams.get('priceMax')      || '',
    city:          searchParams.get('city')          || DEFAULT_FILTERS.city,
    sqftMin:       searchParams.get('sqftMin')       || '',
    sqftMax:       searchParams.get('sqftMax')       || '',
    domMax:        searchParams.get('domMax')        || '',
    hoaMax:        searchParams.get('hoaMax')        || '',
    subtype:       searchParams.get('subtype')       || '',
    yearBuiltMin:  searchParams.get('yearBuiltMin')  || '',
    yearBuiltMax:  searchParams.get('yearBuiltMax')  || '',
    newConstruction: searchParams.get('newConstruction') === '1',
    keywords:      searchParams.get('keywords')      || '',
    statusesCsv:   searchParams.get('statusesCsv')   || '',
    amenitiesCsv:  searchParams.get('amenitiesCsv')  || '',
  }));
  const [bounds, setBounds] = useState<string>(() => {
    const b = searchParams.get('bounds');
    if (b && boundsUsable(b.split(',').map(Number))) return b;
    return DEFAULT_BOUNDS;
  });

  // Transaction mode (sale/rent) is the front-door switch above the filter
  // bar. Kept out of the Filters object so it survives Reset.
  const [transaction, setTransactionState] = useState<'sale' | 'rent'>(
    () => (searchParams.get('transaction') === 'rent' ? 'rent' : 'sale')
  );
  const setTransaction = (t: 'sale' | 'rent') => {
    if (t !== transaction) {
      // Sale and rent prices are different scales ($500k vs $5k). Clear price
      // filters when switching so the user starts fresh on the new scale.
      setFilters(f => ({ ...f, priceMin: '', priceMax: '' }));
    }
    setTransactionState(t);
  };

  const [listings,   setListings]   = useState<Listing[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [count,      setCount]      = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode,   setViewMode]   = useState<'split' | 'map' | 'list'>('split');
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [isMobile,   setIsMobile]   = useState(false);
  // Location persists across listing detail navigation via sessionStorage.
  // Without this, a bfcache miss on Back resets location to null — the
  // LocationSearch chip disappears and the fetch goes out without the
  // location filter params, so results un-narrow. Mobile uses the same
  // pattern (see SearchPageMobile.tsx).
  const [location, setLocation] = useState<LocationFilter | null>(() => {
    // Deep link from the homepage hero search: ?loc=<encoded LocationFilter>.
    try {
      const u = new URLSearchParams(window.location.search).get('loc');
      if (u) return JSON.parse(u) as LocationFilter;
    } catch {}
    try {
      const saved = sessionStorage.getItem('mlg_desktop_search');
      if (saved) return JSON.parse(saved).location || null;
    } catch {}
    return null;
  });
  // Set when the user picks a location in the typeahead; the NEXT fetch
  // omits the map bounds (zip/city may be outside the current viewport —
  // bounds ∩ new-location would return nothing) and then fits the map to
  // the returned pins. Ported from mlg-site's working search (Patrick's
  // 2026-05-26 rule: picking a zip zooms the map; panning re-narrows).
  const locationJustChangedRef = useRef(false);
  useEffect(() => {
    try {
      if (location) sessionStorage.setItem('mlg_desktop_search', JSON.stringify({ location }));
      else          sessionStorage.removeItem('mlg_desktop_search');
    } catch {}
  }, [location]);
  // Drip-email deep link state. When ?drip=<uuid> is in the URL, we
  // resolve it via /api/search/drip/[id] and override the result set to
  // exactly the MLS IDs that were sent in that email. The banner shows
  // the contact who they're acting as (in case the link is forwarded)
  // and lets them dismiss back to the default search.
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

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // CRM hand-off: when an agent on team.mlrecloud.com clicks "Create
  // saved search for [Name]" on a contact page, that link sends them
  // here with ?contact_id and ?contact_name. We display a sticky
  // attribution badge so the agent can't accidentally save for the
  // wrong client, and pass the IDs through to SaveSearchModal.
  const contactForSearch = useMemo(() => {
    const id = searchParams.get('contact_id');
    const name = searchParams.get('contact_name');
    return id && name ? { id, name } : null;
  }, [searchParams]);
  // On mobile we force list-only mode regardless of state. The map view is a
  // poor experience on a phone (tiny pins, popup eats half the screen, and
  // scroll-zoom fights the page scroll). Users get the per-listing map on
  // the detail page instead.
  // Declared AFTER isMobile because const access is in the temporal dead
  // zone — referencing isMobile before its declaration throws.
  const effectiveViewMode = isMobile ? 'list' : viewMode;

  // ── Mobile detection ──
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Sync state → URL (debounced for bounds) ──
  useEffect(() => {
    const params = new URLSearchParams();
    // Preserve the contact-attribution params across every URL rewrite.
    // Otherwise the very first filter / bounds change strips them from
    // the URL and the green "Saving for [Name]" banner disappears within
    // milliseconds of landing — the agent never sees it. Save-search
    // also needs contact_id to bind the new search to the contact.
    if (contactForSearch) {
      params.set('contact_id',   contactForSearch.id);
      params.set('contact_name', contactForSearch.name);
    }
    (Object.entries(filters) as [keyof Filters, string | boolean][]).forEach(([k, v]) => {
      // Skip falsy values and values equal to the default (keeps the URL clean
      // of `?status=On Market` etc). Booleans serialize as '1' to keep the
      // URL short and to mirror how the mobile sheet writes it.
      if (v === DEFAULT_FILTERS[k]) return;
      if (typeof v === 'boolean') {
        if (v) params.set(k, '1');
      } else if (v) {
        params.set(k, v);
      }
    });
    if (bounds && bounds !== DEFAULT_BOUNDS) params.set('bounds', bounds);
    const qs = params.toString();
    const url = qs ? `/search?${qs}` : '/search';
    // Use replace so we don't pollute browser history with every map nudge.
    router.replace(url, { scroll: false });
  }, [filters, bounds, router, contactForSearch]);

  // ── Map init ──
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Default center/zoom; we'll fitBounds afterward if URL has bounds.
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: defaultCenter(), // derived from DEFAULT_BOUNDS, never hand-set
      zoom: 13,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    // LM brand — faded turquoise water (#c6e9ee)
    map.on('style.load', () => { map.setPaintProperty('water', 'fill-color', '#c6e9ee') });

    const updateBounds = () => {
      const b = map.getBounds();
      if (!b) return;
      setBounds(`${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`);
    };

    map.on('load', () => {
      // Restore from URL bounds if present.
      const urlBounds = searchParams.get('bounds');
      if (urlBounds) {
        const parsed = urlBounds.split(',').map(Number);
        if (boundsUsable(parsed)) {
          const [w, s, e, n] = parsed;
          map.fitBounds([[w, s], [e, n]], { padding: 0, duration: 0 });
        }
        // else: ignore the stale/off-region viewport; keep the default
        // county view so the page never opens blank.
      }
      updateBounds();
    });
    map.on('moveend', updateBounds);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ZIP boundary outline ─────────────────────────────────────────────
  // When the user picks a ZIP via the location typeahead, draw the actual
  // postal boundary on the map (Compass-style). Boundaries come from the
  // OpenDataDE Florida ZIP GeoJSON, fetched lazily once and cached so
  // subsequent ZIP changes are instant.
  const flZipsRef = useRef<any | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const zip = location?.filter?.zip;

    const clearZipLayer = () => {
      // Guard against Mapbox mid-teardown during route transitions.
      // When a user clicks a listing card from /search, this component
      // unmounts and the cleanup fires clearZipLayer() — but Mapbox has
      // already nulled its internal `style` object by then, so getLayer()
      // throws "Cannot read properties of undefined (reading 'getOwnLayer')"
      // and the user sees the Next.js client-side exception screen on the
      // listing page. Belt-and-suspenders: each remove is also try/caught
      // in case style teardown is partial.
      if (!map || (map as any)._removed) return;
      try { if (!map.getStyle()) return; } catch { return; }
      try { if (map.getLayer('zip-boundary-fill')) map.removeLayer('zip-boundary-fill'); } catch {}
      try { if (map.getLayer('zip-boundary-line')) map.removeLayer('zip-boundary-line'); } catch {}
      try { if (map.getSource('zip-boundary')) map.removeSource('zip-boundary'); } catch {}
    };

    if (!zip) { clearZipLayer(); return; }

    let cancelled = false;
    (async () => {
      if (!flZipsRef.current) {
        try {
          const r = await fetch('https://cdn.jsdelivr.net/gh/OpenDataDE/State-zip-code-GeoJSON@master/fl_florida_zip_codes_geo.min.json');
          flZipsRef.current = await r.json();
        } catch (e) {
          console.warn('ZIP GeoJSON fetch failed', e);
          return;
        }
      }
      if (cancelled) return;
      const feature = (flZipsRef.current?.features || [])
        .find((f: any) => f?.properties?.ZCTA5CE10 === zip);
      if (!feature) return;

      const ensureMapReady = () => {
        if (!map.isStyleLoaded()) {
          map.once('styledata', addLayer);
        } else {
          addLayer();
        }
      };
      const addLayer = () => {
        if (cancelled) return;
        clearZipLayer();
        map.addSource('zip-boundary', { type: 'geojson', data: feature });
        map.addLayer({
          id: 'zip-boundary-fill', type: 'fill', source: 'zip-boundary',
          paint: { 'fill-color': TEAL, 'fill-opacity': 0.06 },
        });
        map.addLayer({
          id: 'zip-boundary-line', type: 'line', source: 'zip-boundary',
          paint: {
            'line-color': TEAL,
            'line-width': 2.5,
            'line-dasharray': [2, 1.5],
          },
        });
      };
      ensureMapReady();
    })();

    return () => { cancelled = true; clearZipLayer(); };
  }, [location]);

  // ── Scroll a card to the top of the right panel ──
  // scrollIntoView({block:'nearest'}) only nudges the card if it's outside
  // the viewport, so a card already visible at the bottom stays at the
  // bottom. Compute scrollTop directly for guaranteed top alignment.
  const scrollCardToTop = useCallback((id: string) => {
    const panel = panelRef.current;
    const card  = document.getElementById('card-' + id);
    if (!panel || !card) return;
    panel.scrollTo({ top: card.offsetTop - panel.offsetTop - 8, behavior: 'smooth' });
  }, []);

  // ── Compass-style popup on pin click ──
  // One popup at a time; opens above the pin and shows photo, price, addr,
  // beds/baths/sqft, and a "View details →" CTA. Click anywhere on the
  // popup body navigates to the listing detail page (router.push, no full
  // reload). Closing the popup clears active state.
  const openPinPopup = useCallback((l: Listing) => {
    const map = mapRef.current;
    if (!map || l.latitude == null || l.longitude == null) return;

    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }

    const img       = l.image_urls?.[0] ? imgOpt(l.image_urls[0], 400) : '';
    const addrLine1 = String(l.street_address || '').split(',')[0]
                    + (l.unit_number ? ' #' + l.unit_number : '');
    const addrLine2 = [l.city, l.state, l.zip].filter(Boolean).join(', ');
    const beds      = l.beds  != null ? `${l.beds} bd`  : '';
    const baths     = l.baths != null ? `${l.baths} ba` : '';
    const sqft      = l.sqft  != null ? `${l.sqft.toLocaleString()} sf` : '';
    const meta      = [beds, baths, sqft].filter(Boolean).join(' · ');
    const slug      = slugifyListing(l);

    const html = `
      <a href="/listings/${slug}" data-popup-link style="display:block;text-decoration:none;color:inherit;width:240px;cursor:pointer;">
        ${img ? `<div style="height:130px;background:#dde3ea;overflow:hidden;border-radius:8px 8px 0 0;">
          <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'" />
        </div>` : ''}
        <div style="padding:10px 12px 12px;">
          <div style="font-family:${DISPLAY};font-size:15px;font-weight:800;color:${NAVY};margin-bottom:3px;">$${(l.list_price || 0).toLocaleString()}${l.property_type === 'ResidentialLease' ? '<span style="font-size:11px;font-weight:600;color:'+SLATE+';margin-left:3px;">/mo</span>' : ''}</div>
          <div style="font-family:${BODY};font-size:11px;color:${SLATE};line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${addrLine1}</div>
          <div style="font-family:${BODY};font-size:10px;color:#94a3b8;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${addrLine2}</div>
          ${meta ? `<div style="font-family:${BODY};font-size:11px;color:${NAVY};font-weight:600;margin-bottom:8px;">${meta}</div>` : ''}
          <div style="font-family:${DISPLAY};font-size:11px;font-weight:700;color:${TEAL};text-transform:uppercase;letter-spacing:0.04em;">View details →</div>
        </div>
      </a>
    `;

    const popup = new mapboxgl.Popup({
      offset: 18,
      closeButton: true,
      closeOnClick: false,
      maxWidth: '260px',
      className: 'mlg-listing-popup',
    })
      .setLngLat([l.longitude, l.latitude])
      .setHTML(html)
      .addTo(map);

    const linkEl = popup.getElement()?.querySelector('[data-popup-link]') as HTMLAnchorElement | null;
    if (linkEl) {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        router.push('/listings/' + slug);
      });
    }
    popup.on('close', () => {
      if (popupRef.current === popup) popupRef.current = null;
      setActiveId(null);
    });

    popupRef.current = popup;
  }, [router]);

  // ── Map markers ──
  const updateMarkers = useCallback((items: Listing[]) => {
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const map = mapRef.current;
    if (!map) return;
    // Status → pin color. Tuned to MLG palette + general convention:
    // teal/navy for live, amber for under-contract / pending,
    // grey for closed. New (DOM≤10) gets a brighter accent.
    const colorFor = (l: Listing): { bg: string; fg: string; border: string } => {
      const isNew = (l.days_on_market != null && l.days_on_market <= 10);
      if (l.status === 'Closed')              return { bg: '#fff', fg: '#6b7280', border: '#9ca3af' };
      if (l.status === 'Pending'
       || l.status === 'ActiveUnderContract') return { bg: '#fff', fg: '#b45309', border: '#f59e0b' };
      if (l.status === 'ComingSoon')          return { bg: '#fff', fg: '#7c3aed', border: '#a78bfa' };
      if (isNew)                              return { bg: TEAL,    fg: '#fff',  border: TEAL    };
      return                                          { bg: '#fff', fg: NAVY,    border: NAVY    };
    };
    items.forEach(l => {
      if (!l.latitude || !l.longitude) return;
      const c = colorFor(l);
      const el = document.createElement('div');
      el.innerText = fmtPrice(l.list_price);
      el.style.cssText = [
        `background:${c.bg}`, `color:${c.fg}`, `border:2px solid ${c.border}`,
        'border-radius:20px', 'padding:4px 8px', 'font-size:11px',
        'font-weight:700', 'cursor:pointer', 'white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.15)', `font-family:${BODY}`,
      ].join(';');
      el.addEventListener('mouseenter', () => {
        el.style.background = TEAL; el.style.color = '#fff'; el.style.borderColor = TEAL;
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = c.bg; el.style.color = c.fg; el.style.borderColor = c.border;
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveId(l.id);
        scrollCardToTop(l.id);
        openPinPopup(l);
      });
      markersRef.current.push(
        new mapboxgl.Marker({ element: el })
          .setLngLat([l.longitude, l.latitude])
          .addTo(map)
      );
    });
  }, []);

  // ── Fetch listings ──
  const fetchListings = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ bounds, limit: '150' });
    // Skip bounds on the fetch right after a location pick — the picked
    // zip/city may be entirely outside the current viewport (bounds ∩
    // new-location would return nothing, leaving no pins to fit to).
    if (locationJustChangedRef.current) p.delete('bounds');
    p.set('transaction', transaction);  // sale is server default but be explicit
  // Default sort: newest listings first (DOM asc), then most photos
  if (!p.has('sort')) p.set('sort', 'dom_asc');
    // Drip-email deep link: forces the result set to the exact MLS IDs
    // that were in the email. API also drops the default On-Market status
    // filter when mls_ids is set so a listing that went Pending since the
    // email still appears.
    if (drip && drip.mls_ids.length > 0) {
      p.set('mls_ids', drip.mls_ids.join(','));
    }
    // Status: if the user has touched the drawer's multi-select checkboxes
    // we send a CSV via `statuses` (which the API gives precedence to).
    // Otherwise fall back to the simple top-bar single-select.
    if (filters.statusesCsv) {
      p.set('statuses', filters.statusesCsv);
    } else {
      const apiStatus = STATUS_LABEL_TO_API[filters.status] || filters.status;
      p.set('status', apiStatus);
    }
    if (filters.beds  !== 'Any') p.set('beds_min',  filters.beds.replace('+', ''));
    if (filters.baths !== 'Any') p.set('baths_min', filters.baths.replace('+', ''));
    if (filters.priceMin) p.set('priceMin', filters.priceMin);
    if (filters.priceMax) p.set('priceMax', filters.priceMax);
    if (filters.city !== 'Any') p.set('city', filters.city);
    // Location filter from typeahead — overrides city filter
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
    if (filters.sqftMin) p.set('sqft_min', filters.sqftMin);
    if (filters.sqftMax) p.set('sqft_max', filters.sqftMax);
    if (filters.domMax)  p.set('dom_max',  filters.domMax);
    if (filters.hoaMax)  p.set('hoa_max',  filters.hoaMax);
    if (filters.subtype) p.set('property_subtype', filters.subtype);
    // New Construction is a UX shortcut for "year_built >= 2025"; mirrors
    // the mobile filter sheet so both surfaces produce identical results.
    const effectiveYearMin = filters.newConstruction ? '2025' : filters.yearBuiltMin;
    if (effectiveYearMin) p.set('year_built_min', effectiveYearMin);
    if (filters.yearBuiltMax) p.set('year_built_max', filters.yearBuiltMax);
    // Keywords: simple ILIKE on description for Stage 1 (good enough for
    // "waterfront", "renovated", "pool"). Stage 2 will swap in semantic
    // search over description embeddings.
    if (filters.keywords && filters.keywords.trim()) p.set('keywords', filters.keywords.trim());
    // Amenities CSV: each value contributes one description-ILIKE on the
    // server, AND'd together (must have ALL of them).
    if (filters.amenitiesCsv) p.set('amenities', filters.amenitiesCsv);
    try {
      const res  = await fetch('/api/search?' + p.toString());
      const data = await res.json();
      const items: Listing[] = Array.isArray(data.listings) ? data.listings : [];
      // Office priority sort now happens server-side in /api/search via the
      // `properties_search` view — we just render whatever the API returns.
      // (Old client-side sort only reordered the page already returned, so
      // priority listings could miss page 1 entirely and never show. Server
      // sort guarantees they always lead the default view.)
      setListings(items);
      latestListingsRef.current = items;
      setCount(data.count ?? items.length);
      updateMarkers(items);
      // Location just picked → move the map to the results (bbox of the
      // returned pins; works uniformly for zips, cities, buildings — no
      // per-place geo data needed). The programmatic move fires moveend →
      // bounds update → one cheap refetch under the new viewport, which
      // returns the same set (every pin is inside the fitted box).
      if (locationJustChangedRef.current && mapRef.current && items.length > 0) {
        const lats = items.map(l => l.latitude).filter((n: any) => Number.isFinite(n)) as number[];
        const lngs = items.map(l => l.longitude).filter((n: any) => Number.isFinite(n)) as number[];
        if (lats.length > 0 && lngs.length > 0) {
          const s2 = Math.min(...lats), n2 = Math.max(...lats);
          const w2 = Math.min(...lngs), e2 = Math.max(...lngs);
          mapRef.current.fitBounds([[w2, s2], [e2, n2]], { padding: 60, duration: 600, maxZoom: 14 });
        }
      }
    } catch (err) {
      console.error('Search fetch error:', err);
    } finally {
      locationJustChangedRef.current = false;
      setLoading(false);
    }
  }, [bounds, filters, transaction, location, updateMarkers, drip]);

  // Recenter the map (and result set) to the full county view — the escape
  // hatch from an empty/off-region viewport (e.g. a stale shared link).
  const resetMapView = useCallback(() => {
    const [w, s2, e, n] = DEFAULT_BOUNDS.split(',').map(Number);
    if (mapRef.current) {
      mapRef.current.fitBounds([[w, s2], [e, n]], { padding: 0, duration: 400 });
    } else {
      setBounds(DEFAULT_BOUNDS);  // map not ready yet — at least refetch wide
    }
  }, []);

  // Debounce the fetch when the user is typing in the Keywords box.
  // Every other filter change is discrete (click a chip / checkbox), so
  // immediate fetch is correct there. Only keyword typing — which fires
  // a state update on every keystroke — needs the throttle.
  useEffect(() => {
    const t = setTimeout(() => { fetchListings(); }, 250);
    return () => clearTimeout(t);
  }, [fetchListings]);

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters(prev => ({ ...prev, [k]: v }));

  const moreFilterCount =
    (filters.statusesCsv ? 1 : 0) +
    (filters.subtype ? 1 : 0) +
    (filters.city !== DEFAULT_FILTERS.city ? 1 : 0) +
    (filters.sqftMin || filters.sqftMax ? 1 : 0) +
    (filters.yearBuiltMin || filters.yearBuiltMax || filters.newConstruction ? 1 : 0) +
    (filters.hoaMax  ? 1 : 0) +
    (filters.domMax  ? 1 : 0) +
    (filters.amenitiesCsv ? (filters.amenitiesCsv.split(',').filter(Boolean).length || 0) : 0) +
    (filters.keywords ? 1 : 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: BODY, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Contact attribution banner — agent landed here from a CRM contact
          page. Persistent so it's always visible while building the search;
          click-to-clear lets the agent break the association if they
          actually meant to save for themselves. */}
      {contactForSearch && (
        <div style={{
          background: '#ecfdf5', borderBottom: '1px solid #a7f3d0',
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontFamily: BODY, color: '#065f46',
        }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <span>
            Saving for <strong>{contactForSearch.name}</strong>. They'll receive drip emails
            when you save this search.
          </span>
          <button
            type="button"
            onClick={() => router.replace('/search', { scroll: false })}
            style={{
              marginLeft: 'auto', padding: '4px 10px', borderRadius: 999,
              border: '1px solid #a7f3d0', background: '#fff',
              color: '#065f46', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: BODY,
            }}
          >Clear</button>
        </div>
      )}

      {/* Top bar — always wrap so narrowing the window pushes buttons to
          the next row instead of clipping them off-screen. */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8edf2',
        padding: isMobile ? '10px 12px' : '12px 20px',
        display: 'flex', alignItems: 'center', gap: 8, rowGap: 8,
        flexShrink: 0, zIndex: 30,
        flexWrap: 'wrap',
      }}>
        {/* Location typeahead — Compass-style search box */}
        <div style={{ flex: 1, minWidth: 240, maxWidth: 480 }}>
          <LocationSearch
            value={location}
            transaction={transaction}
            onChange={(loc) => {
              locationJustChangedRef.current = !!loc;
              setLocation(loc);
              // Drill-ins (building, community, address) clear the broad
              // range filters — sticky $500K+/3BR+ noise hides the very
              // listings the user came for. ZIP and city picks are NOT
              // drill-ins, they're additive filters layered on top of the
              // user's existing preferences; preserve everything in those
              // cases. (Patrick's bug, 2026-05-28: picking 33401 was
              // wiping his price/beds/baths.)
              const isDrillIn = loc?.type === 'building' || loc?.type === 'community' || loc?.type === 'address' || (loc?.type === 'page' && loc?.page_type !== 'city');
              if (loc && isDrillIn) setFilters(f => ({
                ...f,
                city:     'Any',
                priceMin: '',
                priceMax: '',
                beds:     'Any',
                baths:    'Any',
                sqftMin:  '',
                sqftMax:  '',
                domMax:   '',
                hoaMax:   '',
                yearBuiltMin: '',
                yearBuiltMax: '',
              }));
            }}
            placeholder="City, ZIP, building, or community..."
          />
        </div>

        {/* Sale / Rent toggle — front-door choice; drives transaction param */}
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: 999,
          padding: 3, marginRight: 6,
        }}>
          {(['sale', 'rent'] as const).map(t => (
            <button
              key={t} type="button"
              onClick={() => setTransaction(t)}
              style={{
                padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: transaction === t ? '#fff' : 'transparent',
                color: transaction === t ? NAVY : SLATE,
                fontSize: 12, fontWeight: 700, fontFamily: BODY,
                whiteSpace: 'nowrap',
                boxShadow: transaction === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {t === 'sale' ? 'For Sale' : 'For Rent'}
            </button>
          ))}
        </div>

        {/* Status dropdown — when the drawer's multi-select is active,
            mirror that count instead of the stale single-select label.
            Clicking a top-bar option clears the drawer override so the
            user can roll back to a simple single status without hunting
            for it. */}
        {(() => {
          const drawerStatuses = filters.statusesCsv
            ? filters.statusesCsv.split(',').filter(Boolean)
            : null;
          const displayValue = drawerStatuses
            ? `${drawerStatuses.length} selected`
            : filters.status;
          const isActive = drawerStatuses
            ? true
            : filters.status !== DEFAULT_FILTERS.status;
          return (
            <Dropdown label="Status" value={displayValue} isActive={isActive}>
              {(close) => (
                <OptionList
                  options={STATUS_OPTIONS}
                  value={drawerStatuses ? '' : filters.status}
                  onPick={(v) => {
                    setFilter('status', v);
                    // Picking a top-bar option clears any drawer multi-select.
                    if (drawerStatuses) setFilter('statusesCsv', '');
                    close();
                  }}
                />
              )}
            </Dropdown>
          );
        })()}

        {/* Price — Compass-style Min/Max dropdowns with preset buckets.
            Tier-aware: presets switch between sale ($100K-$50M) and rent
            ($500-$50K/mo) based on the For Sale / For Rent toggle. */}
        <Dropdown
          label="Price"
          value={priceLabel(filters.priceMin, filters.priceMax)}
          isActive={!!filters.priceMin || !!filters.priceMax}
          width={300}
        >
          {(close) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MinMaxSelect
                minVal={filters.priceMin}
                maxVal={filters.priceMax}
                presets={transaction === 'rent' ? PRICE_PRESETS_RENT : PRICE_PRESETS_SALE}
                formatPreset={fmtPricePreset}
                onMin={(v) => setFilter('priceMin', v)}
                onMax={(v) => setFilter('priceMax', v)}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { setFilter('priceMin', ''); setFilter('priceMax', ''); }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: SLATE, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: BODY }}
                >Reset</button>
                <button
                  type="button" onClick={close}
                  style={{ flex: 2, padding: '7px 0', borderRadius: 6, border: 'none', background: TEAL, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: BODY }}
                >Done</button>
              </div>
            </div>
          )}
        </Dropdown>

        {/* Beds — single Min dropdown. Patrick's call (2026-05-27): the
            earlier Min/Max range picker enabled impossible combos like
            Min 3 + Max 2 and didn't match how buyers actually search. */}
        <Dropdown
          label="Beds"
          value={filters.beds === 'Any' ? '' : filters.beds}
          isActive={filters.beds !== 'Any'}
          width={140}
        >
          {(close) => (
            <OptionList
              options={BED_OPTIONS}
              value={filters.beds}
              onPick={(v) => { setFilter('beds', v); close(); }}
            />
          )}
        </Dropdown>

        {/* Baths — single Min dropdown (same reasoning as Beds). */}
        <Dropdown
          label="Baths"
          value={filters.baths === 'Any' ? '' : filters.baths}
          isActive={filters.baths !== 'Any'}
          width={140}
        >
          {(close) => (
            <OptionList
              options={BATH_OPTIONS}
              value={filters.baths}
              onPick={(v) => { setFilter('baths', v); close(); }}
            />
          )}
        </Dropdown>

        {/* More filters drawer trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          style={{
            padding: '7px 12px', borderRadius: 6,
            border: `1px solid ${moreFilterCount > 0 ? TEAL : '#e2e8f0'}`,
            background: moreFilterCount > 0 ? '#e6f9fd' : '#fff',
            color: moreFilterCount > 0 ? TEAL : NAVY,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: BODY,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⚙ More{moreFilterCount > 0 ? ` (${moreFilterCount})` : ''}
        </button>

        {/* Save Search — Compass-style outlined teal pill with bell. Saves
            the current filter set + map area so the user can subscribe to
            updates. Only shows when at least one filter or location chip
            is in play (no point saving the default unfiltered view). */}
        {(moreFilterCount > 0 || location || filters.priceMin || filters.priceMax
          || filters.beds !== 'Any' || filters.baths !== 'Any') && (
          <button
            type="button"
            onClick={() => setSaveModalOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              border: `1.5px solid ${TEAL}`, background: '#fff',
              color: TEAL, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: BODY,
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TEAL; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff';  e.currentTarget.style.color = TEAL;  }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Save Search
          </button>
        )}

        {/* Account pushed to far right via marginLeft: auto. Result count
            moved to the active-filter pills row below. */}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <AccountButton />
        </div>
      </div>

      {/* Active filter pills row — Compass-style. Shows every non-default
          filter as a removable chip, so the user can see what's narrowing
          their results and zap any one with a click instead of hunting
          through the drawer. */}
      {(() => {
        const pills: { key: string; label: string; clear: () => void }[] = [];

        // City (CSV — one pill per selected city, click to deselect just that one)
        if (filters.city && filters.city !== DEFAULT_FILTERS.city) {
          const cities = filters.city.split(',').map(s => s.trim()).filter(Boolean);
          for (const city of cities) {
            pills.push({
              key: 'city-' + city, label: city,
              clear: () => {
                const next = cities.filter(c => c !== city);
                setFilter('city', next.length === 0 ? DEFAULT_FILTERS.city : next.join(','));
              },
            });
          }
        }
        // Beds (min only)
        if (filters.beds !== DEFAULT_FILTERS.beds) {
          pills.push({ key: 'beds', label: `${filters.beds} bd`, clear: () => setFilter('beds', DEFAULT_FILTERS.beds) });
        }
        // Baths (min only)
        if (filters.baths !== DEFAULT_FILTERS.baths) {
          pills.push({ key: 'baths', label: `${filters.baths} ba`, clear: () => setFilter('baths', DEFAULT_FILTERS.baths) });
        }
        // Price
        const priceShown = priceLabel(filters.priceMin, filters.priceMax);
        if (priceShown && (filters.priceMin !== DEFAULT_FILTERS.priceMin || filters.priceMax !== DEFAULT_FILTERS.priceMax)) {
          pills.push({ key: 'price', label: priceShown, clear: () => { setFilter('priceMin', ''); setFilter('priceMax', ''); } });
        }
        // Property Type — one pill per matched label
        if (filters.subtype) {
          const selected = new Set(filters.subtype.split(',').filter(Boolean));
          for (const pt of PROPERTY_TYPES) {
            if (pt.values.every(v => selected.has(v))) {
              pills.push({
                key: `pt-${pt.label}`, label: pt.label,
                clear: () => {
                  const next = new Set(selected);
                  pt.values.forEach(v => next.delete(v));
                  setFilter('subtype', Array.from(next).join(','));
                },
              });
            }
          }
        }
        // Status (drawer multi-select takes precedence over single-select)
        if (filters.statusesCsv) {
          const selected = new Set(filters.statusesCsv.split(',').filter(Boolean));
          for (const opt of STATUS_CHECKBOX_OPTIONS) {
            if (opt.values.every(v => selected.has(v))) {
              pills.push({
                key: `st-${opt.label}`, label: opt.label,
                clear: () => {
                  const next = new Set(selected);
                  opt.values.forEach(v => next.delete(v));
                  setFilter('statusesCsv', Array.from(next).join(','));
                },
              });
            }
          }
        } else if (filters.status !== DEFAULT_FILTERS.status) {
          pills.push({ key: 'status', label: filters.status, clear: () => setFilter('status', DEFAULT_FILTERS.status) });
        }
        // Sq Ft
        if (filters.sqftMin || filters.sqftMax) {
          const lo = filters.sqftMin ? Number(filters.sqftMin).toLocaleString() : '';
          const hi = filters.sqftMax ? Number(filters.sqftMax).toLocaleString() : '';
          pills.push({
            key: 'sqft',
            label: lo && hi ? `${lo} to ${hi} sqft` : lo ? `${lo}+ sqft` : `≤${hi} sqft`,
            clear: () => { setFilter('sqftMin', ''); setFilter('sqftMax', ''); },
          });
        }
        // Year Built / New Construction
        if (filters.newConstruction) {
          pills.push({ key: 'nc', label: 'New Construction', clear: () => setFilter('newConstruction', false) });
        } else if (filters.yearBuiltMin || filters.yearBuiltMax) {
          pills.push({
            key: 'yr',
            label: `Built ${filters.yearBuiltMin || '*'} to ${filters.yearBuiltMax || '*'}`,
            clear: () => { setFilter('yearBuiltMin', ''); setFilter('yearBuiltMax', ''); },
          });
        }
        // Max HOA
        if (filters.hoaMax) {
          pills.push({ key: 'hoa', label: `HOA ≤ $${Number(filters.hoaMax).toLocaleString()}`, clear: () => setFilter('hoaMax', '') });
        }
        // Time on Market
        if (filters.domMax) {
          pills.push({ key: 'dom', label: `≤${filters.domMax} days`, clear: () => setFilter('domMax', '') });
        }
        // Amenities — one pill per checked
        if (filters.amenitiesCsv) {
          for (const a of filters.amenitiesCsv.split(',').filter(Boolean)) {
            const opt = AMENITY_OPTIONS.find(o => o.value === a);
            pills.push({
              key: `am-${a}`, label: opt?.label.replace(/^Must Have /, '') || a,
              clear: () => {
                const next = filters.amenitiesCsv.split(',').filter(v => v && v !== a);
                setFilter('amenitiesCsv', next.join(','));
              },
            });
          }
        }
        // Keywords
        if (filters.keywords) {
          pills.push({ key: 'kw', label: `"${filters.keywords}"`, clear: () => setFilter('keywords', '') });
        }

        // Always render the row — it carries the listing count on the
        // right even when there are no active filters to show on the left.
        return (
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #e8edf2',
            padding: '8px 20px',
            display: 'flex', gap: 6, flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: 38,  // keeps row height consistent when empty
          }}>
            {pills.map(p => (
              <button
                key={p.key} type="button" onClick={p.clear}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px 5px 12px',
                  borderRadius: 999,
                  border: '1px solid #cce7ec',
                  background: '#e6f9fd',
                  color: NAVY, fontSize: 12, fontWeight: 600,
                  fontFamily: BODY, cursor: 'pointer',
                }}
                title="Click to remove"
              >
                {p.label}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, borderRadius: 999,
                  background: 'rgba(13,23,59,0.08)', color: NAVY,
                  fontSize: 11, lineHeight: 1,
                }}>×</span>
              </button>
            ))}
            {pills.length > 1 && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                style={{
                  marginLeft: 8, padding: '5px 10px',
                  borderRadius: 999, border: '1px solid #e2e8f0',
                  background: '#fff', color: SLATE,
                  fontSize: 11, fontWeight: 600, fontFamily: BODY,
                  cursor: 'pointer',
                }}
              >Clear all</button>
            )}

            {/* Listing count — pushed to the far right of the same row.
                Aligns under the Beds/Baths/Status pills above on wide
                screens; wraps onto its own line on narrow screens. */}
            <div style={{
              marginLeft: 'auto', flexShrink: 0,
              fontSize: 12, fontWeight: 600, color: NAVY,
              fontFamily: BODY, whiteSpace: 'nowrap',
            }}>
              {loading ? 'Loading…' : `${count.toLocaleString()} listings`}
            </div>
          </div>
        );
      })()}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {effectiveViewMode !== 'list' && (
          <div ref={mapContainer} style={{
            flexBasis: effectiveViewMode === 'split' ? '55%' : '100%',
            flexGrow: 0, flexShrink: 0, minHeight: 0,
          }} />
        )}

        {effectiveViewMode !== 'map' && (
          <div ref={panelRef} style={{
            flexBasis: effectiveViewMode === 'split' ? '45%' : '100%',
            flexGrow: 0, flexShrink: 0, overflowY: 'auto',
            background: '#f0f4f8',
            padding: isMobile ? 10 : 12, minHeight: 0, boxSizing: 'border-box',
          }}>
            {drip && (
              <div style={{
                marginBottom: 12, padding: '12px 14px', borderRadius: 10,
                background: '#e6f9fd', border: '1px solid #b5e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                fontFamily: BODY,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700, color: TEAL }}>
                    Saved Search Alert
                  </div>
                  <div style={{ fontSize: 13, color: NAVY, marginTop: 2 }}>
                    {drip.mls_ids.length} listing{drip.mls_ids.length === 1 ? '' : 's'} from your <strong>{drip.search?.name || 'saved search'}</strong> alert sent {new Date(drip.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setDrip(null); router.replace('/search', { scroll: false }); }}
                  style={{
                    flexShrink: 0, background: '#fff', border: '1px solid #b5e8f0',
                    color: NAVY, padding: '6px 12px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: BODY,
                  }}
                  title="Clear and return to full search"
                >Show all listings</button>
              </div>
            )}
            {loading && listings.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: SLATE, fontSize: 13, fontFamily: BODY }}>
                Loading listings…
              </div>
            )}
            {!loading && listings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: SLATE, fontSize: 13, fontFamily: BODY }}>
                <div style={{ marginBottom: 16, lineHeight: 1.6 }}>
                  No listings match these filters in the current map view.<br />
                  Try widening the map or clearing a filter.
                </div>
                <button
                  type="button"
                  onClick={resetMapView}
                  style={{
                    fontFamily: DISPLAY, fontWeight: 700, fontSize: 13,
                    background: TEAL, color: NAVY, border: 'none',
                    padding: '11px 22px', borderRadius: 99, cursor: 'pointer',
                  }}
                >
                  Reset to all of Palm Beach County
                </button>
              </div>
            )}
            {listings.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 12 : 10 }}>
                {listings.map(l => (
                  <ListingCard
                    key={l.id} listing={l}
                    active={l.id === activeId}
                    onHover={setActiveId}
                    onClick={() => router.push('/listings/' + slugifyListing(l))}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer for advanced filters — Compass-style wider panel, 2-col grid,
          dropdown selects for predefined ranges, checkboxes for multi-select. */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{
            width: 'min(520px, 90vw)', background: '#fff',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 28px',
              borderBottom: '1px solid #eef1f5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, fontFamily: DISPLAY }}>More Filters</div>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: SLATE, lineHeight: 1 }}>✕</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              {/* Listing Status removed from the drawer 2026-05-28 — the
                  top-bar already has a Status dropdown right next to the
                  search box, so duplicating it here was redundant. The
                  statusesCsv filter state stays in case shared URLs still
                  carry it, but no UI sets it from the drawer anymore. */}

              {/* ── Property Type — multi-select checkboxes ── */}
              <DrawerSection label="Property Type" first>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                  {PROPERTY_TYPES
                    .filter(t => transaction === 'sale' || t.label !== 'Land')
                    .map(t => {
                      const csvValues = t.values.join(',');
                      const selectedCsv = new Set((filters.subtype || '').split(',').filter(Boolean));
                      const allOn = t.values.every(v => selectedCsv.has(v));
                      return (
                        <DrawerCheckbox
                          key={t.label}
                          checked={allOn}
                          label={t.label}
                          onChange={(c) => {
                            const next = new Set(selectedCsv);
                            if (c) t.values.forEach(v => next.add(v));
                            else  t.values.forEach(v => next.delete(v));
                            setFilter('subtype', Array.from(next).join(','));
                          }}
                        />
                      );
                    })}
                </div>
              </DrawerSection>

              {/* ── City — multi-select checkboxes, full PBC list. CSV stored
                  in filters.city; 'Any' (or empty) means no city filter. */}
              <DrawerSection label="City">
                {(() => {
                  const selected = new Set(
                    filters.city && filters.city !== 'Any'
                      ? filters.city.split(',').map(s => s.trim()).filter(Boolean)
                      : []
                  );
                  const toggle = (city: string) => {
                    const next = new Set(selected);
                    if (next.has(city)) next.delete(city); else next.add(city);
                    setFilter('city', next.size === 0 ? 'Any' : Array.from(next).join(','));
                  };
                  return (
                    <>
                      {selected.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilter('city', 'Any')}
                          style={{
                            marginBottom: 10, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid #e2e8f0', background: '#fff',
                            color: SLATE, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', fontFamily: BODY,
                          }}
                        >Clear cities ({selected.size})</button>
                      )}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '8px 24px', maxHeight: 280, overflowY: 'auto',
                        paddingRight: 4,
                      }}>
                        {CITY_OPTIONS.map(city => (
                          <DrawerCheckbox
                            key={city}
                            checked={selected.has(city)}
                            label={city}
                            onChange={() => toggle(city)}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </DrawerSection>

              {/* ── Property Facts — dropdowns in 2-col grid ── */}
              <DrawerSectionHeader>Property Facts</DrawerSectionHeader>

              <DrawerField label="Square Feet">
                <MinMaxSelect
                  minVal={filters.sqftMin} maxVal={filters.sqftMax}
                  presets={SQFT_PRESETS}
                  formatPreset={(v) => v ? Number(v).toLocaleString() : ''}
                  onMin={(v) => setFilter('sqftMin', v)}
                  onMax={(v) => setFilter('sqftMax', v)}
                />
              </DrawerField>

              <DrawerField label="Year Built">
                <MinMaxSelect
                  minVal={filters.yearBuiltMin} maxVal={filters.yearBuiltMax}
                  presets={YEAR_PRESETS}
                  formatPreset={(v) => v}
                  disabledMin={filters.newConstruction}
                  onMin={(v) => setFilter('yearBuiltMin', v)}
                  onMax={(v) => setFilter('yearBuiltMax', v)}
                />
                <div style={{ marginTop: 10 }}>
                  <DrawerCheckbox
                    checked={filters.newConstruction}
                    label="New Construction (built 2025 or later)"
                    onChange={(c) => setFilter('newConstruction', c)}
                  />
                </div>
              </DrawerField>

              <DrawerField label="Max HOA / Month">
                <SelectDropdown
                  value={filters.hoaMax}
                  options={HOA_PRESETS.map(v => ({
                    value: v,
                    label: v === '' ? 'No Max' : `$${Number(v).toLocaleString()}`,
                  }))}
                  onChange={(v) => setFilter('hoaMax', v)}
                />
              </DrawerField>

              {/* ── Listing Activity ── */}
              <DrawerSectionHeader>Listing Activity</DrawerSectionHeader>

              <DrawerField label="Time on Market">
                <SelectDropdown
                  value={filters.domMax}
                  options={DOM_OPTIONS}
                  onChange={(v) => setFilter('domMax', v)}
                />
              </DrawerField>

              {/* ── Other Amenities — "Must Have X" checkboxes ── */}
              <DrawerSectionHeader>Other Amenities</DrawerSectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', marginBottom: 20 }}>
                {AMENITY_OPTIONS.map(amen => {
                  const selected = new Set((filters.amenitiesCsv || '').split(',').filter(Boolean));
                  const on = selected.has(amen.value);
                  return (
                    <DrawerCheckbox
                      key={amen.value}
                      checked={on}
                      label={amen.label}
                      onChange={(c) => {
                        const next = new Set(selected);
                        if (c) next.add(amen.value); else next.delete(amen.value);
                        setFilter('amenitiesCsv', Array.from(next).join(','));
                      }}
                    />
                  );
                })}
              </div>

              {/* ── Keywords (Stage 1 = ILIKE on description; Stage 2 = AI/embeddings) ── */}
              <DrawerSectionHeader>Keywords</DrawerSectionHeader>
              <DrawerField label="Search descriptions">
                <input
                  type="text"
                  value={filters.keywords}
                  placeholder="Try: waterfront, renovated, pool, dock, views"
                  onChange={(e) => setFilter('keywords', e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: 14, fontFamily: BODY, color: NAVY,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{
                  marginTop: 6, fontSize: 11, color: SLATE, fontFamily: BODY,
                }}>
                  Text-match on listing descriptions today. Smarter AI matching coming soon.
                </div>
              </DrawerField>
            </div>

            {/* Sticky footer CTAs */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid #eef1f5',
              background: '#fff',
              display: 'flex', gap: 10,
            }}>
              <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setDrawerOpen(false); }} style={{
                flex: 1, padding: '12px 0', borderRadius: 8,
                border: '1px solid #e2e8f0', background: '#fff',
                color: NAVY, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: BODY,
              }}>Reset All</button>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{
                flex: 2, padding: '12px 0', borderRadius: 8,
                border: 'none', background: TEAL,
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: BODY,
                boxShadow: '0 2px 8px rgba(0, 178, 204, 0.3)',
              }}>{loading ? 'Loading…' : `See ${count.toLocaleString()} ${transaction === 'rent' ? 'Rentals' : 'Homes'}`}</button>
            </div>
          </div>
        </div>
      )}
      {/* Save Search Modal */}
      {saveModalOpen && (
        <SaveSearchModal
          filters={filters}
          location={location}
          transaction={transaction}
          contact={contactForSearch}
          onClose={() => setSaveModalOpen(false)}
          onSaved={() => {
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
          }}
        />
      )}

      {/* Saved toast */}
      {savedToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: NAVY, color: '#fff', borderRadius: 10,
          padding: '12px 20px', fontFamily: BODY, fontSize: 13, fontWeight: 600,
          zIndex: 3000, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: TEAL, display:"flex", alignItems:"center" }}><IconCheck size={16} /></span>
          Search saved! Find it in your account.
        </div>
      )}
    </div>
  );
}
// mapbox token build marker: re-inline NEXT_PUBLIC_MAPBOX_TOKEN (20260704-144921)
