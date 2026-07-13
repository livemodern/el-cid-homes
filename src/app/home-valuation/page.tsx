import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'El Cid Home Valuation | What Is Your Home Worth?',
  description: 'Get a complimentary, no-obligation valuation of your El Cid home from the El Cid specialists at Modern Living Group at Compass.',
  alternates: { canonical: '/home-valuation/' },
}
const TEAL = '#00B2CC', NAVY = '#0D173B', SLATE = '#64748b', DISPLAY = "'Plus Jakarta Sans', sans-serif"
const btnTeal: any = { display: 'inline-block', background: TEAL, color: NAVY, fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, padding: '14px 28px', borderRadius: 99, textDecoration: 'none' }

export default function HomeValuationPage() {
  return (
    <main style={{ fontFamily: "'Poppins',sans-serif", color: '#323232', background: '#fff' }}>
      <section style={{ position: 'relative', minHeight: 400, overflow: 'hidden', marginTop: '-72px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', textAlign: 'center', padding: '120px 4vw 56px' }}>
        <img src="https://images.mlrecloud.com/site/el-cid-homes/el-cid-historic-homes-west-palm-beach.jpg" alt="El Cid Historic District, West Palm Beach" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 32%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,23,59,.55) 0%, rgba(13,23,59,.3) 42%, rgba(13,23,59,.85) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: TEAL, marginBottom: 12 }}>Seller Valuation</div>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 'clamp(28px,4.6vw,44px)', fontWeight: 700, color: '#fff', margin: 0, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>What is your El Cid home worth?</h1>
        <p style={{ color: 'rgba(255,255,255,.72)', maxWidth: 600, margin: '16px auto 28px', fontSize: 14.5, lineHeight: 1.85 }}>
          No portal estimate. A real, home-specific valuation from the specialists who sell in this neighborhood, based on your home&rsquo;s character, updates, and the most recent closings in El Cid.
        </p>
        <Link href="/contact/" style={btnTeal}>Request a Valuation</Link>
      </div>
      </section>
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
          {[['Real El Cid comps', 'We value your home against actual El Cid sales on comparable streets, not county averages.'], ['Pricing strategy', 'A clear recommendation with the data behind it, plus what recent buyers actually paid.'], ['No obligation', 'Whether you sell now or later, the valuation is yours to keep.']].map(([t, d]) => (
            <div key={t} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '26px 24px' }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, color: NAVY, fontSize: 16, marginBottom: 8 }}>{t}</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: SLATE, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
