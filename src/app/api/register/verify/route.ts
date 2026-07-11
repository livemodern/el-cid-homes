// ── /api/register/verify (site-local proxy) ──────────────────────────
// Forwards to mlg-admin's central registration verifier (Telnyx Number
// Lookup + email MX/disposable checks + Claude verdict). FAIL-OPEN: if
// the verifier is unreachable, signup proceeds. Patrick 2026-07-11.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 25;

const ADMIN_BASE = process.env.MLG_ADMIN_BASE || 'https://team.mlrecloud.com';
const TOKEN = process.env.MLG_SERVICE_TOKEN || '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!TOKEN) return NextResponse.json({ ok: true, fieldErrors: {}, phone: null, skipped: 'no-token' });
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 18000);
    const res = await fetch(`${ADMIN_BASE}/api/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MLG-Service-Token': TOKEN },
      body: JSON.stringify({
        firstName: body.firstName,
        lastName:  body.lastName,
        email:     body.email,
        phone:     body.phone,
        siteSlug:  process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid',
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) return NextResponse.json({ ok: true, fieldErrors: {}, phone: null, skipped: `http-${res.status}` });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ ok: true, fieldErrors: {}, phone: null, skipped: 'error' });
  }
}
