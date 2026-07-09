import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Buying in El Cid | Historic West Palm Beach Homes',
  description: 'Buy a home in El Cid, West Palm Beach — historic Mediterranean and Spanish-style homes along the Intracoastal. Current availability, pricing, and private showings with the El Cid specialists at Modern Living Group.',
  alternates: { canonical: '/buying/' },
}
const TEAL = '#00B2CC', NAVY = '#0D173B', SLATE = '#64748b', DISPLAY = "'Plus Jakarta Sans', sans-serif"
const btnTeal: any = { display: 'inline-block', background: TEAL, color: NAVY, fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, padding: '14px 28px', borderRadius: 99, textDecoration: 'none' }
const btnOut: any = { display: 'inline-block', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,.6)', fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, padding: '12.5px 28px', borderRadius: 99, textDecoration: 'none' }

export default function BuyingPage() {
  return (
    <main style={{ fontFamily: "'Poppins',sans-serif", color: '#323232', background: '#fff' }}>
      <section style={{ position: 'relative', minHeight: 400, overflow: 'hidden', marginTop: '-72px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', textAlign: 'center', padding: '120px 4vw 56px' }}>
        <img src="https://images.mlrecloud.com/site/el-cid-homes/hero.jpg" alt="El Cid Historic District, West Palm Beach" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 32%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,23,59,.55) 0%, rgba(13,23,59,.3) 42%, rgba(13,23,59,.85) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: TEAL, marginBottom: 12 }}>Buy in El Cid</div>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 'clamp(30px,5vw,46px)', fontWeight: 700, color: '#fff', margin: 0 }}>Buying in El Cid</h1>
        <p style={{ color: 'rgba(255,255,255,.72)', maxWidth: 620, margin: '16px auto 28px', fontSize: 14.5, lineHeight: 1.85 }}>
          Historic homes on tree-lined streets along the Intracoastal, directly across from Palm Beach and minutes from downtown. Our El Cid specialists know the neighborhood&rsquo;s streets and architecture and match you to the right home.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/for-sale/" style={btnTeal}>Homes For Sale</Link>
          <Link href="/contact/" style={btnOut}>Talk to a Specialist</Link>
        </div>
      </div>
      </section>
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22 }}>
          {[['El Cid expertise', 'We track every active listing and recent sale in El Cid, so you buy with real data — not a portal guess.'], ['Private showings', 'See homes on your schedule, including off-market and coming-soon opportunities.'], ['Start to close', 'From offer strategy to inspections and financing, we manage the details end to end.']].map(([t, d]) => (
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
