'use client';

// OAuth callback for "Sign in with Google" on the portal. Supabase
// redirects the browser here after the user consents on Google. The
// client-side @supabase/supabase-js auth client uses localStorage
// (not cookies — see lib/auth.ts), so the code-for-session exchange
// has to happen here in the browser, NOT in a server route.
//
// Setup requirement on the Supabase project:
//   Auth → URL Configuration → Redirect URLs must include
//   https://mlre.mlrecloud.com/auth/callback (and the production domain
//   at cutover). The Google provider itself is configured project-wide.
//
// PHONE CAPTURE: Google never gives us a phone number. New users are
// steered to the signup form (the Google button only shows on the Sign In
// tab — see AuthModal), but a brand-new visitor can still create an
// account by signing in with Google. For those users this page blocks
// after the session is established and requires name + phone before
// continuing — POSTed to /api/me/profile, which creates the registrations
// row and the FUB contact.

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/auth';
import { validatePhoneFormat } from '@/lib/phone';

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const SLATE = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY = "'Poppins', sans-serif";

function Inner() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finishing sign in…');

  // Phone-capture step state
  const [needsPhone, setNeedsPhone] = useState(false);
  const [nextUrl, setNextUrl] = useState('/');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // next URL was stashed in localStorage by the AuthModal before the
    // OAuth jump (we don't put it in the redirect_to so the URL stays
    // bare and matches Supabase's strict-match allowlist).
    let next = '/';
    try {
      const stashed = localStorage.getItem('mlg-auth-next');
      if (stashed) next = stashed;
      localStorage.removeItem('mlg-auth-next');
    } catch {}
    setNextUrl(next);

    // Supabase's hosted authorize endpoint can return either:
    //   • Implicit flow → tokens in URL hash (#access_token=...&refresh_token=...)
    //   • PKCE flow     → code in query string (?code=...)
    // Our project uses implicit by default, so the hash path is the hot path.
    const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
    const hp = new URLSearchParams(hash);
    const qp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const providerError = hp.get('error_description') || hp.get('error') || qp.get('error_description') || qp.get('error');

    if (providerError) {
      router.replace(`/?auth_error=${encodeURIComponent(providerError)}`);
      return;
    }

    (async () => {
      const sb = getSupabase();

      // Establish the session (implicit or PKCE)
      const access_token = hp.get('access_token');
      const refresh_token = hp.get('refresh_token');
      if (access_token && refresh_token) {
        const { error } = await sb.auth.setSession({ access_token, refresh_token });
        if (error) {
          setMsg('Sign-in failed: ' + error.message);
          setTimeout(() => router.replace(`/?auth_error=${encodeURIComponent(error.message)}`), 1500);
          return;
        }
      } else {
        const code = qp.get('code');
        if (!code) {
          // Magic-link path: /auth/confirm already verified the OTP and stored
          // the session in localStorage, then forwarded here for the shared
          // profile step. Proceed if a session exists; only error if it doesn't.
          const { data: { session: existing } } = await sb.auth.getSession();
          if (!existing) { router.replace('/?auth_error=missing_credentials'); return; }
        }
        const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg('Sign-in failed: ' + error.message);
          setTimeout(() => router.replace(`/?auth_error=${encodeURIComponent(error.message)}`), 1500);
          return;
        }
      }

      // Session is live — check the registration profile. If the user has
      // no registrations row or no phone (OAuth-created account), block
      // here and capture it. Fail-open: if the check itself errors, don't
      // strand the user on this page.
      try {
        const { data: { session } } = await sb.auth.getSession();
        const token = session?.access_token;
        const user = session?.user;
        if (!token || !user) { router.replace(next); return; }

        const r = await fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { router.replace(next); return; }
        const profile = await r.json();
        if (profile.complete) { router.replace(next); return; }

        // Pre-fill names from Google metadata / existing registration row
        const meta: any = user.user_metadata || {};
        const full = String(meta.full_name || meta.name || '').trim();
        const [gFirst, ...rest] = full.split(' ');
        setFirstName(profile.firstName || meta.first_name || gFirst || '');
        setLastName(profile.lastName || meta.last_name || rest.join(' ') || '');
        setNeedsPhone(true);
      } catch {
        router.replace(next);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const fmt = validatePhoneFormat(phone);
    if (!fmt.ok) { setFormError(fmt.reason); return; }
    if (!userType) { setFormError('Please tell us what best describes you.'); return; }
    setBusy(true);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expired, please sign in again.');
      const r = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName, lastName, phone, userType, siteSlug: 'mlg-site' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save');
      router.replace(nextUrl);
    } catch (err: any) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  if (needsPhone) {
    const input: React.CSSProperties = {
      width: '100%', padding: '11px 13px', border: '1px solid #cbd5e1', borderRadius: 10,
      fontFamily: BODY, fontSize: 16, color: NAVY, outline: 'none', boxSizing: 'border-box',
    };
    const label: React.CSSProperties = {
      display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
      textTransform: 'uppercase', color: SLATE, marginBottom: 5, fontFamily: BODY,
    };
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: BODY, background: '#f8fafc', padding: 16,
      }}>
        <form onSubmit={submitPhone} style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
          padding: '30px 28px', boxShadow: '0 24px 64px rgba(13,23,59,0.18)',
        }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, color: NAVY, margin: '0 0 6px' }}>
            One last step
          </h2>
          <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.65, margin: '0 0 18px' }}>
            Add your phone number so a Modern Living agent can reach you about tours and listings.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>First name</label>
              <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
            </div>
            <div>
              <label style={label}>Last name</label>
              <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Phone</label>
            <input style={input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>What best describes you?</label>
            <select style={{ ...input, background: '#fff', color: userType ? NAVY : SLATE, cursor: 'pointer' }} value={userType} onChange={(e) => setUserType(e.target.value)} required>
              <option value="" disabled>Select one</option>
              {['Buyer', 'Seller', 'Renter', 'Landlord'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {formError && <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 12 }}>{formError}</div>}
          <button type="submit" disabled={busy} style={{
            width: '100%', padding: '13px 18px', borderRadius: 99, border: 'none',
            background: TEAL, color: NAVY, fontFamily: DISPLAY, fontWeight: 700,
            fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>{busy ? 'Saving…' : 'Continue'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: BODY, color: NAVY, background: '#f8fafc',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: SLATE, marginBottom: 12 }}>{msg}</div>
        <div style={{
          width: 28, height: 28, margin: '0 auto',
          border: '3px solid #cbd5e1', borderTopColor: TEAL,
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div />}>
      <Inner />
    </Suspense>
  );
}
