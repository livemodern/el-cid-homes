'use client';

import { useState, useEffect } from 'react';
import { listingHref } from '@/lib/listing-slug';
import { imgOpt, listingImageAlt } from '@/lib/img';
import CardPhotos from '@/components/CardPhotos';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

function fmt(n: number | null) {
  if (!n) return 'N/A';
  return '$' + n.toLocaleString();
}

function shortFmt(n: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  return '$' + Math.round(n / 1000) + 'K';
}

function priceDiff(list: number | null, close: number | null) {
  if (!list || !close) return null;
  const pct = ((close - list) / list) * 100;
  return pct;
}

// Close date may live in either typed column or raw record (older Closed
// listings synced before the close_date mapping won't have the typed column).
function getCloseDate(l: any): string | null {
  return l?.close_date || l?.trestle_raw?.CloseDate || null;
}

function fmtCloseDate(s: string | null): string | null {
  if (!s) return null;
  try {
    const d = new Date(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)
      ? s.slice(0, 10) + 'T00:00:00'
      : s);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

// Closed comps now arrive server-rendered + pre-filtered via props (SSR) —
// the closed/non-rental filter runs server-side in page.tsx. Same markup.
export default function RecentSalesGrid({ initialListings, initialError }: { initialListings: any[]; initialError?: string | null }) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const listings = initialListings;
  const err = initialError ?? null;
  const [sort,     setSort]       = useState('date_desc');  // most-recent-first by default
  const [minBeds,  setMinBeds]    = useState(0);

  let filtered = minBeds > 0 ? listings.filter(l => (l.beds || 0) >= minBeds) : listings;
  filtered = [...filtered].sort((a, b) => {
    const aPrice = a.close_price || a.list_price || 0;
    const bPrice = b.close_price || b.list_price || 0;
    const aDate  = new Date(getCloseDate(a) || '1970-01-01').getTime();
    const bDate  = new Date(getCloseDate(b) || '1970-01-01').getTime();
    if (sort === 'date_desc')  return bDate - aDate;
    if (sort === 'date_asc')   return aDate - bDate;
    if (sort === 'price_asc')  return aPrice - bPrice;
    if (sort === 'price_desc') return bPrice - aPrice;
    if (sort === 'dom_asc')    return (a.days_on_market || 999) - (b.days_on_market || 999);
    return bDate - aDate;  // default: most recent first
  });

  // Compute stats from closed listings
  const closePrices = listings.map(l => l.close_price).filter(Boolean);
  const avgClose    = closePrices.length ? Math.round(closePrices.reduce((a: number, b: number) => a + b, 0) / closePrices.length) : null;
  const medClose    = closePrices.length ? [...closePrices].sort((a, b) => a - b)[Math.floor(closePrices.length / 2)] : null;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: BODY }}>

      {/* Hero */}
      {/* Hero */}
      <div style={{ position:'relative', height:isMobile?380:480, overflow:'hidden', marginTop:'-72px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.mlrecloud.com/site/el-cid-homes/hero.jpg" alt="Recent El Cid home sales in West Palm Beach, Florida" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(13,23,59,0.45) 0%, rgba(13,23,59,0.2) 40%, rgba(13,23,59,0.7) 100%)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', padding:isMobile?'0 24px 40px':'0 40px 60px', textAlign:'center' }}>
          <div style={{ fontSize:14, color:'#fff', fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:14, fontFamily:DISPLAY }}>
            El Cid · Market Data
          </div>
          <h1 style={{ fontSize:isMobile?32:52, fontWeight:800, color:'#fff', margin:'0 0 12px', fontFamily:DISPLAY, lineHeight:1.05 }}>
            Recent Sales
          </h1>
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:isMobile?13:16, maxWidth:520, margin:0, fontFamily:BODY, lineHeight:1.65 }}>
            Closed home sales in El Cid — real comps, real sold prices
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {listings.length > 0 && (
        <div style={{ background: NAVY, borderTop: `3px solid ${TEAL}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { v: listings.length.toString(), l: 'Sales on Record' },
              { v: shortFmt(avgClose), l: 'Avg Sold Price' },
              { v: shortFmt(medClose), l: 'Median Sold Price' },
            ].map((s, i) => (
              <div key={s.l} style={{ padding: '28px 20px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 38, fontWeight: 700, color: TEAL, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.44)', marginTop: 6 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* Filter bar */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', margin: '24px 0', border: '1px solid #e2e8f0', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: DISPLAY }}>
            {err ? 'Unable to load, please refresh.' : `${filtered.length} sold unit${filtered.length !== 1 ? 's' : ''}`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, color: NAVY, outline: 'none' }}>
              <option value="date_desc">Most Recent</option>
              <option value="date_asc">Oldest First</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="price_asc">Price: Low to High</option>
            </select>
            <select value={minBeds} onChange={e => setMinBeds(Number(e.target.value))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 13, color: NAVY, outline: 'none' }}>
              <option value={0}>Any Beds</option>
              <option value={1}>1+ Beds</option>
              <option value={2}>2+ Beds</option>
              <option value={3}>3+ Beds</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22, marginBottom: 60 }}>
            {filtered.map(l => {
              const soldPrice = l.close_price || l.list_price;
              const diff      = priceDiff(l.list_price, l.close_price);
              return (
                <a key={l.mls_id}
                  href={listingHref(l)}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}>

                  {/* Photo */}
                  <div style={{ position: 'relative', height: 200, background: '#e2e8f0', overflow: 'hidden' }}>
                    {l.image_urls?.[0]
                      ? <CardPhotos urls={l.image_urls} total={(l as any).photos_total ?? l.image_urls.length} alt={listingImageAlt(l, 0)} width={640} widths={[400, 640, 960]} />
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 36 }}>🏙️</div>}
                    <span style={{ position: 'absolute', top: 12, left: 12, background: '#6b7280', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', fontFamily: DISPLAY }}>
                      Sold
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '16px 20px' }}>
                    {/* Sold price */}
                    <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 2, fontFamily: DISPLAY }}>
                      {fmt(soldPrice)}
                    </div>

                    {/* Sold date — prominent, right under the price */}
                    {(() => {
                      const _d = fmtCloseDate(getCloseDate(l));
                      return _d ? (
                        <div style={{ fontSize: 12, color: TEAL, fontWeight: 700, marginBottom: 6, fontFamily: DISPLAY, letterSpacing: '0.04em' }}>
                          Sold {_d}
                        </div>
                      ) : null;
                    })()}

                    {/* List vs sold comparison */}
                    {l.close_price && l.list_price && l.close_price !== l.list_price && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through', fontFamily: BODY }}>
                          Listed {fmt(l.list_price)}
                        </span>
                        {diff !== null && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: diff >= 0 ? '#22c55e' : '#ef4444', fontFamily: DISPLAY }}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: SLATE, marginBottom: 12, fontFamily: BODY }}>
                      {l.street_address || 'El Cid, West Palm Beach'}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569', fontFamily: BODY }}>
                      {l.beds  && <span><strong>{l.beds}</strong> bd</span>}
                      {l.baths && <span><strong>{l.baths}</strong> ba</span>}
                      {l.sqft  && <span><strong>{l.sqft.toLocaleString()}</strong> sqft</span>}
                    </div>
                    {l.sqft && soldPrice && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontFamily: BODY }}>
                        ${Math.round(soldPrice / l.sqft).toLocaleString()}/sq ft
                      </div>
                    )}
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>MLS# {l.listing_id}</span>
                      <span style={{ fontSize: 11, color: TEAL, fontWeight: 600, fontFamily: DISPLAY }}>View Details →</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: SLATE }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏙️</div>
            <p style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: NAVY }}>No closed sales found</p>
            <p style={{ fontSize: 14, marginTop: 8 }}>Check back soon, data updates nightly.</p>
          </div>
        )}

        {/* CTA */}
        <div style={{ textAlign: 'center', marginBottom: 60, padding: '40px 24px', background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, color: TEAL, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, fontFamily: DISPLAY }}>
            Thinking of Selling?
          </div>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800, color: NAVY, margin: '0 0 10px' }}>
            What's Your Home Worth?
          </h3>
          <p style={{ color: SLATE, fontSize: 14, margin: '0 0 24px', fontFamily: BODY }}>
            Patrick is the El Cid specialist at Modern Living Group. Get a free, data-driven valuation of your home.
          </p>
          <a href="/contact" style={{ display: 'inline-block', padding: '13px 32px', background: TEAL, color: '#fff', textDecoration: 'none', fontFamily: DISPLAY, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 8 }}>
            Get a Free Valuation
          </a>
        </div>

        {/* BeachesMLS compliance + bottom spacing */}
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 40, paddingTop: 24, paddingBottom: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/beachesmls.webp" alt="BeachesMLS" style={{ width: 130, height: 'auto', flexShrink: 0 }} />
            <p style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'Poppins, sans-serif', lineHeight: 1.6, margin: 0, flex: 1 }}>
              All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified for authenticity or accuracy and is not guaranteed. Copyright ©2026 BeachesMLS, Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
