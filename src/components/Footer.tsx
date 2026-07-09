'use client';
import Link from 'next/link';
import { MLG_SITE_URL } from '@/lib/mlg-site-url';

// Footer mirror of mlg-site's SiteFooter (modernlivingre.com brand
// system) — 4-col grid, navy background, fade typography (#b3bed8 body,
// #cdd6ee contact, #8e9bc2 compliance), BMLS row, brokerage attribution,
// © legal row. TCP's flavor: nav column points at building-specific
// pages instead of city pages; the Communities + About columns deep-link
// back to mlg-site (umbrella) so visitors can reach county-wide search and
// the team without leaving the brand orbit.

const TEAL = '#00B2CC';

export default function Footer() {
  return (
    <footer style={{
      background: '#0D173B',
      color: '#b3bed8',
      padding: '64px 4vw 0',
      marginTop: 0,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* ── Main 4-col grid ─── */}
      <div className="tcp-foot-cols" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
        gap: 44,
        maxWidth: 1320,
      }}>
        {/* Col 1 — Brand */}
        <div style={{ maxWidth: 320 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.mlrecloud.com/cdn-cgi/image/width=520,quality=90,format=auto/https://images.mlrecloud.com/brand/mlg-compass-white.webp"
            alt="Modern Living Group at Compass"
            style={{ height: 46, width: 'auto', display: 'block' }}
          />
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: TEAL,
            margin: '18px 0 10px',
          }}>
            El Cid Specialists
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.85, margin: 0, color: '#b3bed8' }}>
            Modern Living Group at Compass<br />
            480 Hibiscus St Suite 110<br />
            West Palm Beach, FL 33401
          </p>
          <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.85 }}>
            <a href="tel:5612288420" style={{ color: '#cdd6ee', textDecoration: 'none' }}>(561) 228-8420</a><br />
            <a href="mailto:info@modernlivingre.com" style={{ color: '#cdd6ee', textDecoration: 'none' }}>info@modernlivingre.com</a>
          </p>
          <p style={{ margin: '14px 0 0', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12.5 }}>
            <a href="https://www.instagram.com/modernlivingre/" target="_blank" rel="noopener noreferrer"
              style={{ color: TEAL, textDecoration: 'none' }}>@modernlivingre</a>
          </p>
        </div>

        {/* Col 2 — El Cid */}
        <div>
          <h5 style={col_h5}>EL CID</h5>
          <Link href="/for-sale"     style={col_a}>Homes For Sale</Link>
          <Link href="/for-rent"     style={col_a}>For Rent</Link>
          <Link href="/recent-sales" style={col_a}>Recent Sales</Link>
          <Link href="/selling"      style={col_a}>List Your Home</Link>
          <Link href="/contact"      style={col_a}>Contact</Link>
        </div>

        {/* Col 3 — Communities (back to mlg-site umbrella) */}
        <div>
          <h5 style={col_h5}>COMMUNITIES</h5>
          <a href={`${MLG_SITE_URL}/downtown-west-palm-beach`} style={col_a}>Downtown West Palm Beach</a>
          <a href={`${MLG_SITE_URL}/downtown-delray-beach`}   style={col_a}>Downtown Delray Beach</a>
          <a href={`${MLG_SITE_URL}/palm-beach-gardens`}      style={col_a}>Palm Beach Gardens</a>
          <a href={`${MLG_SITE_URL}/west-palm-beach`}         style={col_a}>West Palm Beach</a>
          <a href={`${MLG_SITE_URL}/singer-island`}           style={col_a}>Singer Island</a>
          <a href={`${MLG_SITE_URL}/jupiter`}                 style={col_a}>Jupiter</a>
          <a href={`${MLG_SITE_URL}/palm-beach`}              style={col_a}>Palm Beach Island</a>
          <a href={`${MLG_SITE_URL}/boca-raton`}              style={col_a}>Boca Raton</a>
          <a href={`${MLG_SITE_URL}/stuart`}                  style={col_a}>Stuart / Palm City</a>
        </div>

        {/* Col 4 — About MLG */}
        <div>
          <h5 style={col_h5}>ABOUT MLG</h5>
          <a href={`${MLG_SITE_URL}/about-us`}        style={col_a}>Our Company</a>
          <a href={`${MLG_SITE_URL}/agents`}          style={col_a}>Our Agents</a>
          <a href={`${MLG_SITE_URL}/why-list-with-us`} style={col_a}>Why List With Us</a>
          <a href={`${MLG_SITE_URL}/blog`}            style={col_a}>Inside Scoop</a>
          <a href={`${MLG_SITE_URL}/contact`}         style={col_a}>Contact Us</a>
        </div>
      </div>

      {/* ── BMLS compliance row ─── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        marginTop: 48,
        padding: '26px 0 30px',
        display: 'flex',
        gap: 22,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.mlrecloud.com/brand/bmls-logo.png" alt="BeachesMLS"
          style={{ height: 30, width: 'auto', background: '#fff', borderRadius: 6, padding: '5px 9px' }} />
        <p style={{ fontSize: 11, lineHeight: 1.7, color: '#8e9bc2', margin: 0, maxWidth: 880 }}>
          All listings featuring the BMLS logo are provided by BeachesMLS, Inc. This information is not verified
          for authenticity or accuracy and is not guaranteed. Copyright &copy;{new Date().getFullYear()} BeachesMLS,
          Inc. Listing information is deemed reliable but not guaranteed and should be independently verified.
          Equal Housing Opportunity.
        </p>
      </div>

      {/* ── Compass affiliation (italic muted) ─── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        marginTop: 4,
        padding: '18px 16px 14px',
        textAlign: 'center',
      }}>
        <p style={{
          margin: '0 auto', maxWidth: 680, color: '#94a3b8',
          fontSize: 11.5, lineHeight: 1.7, fontStyle: 'italic', letterSpacing: '0.01em',
        }}>
          Modern Living Group is a real estate team affiliated with Compass. Compass is a licensed real estate
          broker and abides by Equal Housing Opportunity laws.
        </p>
      </div>

      {/* ── Legal row ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        padding: '0 0 26px', maxWidth: 1320,
        fontSize: 11.5, color: '#8e9bc2',
      }}>
        <span>&copy; {new Date().getFullYear()} Modern Living Group · Compass Florida, LLC</span>
        <span>
          <a href={`${MLG_SITE_URL}/privacy-policy`} style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a> · {' '}
          <a href={`${MLG_SITE_URL}/terms`}          style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Use</a> · {' '}
          <a href={`${MLG_SITE_URL}/accessibility`}  style={{ color: 'inherit', textDecoration: 'none' }}>Accessibility</a>
        </span>
      </div>

      {/* ── Responsive — collapse 4 cols to 2 then 1 ─── */}
      <style>{`
        @media (max-width: 900px) {
          footer .tcp-foot-cols { grid-template-columns: 1fr 1fr !important; gap: 30px !important; }
          footer { padding: 48px 22px 0 !important; }
        }
        @media (max-width: 560px) {
          footer .tcp-foot-cols { grid-template-columns: 1fr !important; }
        }
        footer a:hover { color: ${TEAL} !important; }
      `}</style>
    </footer>
  );
}

// Shared inline styles for the column headings and links — keeps the JSX
// readable without dragging in a CSS module.
const col_h5: React.CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 11, letterSpacing: '2.5px', color: '#fff',
  fontWeight: 700, margin: '4px 0 16px',
};
const col_a: React.CSSProperties = {
  display: 'block', fontSize: 13, color: '#b3bed8',
  textDecoration: 'none', padding: '5px 0',
};
