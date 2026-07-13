import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import { getSiteConfig } from '@/lib/site-config';
import Footer from '@/components/Footer';
// FubPixel removed 2026-07-08 — matches mlg-site 5d849cf + TCP b15977f4.
// FUB downstream; server-side push from mlg-site 074fd0b handles view sync.
// import FubPixel from '@/components/FubPixel';
import { AuthBackGuard } from '@/components/AuthBackGuard';

// Single source of truth for the public domain + index gate. At cutover set
// NEXT_PUBLIC_SITE_URL=https://elcidhomes.com and SITE_INDEXABLE=true
// in Vercel prod and redeploy. Staging stays noindex by default.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://elcidhomes.com';
const INDEXABLE = process.env.SITE_INDEXABLE === 'true';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'El Cid Homes For Sale | Historic West Palm Beach Real Estate',
  description: 'El Cid homes for sale and rent in West Palm Beach. Historic Mediterranean Revival and Spanish-style homes on tree-lined streets along the Intracoastal, directly across from Palm Beach and minutes from downtown. Presented by Modern Living Group at Compass.',
  keywords: [
    'El Cid homes for sale',
    'El Cid West Palm Beach',
    'El Cid historic district',
    'El Cid homes for rent',
    'historic homes West Palm Beach',
    'Mediterranean Revival homes West Palm Beach',
    'El Cid waterfront homes',
    'West Palm Beach luxury homes',
  ],
  openGraph: {
    title: 'El Cid Homes | Historic West Palm Beach',
    description: 'Historic Mediterranean and Spanish-style homes on tree-lined streets along the Intracoastal, across from Palm Beach. Presented by Modern Living Group at Compass.',
    url: SITE_URL,
    siteName: 'El Cid Homes',
    locale: 'en_US',
    type: 'website',
    images: [{ url: 'https://images.mlrecloud.com/cdn-cgi/image/width=1200,height=630,fit=cover,quality=82,format=jpeg/site/el-cid-homes/el-cid-historic-homes-west-palm-beach.jpg', width: 1200, height: 630, alt: 'El Cid Historic District, West Palm Beach' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'El Cid Homes | Historic West Palm Beach',
    description: 'Historic homes for sale & rent in El Cid, West Palm Beach, along the Intracoastal across from Palm Beach.',
    images: ['https://images.mlrecloud.com/cdn-cgi/image/width=1200,height=630,fit=cover,quality=82,format=jpeg/site/el-cid-homes/el-cid-historic-homes-west-palm-beach.jpg'],
  },
  robots: {
    index: INDEXABLE,
    follow: INDEXABLE,
    googleBot: { index: INDEXABLE, follow: INDEXABLE, 'max-image-preview': 'large' },
  },
  alternates: { canonical: SITE_URL },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Place',
  name: 'El Cid Historic District',
  alternateName: 'El Cid, West Palm Beach',
  description: 'El Cid is a historic residential neighborhood in West Palm Beach, Florida, developed during the 1920s Florida land boom and listed on the National Register of Historic Places (1995). Known for its Mediterranean Revival and Mission-style homes on tree-lined streets along the Intracoastal Waterway, directly across from Palm Beach and just south of downtown. The district contains 281 historic buildings.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'West Palm Beach',
    addressRegion: 'FL',
    postalCode: '33401',
    addressCountry: 'US',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 26.6918, longitude: -80.0520 },
  url: SITE_URL,
};

const agentJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Modern Living Group at Compass',
  description: 'Luxury real-estate team specializing in El Cid historic homes and Downtown West Palm Beach real estate.',
  url: SITE_URL,
  telephone: '+15612288420',
  email: 'info@modernlivingre.com',
  areaServed: { '@type': 'Place', name: 'West Palm Beach, Florida' },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '480 Hibiscus St Suite 110',
    addressLocality: 'West Palm Beach',
    addressRegion: 'FL',
    postalCode: '33401',
    addressCountry: 'US',
  },
  parentOrganization: { '@type': 'Organization', name: 'Compass' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig().catch(() => null);
  const logo = (site as any)?.config?.brand?.logo || '/mlg-logo-white.svg';
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Favicons are declared via Next.js file convention at src/app/icon.png +
            src/app/apple-icon.png (the ML submark) — no manual link tags needed. */}
        {/* MLG native pixel — first-party event tracking to mlg-admin's
            site_events. data-site-slug tags every event with THIS site so it
            resolves per-contact + attributes traffic to El Cid.
            Cross-origin POST to modernlivingre.com/api/track (CORS allowlisted). */}
        <script async src="https://modernlivingre.com/pixel.js" data-site-slug="el-cid-homes" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,700&family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(agentJsonLd) }} />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0a' }}>
        <Header logo={logo} />
        <AuthBackGuard />
        {children}
        <Footer />
        {/* FUB Widget Tracker — REMOVED 2026-07-08. FUB downstream now;
            mlg-site 074fd0b handles server-side property view push. */}
      </body>
    </html>
  );
}
