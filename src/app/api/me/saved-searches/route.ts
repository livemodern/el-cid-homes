import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy init — module-scope createClient crashes builds in environments
// (e.g. Preview) where Supabase env vars aren't exposed.
let _sb: any = null;
function sb() {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _sb;
}

async function getUser(req: NextRequest) {
  const token = req.cookies.get('sb-access-token')?.value
    || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await sb().auth.getUser(token);
  return error ? null : user;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await sb()
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ searches: data });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, filters, location, transaction, alert_frequency, contact_id } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  // Resolve the CRM contact this search belongs to. When the client passes
  // contact_id explicitly, validate it. Otherwise — the common case, since the
  // building alert widget doesn't know the CRM id — resolve it from the
  // authenticated user's email so the saved search links to the contact,
  // surfaces under the assigned agent in mlg-admin, and the drip cron (gated on
  // a valid contact_id) actually fires. Without this, saved searches were
  // landing with contact_id = null: invisible to the agent and never dripped.
  let validContactId: string | null = null;
  if (contact_id) {
    const { data: c } = await sb().from('contacts').select('id').eq('id', contact_id).maybeSingle();
    if (c) validContactId = c.id;
  } else if (user.email) {
    const { data: rows } = await sb()
      .from('contacts')
      .select('id')
      .ilike('email', user.email)
      .limit(1);
    if (rows && rows[0]) validContactId = rows[0].id;
  }

  const { data, error } = await sb()
    .from('saved_searches')
    .insert({
      user_id:         user.id,
      contact_id:      validContactId,
      name:            name.trim(),
      filters:         filters || {},
      location:        location || null,
      transaction:     transaction || 'sale',
      alert_frequency: alert_frequency || 'daily',
      alert_email:     true, // boolean opt-in flag — drip emails the linked contact (contact_id), not a stored address
      site_slug:       process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid-homes',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire the welcome drip immediately, scoped to this one search. Respects
  // quiet hours inside mlg-admin's cron; outside the window it's a no-op and
  // the hourly cron catches it. Best-effort — a failed trigger never blocks
  // the save (and is a silent no-op if this site lacks the shared secret).
  if (data?.id && validContactId) {
    try {
      const secret = process.env.CRON_JOB_2 || process.env.SYNC_SECRET || process.env.CRON_SECRET;
      if (secret) {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 25_000);
        try {
          await fetch(`https://team.mlrecloud.com/api/cron/drip-saved-searches?search_id=${encodeURIComponent(data.id)}`, {
            headers: { Authorization: `Bearer ${secret}` },
            signal:  ctrl.signal,
          });
        } finally { clearTimeout(t); }
      }
    } catch { /* swallow */ }
  }

  return NextResponse.json({ search: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { error } = await sb()
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
