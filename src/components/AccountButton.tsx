'use client';

import { useState } from 'react';
import { useUser } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const DISPLAY = "'Plus Jakarta Sans', sans-serif";

export function AccountButton({ siteSlug = 'el-cid-homes', dark = false }: { siteSlug?: string; dark?: boolean }) {
  const { user, loading } = useUser();
  const [authOpen, setAuthOpen] = useState(false);

  if (loading) return <div style={{ width: 72 }} />;

  if (!user) {
    const borderColor = dark ? 'rgba(255,255,255,0.7)' : TEAL;
    const textColor   = dark ? '#fff' : TEAL;
    return (
      <>
        <button
          onClick={() => setAuthOpen(true)}
          style={{
            padding: '7px 14px', borderRadius: 8,
            border: `1.5px solid ${borderColor}`, background: 'transparent',
            color: textColor, fontFamily: DISPLAY, fontWeight: 700,
            fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = dark ? 'rgba(255,255,255,0.15)' : TEAL;
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = textColor;
          }}
        >
          Sign In
        </button>
        <AuthModal open={authOpen} siteSlug={siteSlug} defaultMode="signin" onClose={() => setAuthOpen(false)} />
      </>
    );
  }

  const initial    = (user.email?.[0] ?? '?').toUpperCase();
  const pillBg     = dark ? 'rgba(255,255,255,0.12)' : '#fff';
  const pillBorder = dark ? 'rgba(255,255,255,0.3)'  : '#e2e8f0';
  const pillColor  = dark ? '#fff' : NAVY;

  return (
    <a href="/account" style={{
        display: 'flex', alignItems: 'center', gap: 7,
        textDecoration: 'none', color: pillColor,
        fontFamily: DISPLAY, fontWeight: 700, fontSize: 12,
        padding: '6px 12px 6px 6px',
        borderRadius: 20, border: `1.5px solid ${pillBorder}`,
        background: pillBg, whiteSpace: 'nowrap',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = TEAL; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = pillBorder; }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: TEAL, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, fontFamily: DISPLAY, flexShrink: 0,
      }}>
        {initial}
      </div>
      Account
    </a>
  );
}
