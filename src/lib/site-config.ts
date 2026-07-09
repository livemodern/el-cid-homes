import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// Loads THIS mini-site's registry row (sites.config) by slug. The config
// JSONB is authored in mlg-admin → Tools → Mini-Sites and drives all of the
// homepage content, so a new building is (mostly) a config edit, not code.
const SITE_SLUG = process.env.NEXT_PUBLIC_SITE_SLUG || 'el-cid-homes'

async function loadConfig() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await sb
      .from('sites')
      .select('slug, name, domain, building_name, config')
      .eq('slug', SITE_SLUG)
      .maybeSingle()
    return data as { slug: string; name: string; domain: string | null; building_name: string | null; config: any } | null
  } catch {
    return null
  }
}

export const getSiteConfig = unstable_cache(loadConfig, ['site-config:' + SITE_SLUG], { revalidate: 300 })
