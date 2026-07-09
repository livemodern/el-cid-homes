'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, isAdmin, getSupabase } from '@/lib/auth';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

const SITE_LABEL: Record<string, string> = {
  'mlg-search':   'MLG Search',
  'el-cid-homes': 'El Cid',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRelative(s: string | undefined) {
  if (!s) return '—';
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDate(s);
}

function SiteBadge({ slug }: { slug: string | null }) {
  const colors: Record<string, { bg: string; color: string }> = {
    'mlg-search':   { bg: '#e6f9fd', color: TEAL },
    'el-cid-homes': { bg: '#ede9fe', color: '#7c3aed' },
  };
  const c = slug ? (colors[slug] || { bg: '#f1f5f9', color: SLATE }) : { bg: '#f1f5f9', color: SLATE };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {slug ? (SITE_LABEL[slug] || slug) : '—'}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: NAVY, marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {title}
        {count !== undefined && <span style={{ fontSize: 12, color: SLATE, fontWeight: 400 }}>({count})</span>}
      </div>
      {children}
    </div>
  );
}

function PropCard({ property, meta }: { property: any; meta?: React.ReactNode }) {
  if (!property) return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: SLATE }}>
      Property details unavailable
    </div>
  );

  const isRental = property.property_type === 'ResidentialLease';
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
      {/* Thumbnail */}
      <div style={{ width: 80, flexShrink: 0, background: '#f1f5f9', position: 'relative' }}>
        {property.image_urls?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
        )}
      </div>
      {/* Details */}
      <div style={{ padding: '10px 14px', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, fontFamily: DISPLAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {property.street_address}
        </div>
        <div style={{ fontSize: 11, color: SLATE, marginBottom: 4 }}>
          {property.city}{property.state ? `, ${property.state}` : ''}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, fontFamily: DISPLAY }}>
          ${(property.list_price || 0).toLocaleString()}
          {isRental && <span style={{ fontSize: 10, fontWeight: 600, color: SLATE, marginLeft: 2 }}>/mo</span>}
          {property.beds ? <span style={{ fontSize: 11, fontWeight: 500, color: SLATE, marginLeft: 8 }}>{property.beds}bd · {property.baths}ba</span> : ''}
        </div>
        {meta && <div style={{ marginTop: 4 }}>{meta}</div>}
      </div>
    </div>
  );
}

export default function AdminUserDetail() {
  const router = useRouter();
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const { user, loading } = useUser();

  const [data, setData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/account'); return; }
    if (!isAdmin(user)) { router.push('/'); return; }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !isAdmin(user) || !userId) return;
    setDataLoading(true);
    (async () => {
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) { setDataLoading(false); return; }
      const res = await fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
      setDataLoading(false);
    })();
  }, [user?.id, userId]);

  if (loading || !user) return <div style={{ padding: 80, textAlign: 'center', fontFamily: BODY, color: SLATE }}>Loading…</div>;
  if (!isAdmin(user)) return null;

  const profile = data?.profile;
  const views   = data?.views   || [];
  const saved   = data?.saved   || [];
  const inquiries = data?.inquiries || [];
  const fullName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email : '—';

  // Stats
  const totalViews = views.reduce((s: number, v: any) => s + (v.view_count || 1), 0);
  const avgPrice = views.length
    ? Math.round(views.filter((v: any) => v.property?.list_price).reduce((s: number, v: any) => s + v.property.list_price, 0) / views.filter((v: any) => v.property?.list_price).length)
    : 0;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: BODY }}>
      {/* Top bar */}
      <div style={{ background: NAVY, color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push('/admin/users')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: BODY, fontSize: 13 }}>
            ← Users
          </button>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15 }}>
            MLG <span style={{ color: TEAL }}>Admin</span> · {dataLoading ? '…' : fullName}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {dataLoading ? (
          <div style={{ textAlign: 'center', padding: 80, color: SLATE }}>Loading user data…</div>
        ) : (
          <>
            {/* Profile header */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, color: NAVY, marginBottom: 4 }}>{fullName}</div>
                  <div style={{ fontSize: 13, color: SLATE }}>
                    {profile?.email}
                    {profile?.phone ? ` · ${profile.phone}` : ''}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <SiteBadge slug={profile?.source_site} />
                    <span style={{ fontSize: 12, color: SLATE }}>Joined {profile?.created_at ? fmtDate(profile.created_at) : '—'}</span>
                    {profile?.fub_synced && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>FUB SYNCED</span>}
                  </div>
                </div>
                {/* Quick stats */}
                <div style={{ display: 'flex', gap: 24 }}>
                  {[
                    { label: 'Listings Viewed', value: totalViews },
                    { label: 'Unique Properties', value: views.length },
                    { label: 'Saved', value: saved.length },
                    { label: 'Inquiries', value: inquiries.length },
                    { label: 'Avg Price Viewed', value: avgPrice ? `$${Math.round(avgPrice / 1000)}k` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, fontFamily: DISPLAY }}>{value}</div>
                      <div style={{ fontSize: 10, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Left column */}
              <div>
                {/* Inquiries */}
                <Section title="Inquiries & Showing Requests" count={inquiries.length}>
                  {inquiries.length === 0 ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: SLATE, fontSize: 13 }}>No inquiries yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {inquiries.map((inq: any) => (
                        <div key={inq.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#854d0e' }}>
                              {inq.source_type || 'inquiry'}
                            </span>
                            <span style={{ fontSize: 11, color: SLATE }}>{fmtRelative(inq.created_at)}</span>
                          </div>
                          {inq.listing_address && (
                            <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 4 }}>{inq.listing_address}</div>
                          )}
                          {inq.message && (
                            <div style={{ fontSize: 12, color: SLATE, lineHeight: 1.5, fontStyle: 'italic' }}>"{inq.message}"</div>
                          )}
                          <SiteBadge slug={inq.source_site} />
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Saved listings */}
                <Section title="Saved Listings" count={saved.length}>
                  {saved.length === 0 ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: SLATE, fontSize: 13 }}>No saved listings</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {saved.map((s: any) => (
                        <PropCard
                          key={s.mls_id}
                          property={s.property}
                          meta={<span style={{ fontSize: 10, color: SLATE }}>Saved {fmtRelative(s.saved_at)}</span>}
                        />
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              {/* Right column — viewed properties */}
              <div>
                <Section title="Properties Viewed" count={views.length}>
                  {views.length === 0 ? (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '32px 24px', textAlign: 'center', color: SLATE, fontSize: 13 }}>No properties viewed yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {views.map((v: any) => (
                        <PropCard
                          key={v.mls_id}
                          property={v.property}
                          meta={
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, color: SLATE }}>
                                {v.view_count > 1 ? `Viewed ${v.view_count}× · ` : ''}Last {fmtRelative(v.last_viewed_at)}
                              </span>
                              <SiteBadge slug={v.site_slug} />
                            </div>
                          }
                        />
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
