'use client';

// ─── InquireModal — property inquiry with auth gate ───────────────────
// If user is not logged in → shows sign up / sign in first, then inquiry
// If logged in → shows pre-filled inquiry form with message field
// Fires to /api/leads as a Property Inquiry → Supabase + FUB

import { useState, useEffect } from 'react';
import { useUser, getSupabase } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { getViewedListings } from '@/lib/view-tracker';
import SmsConsentDisclosure, { SMS_CONSENT_TEXT } from '@/components/SmsConsentDisclosure';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";
const BODY    = "'Poppins', sans-serif";

type InquireModalProps = {
  open: boolean;
  onClose: () => void;
  listing: {
    mls_id: string;
    street_address: string;
    city?: string;
    state?: string;
    list_price?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
  } | null;
  siteSlug?: string;
};

export function InquireModal({ open, onClose, listing, siteSlug = 'el-cid-homes' }: InquireModalProps) {
  const { user, loading: authLoading } = useUser();
  const [showAuth, setShowAuth] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsConsent, setSmsConsent] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: '',
  });

  // Pre-fill form from server-side profile (bypasses RLS reliably)
  useEffect(() => {
    if (!user || authLoading) return;
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token;
      if (!token) return;
      fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(({ profile }) => {
          if (profile) setForm(f => ({
            ...f,
            firstName: profile.firstName || f.firstName,
            lastName:  profile.lastName  || f.lastName,
            email:     profile.email     || f.email,
            phone:     profile.phone     || f.phone,
          }));
        }).catch(() => {});
    });
  }, [user?.id, authLoading]);

  // Reset on open
  useEffect(() => {
    if (open) { setStep('form'); setError(null); setShowAuth(false); setSmsConsent(false); }
  }, [open]);

  if (!open) return null;

  // Not logged in → show auth modal first
  if (!user && !authLoading && !showAuth) {
    return (
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,23,59,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, backdropFilter: 'blur(4px)' }}
      >
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: '24px 28px', color: '#fff' }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Inquire About This Property</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{listing?.street_address}</div>
          </div>
          <div style={{ padding: '28px' }}>
            <div style={{ fontSize: 14, color: NAVY, marginBottom: 20, lineHeight: 1.6 }}>
              Create a free account to send your inquiry, you'll also be able to save listings and track your searches across all Modern Living sites.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setShowAuth(true)}
                style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Sign Up / Sign In to Inquire
              </button>
              <button
                onClick={onClose}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', fontFamily: BODY, fontSize: 13, color: SLATE, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show auth modal
  if (showAuth) {
    return (
      <AuthModal
        open
        siteSlug={siteSlug}
        defaultMode="signup"
        message={`Sign up to inquire about ${listing?.street_address || 'this property'}, your account works across all Modern Living sites.`}
        onClose={(result) => {
          setShowAuth(false);
          if (result === 'cancelled') onClose();
          // If signed in, InquireModal will re-render with user and show form
        }}
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) { setError('Please include a message or question.'); return; }
    // A2P/TCPA — explicit SMS consent required when capturing a phone.
    if (form.phone && !smsConsent) {
      setError('Please check the SMS consent box if you’d like agent updates by text, or leave the phone field blank to skip.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:  form.firstName,
          lastName:   form.lastName,
          email:      form.email,
          phone:      form.phone,
          message:    form.message,
          source:     'Property Inquiry',
          mls_id:     listing?.mls_id,
          listing:    listing?.street_address,
          listPrice:  listing?.list_price,
          viewedMlsIds: getViewedListings(),
          siteSlug,
          smsConsent,
          smsConsentText: smsConsent ? SMS_CONSENT_TEXT : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setStep('done');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  const input = (label: string, key: keyof typeof form, type = 'text', required = false) => (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginBottom: 4, letterSpacing: '0.03em' }}>{label}{required ? ' *' : ''}</div>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={required}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: BODY, color: NAVY, outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.currentTarget.style.borderColor = TEAL; }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      />
    </label>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,23,59,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: BODY, backdropFilter: 'blur(4px)' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2a6b 100%)`, padding: '24px 28px', color: '#fff', position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Inquire About This Property</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{listing?.street_address}{listing?.city ? `, ${listing.city}` : ''}</div>
              {listing?.list_price && (
                <div style={{ fontSize: 14, fontWeight: 700, color: TEAL, marginTop: 4 }}>
                  ${listing.list_price.toLocaleString()}
                  {listing.beds ? ` · ${listing.beds} bd` : ''}
                  {listing.baths ? ` / ${listing.baths} ba` : ''}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '24px 28px 28px' }}>
          {step === 'done' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: NAVY, marginBottom: 8 }}>Inquiry Sent!</div>
              <div style={{ fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
                We'll get back to you shortly. Check your email for a confirmation.
              </div>
              <button onClick={onClose} style={{ marginTop: 20, background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {input('First Name', 'firstName', 'text', true)}
                <div style={{ paddingLeft: 8 }}>{input('Last Name', 'lastName')}</div>
              </div>
              {input('Email', 'email', 'email', true)}
              {input('Phone', 'phone', 'tel')}

              {/* Carrier-required SMS consent — explicit unchecked checkbox. */}
              <SmsConsentDisclosure checked={smsConsent} onChange={setSmsConsent} />

              {/* Message field */}
              <label style={{ display: 'block', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SLATE, marginBottom: 4, letterSpacing: '0.03em' }}>Your Question or Message *</div>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  required
                  rows={4}
                  placeholder="e.g. I'm interested in this property and would like more information about..."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: BODY, color: NAVY, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => { e.currentTarget.style.borderColor = TEAL; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                />
              </label>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{ width: '100%', padding: '13px', background: busy ? '#94a3b8' : TEAL, color: '#fff', border: 'none', borderRadius: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, cursor: busy ? 'wait' : 'pointer', boxShadow: busy ? 'none' : '0 4px 16px rgba(0,178,204,0.35)' }}
              >
                {busy ? '…' : 'Send Inquiry'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: SLATE, marginTop: 12 }}>
                A Modern Living Group agent will respond within 1 hour during business hours.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
