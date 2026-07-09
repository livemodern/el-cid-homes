import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// mapbox-gl uses browser APIs (window, WebGL) — must be client-only
const SearchPage = dynamic(() => import('./SearchPageClient'), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return (
    <div style={{
      height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Poppins', sans-serif",
      color: '#64748b', fontSize: 14, background: '#f7f8fa',
    }}>
      Loading search…
    </div>
  );
}

export const metadata = {
  title: 'Search Palm Beach County MLS | El Cid Homes',
  description: 'Search every home and condo for sale or rent across Palm Beach County, live MLS listings with map search, filters, and saved searches. Presented by Modern Living Group at Compass.',
};

export default function Page() {
  return (
    /* Unlike mlg-site, TCP's RootLayout already renders the global Header
       (fixed bar + 72px spacer) and Footer around every page, so this
       wrapper must NOT add its own (doing so stacked a second transparent
       72px spacer that exposed the dark body background as a black band).
       The search shell is simply viewport-minus-header tall with its own
       scroll container; the layout's Footer sits below the fold, keeping
       BMLS attribution reachable on a page full of MLS data. */
    <div style={{ height: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column', background: '#f7f8fa' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <Suspense fallback={<Loading />}>
          <SearchPage />
        </Suspense>
      </div>
    </div>
  );
}
