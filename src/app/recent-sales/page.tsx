import type { Metadata } from 'next'
import { getGridListings } from '@/lib/listings'
import RecentSalesGrid from '@/components/RecentSalesGrid'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

export const metadata: Metadata = {
  title: 'El Cid Recent Sales | Sold Home Comps, West Palm Beach',
  description:
    'Recent closed home sales in El Cid, West Palm Beach. Real sold prices, dates and price-per-sq-ft comps from BeachesMLS.',
  alternates: { canonical: '/recent-sales/' },
  openGraph: {
    title: 'El Cid Recent Sales | Sold Comps',
    description: 'Closed home sales in El Cid — real sold prices and comps.',
    url: `${SITE_URL}/recent-sales`,
    type: 'website',
  },
}

// Same multi-signal rental filter the page used client-side, run on the server
// so the grid receives only true closed *sales*. Trestle is inconsistent
// (sale_or_lease / property_type sometimes null on old closed records), so we
// check every available signal plus a price heuristic.
function isRental(l: any): boolean {
  if (l?.sale_or_lease === 'Lease') return true
  if (l?.trestle_raw?.SaleOrLeaseIndicator === 'Lease') return true
  if (l?.property_type === 'ResidentialLease') return true
  if (l?.trestle_raw?.PropertyType === 'ResidentialLease') return true
  const price = l?.close_price || l?.list_price || 0
  if (price > 0 && price < 25000) return true
  return false
}

export default async function RecentSalesPage() {
  let closed: any[] = []
  let error: string | null = null
  try {
    // include_raw so old Closed records expose CloseDate / sale-or-lease signals.
    const r = await getGridListings({ type: 'sale', includeRaw: true })
    closed = r.listings.filter(l => l.status === 'Closed' && !isRental(l))
  } catch (e: any) {
    error = e?.message || 'Failed to load sales'
  }

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'El Cid Recent Sales',
    description: 'Recent closed home sales in El Cid, West Palm Beach FL.',
    url: `${SITE_URL}/recent-sales`,
    about: {
      '@type': 'Place',
      name: 'El Cid Historic District',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'West Palm Beach',
        addressRegion: 'FL',
        postalCode: '33401',
        addressCountry: 'US',
      },
    },
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Recent Sales', item: `${SITE_URL}/recent-sales` },
    ],
  }

  return (
    <>
      <RecentSalesGrid initialListings={closed} initialError={error} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  )
}
