'use client';
// ─── Homepage floor-plan cards ────────────────────────────────────────
// The homepage used to render floor plans as inert <div>s: no click handler, no
// modal, no gate. They looked like cards, so people clicked them, and nothing
// happened. Worse, they were the one high-intent thing on the page that asked
// nothing of the visitor in return.
//
// Now they behave exactly like the cards on /floorplans — click to open the
// plan, and the SAME registration gate, counting through the SAME shared
// tracker. Two plans on the homepage plus two on /floorplans is four plans, not
// two-and-two, so the wall can't be walked around by changing route.

import { useState, useEffect } from 'react';
import { imgOpt } from '@/lib/img';
import { useUser } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { recordPlanView, getPlanViewCount } from '@/lib/floorplan-tracker';

type Plan = { label?: string; name?: string; beds?: string; baths?: string; sqft?: string; image?: string };

export default function HomeFloorPlans({
  plans, title, siteSlug, gateLimit = 2, gateEnabled = true,
}: {
  plans: Plan[]; title: string; siteSlug: string; gateLimit?: number; gateEnabled?: boolean;
}) {
  const { user, loading } = useUser();
  const [justSignedIn, setJustSignedIn] = useState(false);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const signedIn = !!user || justSignedIn;

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [selected]);

  const planName = (p: Plan) => String(p.label || p.name || '');

  const open = (p: Plan) => {
    if (gateEnabled && !loading && !signedIn && gateLimit > 0) {
      const seen = recordPlanView(planName(p));
      if (seen >= gateLimit) { setGateOpen(true); return; }
    }
    setSelected(p);
  };

  const meta = (p: Plan) =>
    [p.beds && `${p.beds} bd`, p.baths && `${p.baths} ba`, p.sqft && `${p.sqft} sf`].filter(Boolean).join(' \u00b7 ');

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
        {plans.map((f, i) => (
          <button
            key={i}
            onClick={() => open(f)}
            className="card"
            style={{
              overflow: 'hidden', cursor: 'pointer', textAlign: 'left', padding: 0,
              display: 'block', width: '100%', border: '1px solid #e2e8f0', background: '#fff',
              borderRadius: 16, transition: 'transform .2s, box-shadow .2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,178,204,.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
          >
            {f.image && (
              <img
                src={imgOpt(f.image, 640)}
                alt={`${title} ${planName(f)} floor plan`}
                style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
              />
            )}
            <div style={{ padding: 18 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{planName(f)}</div>
              <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>{meta(f)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Plan viewer */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(13,23,59,.86)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: 940, width: '100%', maxHeight: '92vh', overflow: 'auto', position: 'relative' }}>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close floor plan"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(13,23,59,.72)', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
              &times;
            </button>
            {selected.image && (
              <img
                src={imgOpt(selected.image, 1400)}
                alt={`${title} ${planName(selected)} floor plan`}
                style={{ width: '100%', height: 'auto', display: 'block', background: '#f8fafc' }}
              />
            )}
            <div style={{ padding: '20px 24px 26px' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 21, fontWeight: 800, color: 'var(--navy)' }}>{planName(selected)}</div>
              <div style={{ fontSize: 13, color: 'var(--slate)', marginTop: 5 }}>{meta(selected)}</div>
              <a href="/floorplans" className="btn btn-teal" style={{ marginTop: 18, display: 'inline-block' }}>See all floor plans</a>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={gateOpen}
        blocking
        defaultMode="signup"
        siteSlug={siteSlug}
        message={`Create a free account to see every ${title} floor plan, save your favorites, and get alerts when a matching residence lists.`}
        onClose={(r) => { setGateOpen(false); if (r === 'signed-in') setJustSignedIn(true); }}
      />
    </>
  );
}
