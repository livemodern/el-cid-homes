import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return NextResponse.json({ profile: null });

  const token = auth.slice(7);
  const sb = getServiceClient();

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return NextResponse.json({ profile: null });

  const { data: reg } = await sb
    .from('registrations')
    .select('first_name, last_name, phone, email, source_site')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      firstName: reg?.first_name || '',
      lastName:  reg?.last_name  || '',
      phone:     reg?.phone      || '',
      email:     reg?.email      || user.email || '',
      sourceSite: reg?.source_site || '',
    },
  });
}
