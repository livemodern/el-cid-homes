import type { Metadata } from 'next'
import { getGridListings } from '@/lib/listings'
import { listingHref } from '@/lib/listing-slug'
import ForSaleGrid from '@/components/ForSaleGrid'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

export const metadata: Metadata = {
  title: 'El Cid Homes For Sale | West Palm Beach Historic District',
  description:
    'Active homes for sale in El Cid, West Palm Beach — historic Mediterranean and Spanish-style homes along the Intracoastal. Browse current listings, prices and photos, updated daily from BeachesMLS.',
  alternates: { canonical: '/for-sale/' },
  openGraph: {
    title: 'El Cid Homes For Sale | West Palm Beach',
    description: 'Current homes for sale in El Cid, West Palm Beach. Updated daily from BeachesMLS.',
    url: `${SITE_URL}/for-sale`,
    type: 'website',
  },
}

export default async function ForSalePage() {
  let listings: any[] = []
  let error: string | null = null
  try {
    const r = await getGridListings({ type: 'sale' })
    listings = r.listings
  } catch (e: any) {
    error = e?.message || 'Failed to load listings'
  }

  // ItemList JSON-LD for the active for-sale set — helps Google/AI surface
  // the building's available units as a structured result.
  const active = listings.filter(l => l.status === 'Active').slice(0, 30)
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'El Cid Homes For Sale',
    numberOfItems: active.length,
    itemListElement: active.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}${listingHref(l)}`,
      name: `${l.street_address || 'El Cid Home'}`,
    })),
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'For Sale', item: `${SITE_URL}/for-sale` },
    ],
  }

  return (
    <>
      <ForSaleGrid initialListings={listings} initialError={error} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  )
}
