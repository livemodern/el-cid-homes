'use client';

// ─── /account — user dashboard ────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, signOut, getSupabase } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { slugifyListing } from '@/lib/listing-slug';
// Header + Footer come from app/layout.tsx on TCP (global chrome).
// mlg-site doesn't wrap globally so its account page imports them
// directly; on TCP we'd render them twice if we kept the imports.
import SmsConsentDisclosure from '@/components/SmsConsentDisclosure';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

// ─── Password reset form — shown when URL hash contains type=recovery ──
function SetNewPassword() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password, data: { password_set: true } });
    if (error) { setError(error.message); setBusy(false); return; }
    // Clear hash and reload so account page shows normally
    window.history.replaceState(null, '', '/account');
    window.location.reload();
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 220px)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: '28px', color: '#fff' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Set New Password</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Choose a password for your MLG account.</div>
        </div>
        <div style={{ padding: '28px' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Password updated!</div>
              <div style={{ fontSize: 13, color: SLATE }}>Redirecting to your account…</div>
            </div>
          ) : (
            <form onSubmit={submit}>
              <PwInput label="New Password" value={password} onChange={setPassword} />
              <PwInput label="Confirm Password" value={confirm} onChange={setConfirm} />
              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                style={{ width: '100%', padding: '12px', background: busy ? '#94a3b8' : TEAL, color: '#fff', border: 'none', borderRadius: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer' }}
              >
                {busy ? '…' : 'Save Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PwInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginBottom: 4, letterSpacing: '0.03em' }}>{label}</div>
      <input
        type="password" value={value} onChange={e => onChange(e.target.value)} required minLength={8}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: BODY, color: NAVY, outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.currentTarget.style.borderColor = TEAL; }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      />
    </label>
  );
}

// ─── Main account page ─────────────────────────────────────────────────
type ExtraPhone = { label: string; number: string };
type ExtraEmail = { email: string };
type AgentCard = { name: string; title: string | null; photo_url: string | null; phone: string | null; email: string | null; slug: string } | null;
type Profile = { first_name: string | null; last_name: string | null; phone: string | null; extra_phones: ExtraPhone[]; extra_emails: ExtraEmail[]; pending_email: string | null; photo_url: string | null; member_since: string; email: string | null };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 };
const pill: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 12.5, padding: '10px 18px', borderRadius: 99, textDecoration: 'none', cursor: 'pointer', border: 'none', display: 'inline-block' };

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await getSupabase().auth.getSession();
  const token = session?.access_token;
  return fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
}

async function logSecurityEvent(event: 'password_set' | 'password_changed') {
  try { await authedFetch('/api/me/account', { method: 'POST', body: JSON.stringify({ action: 'security_event', event }) }); } catch {}
}

function AccountInner() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phonesEnabled, setPhonesEnabled] = useState(true);
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [agent, setAgent] = useState<AgentCard>(null);
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const [searches, setSearches] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwPromptDismissed, setPwPromptDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPwPromptDismissed(localStorage.getItem('mlg_pw_prompt_dismissed') === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      getSupabase().auth.getSession().then(() => setIsRecovery(true));
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !isRecovery) setAuthOpen(true);
  }, [loading, user, isRecovery]);

  async function reloadAccount() {
    try {
      const res = await authedFetch('/api/me/account');
      const j = await res.json();
      if (j.profile) { setProfile(j.profile); setPhonesEnabled(j.phonesEnabled !== false); setEmailsEnabled(j.emailsEnabled !== false); setAgent(j.agent || null); }
    } catch {}
  }

  useEffect(() => {
    if (!user || isRecovery) { setDataLoading(false); return; }
    setDataLoading(true);
    (async () => {
      await Promise.all([
        reloadAccount(),
        authedFetch('/api/me/saved').then(r => r.json()).then(j => setSavedListings(j.listings || [])).catch(() => setSavedListings([])),
        authedFetch('/api/me/saved-searches').then(r => r.json()).then(j => setSearches(Array.isArray(j) ? j : (j.searches || j.data || []))).catch(() => setSearches([])),
      ]);
      setDataLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isRecovery]);

  if (isRecovery) return <SetNewPassword />;
  if (loading) return <div style={{ padding: 80, textAlign: 'center', fontFamily: BODY, color: SLATE }}>Loading…</div>;

  if (!user) {
    return (
      <>
        <AuthModal open={authOpen} siteSlug="mlg-search" defaultMode="signin"
          message="Sign in to access your saved listings and account."
          onClose={(result) => { setAuthOpen(false); if (result === 'cancelled') router.push('/'); }} />
        <div style={{ padding: 80, textAlign: 'center', fontFamily: BODY, color: SLATE }}>Sign in to continue…</div>
      </>
    );
  }

  const first = profile?.first_name || '';
  const last = profile?.last_name || '';
  const initials = ((first[0] || '') + (last[0] || (first ? '' : (user.email?.[0] || '')))).toUpperCase() || 'ML';
  const memberSince = profile?.member_since ? new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <div style={{ background: '#f6f8fb', minHeight: 'calc(100vh - 220px)', fontFamily: BODY }}>
      <style>{`
        .acct-grid { display: grid; grid-template-columns: 1fr 340px; gap: 26px; align-items: start; }
        @media (max-width: 920px) { .acct-grid { grid-template-columns: 1fr; } .acct-side { position: static !important; } }
        .acct-card-link { transition: transform .2s ease, box-shadow .2s ease; }
        .acct-card-link:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(13,23,59,.10); }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(125deg, ${NAVY} 0%, #14306e 100%)`, color: '#fff', padding: '40px 24px 44px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          {profile?.photo_url
            ? <img src={profile.photo_url} alt={first || 'You'} referrerPolicy="no-referrer" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,.25)' }} />
            : <div style={{ width: 76, height: 76, borderRadius: '50%', background: TEAL, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, flexShrink: 0 }}>{initials}</div>}
          <div style={{ flex: 1, minWidth: 240 }}>
            <NameBlock first={first} last={last} onSaved={reloadAccount} />
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>
              {user.email}{memberSince ? ` · Member since ${memberSince}` : ''}
            </div>
          </div>
          <button onClick={async () => { await signOut(); router.push('/'); }}
            style={{ background: 'transparent', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff', padding: '9px 18px', borderRadius: 99, fontSize: 12, fontFamily: DISPLAY, fontWeight: 700, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px 70px' }}>
        {user && !user.user_metadata?.password_set && !pwPromptDismissed && (
          <SetPasswordModal user={user}
            onClose={() => { setPwPromptDismissed(true); try { localStorage.setItem('mlg_pw_prompt_dismissed', '1'); } catch {} }}
            onSaved={async () => { setPwPromptDismissed(true); await reloadAccount(); }} />
        )}
        <div className="acct-grid">

          {/* ── LEFT ── */}
          <div>
            {/* Saved Searches */}
            <SectionHead title="Saved Searches" count={searches.length}
              action={<a href="/search" style={{ ...pill, background: TEAL, color: NAVY }}>+ New saved search</a>} />
            {dataLoading ? <Placeholder text="Loading…" /> : searches.length === 0 ? (
              <div style={{ ...card, padding: '34px 26px', textAlign: 'center' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16, color: NAVY }}>Never miss a listing</div>
                <div style={{ fontSize: 13, color: SLATE, margin: '8px auto 16px', maxWidth: 380, lineHeight: 1.7 }}>
                  Save a search and we&rsquo;ll email you the moment something new hits the market that matches. Your agent can set one up for you too.
                </div>
                <a href="/search" style={{ ...pill, background: NAVY, color: '#fff' }}>Start a search →</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {searches.map((s: any) => (
                  <div key={s.id} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: NAVY }}>{s.name || 'Untitled search'}</div>
                      <div style={{ fontSize: 12, color: SLATE, marginTop: 4 }}>
                        <span style={{ background: s.transaction === 'rent' ? NAVY : TEAL, color: s.transaction === 'rent' ? '#fff' : NAVY, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, padding: '2px 8px', borderRadius: 99, marginRight: 8, letterSpacing: '.04em' }}>
                          {s.transaction === 'rent' ? 'FOR RENT' : 'FOR SALE'}
                        </span>
                        {(() => { const loc = typeof s.location === 'string' ? s.location : s.location?.name; return loc ? `${loc} · ` : ''; })()}Alerts {s.alert_frequency || 'daily'}
                      </div>
                    </div>
                    <a href="/search" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12.5, color: TEAL, textDecoration: 'none' }}>Run search →</a>
                    <button onClick={async () => {
                      if (!confirm(`Delete "${s.name}"?`)) return;
                      await authedFetch(`/api/me/saved-searches?id=${s.id}`, { method: 'DELETE' });
                      setSearches(prev => prev.filter((x: any) => x.id !== s.id));
                    }} aria-label="Delete" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Saved Listings */}
            <SectionHead title="Saved Listings" count={savedListings.length} style={{ marginTop: 34 }} />
            {dataLoading ? <Placeholder text="Loading…" /> : savedListings.length === 0 ? (
              <Placeholder text="No saved listings yet. Tap the star on any listing to keep it here." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {savedListings.map((s: any) => {
                  const l = s.properties; if (!l) return null;
                  const isRental = l.property_type === 'ResidentialLease';
                  return (
                    <a key={s.mls_id} href={`/listings/${slugifyListing(l)}`} className="acct-card-link"
                      style={{ ...card, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                      <div style={{ height: 158, background: '#f1f5f9' }}>
                        {l.image_urls?.[0] && <img src={l.image_urls[0]} alt={l.street_address || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 800, color: NAVY }}>
                          ${(l.list_price || 0).toLocaleString()}{isRental && <span style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginLeft: 3 }}>/mo</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: SLATE, margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {l.street_address}{l.city ? `, ${l.city}` : ''}
                        </div>
                        <div style={{ fontSize: 11.5, color: NAVY, fontWeight: 600 }}>
                          {l.beds ? `${l.beds} bd` : ''}{l.baths ? ` · ${l.baths} ba` : ''}{l.sqft ? ` · ${l.sqft.toLocaleString()} sf` : ''}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="acct-side" style={{ position: 'sticky', top: 86 }}>
            <AgentPanel agent={agent} loading={dataLoading} />
            <ContactInfoPanel profile={profile} phonesEnabled={phonesEnabled} emailsEnabled={emailsEnabled} onChanged={reloadAccount} />
            <SecurityPanel user={user} open={pwOpen} setOpen={setPwOpen} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero: name with inline edit ──────────────────────────────────────
function NameBlock({ first, last, onSaved }: { first: string; last: string; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(first);
  const [l, setL] = useState(last);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setF(first); setL(last); }, [first, last]);

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 }}>
          Welcome back{first ? ', ' : ''}{first} {last && <em style={{ fontStyle: 'italic', fontWeight: 500, color: TEAL }}>{last}</em>}
        </div>
        <button onClick={() => setEditing(true)}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.55)', fontSize: 12, fontFamily: BODY, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          {first ? 'Edit name' : 'Add your name'}
        </button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={f} onChange={e => setF(e.target.value)} placeholder="First name"
          style={{ padding: '9px 12px', borderRadius: 8, border: 'none', fontSize: 14, fontFamily: BODY, width: 150 }} />
        <input value={l} onChange={e => setL(e.target.value)} placeholder="Last name"
          style={{ padding: '9px 12px', borderRadius: 8, border: 'none', fontSize: 14, fontFamily: BODY, width: 150 }} />
        <button disabled={busy} onClick={async () => {
          setBusy(true); setErr(null);
          const res = await authedFetch('/api/me/account', { method: 'POST', body: JSON.stringify({ action: 'name', firstName: f, lastName: l }) });
          const j = await res.json();
          if (!res.ok) { setErr(j.error || 'Could not save'); setBusy(false); return; }
          // The header greeting ("Hi, …") reads Supabase Auth user_metadata,
          // not the registrations row. Sync it here so the nav updates live —
          // updateUser fires a USER_UPDATED event that useUser() listens for.
          try { await getSupabase().auth.updateUser({ data: { first_name: f, last_name: l || null } }); } catch {}
          await onSaved(); setBusy(false); setEditing(false);
        }} style={{ background: TEAL, color: NAVY, border: 'none', padding: '9px 18px', borderRadius: 99, fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {busy ? '…' : 'Save'}
        </button>
        <button onClick={() => { setEditing(false); setErr(null); }}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
      {err && <div style={{ color: '#fda4af', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ─── Your Agent — mirrors the listing-page agent card ────────────────
function AgentPanel({ agent, loading }: { agent: AgentCard; loading: boolean }) {
  if (loading) return <div style={{ ...card, padding: 24, color: SLATE, fontSize: 13 }}>Loading your agent…</div>;
  const telDigits = (p: string) => p.replace(/\D/g, '');

  const circle: React.CSSProperties = { width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', border: '3px solid #f1f5f9', flexShrink: 0 };

  const inner = (photo: React.ReactNode, eyebrow: string, name: string, title: string | null, line: string, actions: React.ReactNode, footer?: React.ReactNode) => (
    <div style={{ ...card, padding: '22px 22px 20px', boxShadow: '0 1px 3px rgba(13,23,59,.04)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {photo}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 10, letterSpacing: '2.5px', color: TEAL, fontWeight: 700 }}>{eyebrow}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, color: NAVY, margin: '3px 0 1px' }}>{name}</div>
          {title && <div style={{ fontSize: 11.5, color: SLATE, letterSpacing: '.08em', textTransform: 'uppercase' }}>{title}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: SLATE, lineHeight: 1.7, margin: '14px 0 0' }}>{line}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>{actions}</div>
      {footer}
    </div>
  );

  if (!agent) {
    return inner(
      <div style={{ ...circle, background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, border: 'none' }}>ML</div>,
      'YOUR TEAM', 'Modern Living Group', null,
      "We'll pair you with the right specialist for your search, call or message us any time.",
      <>
        <a href="tel:5612288420" style={{ ...pill, background: TEAL, color: NAVY }}>Call</a>
        <a href="/contact" style={{ ...pill, background: '#fff', border: '1.5px solid #cbd5e1', color: NAVY }}>Message us</a>
      </>,
    );
  }

  return inner(
    agent.photo_url
      ? <img src={agent.photo_url} alt={agent.name} style={circle} />
      : <div style={{ ...circle, background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, border: 'none' }}>{agent.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>,
    'YOUR AGENT', agent.name, agent.title,
    "Feel free to call or text me anytime, I'm your direct line at Modern Living.",
    <>
      {agent.phone && <a href={`tel:${telDigits(agent.phone)}`} style={{ ...pill, background: TEAL, color: NAVY }}>Call</a>}
      {agent.phone && <a href={`sms:${telDigits(agent.phone)}`} style={{ ...pill, background: '#fff', border: `1.5px solid ${TEAL}`, color: '#0891a8' }}>Text</a>}
      {agent.email && <a href={`mailto:${agent.email}`} style={{ ...pill, background: '#fff', border: '1.5px solid #cbd5e1', color: NAVY }}>Email</a>}
    </>,
    <a href={`/agents/${agent.slug}`} style={{ display: 'inline-block', marginTop: 13, fontSize: 12, color: SLATE, textDecoration: 'underline' }}>View profile</a>,
  );
}

// ─── Contact info: emails + phones, change primary, request removal ──
function ContactInfoPanel({ profile, phonesEnabled, emailsEnabled, onChanged }: { profile: Profile | null; phonesEnabled: boolean; emailsEnabled: boolean; onChanged: () => Promise<void> }) {
  // email
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailVal, setEmailVal] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  // phone
  const [addingPhone, setAddingPhone] = useState(false);
  const [phoneLabel, setPhoneLabel] = useState('Cell');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneMakePrimary, setPhoneMakePrimary] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  // shared
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (!profile) return null;
  const phones = profile.extra_phones || [];
  const emails = profile.extra_emails || [];
  const pendingEmail = profile.pending_email || null;

  const post = (b: any) => authedFetch('/api/me/account', { method: 'POST', body: JSON.stringify(b) });

  async function addEmail() {
    setEmailBusy(true); setEmailErr(null);
    const res = await post({ action: 'add_email', email: emailVal });
    const j = await res.json();
    if (!res.ok) { setEmailErr(j.error || 'Could not add email'); setEmailBusy(false); return; }
    setEmailVal(''); setAddingEmail(false); setEmailBusy(false);
    await onChanged();
  }

  async function makeEmailPrimary(email: string) {
    setEmailErr(null); setEmailMsg(null);
    // Client-side change → Supabase emails a confirmation link to the new address.
    const { error } = await getSupabase().auth.updateUser({ email });
    if (error) { setEmailErr(error.message); return; }
    // Retain the old login email as a secondary once the change confirms.
    await post({ action: 'capture_prev_email', newEmail: email }).catch(() => {});
    setEmailMsg(`Check ${email} and click the link there to make it your primary sign-in address.`);
    await onChanged();
  }

  async function addPhone() {
    setPhoneBusy(true); setPhoneErr(null);
    const res = await post({ action: 'add_phone', label: phoneLabel, number: phoneNumber, makePrimary: phoneMakePrimary });
    const j = await res.json();
    if (!res.ok) { setPhoneErr(j.error || 'Could not add number'); setPhoneBusy(false); return; }
    setPhoneNumber(''); setPhoneMakePrimary(false); setAddingPhone(false); setPhoneBusy(false);
    await onChanged();
  }

  async function makePhonePrimary(number: string) {
    await post({ action: 'set_primary_phone', number });
    await onChanged();
  }

  async function requestRemoval(kind: 'phone' | 'email', value: string) {
    await post({ action: 'request_removal', kind, value });
    setActionMsg('Got it, we\u2019ve let your agent know and they\u2019ll take it off.');
    setTimeout(() => setActionMsg(null), 5000);
  }

  const linkBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#0891a8', fontFamily: DISPLAY, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: 0 };
  const removeBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 11.5, cursor: 'pointer', padding: 0 };
  const primaryTag: React.CSSProperties = { background: TEAL, color: NAVY, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, padding: '3px 9px', borderRadius: 99, letterSpacing: '.05em', textTransform: 'uppercase' };
  const sub: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: SLATE, margin: '4px 0 6px' };
  const dashBtn: React.CSSProperties = { marginTop: 12, background: 'transparent', border: '1.5px dashed #cbd5e1', color: SLATE, padding: '9px 16px', borderRadius: 10, fontSize: 12.5, fontFamily: DISPLAY, fontWeight: 700, cursor: 'pointer', width: '100%' };
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: BODY, color: NAVY };

  return (
    <div style={{ ...card, padding: '20px 20px 22px', marginTop: 18 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: NAVY, marginBottom: 12 }}>Contact info</div>

      {/* EMAIL */}
      <div style={sub}>Email</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
        <span style={primaryTag}>Primary</span>
        <span style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600, wordBreak: 'break-all' }}>{profile.email || '—'}</span>
      </div>
      {pendingEmail && (
        <div style={{ fontSize: 11.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', margin: '8px 0' }}>
          Pending confirmation: <strong>{pendingEmail}</strong>, check that inbox and click the link to make it your primary sign-in.
        </div>
      )}
      {emails.map(e => (
        <div key={e.email} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 150, fontSize: 13, color: NAVY, fontWeight: 600, wordBreak: 'break-all' }}>{e.email}</span>
          <button onClick={() => makeEmailPrimary(e.email)} style={linkBtn}>Make primary</button>
          <span style={{ color: '#e2e8f0' }}>·</span>
          <button onClick={() => requestRemoval('email', e.email)} style={removeBtn}>Request removal</button>
        </div>
      ))}
      {emailMsg && <div style={{ fontSize: 11.5, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 10px', marginTop: 8 }}>{emailMsg}</div>}
      {emailsEnabled && (addingEmail ? (
        <div style={{ marginTop: 12 }}>
          <input value={emailVal} onChange={e => setEmailVal(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" style={inp} />
          {emailErr && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{emailErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button disabled={emailBusy || !emailVal.trim()} onClick={addEmail} style={{ ...pill, background: NAVY, color: '#fff', opacity: emailBusy || !emailVal.trim() ? .6 : 1 }}>{emailBusy ? '…' : 'Add email'}</button>
            <button onClick={() => { setAddingEmail(false); setEmailErr(null); }} style={{ background: 'transparent', border: 'none', color: SLATE, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAddingEmail(true); setEmailMsg(null); }} style={dashBtn}>+ Add another email</button>
      ))}

      {/* PHONE */}
      <div style={{ ...sub, marginTop: 18 }}>Phone</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
        <span style={primaryTag}>Primary</span>
        <span style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600 }}>{profile.phone || '—'}</span>
      </div>
      {phones.map(p => (
        <div key={p.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <span style={{ background: '#eef6f8', color: NAVY, fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, padding: '3px 9px', borderRadius: 99, letterSpacing: '.05em', textTransform: 'uppercase' }}>{p.label}</span>
          <span style={{ flex: 1, minWidth: 110, fontSize: 13, color: NAVY, fontWeight: 600 }}>{p.number}</span>
          <button onClick={() => makePhonePrimary(p.number)} style={linkBtn}>Make primary</button>
          <span style={{ color: '#e2e8f0' }}>·</span>
          <button onClick={() => requestRemoval('phone', p.number)} style={removeBtn}>Request removal</button>
        </div>
      ))}
      {phonesEnabled && (addingPhone ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={phoneLabel} onChange={e => setPhoneLabel(e.target.value)} disabled={phoneMakePrimary}
              style={{ padding: '9px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: BODY, color: NAVY, opacity: phoneMakePrimary ? .5 : 1 }}>
              {['Cell', 'Home', 'Work', 'Other'].map(o => <option key={o}>{o}</option>)}
            </select>
            <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="(561) 555-0123" inputMode="tel"
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: BODY, color: NAVY }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: NAVY, cursor: 'pointer' }}>
            <input type="checkbox" checked={phoneMakePrimary} onChange={e => setPhoneMakePrimary(e.target.checked)} />
            Make this my primary number
          </label>
          <SmsConsentDisclosure />
          {phoneErr && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{phoneErr}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button disabled={phoneBusy || !phoneNumber.trim()} onClick={addPhone} style={{ ...pill, background: NAVY, color: '#fff', opacity: phoneBusy || !phoneNumber.trim() ? .6 : 1 }}>{phoneBusy ? '…' : 'Add number'}</button>
            <button onClick={() => { setAddingPhone(false); setPhoneErr(null); }} style={{ background: 'transparent', border: 'none', color: SLATE, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingPhone(true)} style={dashBtn}>+ Add another number</button>
      ))}

      {actionMsg && <div style={{ fontSize: 11.5, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '7px 10px', marginTop: 12 }}>{actionMsg}</div>}
    </div>
  );
}

// ─── First-login modal: prompt magic-link users to set a password ─────
function SetPasswordModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password: pw, data: { ...(user?.user_metadata || {}), password_set: true } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    logSecurityEvent('password_set');
    await onSaved();
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,23,59,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: 24, color: '#fff' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800 }}>Set a password</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 4, lineHeight: 1.5 }}>You signed in with a one-time link. Add a password so you can log in directly next time.</div>
        </div>
        <div style={{ padding: 24 }}>
          <PwInput label="Password" value={pw} onChange={setPw} />
          <PwInput label="Confirm password" value={confirm} onChange={setConfirm} />
          {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}
          <button disabled={busy || !pw || !confirm} onClick={save}
            style={{ width: '100%', padding: 12, background: busy || !pw || !confirm ? '#94a3b8' : TEAL, color: '#fff', border: 'none', borderRadius: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{busy ? '…' : 'Save password'}</button>
          <button onClick={onClose} style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: SLATE, fontSize: 12.5, cursor: 'pointer' }}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}

// ─── Account security: set / change password (client-side updateUser) ─
function SecurityPanel({ user, open, setOpen }: { user: any; open: boolean; setOpen: (v: boolean) => void }) {
  const hasPassword = !!user?.user_metadata?.password_set;
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setErr(null);
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({
      password: pw,
      data: { ...(user?.user_metadata || {}), password_set: true },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    logSecurityEvent(hasPassword ? 'password_changed' : 'password_set');
    setDone(true); setPw(''); setConfirm('');
    setTimeout(() => { setDone(false); setOpen(false); }, 2200);
  }

  return (
    <div id="acct-security" style={{ ...card, padding: '20px 20px 22px', marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, color: NAVY }}>Account security</div>
        {!open && (
          <button onClick={() => setOpen(true)} style={{ ...pill, background: '#fff', border: `1.5px solid ${TEAL}`, color: '#0891a8', padding: '7px 14px' }}>
            {hasPassword ? 'Change password' : 'Set a password'}
          </button>
        )}
      </div>
      {!open ? (
        <div style={{ fontSize: 12, color: SLATE, marginTop: 8, lineHeight: 1.6 }}>
          {hasPassword ? 'Update the password you use to sign in.' : 'Add a password so you can sign in without a one-time link next time.'}
        </div>
      ) : done ? (
        <div style={{ marginTop: 14, color: NAVY, fontWeight: 700, fontFamily: DISPLAY }}>✓ Password saved</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <PwInput label={hasPassword ? 'New password' : 'Password'} value={pw} onChange={setPw} />
          <PwInput label="Confirm password" value={confirm} onChange={setConfirm} />
          {err && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button disabled={busy || !pw || !confirm} onClick={save}
              style={{ ...pill, background: NAVY, color: '#fff', opacity: busy || !pw || !confirm ? .6 : 1 }}>{busy ? '…' : 'Save password'}</button>
            <button onClick={() => { setOpen(false); setErr(null); setPw(''); setConfirm(''); }}
              style={{ background: 'transparent', border: 'none', color: SLATE, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ title, count, action, style }: { title: string; count?: number; action?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, ...style }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, color: NAVY }}>{title}</div>
      {count !== undefined && <div style={{ fontSize: 12, color: SLATE }}>({count})</div>}
      <div style={{ marginLeft: 'auto' }}>{action}</div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '38px 24px', textAlign: 'center', color: SLATE, fontSize: 13 }}>
      {text}
    </div>
  );
}

export default function AccountPage() {
  return (
    <AccountInner />
  );
}


