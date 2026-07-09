import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchTwoPlazaListings, processListing, ensureBuildingRegistry } from '@/lib/trestle';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const startedAt = Date.now();
  let listingsSynced = 0;
  const errors: string[] = [];

  try {
    await ensureBuildingRegistry();
    const rawListings = await fetchTwoPlazaListings();
    for (const raw of rawListings) {
      try {
        const listing = processListing(raw);
        const { error } = await supabase
          .from('properties')
          .upsert(listing as any, { onConflict: 'mls_id' });  // row shape is trestle-derived, wider than generated types
        if (error) throw error;
        listingsSynced++;
      } catch (err: any) {
        errors.push(`${raw.ListingKey}: ${err.message}`);
      }
    }
    await supabase.from('sync_log').insert({
      site_slug: 'el-cid-homes',
      sync_type: 'full',
      listings_synced: listingsSynced,
      errors,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false, listingsSynced: 0,
      errors: [`Sync failed: ${err.message}`],
      durationMs: Date.now() - startedAt,
    });
  }

  return NextResponse.json({
    success: true, listingsSynced, errors,
    durationMs: Date.now() - startedAt,
  });
}
