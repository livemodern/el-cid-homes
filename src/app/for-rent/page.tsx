import type { Metadata } from 'next'
import { getGridListings } from '@/lib/listings'
import { listingHref } from '@/lib/listing-slug'
import ForRentGrid from '@/components/ForRentGrid'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

export const metadata: Metadata = {
  title: 'El Cid Homes For Rent | West Palm Beach Historic District',
  description:
    'Homes for rent in El Cid, West Palm Beach — historic homes along the Intracoastal. Browse current rentals, prices and photos, updated daily from BeachesMLS.',
  alternates: { canonical: '/for-rent/' },
  openGraph: {
    title: 'El Cid Homes For Rent | West Palm Beach',
    description: 'Current rentals in El Cid, West Palm Beach. Updated daily from BeachesMLS.',
    url: `${SITE_URL}/for-rent`,
    type: 'website',
  },
}

export default async function ForRentPage() {
  let listings: any[] = []
  let error: string | null = null
  try {
    const r = await getGridListings({ type: 'rent' })
    listings = r.listings
  } catch (e: any) {
    error = e?.message || 'Failed to load rentals'
  }

  const available = listings.filter(l => l.status === 'Active').slice(0, 30)
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'El Cid Homes For Rent',
    numberOfItems: available.length,
    itemListElement: available.map((l, i) => ({
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
      { '@type': 'ListItem', position: 2, name: 'For Rent', item: `${SITE_URL}/for-rent` },
    ],
  }

  return (
    <>
      <ForRentGrid initialListings={listings} initialError={error} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  )
}
