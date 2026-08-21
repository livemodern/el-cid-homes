// ─── src/lib/site-tracker.ts — first-party event stream ───────────────
//
// Replaces the anonymous modernlivingre.com/pixel.js. That script fired
// pageviews with email hardcoded to null, so across the whole fleet NOT ONE
// pageview ever attached to a CRM contact — an agent could see which listings
// a lead opened but never that they read /selling ("List Your Condo") on the
// way, which is exactly the signal that says "this person is a seller."
//
// Identity lives in first-party cookies rather than memory, because the first
// pageview fires before any auth check resolves. Same-origin POST, so there's
// no CORS preflight and no allow-list to rot (that failure silently dropped
// every anonymous listing view on five live minis for weeks), and ad blockers
// don't touch it.

'use client';

const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid-homes';
const COOKIE_UID = 'mlg_uid';
const COOKIE_UEM = 'mlg_uem';
const COOKIE_ATTR = 'mlg_attr';
const SESSION_KEY = 'mlg_sid';
const SESSION_COOKIE = 'mlg_sid';
const FLUSH_MS = 4000;

export type SiteEventType =
  | 'pageview' | 'listing_view' | 'search' | 'save_listing' | 'cta_click'
  | 'scroll' | 'phone_click' | 'email_click' | 'form_start' | 'form_abandon' | 'form_submit';

type Attribution = {
  source: string | null; medium: string | null; campaign: string | null;
  gclid: string | null; fbclid: string | null;
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = [`${name}=${encodeURIComponent(value)}`, `expires=${exp}`, 'path=/', 'SameSite=Lax'].join('; ');
}
function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

// Seed identity from cookies at module load so even the first pageview is stamped.
let identity: { user_id: string | null; email: string | null } =
  typeof document === 'undefined'
    ? { user_id: null, email: null }
    : { user_id: readCookie(COOKIE_UID), email: readCookie(COOKIE_UEM) };

export function setTrackerIdentity(id: { user_id: string | null; email: string | null }): void {
  identity = { user_id: id.user_id ?? identity.user_id, email: id.email ?? identity.email };
  if (id.user_id) writeCookie(COOKIE_UID, id.user_id);
  if (id.email) writeCookie(COOKIE_UEM, id.email);
}
export function clearTrackerIdentity(): void {
  identity = { user_id: null, email: null };
  clearCookie(COOKIE_UID);
  clearCookie(COOKIE_UEM);
}
export function trackedEmail(): string | null { return identity.email; }

function writeSessionCookie(sid: string): void {
  if (typeof document === 'undefined' || !sid) return;
  try {
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(sid)}; path=/; SameSite=Lax`;
  } catch { /* cookies disabled — falls back to whatever the form sends */ }
}

function sessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2);
      window.sessionStorage.setItem(SESSION_KEY, sid);
      // Mirror to a cookie so /api/leads can read the session SERVER-side.
      // Every lead form on the site then bridges anonymous browsing to the
      // contact for free — no form has to remember to send it, and forms we
      // add later are covered automatically. Session-scoped (no expires).
      writeSessionCookie(sid);
    }
    // Re-assert on every read: a cookie can be cleared independently of
    // sessionStorage, and a missing cookie silently costs us the bridge.
    writeSessionCookie(sid);
    return sid;
  } catch { return ''; }
}
/** Handed to /api/leads so the server can back-stitch this session's earlier
 *  anonymous events onto the contact once we learn who they are. */
export function trackedSessionId(): string { return sessionId(); }

function deviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** First touch of a session wins — a later organic visit must not overwrite
 *  the paid click that actually earned the lead. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  if (readCookie(COOKIE_ATTR)) return;
  const p = new URLSearchParams(window.location.search);
  const ref = document.referrer || '';
  let source = p.get('utm_source');
  let medium = p.get('utm_medium');
  if (!source) {
    if (p.get('gclid')) { source = 'google'; medium = medium || 'cpc'; }
    else if (p.get('fbclid')) { source = 'facebook'; medium = medium || 'paid-social'; }
    else if (ref) { try { source = new URL(ref).hostname.replace(/^www\./, ''); medium = medium || 'referral'; } catch { /* bad referrer */ } }
    else { source = '(direct)'; medium = medium || '(none)'; }
  }
  const attr: Attribution = {
    source, medium: medium ?? null, campaign: p.get('utm_campaign'),
    gclid: p.get('gclid'), fbclid: p.get('fbclid'),
  };
  try { writeCookie(COOKIE_ATTR, JSON.stringify(attr)); } catch { /* cookies off */ }
}
function currentAttribution(): Attribution {
  const raw = readCookie(COOKIE_ATTR);
  if (raw) { try { return JSON.parse(raw) as Attribution; } catch { /* corrupt */ } }
  return { source: null, medium: null, campaign: null, gclid: null, fbclid: null };
}

let queue: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function flush(useBeacon = false): void {
  if (typeof window === 'undefined' || queue.length === 0) return;
  const events = queue; queue = [];
  if (timer) { clearTimeout(timer); timer = null; }
  const payload = JSON.stringify({ events, email: identity.email });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: payload, keepalive: true,
    }).catch(() => { /* never surface a tracking failure to the visitor */ });
  } catch { /* ignore */ }
}

export function fire(eventType: SiteEventType, opts: { data?: Record<string, unknown>; immediate?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  queue.push({
    event_type: eventType,
    session_id: sessionId(),
    user_id: identity.user_id,
    page_url: window.location.href,
    page_path: window.location.pathname,
    referrer: document.referrer || null,
    ...(() => { const a = currentAttribution(); return {
      attribution_source: a.source, attribution_medium: a.medium,
      attribution_campaign: a.campaign, gclid: a.gclid, fbclid: a.fbclid }; })(),
    device_type: deviceType(),
    user_agent: navigator.userAgent,
    site_slug: SITE_SLUG,
    data: opts.data ?? null,
    occurred_at: new Date().toISOString(),
  });
  if (opts.immediate) { flush(); return; }
  if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
}

/** Flush on tab hide/close so the last page of a session isn't lost. */
export function attachUnloadFlush(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => flush(true));
  return () => document.removeEventListener('visibilitychange', onHide);
}
