'use client';

// ─── LocationSearch — Compass-style typeahead search box ──────────────
// Searches buildings, communities, cities, and zips.
// Returns a filter payload that the parent wires into the search API.

import { useState, useEffect, useRef, useCallback } from 'react';

const TEAL    = '#00B2CC';
const NAVY    = '#0D173B';
const SLATE   = '#64748b';
const BODY    = "'Poppins', sans-serif";
const DISPLAY = "'Plus Jakarta Sans', sans-serif";

const TYPE_LABEL: Record<string, string> = {
  building:  'Building',
  community: 'Community',
  city:      'City',
  zip:       'ZIP Code',
};

export type LocationFilter = {
  type: 'building' | 'community' | 'city' | 'zip' | 'address';
  name: string;
  filter: Record<string, any>;
};

type Suggestion = {
  type: string;
  name: string;
  count: number;
  is_parent: boolean;
  filter: Record<string, any>;
};

type Props = {
  value: LocationFilter | null;
  onChange: (loc: LocationFilter | null) => void;
  placeholder?: string;
  transaction?: 'sale' | 'rent';
};

import { IconSearch, IconBuilding, IconCommunity, IconLocation, IconZip, IconX } from './icons';

// Map type to SVG icon component
function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const color = '#64748b';
  if (type === 'building')  return <IconBuilding size={size} color={color} />;
  if (type === 'community') return <IconCommunity size={size} color={color} />;
  if (type === 'city')      return <IconLocation size={size} color={color} />;
  if (type === 'zip')       return <IconZip size={size} color={color} />;
  return <IconLocation size={size} color={color} />;
}

export default function LocationSearch({ value, onChange, placeholder = 'Search by address, building, community, city, or ZIP...', transaction = 'sale' }: Props) {
  const [query, setQuery]         = useState('');
  const [suggestions, setSugs]    = useState<Suggestion[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [highlighted, setHL]      = useState(-1);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout>>();

  // Show selected value label in input
  const displayValue = value ? value.name : query;

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSugs([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&transaction=${transaction}`);
      const data = await res.json();
      setSugs(data.results || []);
      setOpen(true);
    } catch {
      setSugs([]);
    }
    setLoading(false);
  }, []);

  // Debounced fetch on query change
  useEffect(() => {
    if (value) return; // Don't search when something is selected
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setSugs([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, value, fetchSuggestions]);

  function selectSuggestion(s: Suggestion) {
    onChange({ type: s.type as any, name: s.name, filter: s.filter });
    setQuery('');
    setSugs([]);
    setOpen(false);
    setHL(-1);
  }

  function clear() {
    onChange(null);
    setQuery('');
    setSugs([]);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHL(h => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setHL(h => Math.max(h - 1, -1)); }
    if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); selectSuggestion(suggestions[highlighted]); }
    if (e.key === 'Escape') { setOpen(false); setHL(-1); }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#fff', border: `2px solid ${open ? TEAL : '#e2e8f0'}`,
        borderRadius: 10, padding: '0 12px', gap: 8,
        transition: 'border-color 0.15s',
        boxShadow: open ? `0 0 0 3px rgba(0,178,204,0.12)` : 'none',
      }}>
        {/* Search icon or type icon */}
        <span style={{ flexShrink: 0, color: value ? TEAL : SLATE, display: 'flex', alignItems: 'center' }}>
          {value ? <TypeIcon type={value.type} size={16} /> : <IconSearch size={16} />}
        </span>

        <input
          ref={inputRef}
          value={value ? value.name : query}
          onChange={e => { if (!value) setQuery(e.target.value); }}
          onFocus={() => { if (!value && query.length >= 2) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKey}
          placeholder={value ? '' : placeholder}
          readOnly={!!value}
          style={{
            flex: 1, border: 'none', outline: 'none',
            fontFamily: BODY, fontSize: 14, color: NAVY,
            padding: '12px 0', background: 'transparent',
            cursor: value ? 'default' : 'text',
          }}
        />

        {/* Loading spinner */}
        {loading && !value && (
          <span style={{ fontSize: 12, color: SLATE, flexShrink: 0 }}>…</span>
        )}

        {/* Clear button */}
        {value && (
          <button
            onClick={clear}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: SLATE, padding: '4px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
          ><IconX size={16} /></button>
        )}
      </div>

      {/* Selected pill */}
      {value && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#e6f9fd', color: TEAL, border: '1px solid rgba(0,178,204,0.3)',
            borderRadius: 20, padding: '3px 10px 3px 8px', fontSize: 12, fontWeight: 600, fontFamily: DISPLAY,
          }}>
            <TypeIcon type={value.type} size={12} />
            {value.name}
            <span style={{ fontSize: 10, color: SLATE, marginLeft: 2, fontWeight: 400 }}>
              {TYPE_LABEL[value.type]}
            </span>
          </span>
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SLATE, fontSize: 11, fontFamily: BODY }}>
            ✕ Clear
          </button>
        </div>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && !value && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 4,
        }}>
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}:${s.name}`}
              onMouseDown={() => selectSuggestion(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px', border: 'none', textAlign: 'left',
                background: i === highlighted ? '#f0fdf4' : '#fff',
                cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
              onMouseEnter={() => setHL(i)}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}><TypeIcon type={s.type} size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                  {s.is_parent && <span style={{ marginLeft: 4, fontSize: 10, color: TEAL, fontWeight: 600 }}>ALL</span>}
                </div>
                <div style={{ fontSize: 10, color: SLATE, fontFamily: BODY }}>
                  {TYPE_LABEL[s.type]} · {s.count.toLocaleString()} listings
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: s.type === 'building' ? '#f0fdf4' : s.type === 'city' ? '#eff6ff' : '#fafafa',
                color: s.type === 'building' ? '#16a34a' : s.type === 'city' ? '#1d4ed8' : SLATE,
                flexShrink: 0,
              }}>
                {TYPE_LABEL[s.type]}
              </span>
            </button>
          ))}
          <div style={{ padding: '6px 14px', fontSize: 10, color: SLATE, fontFamily: BODY, borderTop: '1px solid #f1f5f9' }}>
            Showing top results · Type to refine
          </div>
        </div>
      )}

      {/* No results */}
      {open && suggestions.length === 0 && query.length >= 2 && !loading && !value && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '16px 14px',
          marginTop: 4, fontSize: 13, color: SLATE, fontFamily: BODY, textAlign: 'center',
        }}>
          No results for "{query}", try a city, ZIP, or building name
        </div>
      )}
    </div>
  );
}
