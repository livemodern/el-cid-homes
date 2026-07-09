'use client';

// ─── BuildingAlerts ───────────────────────────────────────────────────
// Quick saved-search widget for a single community / building / area.
// Pre-binds the location filter to the parent page so the user only picks
// beds / baths / max price / frequency.
//
// Account model (Patrick 2026-06-20):
//   • Signed in  → no email field; "Notify Me" saves straight to
//     /api/me/saved-searches (Bearer token). The server stamps user_id and
//     resolves the CRM contact from the account email, so it surfaces under
//     the assigned agent and the drip fires.
//   • Signed out → alerts are recurring email to a person, so they REQUIRE
//     an account. Picking criteria + tapping the button opens the shared
//     AuthModal (sign up). On success the search saves authed and binds to
//     the new account. No more nameless email-only "leads" — registration
//     captures name / phone / type and creates the FUB contact.
//
// Canonical implementation; goes back to TCP + mini-sites once dialed in.

import { useState } from 'react';
import { IconBell } from './icons';
import { getSupabase, useUser } from '@/lib/auth';
import { AuthModal } from './AuthModal';

const TEAL  = '#00B2CC';
const NAVY  = '#0D173B';
const SLATE = '#64748b';
const BODY  = "'Poppins', sans-serif";
const DISP  = "'Plus Jakarta Sans', sans-serif";

// Tags the saved_search/registration to the originating site. Env-driven so
// the same component tags rows correctly when copied to TCP / mini-sites.
const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid-homes';

type AlertFrequency = 'immediate' | 'daily' | 'weekly';

type Props = {
  /** Display name — e.g. "330 Cocoanut Row" or "Palm Beach Gardens". */
  buildingName: string;
  /** Pre-bound location filter — { building_name } / { city } / { community_slug } etc. */
  buildingFilter: Record<string, any>;
  /** Lead/analytics source tag — defaults to 'community-alert'. */
  source?: string;
  /** Sale vs rent — drives price option scale + saved-search transaction. */
  transaction?: 'sale' | 'rent';
  /** "condo" / "home" / "townhome" — drives the empty-state headline copy. */
  kind?: string;
  /** When true, copy reframes for the "0 listings currently" scenario. */
  emptyState?: boolean;
};

const BED_OPTIONS  = ['Any', '1+', '2+', '3+', '4+'];
const BATH_OPTIONS = ['Any', '1+', '2+', '3+'];
const PRICE_OPTIONS_SALE = ['Any', '500k', '750k', '1M', '1.5M', '2M', '3M', '5M+'];
const PRICE_OPTIONS_RENT = ['Any', '2k', '3k', '4k', '5k', '7.5k', '10k+'];

function parsePrice(val: string): string {
  if (val === 'Any') return '';
  return val.replace('k', '000').replace('M', '000000').replace('+', '');
}

const FREQ_OPTIONS: { value: AlertFrequency; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'daily',     label: 'Daily digest' },
  { value: 'weekly',    label: 'Weekly digest' },
];

export default function BuildingAlerts({
  buildingName, buildingFilter,
  transaction: initialTransaction = 'sale',
  kind,
  emptyState = false,
}: Props) {
  const { user, loading } = useUser();

  // Transaction is internal state — seeded from the prop (the parent's
  // defaultTab) so the user lands on the right context, but they can flip
  // inside the modal (price scale differs: $500k+ vs $2k+/mo).
  const [transaction, setTransaction] = useState<'sale' | 'rent'>(initialTransaction);
  const [beds,      setBeds]      = useState('Any');
  const [baths,     setBaths]     = useState('Any');
  const [maxPrice,  setMaxPrice]  = useState('Any');
  const [frequency, setFrequency] = useState<AlertFrequency>('daily');
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  // Auth gate for signed-out users. authMode controls which tab the modal
  // opens on: the primary CTA → sign up; the "already have an account" link
  // → sign in.
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const priceOpts = transaction === 'rent' ? PRICE_OPTIONS_RENT : PRICE_OPTIONS_SALE;

  function handleTransactionChange(next: 'sale' | 'rent') {
    if (next === transaction) return;
    setTransaction(next);
    setMaxPrice('Any');
  }

  const headline = emptyState
    ? `Be the first to know when a ${kind ?? 'listing'} hits the market at ${buildingName}`
    : `Get ${buildingName} alerts`;
  const subhead = emptyState
    ? `No active listings right now, set up an alert and we'll email you the moment one comes up.`
    : `Be first to know when new listings match`;

  function buildName() {
    const parts = [buildingName];
    if (beds !== 'Any') parts.push(`${beds} bed`);
    if (maxPrice !== 'Any') parts.push(`Under $${maxPrice}`);
    parts.push(transaction === 'rent' ? 'Rental Alerts' : 'Sale Alerts');
    return parts.join(' · ');
  }

  // Reads the live Supabase session token. Auth cookies are scoped to
  // .mlrecloud.com and don't carry on modernlivingre.com / mini-site TLDs,
  // so the Bearer header is the portable path for every MLG site.
  async function getToken(): Promise<string | null> {
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  // Authed save — token required. Returns true on success.
  async function doSave(): Promise<boolean> {
    const token = await getToken();
    if (!token) return false;

    const filters = {
      status: 'Active', beds, baths,
      priceMin: '', priceMax: parsePrice(maxPrice),
      city: 'Any', sqftMin: '', sqftMax: '', domMax: '', hoaMax: '',
    };
    const location = { type: 'building', name: buildingName, filter: buildingFilter };

    try {
      const res = await fetch('/api/me/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: buildName(),
          filters,
          location,
          transaction,
          alert_frequency: frequency,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Primary CTA. Signed in → save. Signed out → require registration.
  async function handleSubmit() {
    setError('');
    const token = await getToken();
    if (!token) {
      setAuthMode('signup');
      setAuthOpen(true);
      return;
    }
    setSaving(true);
    const ok = await doSave();
    setSaving(false);
    if (ok) setSaved(true);
    else setError('Something went wrong. Please try again.');
  }

  // After the AuthModal resolves. On sign-in/up success, finish the save the
  // user came here to do. A short tick lets the client persist the new
  // session before we read the token back.
  async function handleAuthClose(result: 'signed-in' | 'cancelled') {
    setAuthOpen(false);
    if (result !== 'signed-in') return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 150));
    const ok = await doSave();
    setSaving(false);
    if (ok) setSaved(true);
    else setError("You're all set up, we hit a snag saving the alert. Tap Notify Me to retry.");
  }

  if (saved) {
    return (
      <div style={{
        background: '#f0fbfd', border: `1.5px solid ${TEAL}`,
        borderRadius: 14, padding: '24px 20px', textAlign: 'center',
      }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconBell size={28} color={TEAL} /></div>
        <div style={{ fontFamily: DISP, fontWeight: 800, fontSize: 16, color: NAVY, marginBottom: 6 }}>Alert set!</div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: SLATE }}>
          We'll notify you {frequency === 'immediate' ? 'immediately' : frequency === 'daily' ? 'daily' : 'weekly'} when new listings match your criteria at {buildingName}.
        </div>
      </div>
    );
  }

  // Button label reflects auth state. While auth is still resolving we use a
  // neutral label so a signed-in user never flashes the "create account" copy.
  const ctaLabel = loading ? 'Set Up Alert' : (user ? 'Notify Me' : 'Create a free account to get alerts');

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e2e8f0',
      borderRadius: 14,
      padding: emptyState ? '28px 24px' : '20px',
      maxWidth: emptyState ? 560 : '100%',
      margin: emptyState ? '0 auto' : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: emptyState ? 18 : 14 }}>
        <span style={{ display: 'flex', alignItems: 'center' }}><IconBell size={emptyState ? 24 : 20} color={TEAL} /></span>
        <div>
          <div style={{
            fontFamily: DISP,
            fontWeight: 800,
            fontSize: emptyState ? 17 : 14,
            color: NAVY,
            lineHeight: 1.25,
          }}>{headline}</div>
          <div style={{ fontFamily: BODY, fontSize: 12, color: SLATE, marginTop: 2 }}>{subhead}</div>
        </div>
      </div>

      {/* For Sale / For Rent toggle — defaults to whichever tab the user was
          on when they opened the form; flipping clears maxPrice so the wrong-
          scale stale value doesn't post. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, padding: 3, borderRadius: 9, background: '#f1f5f9' }}>
        {(['sale', 'rent'] as const).map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => handleTransactionChange(opt)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 7, cursor: 'pointer',
              border: 'none',
              background: transaction === opt ? '#fff' : 'transparent',
              color: transaction === opt ? NAVY : SLATE,
              fontFamily: DISP, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.4px',
              boxShadow: transaction === opt ? '0 1px 2px rgba(13,23,59,0.10)' : 'none',
              transition: 'all 120ms ease',
            }}
          >
            {opt === 'sale' ? 'For Sale' : 'For Rent'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: BODY, fontSize: 10, fontWeight: 600, color: SLATE, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beds</div>
          <select value={beds} onChange={e => setBeds(e.target.value)} style={{ width: '100%', padding: '7px 6px', borderRadius: 7, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 12, color: NAVY, background: '#fff' }}>
            {BED_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontFamily: BODY, fontSize: 10, fontWeight: 600, color: SLATE, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Baths</div>
          <select value={baths} onChange={e => setBaths(e.target.value)} style={{ width: '100%', padding: '7px 6px', borderRadius: 7, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 12, color: NAVY, background: '#fff' }}>
            {BATH_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontFamily: BODY, fontSize: 10, fontWeight: 600, color: SLATE, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Max Price</div>
          <select value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width: '100%', padding: '7px 6px', borderRadius: 7, border: '1px solid #e2e8f0', fontFamily: BODY, fontSize: 12, color: NAVY, background: '#fff' }}>
            {priceOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {FREQ_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFrequency(opt.value)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 7, cursor: 'pointer',
              border: `1.5px solid ${frequency === opt.value ? TEAL : '#e2e8f0'}`,
              background: frequency === opt.value ? '#f0fbfd' : '#fff',
              color: frequency === opt.value ? TEAL : SLATE,
              fontFamily: BODY, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.3px',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <div style={{ fontFamily: BODY, fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
          background: saving ? SLATE : TEAL, color: '#fff',
          fontFamily: DISP, fontSize: 13, fontWeight: 700,
          cursor: saving ? 'default' : 'pointer', letterSpacing: '0.3px',
        }}
      >
        {saving ? 'Setting up alert…' : (<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IconBell size={14} color="#fff" />{ctaLabel}</span>)}
      </button>

      {!loading && !user && (
        <div style={{ marginTop: 10, fontFamily: BODY, fontSize: 11, color: SLATE, textAlign: 'center' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
            style={{ background: 'none', border: 'none', color: TEAL, fontFamily: BODY, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            Sign in
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, fontFamily: BODY, fontSize: 10, color: SLATE, textAlign: 'center' }}>
        Alerts sent after every hourly MLS update · Unsubscribe anytime
      </div>

      <AuthModal
        open={authOpen}
        onClose={handleAuthClose}
        siteSlug={SITE_SLUG}
        defaultMode={authMode}
        message={`Create a free account to get ${buildingName} listing alerts, your saved searches follow you across all Modern Living sites.`}
      />
    </div>
  );
}
