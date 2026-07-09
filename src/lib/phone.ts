// ─── Phone validation — two layers ───────────────────────────────────
// 1. validatePhoneFormat — pure NANP sanity checks, safe to run on the
//    client (form-level feedback) AND mirrored server-side so it can't
//    be bypassed. Free, catches most lazy junk.
// 2. lookupPhone (SERVER ONLY) — Twilio Lookup v2: confirms the number
//    actually exists and returns the line type (mobile/landline/VoIP).
//    ~$0.008/lookup. Fails OPEN: if creds are missing or Twilio errors,
//    we never block a real lead over our own outage.

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

// ─── Layer 2: Twilio Lookup (server only — uses secret creds) ────────

export type LookupResult = {
  // true = confirmed real, false = confirmed junk, null = couldn't check
  valid: boolean | null;
  // 'mobile' | 'landline' | 'fixedVoip' | 'nonFixedVoip' | ... | null
  lineType: string | null;
};

export async function lookupPhone(e164: string): Promise<LookupResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { valid: null, lineType: null }; // not configured — skip

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`,
      {
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
        signal: ctrl.signal,
        cache: 'no-store',
      }
    );
    clearTimeout(t);
    if (!res.ok) return { valid: null, lineType: null }; // Twilio-side problem — fail open
    const d: any = await res.json();
    return {
      valid: typeof d.valid === 'boolean' ? d.valid : null,
      lineType: d.line_type_intelligence?.type ?? null,
    };
  } catch {
    return { valid: null, lineType: null }; // network/timeout — fail open
  }
}

// VoIP types worth flagging for the texting pipeline (often burners; only
// 'mobile' is a confidently textable consumer number).
export function isVoip(lineType: string | null): boolean {
  return lineType === 'nonFixedVoip' || lineType === 'fixedVoip' || lineType === 'voip';
}
