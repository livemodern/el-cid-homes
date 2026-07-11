'use client';

// ─── AuthModal — sign in / sign up overlay ───────────────────────────
import { useState, useEffect } from 'react';
import { signUp, signIn, getSupabase } from '@/lib/auth';
import { flushViewsToServer } from '@/lib/view-tracker';
import SmsConsentDisclosure, { SMS_CONSENT_TEXT } from '@/components/SmsConsentDisclosure';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

type Mode = 'signin' | 'signup' | 'forgot' | 'magic';

export function AuthModal({
  open, onClose, siteSlug, defaultMode = 'signin', message, blocking = false,
}: {
  open: boolean;
  onClose: (result: 'signed-in' | 'cancelled') => void;
  siteSlug: string;
  defaultMode?: 'signin' | 'signup';
  message?: string;
  blocking?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [magicSent, setMagicSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userType, setUserType] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError(null);
      setBusy(false);
      setResetSent(false);
      setSmsConsent(false);
    }
  }, [open, defaultMode]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: 'https://search.mlrecloud.com/account',
        });
        if (error) { setError(error.message); setBusy(false); return; }
        setResetSent(true);
        setBusy(false);
        return;
      }
      if (mode === 'magic') {
        // Magic link — no password needed. Supabase emails a one-tap sign-in
        // link; /auth/callback (or /auth/confirm via the email template)
        // establishes the session on return.
        const redirectTo = `${window.location.origin}/auth/callback`;
        try {
          localStorage.setItem('mlg-auth-next', window.location.pathname + window.location.search);
        } catch {}
        const { error } = await getSupabase().auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) { setError(error.message); setBusy(false); return; }
        setMagicSent(true);
        setBusy(false);
        return;
      }
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) { setError(error.message); setBusy(false); return; }
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Please enter your first and last name.');
          setBusy(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          setBusy(false);
          return;
        }
        if (!userType) {
          setError('Please tell us what best describes you.');
          setBusy(false);
          return;
        }
        // SMS consent — A2P/TCPA require explicit unchecked-by-default
        // opt-in if a phone is provided. Phone is optional on TCP, so the
        // box only gates submit when the user filled it in.
        if (phone && !smsConsent) {
          setError('Please check the SMS consent box if you’d like agent updates by text, or leave the phone field blank to skip.');
          setBusy(false);
          return;
        }
        const { error } = await signUp({
          email, password, firstName, lastName, phone, siteSlug, userType,
          smsConsent, smsConsentText: SMS_CONSENT_TEXT,
        });
        if (error) { setError(error.message); setBusy(false); return; }
      }
      try { await flushViewsToServer(siteSlug); } catch { /* non-blocking */ }
      onClose('signed-in');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div
      onClick={() => { if (!blocking) onClose('cancelled'); }}
      style={{
        position: 'fixed', inset: 0,
        background: blocking ? 'rgba(13,23,59,0.85)' : 'rgba(13,23,59,0.55)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: BODY,
        backdropFilter: blocking ? 'blur(4px)' : undefined,
        WebkitBackdropFilter: blocking ? 'blur(4px)' : undefined,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          position: 'relative',
          // Cap to viewport so the tall sign-up form (name → phone → SMS
          // consent → email → password → button) can scroll internally
          // instead of clipping off-screen on mobile with no way to reach
          // the submit. Flex column lets the gradient header stay pinned
          // while the form area scrolls under it. iOS-safe via 100dvh.
          // Same fix that landed on mlg-site (commits 824eb0c + f331dc4).
          // Patrick 2026-06-22.
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {!blocking && (
          <button
            type="button"
            onClick={() => onClose('cancelled')}
            aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 12, zIndex: 1,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', width: 30, height: 30, borderRadius: '50%',
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}
          >×</button>
        )}

        {/* Header — MLG-branded. White logo sits above the title against
            the navy gradient (logo file is /public/mlg-logo-white.svg). */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`,
          padding: '28px 28px 26px', color: '#fff',
        }}>
          <img
            src="/mlg-logo-white.svg"
            alt="Modern Living Real Estate"
            style={{ height: 34, width: 'auto', display: 'block', marginBottom: 18, opacity: 0.96 }}
          />
          <div style={{
            fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em',
            lineHeight: 1.2, marginBottom: 6,
          }}>
            {mode === 'signin' ? 'Welcome Back' : mode === 'signup' ? 'Create Your Account' : mode === 'magic' ? 'Email Sign-In' : 'Reset Password'}
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
            {mode === 'forgot'
              ? "Enter your email and we'll send you a reset link."
              : "One account works across all Modern Living sites, your saved listings, searches, and tour requests follow you everywhere."}
          </div>
        </div>

        {message && mode !== 'forgot' && (
          <div style={{
            padding: '12px 28px',
            background: blocking ? '#fef3c7' : '#f0fbfd',
            borderBottom: `1px solid ${blocking ? '#fcd34d' : '#e0f5f9'}`,
            color: blocking ? '#92400e' : NAVY,
            fontSize: 13, fontWeight: 600,
          }}>
            {message}
          </div>
        )}

        {/* Tabs — only shown for signin/signup */}
        {mode !== 'forgot' && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, padding: '14px 0', background: 'transparent', border: 'none',
                  borderBottom: mode === m ? `2px solid ${TEAL}` : '2px solid transparent',
                  color: mode === m ? NAVY : SLATE,
                  fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} style={{ padding: '24px 28px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

          {/* Forgot password — success state */}
          {mode === 'forgot' && resetSent ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                Check your email
              </div>
              <div style={{ fontSize: 13, color: SLATE, marginBottom: 20, lineHeight: 1.6 }}>
                We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
              </div>
              <button
                type="button"
                onClick={() => { setMode('signin'); setResetSent(false); setError(null); }}
                style={{ background: 'none', border: 'none', color: TEAL, fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                ← Back to Sign In
              </button>
            </div>
          ) : mode === 'magic' && magicSent ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                Check your email
              </div>
              <div style={{ fontSize: 13, color: SLATE, marginBottom: 8, lineHeight: 1.6 }}>
                We sent a sign-in link to <strong>{email}</strong>.
              </div>
              <div style={{ fontSize: 12, color: SLATE, marginBottom: 20, lineHeight: 1.6 }}>
                Tap the link in your email, you'll be signed in instantly, no password needed. The link expires in 1 hour.
              </div>
              <button
                type="button"
                onClick={() => { setMode('signin'); setMagicSent(false); setError(null); }}
                style={{ background: 'none', border: 'none', color: TEAL, fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                &larr; Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth — SIGN IN ONLY (Google gives no phone; new users
                  are steered to the signup form for A2P-compliant capture) */}
              {mode === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        localStorage.setItem('mlg-auth-next', window.location.pathname + window.location.search);
                        // Back target for the post-OAuth back-button guard: the
                        // in-site page the user was on BEFORE this one (route
                        // tracker in AuthBackGuard), so Back after signing in
                        // skips Google's history entries. Patrick 2026-07-11.
                        sessionStorage.setItem('mlg-auth-back', sessionStorage.getItem('mlg-prev-path') || '/listings');
                      } catch {}
                      const redirectTo = `${window.location.origin}/auth/callback`;
                      const { data, error: oerr } = await getSupabase().auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo, skipBrowserRedirect: true },
                      });
                      if (oerr || !data?.url) {
                        setError(oerr?.message || 'Could not start Google sign-in. Make sure the redirect URL is allowlisted in Supabase.');
                        return;
                      }
                      window.location.assign(data.url);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 10, padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: 10,
                      background: '#fff', color: NAVY, fontFamily: BODY, fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', marginBottom: 10,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                    </svg>
                    Continue with Google
                  </button>

                  {/* Magic link — second option, great on mobile */}
                  <button
                    type="button"
                    onClick={() => { setMode('magic'); setError(null); setMagicSent(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 10,
                      background: '#f8fafc', color: NAVY, fontFamily: BODY, fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', marginBottom: 14,
                    }}
                  >
                    ✉️ Email me a sign-in link
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: '#e8eaee' }} />
                    <span style={{ fontSize: 11, color: SLATE, fontFamily: BODY, letterSpacing: '0.08em', textTransform: 'uppercase' }}>or use password</span>
                    <div style={{ flex: 1, height: 1, background: '#e8eaee' }} />
                  </div>
                </>
              )}

              {mode === 'magic' && (
                <div style={{ fontSize: 13, color: SLATE, marginBottom: 14, lineHeight: 1.6 }}>
                  Enter your email and we'll send you a one-tap sign-in link, no password needed.
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" required />
                    <Input label="Last name"  value={lastName}  onChange={setLastName}  autoComplete="family-name" required />
                  </div>
                  <Input label="Phone (optional)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
                  {/* Carrier-required SMS consent checkbox. Stays unchecked
                      until the user actively opts in; gated in submit handler
                      so an empty phone never forces the box. */}
                  <SmsConsentDisclosure checked={smsConsent} onChange={setSmsConsent} />
                </>
              )}

              <Input label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required />

              {mode !== 'forgot' && mode !== 'magic' && (
                <Input label="Password" value={password} onChange={setPassword} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signup' ? 8 : undefined} />
              )}

              {mode === 'signup' && (
                <Select label="What best describes you?" value={userType} onChange={setUserType} required placeholder="Select one" options={['Buyer', 'Seller', 'Buyer & Seller', 'Investor', 'Renter', 'Landlord']} />
              )}

              {/* Forgot password link — sign in mode only */}
              {mode === 'signin' && (
                <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); }}
                    style={{ background: 'none', border: 'none', color: TEAL, fontFamily: BODY, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Back to sign in — forgot mode */}
              {(mode === 'forgot' || mode === 'magic') && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setError(null); }}
                    style={{ background: 'none', border: 'none', color: SLATE, fontFamily: BODY, fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              )}

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  width: '100%', padding: '12px 16px', background: busy ? '#94a3b8' : TEAL,
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontFamily: DISPLAY, fontWeight: 700, fontSize: 14,
                  cursor: busy ? 'wait' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {busy ? '…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'magic' ? 'Send Sign-In Link' : 'Send Reset Link'}
              </button>

              {mode !== 'forgot' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ textAlign: 'center', fontSize: 11, color: SLATE }}>
                    We never sell your data.
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', autoComplete, required, minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginBottom: 4, fontFamily: BODY, letterSpacing: '0.03em' }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
          // 16px is the iOS-Safari threshold that prevents auto-zoom on
          // focus. Below 16px, focusing any input zooms the page and
          // shifts the fixed-position modal off-center (navy backdrop
          // bleeds in on one side, form content slides off the other).
          // Same fix that landed on mlg-site (commit f331dc4).
          // Patrick 2026-06-22.
          borderRadius: 8, fontSize: 16, fontFamily: BODY, color: NAVY, outline: 'none',
          boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = TEAL; }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      />
    </label>
  );
}

function Select({
  label, value, onChange, options, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginBottom: 4, fontFamily: BODY, letterSpacing: '0.03em' }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
          borderRadius: 8, fontSize: 16, fontFamily: BODY, color: value ? NAVY : SLATE, outline: 'none',
          boxSizing: 'border-box', transition: 'border-color 0.15s', background: '#fff', cursor: 'pointer',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = TEAL; }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        <option value="" disabled>{placeholder || 'Select…'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

