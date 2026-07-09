'use client';

/**
 * Search page router. Picks between mobile and desktop variants based on
 * viewport width, with each variant in its own dynamically-imported chunk
 * so mobile users never download the desktop's mapbox-gl bundle.
 *
 * Why split: mapbox-gl v3 requires WebGL2 which some iOS Safari versions
 * lack. A static import was crashing the entire page on mobile.
 * Separating the bundles guarantees mobile gets none of that code path.
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Loader = () => (
  <div style={{
    height: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Poppins', sans-serif",
    color: '#64748b', fontSize: 14, background: '#f8fafc',
  }}>
    Loading search…
  </div>
);

// ssr:false → these are client-only chunks. The dynamic() call ensures
// each ends up in its own JS file; the router only fetches the one it
// renders.
const SearchPageMobile  = dynamic(() => import('./SearchPageMobile'),  { ssr: false, loading: Loader });
const SearchPageDesktop = dynamic(() => import('./SearchPageDesktop'), { ssr: false, loading: Loader });

export default function SearchPageClient() {
  // null = haven't measured yet (SSR placeholder).
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile === null) return <Loader />;
  return isMobile ? <SearchPageMobile /> : <SearchPageDesktop />;
}
