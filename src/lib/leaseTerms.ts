// Seasonal/annual lease-term extraction for rentals.
//
// BeachesMLS carries no structured seasonal-vs-annual field and no separate
// seasonal price column — the distinction (and any dual pricing) lives only in
// the free-text PublicRemarks. ~86% of Palm Beach rentals never mention it, so
// we pre-filter cheaply and only spend a Haiku call on the ones that do.

import crypto from 'crypto';

export function remarksHash(s: string | null | undefined): string {
  return crypto.createHash('sha1').update((s || '').trim()).digest('hex');
}

// Only worth a model call if the remarks plausibly describe seasonal/annual terms.
export function leasePrefilter(remarks: string | null | undefined): boolean {
  if (!remarks) return false;
  return /season|annual|short[-\s]?term/i.test(remarks);
}

export type LeaseTerms = {
  lease_type: 'annual' | 'seasonal' | 'both' | null;
  annual_rate: number | null;
  seasonal_rate: number | null;
  off_season_rate: number | null;
  seasonal_min_months: number | null;
};

export const EMPTY_LEASE_TERMS: LeaseTerms = {
  lease_type: null, annual_rate: null, seasonal_rate: null,
  off_season_rate: null, seasonal_min_months: null,
};

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = [
  'You extract Florida residential rental lease terms from MLS public remarks.',
  'Return ONLY a JSON object — no prose, no markdown fences. Schema:',
  '{"lease_type":"annual"|"seasonal"|"both"|null,"annual_rate":number|null,"seasonal_rate":number|null,"off_season_rate":number|null,"seasonal_min_months":number|null}',
  'Rules:',
  '- All rates are MONTHLY US dollar integers. If a remark gives an annual total, divide by 12 and round.',
  '- annual_rate = monthly rent for a year-round / annual lease.',
  '- seasonal_rate = monthly rent for the high / winter season.',
  '- off_season_rate = monthly rent for the off / summer season.',
  '- seasonal_min_months = minimum months required for a seasonal lease, if explicitly stated.',
  '- lease_type "both" only when the listing clearly offers annual AND seasonal.',
  '- Use null for anything not explicitly stated. NEVER guess or infer a number that is not written.',
].join('\n');

export async function extractLeaseTerms(remarks: string, listPrice: number | null): Promise<LeaseTerms> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !remarks) return { ...EMPTY_LEASE_TERMS };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `List price (headline rate, may be annual or seasonal): ${listPrice ?? 'unknown'}\n\nRemarks:\n${remarks.slice(0, 4000)}`,
        }],
      }),
    });
    if (!res.ok) return { ...EMPTY_LEASE_TERMS };
    const data = await res.json();
    const text = (data?.content || [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return sanitizeLeaseTerms(JSON.parse(jsonStr));
  } catch {
    return { ...EMPTY_LEASE_TERMS };
  }
}

export function sanitizeLeaseTerms(p: any): LeaseTerms {
  const rate = (v: any) => {
    const n = Number(v);
    return isFinite(n) && n >= 200 && n < 1_000_000 ? Math.round(n) : null;
  };
  const lt = (p?.lease_type === 'annual' || p?.lease_type === 'seasonal' || p?.lease_type === 'both') ? p.lease_type : null;
  const mm = Number(p?.seasonal_min_months);
  return {
    lease_type: lt,
    annual_rate: rate(p?.annual_rate),
    seasonal_rate: rate(p?.seasonal_rate),
    off_season_rate: rate(p?.off_season_rate),
    seasonal_min_months: (isFinite(mm) && mm >= 1 && mm <= 12) ? Math.round(mm) : null,
  };
}
