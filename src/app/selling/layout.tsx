import type { Metadata } from 'next'

// Route-segment metadata for a client page (page.tsx stays 'use client';
// metadata + structured data live here, mirroring /contact).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com'

export const metadata: Metadata = {
  title: 'Sell Your El Cid Home | Modern Living Group at Compass',
  description:
    'Thinking of selling your El Cid home? Get a free valuation from the team that has specialized in El Cid and downtown West Palm Beach since 2008 — real comps, not an algorithm. Backed by Compass, the #1 brokerage in America.',
  alternates: { canonical: '/selling/' },
  openGraph: {
    title: 'Sell Your El Cid Home | Modern Living Group at Compass',
    description:
      'List your El Cid home with the team buyers already call. Free, no-obligation valuation based on real El Cid comps.',
    url: `${SITE_URL}/selling`,
    type: 'website',
  },
}

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Selling', item: `${SITE_URL}/selling` },
  ],
}

const faq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How much is my El Cid home worth?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The value of an El Cid home depends on the street, lot, square footage, architectural style, level of restoration and how close it sits to the Intracoastal. Modern Living Group provides a free, no-obligation comparative market analysis based on the most recent closed sales in El Cid — request one through the form on this page and a specialist responds the same day with real numbers.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why list my El Cid home with Modern Living Group?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Modern Living Group has specialized in El Cid and downtown West Palm Beach real estate since 2008, with sales represented on both the list and buyer side inside the historic district. The team pairs that neighborhood-level knowledge with Compass, the #1 brokerage in the U.S. by sales volume, for national reach, marketing technology, and a buyer network that reaches the relocation and second-home buyers driving this market.',
      },
    },
    {
      '@type': 'Question',
      name: 'What should I know about selling a historic home in El Cid?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'El Cid is a designated historic district, so exterior changes that alter a home\u2019s appearance generally require a Certificate of Appropriateness from the City of West Palm Beach\u2019s historic preservation program (interior remodeling is not reviewed). Buyers in El Cid actively value preserved Mediterranean and Spanish-style character, so the right marketing leans into a home\u2019s history and architecture. Modern Living Group knows the local buyer pool and how to position a historic home to sell for its full value.',
      },
    },
    {
      '@type': 'Question',
      name: 'How long does it take to sell a home in El Cid?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Days on market vary with pricing, the individual home, and current El Cid inventory. El Cid is a small, tightly held historic neighborhood, so well-priced homes with strong marketing can move quickly. Pricing correctly in the first few weeks — when a listing gets the most traffic — is the single biggest factor. Modern Living Group can also pre-market your home to Compass agents through Private Exclusive and Coming Soon before it ever hits the public market.',
      },
    },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  )
}
