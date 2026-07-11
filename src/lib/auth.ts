// ─── Auth — Supabase Auth client + helpers for cross-site MLG accounts ──
// One account works across ALL MLG sites (mlg-search, twocityplazacondos,
// and all future neighborhood mini-sites). Same Supabase project means
// same user table, same saved listings, same saved searches everywhere.
//
// Each site has its own session cookie (cookies are domain-scoped). When
// a user visits a different MLG site they sign in there too, but it's the
// same account — they immediately see all their saved listings and history.
//
// For "true SSO" across the *.mlrecloud.com family we'll switch to a
// subdomain cookie domain later. CityPlace South Tower is on its own TLD so it'll
// always require a separate sign-in.

'use client';

import { useEffect, useState } from 'react';
import { createClient, type User, type Session } from '@supabase/supabase-js';

// Lazy singleton — same client instance per page. Avoids creating multiple
// auth listeners which would each fire on every state change.
let _client: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // localStorage works for SPA-style mlg-search. Cookies would be
        // better for SSR-rendered pages but we don't have any user-gated
        // SSR routes; all auth-aware UI is client-side.
        storageKey: 'mlg-auth',
      },
    },
  );
  return _client;
}

// ─── Hooks ────────────────────────────────────────────────────────────

export type AuthState = {
  user: User | null;
  loading: boolean;
};

// Subscribes to auth changes. Use in any client component that needs to
// know the current user.
// Uses getSession() (not getUser()) for initial load — getSession() reads
// from localStorage and restores the full session into the client's internal
// state, which means subsequent DB queries correctly include the JWT for RLS.
// getUser() only validates the token server-side; it doesn't restore the
// local session, so RLS queries would silently run as anonymous.
export function useUser(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const sb = getSupabase();
    let mounted = true;

    sb.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setState({ user: session?.user ?? null, loading: false });
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session: Session | null) => {
      if (mounted) setState({ user: session?.user ?? null, loading: false });
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}

// ─── Operations ───────────────────────────────────────────────────────

// Sign up creates the auth.users row AND the registrations row. Both have
// to succeed for a valid registration — we link them via auth user id.
// The site_slug records where the user originally signed up (analytics +
// later FUB tagging).
export async function signUp(args: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  siteSlug: string;
  userType?: string;
  // A2P/TCPA consent — true iff the user actively checked the unchecked-
  // by-default SMS consent box. smsConsentText is the verbatim disclosure
  // shown at consent time, persisted as TCPA evidence.
  smsConsent?: boolean;
  smsConsentText?: string;
}) {
  const sb = getSupabase();
  const { email, password, firstName, lastName, phone, siteSlug, userType, smsConsent, smsConsentText } = args;

  // 1) Create auth user. Supabase handles password hashing, email confirm.
    // 0.5) Registration verification gate (Patrick 2026-07-11) — central
  // verifier: Telnyx Number Lookup (number must be in service), email MX +
  // disposable checks, Claude verdict on obvious fakes. FAIL-OPEN.
  try {
    const vRes = await fetch('/api/register/verify/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone }),
    });
    if (vRes.ok) {
      const v = await vRes.json() as { ok?: boolean; fieldErrors?: Record<string, string> };
      if (v.ok === false && v.fieldErrors && Object.keys(v.fieldErrors).length > 0) {
        const msg = v.fieldErrors.phone || v.fieldErrors.email || v.fieldErrors.name
          || 'Please double-check your information and try again.';
        return { error: { code: 'verification', message: msg } as any };
      }
    }
  } catch { /* fail open */ }

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, phone, site_slug: siteSlug },
    },
  });
  if (error) return { error };
  if (!data.user) return { error: { message: 'Sign up succeeded but no user returned.' } as any };

  // 2) Add row to registrations for the profile fields (the rest of the app
  //    reads from here, not from auth.users metadata). Idempotent: a DB
  //    trigger could also auto-create this; we do it explicitly so we can
  //    confirm the row exists before continuing.
  const regRow: Record<string, any> = {
    user_id: data.user.id,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    source_site: siteSlug,
    user_type: userType || null,
    sms_consent: smsConsent ?? false,
    sms_consent_at: smsConsent ? new Date().toISOString() : null,
    sms_consent_text: smsConsent ? (smsConsentText || null) : null,
  };
  let { error: regErr } = await sb.from('registrations').insert(regRow as any);  // table absent from generated types
  // Defensive retry — strip columns the schema hasn't picked up yet so the
  // migration window never blocks account creation.
  if (regErr && /sms_consent|user_type|column|schema cache/i.test(regErr.message || '')) {
    delete regRow.sms_consent;
    delete regRow.sms_consent_at;
    delete regRow.sms_consent_text;
    delete regRow.user_type;
    ({ error: regErr } = await sb.from('registrations').insert(regRow as any));
  }
  // If registrations row fails we still consider sign up "successful" —
  // the user can sign in, and an admin can repair the missing row. Better
  // than blocking on a non-critical write.
  if (regErr) console.error('registrations insert failed (non-fatal):', regErr);

  // 3) Create FUB contact — fire-and-forget, never blocks signup.
  //    Runs server-side via /api/leads so FUB_API_KEY stays secret.
  try {
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        siteSlug,
        userType: userType || undefined,
        smsConsent: smsConsent ?? false,
        smsConsentText: smsConsent ? (smsConsentText || null) : null,
        isRegistration: true,
        source: 'Registration',
        // Browsing history (pre-registration) so the routing engine can compute
        // dominant type + median price + area and route on real intent. Read
        // localStorage inline to avoid a circular import with view-tracker.
        viewedMlsIds: (() => {
          try { const r = window.localStorage.getItem('mlg.viewed_listings'); return r ? JSON.parse(r) : []; } catch { return []; }
        })(),
      }),
    }).catch(() => {}); // fire-and-forget
  } catch {}

  return { user: data.user };
}

export async function signIn(email: string, password: string) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error };
  return { user: data.user };
}

export async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}

// ─── Saved listings ───────────────────────────────────────────────────

// Returns whether the current user has saved a given listing. Watches auth
// state so it re-runs when the user signs in/out.
export function useIsSaved(mlsId: string | null | undefined) {
  const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !mlsId) {
      setSaved(false);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    getSupabase()
      .from('saved_listings')
      .select('id')
      .eq('user_id', user.id)
      .eq('mls_id', mlsId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) {
          setSaved(!!data);
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [user?.id, mlsId]);

  return { saved, setSaved, loading };
}

export async function saveListing(userId: string, mlsId: string, siteSlug: string) {
  const result = await getSupabase()
    .from('saved_listings')
    .insert({ user_id: userId, mls_id: mlsId, site_slug: siteSlug } as any);

  // Fire FUB "Saved Property" event — server-side route handles it
  getSupabase().auth.getSession().then(({ data: { session } }) => {
    const token = session?.access_token;
    if (!token) return;
    fetch('/api/me/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mls_id: mlsId, site_slug: siteSlug }),
    }).catch(() => {});
  });

  return result;
}

export async function unsaveListing(userId: string, mlsId: string) {
  return getSupabase()
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('mls_id', mlsId);
}

// ─── Admin helpers ────────────────────────────────────────────────────
// Admin allowlist by email. Lives client-side ONLY for UI gating — the
// actual permission check is enforced server-side via Supabase RLS / API
// route that reads from this allowlist too.
const ADMIN_EMAILS = new Set([
  'patrick@modernlivingre.com',
  'patrick@livemodern.com',
]);

export function isAdmin(user: User | null): boolean {
  if (!user?.email) return false;
  return ADMIN_EMAILS.has(user.email.toLowerCase());
}


