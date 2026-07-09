import { NextRequest, NextResponse } from 'next/server';
import { isTrestleHost } from '@/lib/img';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const TOKEN_URL = 'https://api.cotality.com/trestle/oidc/connect/token';
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getTrestleToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) return cachedToken;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TRESTLE_CLIENT_ID!,
      client_secret: process.env.TRESTLE_CLIENT_SECRET!,
      scope: 'api',
    }),
  });
  if (!res.ok) throw new Error(`Trestle auth failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = access_token;
  tokenExpiry = now + (expires_in - 60) * 1000;
  return access_token;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  // Strict hostname allowlist, shared with lib/img.ts (the only caller
  // that builds these proxy URLs). Two old bugs here (2026-06 audit, Low):
  //   1. Non-MLS URLs got a 307 redirect — an open redirect anyone could
  //      aim anywhere (?url=https://evil.com).
  //   2. The MLS check was substring-on-the-full-URL, so
  //      https://evil.com/?x=cotality.com was fetched WITH our Trestle
  //      bearer token attached — leaking the token to arbitrary hosts.
  // Now: parse the URL, require https + an allowlisted hostname, else 400.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !isTrestleHost(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 400 });
  }

  try {
    const token = await getTrestleToken();
    const imageRes = await fetch(parsed.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!imageRes.ok) {
      return new NextResponse(`Upstream error: ${imageRes.status}`, { status: imageRes.status });
    }

    const buffer = await imageRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/jpeg',
        // Cache forever-ish at every layer. Cotality URLs include a content
        // hash, so a real photo change always produces a different URL anyway.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (err: any) {
    console.error('Image proxy error:', err?.message);
    return new NextResponse(`Proxy error: ${err?.message}`, { status: 500 });
  }
}
