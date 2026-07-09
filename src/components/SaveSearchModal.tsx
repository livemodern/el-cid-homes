'use client';

import { useState } from 'react';
import { IconBell, IconCheck, IconX } from './icons';
import type { LocationFilter } from './LocationSearch';
import { getSupabase } from '@/lib/auth';

const TEAL  = '#00B2CC';
const NAVY  = '#0D173B';
const SLATE = '#64748b';
const BODY  = "'Poppins', sans-serif";
const DISP  = "'Plus Jakarta Sans', sans-serif";

type Filters = {
  status: string; beds: string; baths: string;
  priceMin: string; priceMax: string; city: string;
  sqftMin: string; sqftMax: string; domMax: string; hoaMax: string;
};

type AlertFrequency = 'immediate' | 'daily' | 'weekly' | 'none';

type Props = {
  filters: Filters;
  location: LocationFilter | null;
  transaction: 'sale' | 'rent';
  contact?: { id: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
};

function summarize(filters: Filters, location: LocationFilter | null, transaction: 'sale' | 'rent'): string {
  const parts: string[] = [];
  if (location) parts.push(location.name);
  else if (filters.city !== 'Any') parts.push(filters.city);
  if (filters.beds !== 'Any') parts.push(`${filters.beds} bed`);
  if (filters.priceMin && filters.priceMax)
    parts.push(`$${Number(filters.priceMin).toLocaleString()}, $${Number(filters.priceMax).toLocaleString()}`);
  else if (filters.priceMax)
    parts.push(`Under $${Number(filters.priceMax).toLocaleString()}`);
  else if (filters.priceMin)
    parts.push(`Over $${Number(filters.priceMin).toLocaleString()}`);
  parts.push(transaction === 'rent' ? 'For Rent' : 'For Sale');
  return parts.join(' · ') || 'My Search';
}

const FREQ_OPTIONS: { value: AlertFrequency; label: string; desc: string }[] = [
  { value: 'immediate', label: 'Immediately',  desc: 'As soon as a match is found' },
  { value: 'daily',     label: 'Daily digest', desc: 'One email per day with all new matches' },
  { value: 'weekly',    label: 'Weekly digest', desc: 'One email per week with all new matches' },
  { value: 'none',      label: 'No alerts',    desc: 'Save only, no email notifications' },
];

export default function SaveSearchModal({ filters, location, transaction, onClose, onSaved }: Props) {
  const [name, setName]           = useState(summarize(filters, location, transaction));
  const [frequency, setFrequency] = useState<AlertFrequency>('daily');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Please give this search a name.'); return; }
    setSaving(true);
    setError('');
    try {
      // TCP auth is localStorage-based (storageKey 'mlg-auth') — no cookie — so the
      // saved-searches API only authenticates us via the Bearer header. (Matches
      // mlg-site / mlg-search; TCP's copy had drifted and sent no auth.)
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;
      if (!token) { setError('Please sign in to save searches.'); setSaving(false); return; }
      const res = await fetch('/api/me/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), filters, location, transaction, alert_frequency: frequency }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (res.status === 401) { setError('Please sign in to save searches.'); setSaving(false); return; }
        throw new Error(d.error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    }
    setSaving(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}><IconBell size={18} color={TEAL} /><div style={{ fontFamily: DISP, fontWeight: 800, fontSize: 17, color: NAVY }}>Save Search</div></div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: SLATE, marginTop: 2 }}>Get notified when new listings match</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SLATE, display: 'flex', alignItems: 'center' }}><IconX size={20} /></button>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {location && (
            <span style={{ background: '#e6f9fd', color: TEAL, border: '1px solid rgba(0,178,204,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, fontFamily: BODY }}>
              📍 {location.name}
            </span>
          )}
          {filters.beds !== 'Any' && (
            <span style={{ background: '#f1f5f9', color: NAVY, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontFamily: BODY }}>{filters.beds} beds</span>
          )}
          {filters.priceMax && (
            <span style={{ background: '#f1f5f9', color: NAVY, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontFamily: BODY }}>Under ${Number(filters.priceMax).toLocaleString()}</span>
          )}
          {filters.priceMin && !filters.priceMax && (
            <span style={{ background: '#f1f5f9', color: NAVY, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontFamily: BODY }}>Over ${Number(filters.priceMin).toLocaleString()}</span>
          )}
          <span style={{ background: transaction === 'rent' ? '#fef3c7' : '#f0fdf4', color: transaction === 'rent' ? '#92400e' : '#15803d', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontFamily: BODY }}>
            {transaction === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
        </div>

        {/* Name */}
        <label style={{ display: 'block', fontFamily: BODY, fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Search name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${error ? '#ef4444' : '#e2e8f0'}`,
            borderRadius: 8, padding: '10px 12px',
            fontFamily: BODY, fontSize: 14, color: NAVY, outline: 'none', marginBottom: 18,
          }}
          autoFocus
        />

        {/* Alert frequency */}
        <label style={{ display: 'block', fontFamily: BODY, fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 10 }}>Alert frequency</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {FREQ_OPTIONS.map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${frequency === opt.value ? TEAL : '#e2e8f0'}`,
              background: frequency === opt.value ? '#f0fbfd' : '#fff',
              transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="frequency"
                value={opt.value}
                checked={frequency === opt.value}
                onChange={() => setFrequency(opt.value)}
                style={{ accentColor: TEAL, width: 15, height: 15, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: NAVY }}>{opt.label}</div>
                <div style={{ fontFamily: BODY, fontSize: 11, color: SLATE }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {error && <div style={{ fontFamily: BODY, fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: SLATE, fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px 0', borderRadius: 8, border: 'none', background: saving ? SLATE : TEAL, color: '#fff', fontFamily: BODY, fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Search'}
          </button>
        </div>

        <div style={{ marginTop: 14, fontFamily: BODY, fontSize: 11, color: SLATE, textAlign: 'center' }}>
          Alerts check for new listings after every hourly MLS sync. Manage in your account.
        </div>
      </div>
    </div>
  );
}

