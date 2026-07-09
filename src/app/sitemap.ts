import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { listingHref } from '@/lib/listing-slug'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

// Regenerate hourly so newly-synced listings appear in the sitemap.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { path: '/', freq: 'daily' as const, pri: 1.0 },
    { path: '/for-sale/', freq: 'daily' as const, pri: 0.9 },
    { path: '/for-rent/', freq: 'daily' as const, pri: 0.8 },
    { path: '/recent-sales/', freq: 'weekly' as const, pri: 0.6 },
    { path: '/selling/', freq: 'monthly' as const, pri: 0.7 },
    { path: '/buying/', freq: 'monthly' as const, pri: 0.7 },
    { path: '/home-valuation/', freq: 'monthly' as const, pri: 0.6 },
    { path: '/contact/', freq: 'monthly' as const, pri: 0.5 },
    { path: '/privacy-policy/', freq: 'yearly' as const, pri: 0.2 },
    { path: '/terms-and-conditions/', freq: 'yearly' as const, pri: 0.2 },
  ].map(p => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: new Date(),
    changeFrequency: p.freq,
    priority: p.pri,
  }))

  let listingPages: MetadataRoute.Sitemap = []
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await sb.from('properties')
      .select('mls_id,street_address,city,state,zip,updated_at,status')
      .eq('community_slug', 'el-cid-west-palm-beach')
      .eq('dup_suppressed', false)
      .in('status', ['Active', 'ComingSoon', 'Pending'])
      .limit(300)
    listingPages = ((data as any[]) || []).map(l => ({
      url: `${SITE_URL}${listingHref(l)}`,
      lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch {
    // If the listing query fails, still return the static pages.
  }

  return [...staticPages, ...listingPages]
}
