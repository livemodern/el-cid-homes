'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { listingHref } from '@/lib/listing-slug';
import { listingImageAlt } from '@/lib/img';
import CardPhotos from '@/components/CardPhotos';

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const SLATE = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY = "'Poppins', sans-serif";

const STATUS_COLORS: Record<string, string> = {
  Active: '#22c55e', Pending: '#f59e0b', Closed: '#94a3b8'
};

function fmt(n: number | null) {
  return n ? '$' + n.toLocaleString() : 'N/A';
}

export default function LiveListings() {
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/listings?type=sale')
      .then(r => r.json())
      .then(({ listings }) => {
        if (!listings?.length) { setLoading(false); return; }
        // Active with photos only
        const active = listings.filter((l: any) => l.status === 'Active' && (l.image_urls?.length || 0) > 0);
        // Sort: MLG/Compass listings first, then most photos, then highest price
        const sorted = [...active].sort((a: any, b: any) => {
          const aOurs = (a.list_office_name || '').toLowerCase().includes('compass') ? 1 : 0;
          const bOurs = (b.list_office_name || '').toLowerCase().includes('compass') ? 1 : 0;
          if (bOurs !== aOurs) return bOurs - aOurs;
          const aPhotos = a.image_urls?.length || 0;
          const bPhotos = b.image_urls?.length || 0;
          if (bPhotos !== aPhotos) return bPhotos - aPhotos;
          return (b.list_price || 0) - (a.list_price || 0);
        });
        setListings(sorted.slice(0, 6));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section id="listings" style={{ background: '#f8fafc', padding: '72px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: TEAL, fontFamily: DISPLAY, marginBottom: 10 }}>
            Featured Listings
          </div>
          <div style={{ width: 40, height: 2, background: TEAL, margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 800, color: NAVY, margin: 0 }}>
            Featured El Cid Listings
          </h2>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', height: 340 }}>
                <div style={{ height: 220, background: '#e8ecf0' }} />
                <div style={{ padding: 20 }}>
                  <div style={{ height: 18, background: '#e8ecf0', borderRadius: 4, marginBottom: 8, width: '60%' }} />
                  <div style={{ height: 12, background: '#f1f5f9', borderRadius: 4, width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {listings.map(l => (
              <div key={l.mls_id}
                onClick={() => router.push(listingHref(l))}
                style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}>
                <div style={{ position: 'relative', height: 220, background: '#e2e8f0', overflow: 'hidden' }}>
                  {l.image_urls?.[0] ? (
                    <CardPhotos urls={l.image_urls} total={(l as any).photos_total ?? l.image_urls.length} alt={listingImageAlt(l, 0)}
                      width={640} widths={[400, 640, 960]} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 40 }}>🏙️</div>
                  )}
                  <span style={{ position: 'absolute', top: 12, left: 12, background: STATUS_COLORS[l.status] || '#94a3b8',
                    color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', fontFamily: DISPLAY }}>{l.status}</span>
                  {(l.list_office_name || '').toLowerCase().includes('compass') && (
                    <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.72)',
                      color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: DISPLAY }}>MLG Listing</span>
                  )}
                  
                </div>
                <div style={{ padding: '16px 20px 18px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4, fontFamily: DISPLAY }}>
                    {fmt(l.list_price)}
                  </div>
                  <div style={{ fontSize: 13, color: SLATE, marginBottom: 12, fontFamily: BODY }}>
                    {l.street_address || 'El Cid, West Palm Beach'}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#475569', fontFamily: BODY }}>
                    {l.beds && <span><strong>{l.beds}</strong> bd</span>}
                    {l.baths && <span><strong>{l.baths}</strong> ba</span>}
                    {l.sqft && <span><strong>{l.sqft.toLocaleString()}</strong> sqft</span>}
                  </div>
                  {l.hoa_fee && <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', fontFamily: BODY }}>HOA: ${l.hoa_fee.toLocaleString()}/mo</div>}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: BODY }}>MLS# {l.listing_id}</span>
                    <span style={{ fontSize: 11, color: TEAL, fontWeight: 600, fontFamily: DISPLAY }}>View Details →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All CTA */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <a href="/for-sale" style={{ display: 'inline-flex', alignItems: 'center', gap: 10,
            background: TEAL, color: '#fff', textDecoration: 'none',
            padding: '14px 40px', fontFamily: DISPLAY, fontSize: 14, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            View All Listings <span style={{ fontSize: 16 }}>→</span>
          </a>
        </div>

      </div>
    </section>
  );
}
