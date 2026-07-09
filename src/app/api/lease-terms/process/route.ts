import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractLeaseTerms, leasePrefilter, remarksHash } from '@/lib/leaseTerms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Statuses that actually render as available rentals — the only ones worth parsing.
const ACTIVE_STATUSES = ['Active', 'ActiveUnderContract', 'Pending', 'ComingSoon'];

// Bearer-guarded (CRON_SECRET). Backfill + incremental: processes rentals that
// have not been parsed yet AND whose remarks mention season/annual/short-term
// (the DB-level ilike bounds the cost to the ~14% that matter). Call repeatedly
// until { moreLikely:false }. Pass ?all=1 to include non-active leases.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 300);
  const all = url.searchParams.get('all') === '1';

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let q = sb.from('properties')
    .select('mls_id, list_price, description, trestle_raw')
    .eq('property_type', 'ResidentialLease')
    .is('lease_terms_parsed_at', null)
    .or('description.ilike.%season%,description.ilike.%annual%,description.ilike.%short-term%,description.ilike.%short term%')
    .limit(limit);
  if (!all) q = q.in('status', ACTIVE_STATUSES);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const startedAt = Date.now();
  let scanned = 0, parsed = 0, withType = 0;
  const errors: string[] = [];

  for (const r of (rows || []) as any[]) {
    scanned++;
    const remarks = r.description || r?.trestle_raw?.PublicRemarks || '';
    try {
      const terms = leasePrefilter(remarks)
        ? await extractLeaseTerms(remarks, r.list_price)
        : { lease_type: null, annual_rate: null, seasonal_rate: null, off_season_rate: null, seasonal_min_months: null };
      if (terms.lease_type) withType++;
      const { error: upErr } = await sb.from('properties').update({
        lease_type: terms.lease_type,
        annual_rate: terms.annual_rate,
        seasonal_rate: terms.seasonal_rate,
        off_season_rate: terms.off_season_rate,
        seasonal_min_months: terms.seasonal_min_months,
        lease_terms: { source: 'ai', model: 'claude-haiku-4-5', hash: remarksHash(remarks), ...terms },
        lease_terms_parsed_at: new Date().toISOString(),
      }).eq('mls_id', r.mls_id);
      if (upErr) throw upErr;
      parsed++;
    } catch (e: any) {
      errors.push(`${r.mls_id}: ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true, scanned, parsed, withLeaseType: withType,
    moreLikely: (rows?.length || 0) === limit,
    durationMs: Date.now() - startedAt,
    errors: errors.slice(0, 10),
  });
}
