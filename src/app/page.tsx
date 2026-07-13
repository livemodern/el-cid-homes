import { getGridListings } from '@/lib/listings'
import { getSiteConfig } from '@/lib/site-config'
import HomeContent from '@/components/HomeContent'

// SSR the config-driven content (featured units + avg price + CMS config) so
// it's in the initial HTML for crawlers. Homepage metadata + JSON-LD live in
// layout.tsx.
export const revalidate = 3600

function computeAvgPrice(listings: any[]): string {
  const prices = listings
    .map(l => (l.status === 'Closed' ? (l.close_price || l.list_price) : l.list_price))
    .filter((p: number) => p && p >= 50000)
  if (!prices.length) return '$650K'
  const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
  return avg >= 1_000_000 ? '$' + (avg / 1_000_000).toFixed(1) + 'M' : '$' + Math.round(avg / 1000) + 'K'
}

// Active listings on the market right now — drives the __forsale__ stat token.
function computeForSale(listings: any[]): number {
  return listings.filter(l => l.status === 'Active').length
}

function computeFeatured(listings: any[]): any[] {
  const active = listings.filter(l => l.status === 'Active' && (l.image_urls?.length || 0) > 0)
  const sorted = [...active].sort((a: any, b: any) => {
    const aC = (a.list_office_name || '').toLowerCase().includes('compass') ? 1 : 0
    const bC = (b.list_office_name || '').toLowerCase().includes('compass') ? 1 : 0
    if (bC !== aC) return bC - aC
    const aP = a.image_urls?.length || 0, bP = b.image_urls?.length || 0
    if (bP !== aP) return bP - aP
    return (b.list_price || 0) - (a.list_price || 0)
  })
  return sorted.slice(0, 6)
}

export default async function HomePage() {
  const [site, listingsRes] = await Promise.all([
    getSiteConfig().catch(() => null),
    getGridListings({ type: 'sale' }).catch(() => ({ listings: [] as any[] })),
  ])
  const listings = listingsRes.listings || []
  const cfg = (site as any)?.config || {}
  const faqs: any[] = Array.isArray(cfg?.sections?.faqs) ? cfg.sections.faqs : []
  const stripHtml = (h: string) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const faqLd = faqs.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f: any) => ({
      '@type': 'Question',
      name: stripHtml(f.q),
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.a) },
    })),
  } : null
  return (
    <>
    {faqLd && (
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    )}
    <HomeContent
      cfg={cfg}
      avgPrice={computeAvgPrice(listings)}
      forSaleCount={computeForSale(listings)}
      featured={computeFeatured(listings)}
    />
    </>
  )
}
