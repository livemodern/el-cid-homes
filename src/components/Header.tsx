'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AccountButton } from '@/components/AccountButton';

const NAV_LINKS = [
  { label: 'For Sale',     href: '/for-sale' },
  { label: 'Search MLS',   href: '/search' },
  { label: 'For Rent',     href: '/for-rent' },
  { label: 'Recent Sales', href: '/recent-sales' },
  { label: 'List Your Home', href: '/selling' },
];

const TEAL = '#00B2CC';
const NAVY = '#0D173B';
const INK  = '#1A1A1A';

export default function Header({ logo = '/mlg-logo-white.svg' }: { logo?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <style>{`
        /* Mothership header: white, 3-col grid, animated teal underlines */
        .tcp-hd-grid {
          /* Header spans full viewport: logo anchors to the left edge (4vw
             gutter), Schedule-a-Tour anchors to the right edge, both push
             outward as the browser widens, while the nav stays centered. */
          width: 100%; padding: 0 4vw;
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px;
        }
        .tcp-nav-links { grid-column: 2; justify-self: center; display: flex; align-items: center; gap: 26px; }
        .tcp-hd-right  { grid-column: 3; justify-self: end; display: flex; align-items: center; gap: 12px; }
        /* .tcp-nav-a and .tcp-tel share size/weight/color so the phone reads
           as part of the menu group rather than a separate right-side block. */
        .tcp-nav-a,
        .tcp-tel {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: ${INK};
          text-decoration: none; white-space: nowrap;
          line-height: 1;
          transition: color .15s ease;
        }
        .tcp-nav-a {
          position: relative; padding: 10px 0;
        }
        .tcp-nav-a::after {
          content: ''; position: absolute; left: 0; bottom: 2px;
          width: 0; height: 2px; background: ${TEAL}; border-radius: 2px;
          transition: width .2s ease;
        }
        .tcp-nav-a:hover::after { width: 100%; }
        .tcp-tel { padding: 10px 0; }
        .tcp-tel:hover { color: ${TEAL}; }
        /* Account + Schedule a Tour share pill dimensions so they read as a
           uniform pair. Account button (component) is the size anchor; .tcp-cta
           matches it. */
        .tcp-cta {
          /* Height-matched to AccountButton: 24px avatar + 6+6 padding +
             1.5+1.5 border = 39px outer. Use inline-flex + explicit height
             so the same value isn't sensitive to font/line-height drift. */
          display: inline-flex; align-items: center;
          height: 39px; padding: 0 18px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: ${TEAL}; color: ${NAVY};
          font-weight: 700; font-size: 12px; line-height: 1;
          border: 1.5px solid ${TEAL}; border-radius: 99px;
          text-decoration: none; white-space: nowrap;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .tcp-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(0,178,204,.34); }
        .tcp-ham { display: none; flex-direction: column; gap: 5px;
                   background: none; border: none; cursor: pointer; padding: 6px;
                   grid-column: 3; justify-self: end; }
        @media (max-width: 980px) {
          .tcp-nav-links { display: none !important; }
          .tcp-hd-right  { display: none !important; }
          .tcp-ham       { display: flex !important; }
        }
      `}</style>

      <header style={{
        position:     'fixed',
        top: 0, left: 0, right: 0,
        zIndex:       1000,
        height:       72,
        display:      'flex',
        alignItems:   'center',
        background:   '#ffffff',
        borderBottom: '1px solid #e8eaee',
        boxShadow:    scrolled ? '0 2px 20px rgba(0,0,0,.06)' : 'none',
        transition:   'box-shadow .3s',
      }}>
        <div className="tcp-hd-grid">

          <Link href="/" onClick={close} style={{ gridColumn: 1, justifySelf: 'start', display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="Modern Living Group"
              style={{ height: 42, width: 'auto', filter: 'brightness(0)' }}
            />
          </Link>

          <nav className="tcp-nav-links">
            {NAV_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className="tcp-nav-a">
                {label}
              </Link>
            ))}
            <a className="tcp-tel" href="tel:5612288420">(561) 228-8420</a>
          </nav>

          <div className="tcp-hd-right">
            <AccountButton siteSlug="el-cid-homes" dark={false} />
            <Link href="/contact" className="tcp-cta">Schedule a Tour</Link>
          </div>

          <button
            className="tcp-ham"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: INK, transition: 'transform .25s', transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: INK, transition: 'opacity .25s', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: INK, transition: 'transform .25s', transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        </div>

        {/* Mobile drawer */}
        <div style={{
          position:   'absolute',
          top:        72,
          left:       0,
          right:      0,
          background: '#ffffff',
          borderTop:  menuOpen ? '1px solid #e8eaee' : 'none',
          maxHeight:  menuOpen ? '640px' : '0',
          overflow:   'hidden',
          transition: 'max-height .35s ease',
          boxShadow:  menuOpen ? '0 12px 32px rgba(0,0,0,.12)' : 'none',
        }}>
          <div style={{ padding: '8px 24px 24px' }}>
            {[...NAV_LINKS, { label: 'Contact', href: '/contact' }].map(({ label, href }) => (
              <Link key={href} href={href} onClick={close}
                style={{ display: 'block', padding: '15px 0', borderBottom: '1px solid #f7f8fa', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 500, color: INK, textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}

            {/* Account in mobile drawer */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid #f7f8fa' }}>
              <AccountButton siteSlug="el-cid-homes" />
            </div>

            <Link href="/contact" onClick={close}
              style={{ display: 'block', marginTop: 20, padding: '14px 0', background: TEAL, color: NAVY, borderRadius: 99, textAlign: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
            >
              Schedule a Tour
            </Link>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f7f8fa' }}>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 10, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                Modern Living Group
              </p>
              <a href="tel:5612288420" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", color: NAVY, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'block', marginBottom: 4 }}>
                (561) 228-8420
              </a>
              <a href="mailto:info@modernlivingre.com" style={{ fontFamily: "'Poppins',sans-serif", color: TEAL, fontSize: 13, textDecoration: 'none' }}>
                info@modernlivingre.com
              </a>
            </div>
          </div>
        </div>
      </header>

      <div style={{ height: 72 }} aria-hidden="true" />
    </>
  );
}


