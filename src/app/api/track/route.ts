import { NextRequest, NextResponse } from 'next/server';

// ─── src/app/api/track/route.ts — same-origin event sink ──────────────
//
// Writes to the SAME site_events table mlg-site and LiveModern write to,
// stamped with this site's slug so MLG Admin can segment. Same-origin on
// purpose: a cross-origin JSON POST needs a CORS preflight, and when that
// allow-list rotted it silently dropped every anonymous listing view on five
// live minis for weeks. No preflight, no allow-list, ad-blocker-proof.
//
// Best-effort by design: never block the visitor. One bad event never rejects
// the batch, and insert errors are logged rather than propagated.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SB_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG ?? 'el-cid-homes';

const ALLOWED_EVENT_TYPES = new Set([
  'pageview', 'listing_view', 'search', 'save_listing', 'cta_click',
  'scroll', 'phone_click', 'email_click', 'form_start', 'form_abandon', 'form_submit',
]);

// Generous: one engaged session legitimately fires 100+ events, and we would
// rather over-collect than under.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_IP = 600;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  return arr.length > RATE_LIMIT_PER_IP;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > 0 ? s.slice(0, 2048) : null;
}

function normalize(e: unknown, userAgent: string | null) {
  if (!e || typeof e !== 'object') return null;
  const ev = e as Record<string, unknown>;
  const event_type = str(ev.event_type);
  if (!event_type || !ALLOWED_EVENT_TYPES.has(event_type)) return null;
  return {
    event_type,
    session_id: str(ev.session_id),
    contact_id: str(ev.contact_id),
    user_id: str(ev.user_id),
    page_url: str(ev.page_url),
    page_path: str(ev.page_path),
    referrer: str(ev.referrer),
    attribution_source: str(ev.attribution_source),
    attribution_medium: str(ev.attribution_medium),
    attribution_campaign: str(ev.attribution_campaign),
    gclid: str(ev.gclid),
    fbclid: str(ev.fbclid),
    device_type: str(ev.device_type),
    user_agent: str(ev.user_agent) ?? userAgent,
    site_slug: str(ev.site_slug) || SITE_SLUG,
    data: ev.data && typeof ev.data === 'object' ? ev.data : null,
    occurred_at: typeof ev.occurred_at === 'string' ? ev.occurred_at : new Date().toISOString(),
  };
}

// Resolve an email to a contacts.id so events attach to the CRM record instead
// of floating anonymously. This is the gap pixel.js never closed — it hardcoded
// email:null, so nothing ever tied to a contact.
const contactCache = new Map<string, { id: string | null; at: number }>();
const CONTACT_TTL = 300_000;

async function contactIdForEmail(email: string | null): Promise<string | null> {
  if (!email || !SB_KEY || !SB_URL) return null;
  const key = email.toLowerCase();
  const hit = contactCache.get(key);
  if (hit && Date.now() - hit.at < CONTACT_TTL) return hit.id;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/contacts?email=eq.${encodeURIComponent(key)}&select=id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: 'no-store' },
    );
    const rows = res.ok ? ((await res.json()) as { id: string }[]) : [];
    const id = rows[0]?.id ?? null;
    contactCache.set(key, { id, at: Date.now() });
    return id;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (rateLimited(ip)) return NextResponse.json({ ok: false, dropped: true }, { status: 429 });

    const body = (await req.json().catch(() => null)) as { events?: unknown[]; email?: string } | null;
    if (!body || !Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const ua = req.headers.get('user-agent');
    const rows = body.events.slice(0, 200).map((e) => normalize(e, ua)).filter(Boolean) as Record<string, unknown>[];
    if (!rows.length) return NextResponse.json({ ok: true, count: 0 });

    const email = typeof body.email === 'string' ? body.email : null;
    if (email) {
      const cid = await contactIdForEmail(email);
      if (cid) for (const r of rows) if (!r.contact_id) r.contact_id = cid;
    }

    if (!SB_KEY || !SB_URL) return NextResponse.json({ ok: true, count: 0, note: 'no key' });

    const res = await fetch(`${SB_URL}/rest/v1/site_events`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
      cache: 'no-store',
    });
    if (!res.ok) console.error('[track] insert failed', res.status, await res.text());

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    console.error('[track] error', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
