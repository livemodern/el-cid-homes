import type { Metadata } from 'next'

// Route-segment metadata for a client page (the page stays 'use client';
// metadata + breadcrumb schema live here so we don't refactor the page).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

export const metadata: Metadata = {
  title: 'Contact | El Cid Homes, Modern Living Group at Compass',
  description: 'Contact Patrick Lafferty and the Modern Living Group team at Compass for showings, valuations, or questions about buying or selling a home in El Cid, West Palm Beach.',
  alternates: { canonical: '/contact/' },
  openGraph: { title: 'Contact | El Cid Homes, Modern Living Group at Compass', description: 'Contact Patrick Lafferty and the Modern Living Group team at Compass for showings, valuations, or questions about buying or selling a home in El Cid, West Palm Beach.', url: `${SITE_URL}/contact`, type: 'website' },
}

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Contact', item: `${SITE_URL}/contact` },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  )
}
