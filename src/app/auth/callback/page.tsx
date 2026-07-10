'use client';

// Auth callback for magic-link + "Sign in with Google" on the portal.
// Supabase redirects the browser here after the OTP/OAuth consent. The
// client-side @supabase/supabase-js auth client uses localStorage (not
// cookies — see lib/auth.ts), so the code-for-session exchange happens
// here in the browser, NOT a server route.
//
// Setup requirement on the Supabase project:
//   Auth → URL Configuration → Redirect URLs must include this domain's
//   /auth/callback. The Google provider is configured project-wide.
//
// NOTE (Patrick 2026-07-10): the old "One last step" phone-capture step
// was removed. Phone is already required at registration, so returning
// users always have one — the capture step was redundant and, worse, was
// re-onboarding already-registered users on magic-link sign-in (and not
// even persisting when filled). The callback now simply establishes the
// session and returns the user where they were headed.

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/auth';

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const SLATE = '#64748b';
const BODY = "'Poppins', sans-serif";

function Inner() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finishing sign in…');

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
          // the session in localStorage, then forwarded here. Proceed if a
          // session exists; only error if it doesn't.
          const { data: { session: existing } } = await sb.auth.getSession();
          if (existing) { router.replace(next); return; }
          router.replace('/?auth_error=missing_credentials');
          return;
        }
        const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg('Sign-in failed: ' + error.message);
          setTimeout(() => router.replace(`/?auth_error=${encodeURIComponent(error.message)}`), 1500);
          return;
        }
      }

      // Session is live — send them where they were headed. No profile /
      // phone-capture step: phone is captured at registration for everyone.
      router.replace(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
