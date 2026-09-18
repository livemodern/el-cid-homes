// ─── Phone validation — two layers ───────────────────────────────────
// 1. validatePhoneFormat — pure NANP sanity checks, safe to run on the
//    client (form-level feedback) AND mirrored server-side so it can't
//    be bypassed. Free, catches most lazy junk.
// 2. lookupPhone (SERVER ONLY) — Telnyx Number Lookup: confirms the
//    number actually exists and returns the line type
//    (wireless/landline/voip). ~$0.004/lookup. Fails OPEN: if the key is
//    missing or Telnyx errors, we never block a real lead over our own
//    outage.

// ─── Layer 1: format (isomorphic) ─────────────────────────────────────

export type PhoneCheck =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: string };

export function validatePhoneFormat(raw: string): PhoneCheck {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);

  if (digits.length !== 10) {
    return { ok: false, reason: 'Please enter a 10-digit US phone number.' };
  }

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);

  // NANP: area code and exchange can't start with 0 or 1
  if (/^[01]/.test(area) || /^[01]/.test(exchange)) {
    return { ok: false, reason: "That doesn't look like a valid US phone number." };
  }
  // All-same-digit junk (5555555555, 9999999999...)
  if (/^(\d)\1{9}$/.test(digits)) {
    return { ok: false, reason: 'Please enter a real phone number.' };
  }
  // Fictional 555-01XX range
  if (exchange === '555' && digits.slice(6, 8) === '01') {
    return { ok: false, reason: 'Please enter a real phone number.' };
  }
  // Sequential runs
  if (digits === '0123456789' || digits === '1234567890' || digits === '9876543210') {
    return { ok: false, reason: 'Please enter a real phone number.' };
  }

  return { ok: true, e164: `+1${digits}`, national: digits };
}

// ─── Layer 2: Telnyx Number Lookup (server only — uses secret creds) ──
//
// GET /v2/number_lookup/{E.164}?type=carrier — carrier tier returns
// carrier + line_type (~$0.004, roughly half the legacy provider's
// price). Fails OPEN: missing key, non-404 error, or timeout returns
// unknown so we never block a real lead over our own outage.

export type LookupResult = {
  // true = confirmed in service, false = confirmed disconnected/invalid,
  // null = couldn't check
  valid: boolean | null;
  // 'wireless' | 'landline' | 'voip' | 'tollfree' | 'undetermined' | null
  lineType: string | null;
};

export async function lookupPhone(e164: string): Promise<LookupResult> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return { valid: null, lineType: null }; // not configured — skip

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://api.telnyx.com/v2/number_lookup/${encodeURIComponent(e164)}?type=carrier`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: ctrl.signal,
        cache: 'no-store',
      }
    );
    clearTimeout(t);
    // 404 on a valid E.164 = number not in service.
    if (res.status === 404) return { valid: false, lineType: null };
    if (!res.ok) return { valid: null, lineType: null }; // provider-side problem — fail open
    const d: any = await res.json();
    return {
      valid: true,
      lineType: d?.data?.carrier?.type ?? null,
    };
  } catch {
    return { valid: null, lineType: null }; // network/timeout — fail open
  }
}

// VoIP types worth flagging for the texting pipeline (often burners; only
// a real wireless line is a confidently textable consumer number).
// Case-insensitive and tolerant of every VoIP spelling we've seen.
export function isVoip(lineType: string | null): boolean {
  if (!lineType) return false;
  const l = lineType.toLowerCase().replace(/[\s_-]/g, '');
  return l === 'voip' || l === 'fixedvoip' || l === 'nonfixedvoip';
}
