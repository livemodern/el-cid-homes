'use client';

// Magic-link / email OTP confirmation — keeps the verification link on our
// OWN domain instead of exposing the raw <project>.supabase.co verify URL.
//
// The Supabase "Magic Link" email template links here with a token hash:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
//
// Our auth is localStorage-based and client-side (see lib/auth.ts), so we
// verify the OTP in the browser with the same getSupabase() client the rest
// of the app uses. That establishes the session in localStorage exactly like
// the OAuth path, then we hand off to /auth/callback for the shared session
// establishment and final redirect. Nothing in this flow ever shows
// the user a supabase.co URL.

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/auth';

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const SLATE = '#64748b';
const BODY = "'Poppins', sans-serif";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState('Confirming your sign-in…');

  useEffect(() => {
    (async () => {
      // Surface any error Supabase appended to the link.
      const providerError =
        params.get('error_description') || params.get('error');
      if (providerError) {
        router.replace(`/?auth_error=${encodeURIComponent(providerError)}`);
        return;
      }

      const token_hash = params.get('token_hash');
      // Pass the type straight through from the template so this route also
      // works for signup / recovery links later. Magic links use 'magiclink'.
      const type = (params.get('type') || 'magiclink') as
        | 'magiclink'
        | 'signup'
        | 'recovery'
        | 'invite'
        | 'email'
        | 'email_change';

      if (!token_hash) {
        router.replace('/?auth_error=missing_token');
        return;
      }

      const sb = getSupabase();
      const { error } = await sb.auth.verifyOtp({ type, token_hash });
      if (error) {
        setMsg('This link has expired or was already used.');
        setTimeout(
          () => router.replace(`/?auth_error=${encodeURIComponent(error.message)}`),
          1800,
        );
        return;
      }

      // Session is live in localStorage. Hand off to the shared callback tail
      // (session establishment + final redirect).
      router.replace('/auth/callback?verified=1');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: BODY,
        color: NAVY,
        background: '#f8fafc',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: SLATE, marginBottom: 12 }}>{msg}</div>
        <div
          style={{
            width: 28,
            height: 28,
            margin: '0 auto',
            border: '3px solid #cbd5e1',
            borderTopColor: TEAL,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div />}>
      <Inner />
    </Suspense>
  );
}
