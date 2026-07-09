const HERO = 'https://images.mlrecloud.com/site/el-cid-homes/hero.jpg';
const TEAL = '#00B2CC';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${HERO})`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(13,23,59,0.82) 0%, rgba(13,23,59,0.58) 45%, rgba(13,23,59,0.86) 100%)', zIndex: 1 }} />

      <section style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ letterSpacing: '0.35em', fontSize: 13, fontWeight: 500, color: TEAL, textTransform: 'uppercase', marginBottom: 22 }}>
          West Palm Beach Historic
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(46px, 9vw, 104px)', fontWeight: 700, margin: 0, lineHeight: 1.04, letterSpacing: '-0.01em' }}>
          El Cid <span style={{ fontStyle: 'italic', color: TEAL }}>Homes</span>
        </h1>
        <p style={{ maxWidth: 640, fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, lineHeight: 1.8, color: 'rgba(255,255,255,0.9)', margin: '26px 0 0' }}>
          A historic district in the heart of West Palm Beach — Spanish Revival and Mediterranean homes on tree-lined streets, lining the Flagler Drive waterfront directly across from Palm Beach.
        </p>
        <div style={{ marginTop: 42, display: 'inline-flex', alignItems: 'center', gap: 11, border: '1px solid rgba(0,178,204,0.5)', borderRadius: 999, padding: '13px 30px', fontSize: 13, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', background: 'rgba(0,178,204,0.12)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: TEAL, display: 'inline-block' }} /> Coming Soon
        </div>
      </section>

      <footer style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '26px 24px 40px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600 }}>
          Modern Living Group <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 300 }}>at Compass</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
          <a href="tel:5612288420" style={{ color: TEAL, textDecoration: 'none' }}>561.228.8420</a>
          <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>&middot;</span>
          <a href="mailto:info@modernlivingre.com" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>info@modernlivingre.com</a>
        </div>
      </footer>
    </main>
  );
}
